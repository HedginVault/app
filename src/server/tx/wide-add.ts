import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import type { z } from "zod";
import { DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import { amountForBinChunk, DLMM_MAX_ADD_BINS_PER_TX, nextBinChunk } from "@/lib/dlmm-wide";
import type { BuiltTransaction, DlmmShape } from "@/lib/types";
import { getActiveBinIds, getPool } from "@/server/dlmm-pool";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmAddLiquidityForRangeIx, missingBinArrayIxs } from "@/server/tx/dlmm";
import { dlmmWideAddBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";

const smallerChunk = (bins: number) => bins > 70 ? 70 : Math.max(1, Math.floor(bins / 2));

/** Only a proven compute-limit failure permits retrying with fewer bins. Other failures surface. */
const isComputeLimitError = (error: unknown) =>
  error instanceof ApiError && error.code === "SimulationFailed" &&
  /ComputationalBudgetExceeded|computational budget exceeded|exceeded.*compute units/i.test(
    [error.message, ...(error.logs ?? [])].join("\n"),
  );

const instructionKey = (ix: TransactionInstruction) => [
  ix.programId.toBase58(),
  Buffer.from(ix.data).toString("base64"),
  ...ix.keys.map((key) => `${key.pubkey.toBase58()}:${Number(key.isSigner)}:${Number(key.isWritable)}`),
].join("|");

interface WideAddPlan {
  authority: PublicKey;
  ctx: Awaited<ReturnType<typeof loadVaultCtx>>;
  position: PublicKey;
  program: ReturnType<typeof getProgram>;
  dlmm: Awaited<ReturnType<typeof getPool>>;
  lowerBinId: number;
  upperBinId: number;
  cursorBinId: number;
  activeBinId: number;
  amountXBaseUnits: bigint;
  amountYBaseUnits: bigint;
  shape: DlmmShape;
  maxActiveBinSlippage: number;
  /** The position is created by an earlier transaction in the same wallet-approved batch. */
  deferFirstSimulation?: boolean;
}

/** Builds every funding transaction up front so a compatible wallet can approve the batch once. */
export async function buildWideAddPlan(plan: WideAddPlan): Promise<BuiltTransaction[]> {
  const built: BuiltTransaction[] = [];
  const plannedBinArrayInstructions = new Set<string>();
  let cursorBinId = plan.cursorBinId;
  while (cursorBinId <= plan.upperBinId) {
    let maxBins = DLMM_MAX_ADD_BINS_PER_TX;
    while (maxBins >= 1) {
      const chunk = nextBinChunk(cursorBinId, plan.upperBinId, maxBins);
      const attemptedBins = chunk.upperBinId - chunk.lowerBinId + 1;
      const allocation = amountForBinChunk(
        plan.lowerBinId, plan.upperBinId, plan.activeBinId,
        chunk.lowerBinId, chunk.upperBinId, plan.shape, plan.amountXBaseUnits, plan.amountYBaseUnits,
      );
      if (allocation.amountXBaseUnits === 0n && allocation.amountYBaseUnits === 0n) {
        cursorBinId = chunk.upperBinId + 1;
        break;
      }
      const candidateBinArrays = await missingBinArrayIxs(
        plan.dlmm, chunk.lowerBinId, chunk.upperBinId, plan.authority,
      );
      const binArrays = candidateBinArrays.filter((ix) => !plannedBinArrayInstructions.has(instructionKey(ix)));
      const add = await dlmmAddLiquidityForRangeIx(
        plan.program, plan.ctx, plan.authority, plan.position, plan.dlmm, chunk.lowerBinId, chunk.upperBinId,
        new BN(allocation.amountXBaseUnits.toString()), new BN(allocation.amountYBaseUnits.toString()),
        plan.shape, plan.maxActiveBinSlippage,
      );
      const ixs = [...binArrays, ...add];
      if (!fitsInTransaction(plan.authority, ixs)) {
        if (attemptedBins === 1) throw new ApiError(400, "Validation", "one bin does not fit in a transaction for this pool");
        maxBins = smallerChunk(attemptedBins);
        continue;
      }
      try {
        built.push(await assemble(plan.authority, ixs, {
          deferSimulation: !!plan.deferFirstSimulation || built.length > 0,
        }));
        for (const ix of binArrays) plannedBinArrayInstructions.add(instructionKey(ix));
        cursorBinId = chunk.upperBinId + 1;
        break;
      } catch (error) {
        if (!isComputeLimitError(error) || attemptedBins === 1) throw error;
        maxBins = smallerChunk(attemptedBins);
      }
    }
  }
  if (built.length === 0) throw new ApiError(400, "Validation", "no liquidity remains for the selected bins");
  return built;
}

export async function buildWideAdd(b: z.infer<typeof dlmmWideAddBody>) {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const position = new PublicKey(b.position);
  const program = getProgram();
  const account = await program.account.positionV2.fetch(position);
  if (!account.owner.equals(ctx.key)) throw new ApiError(403, "Denied", "position does not belong to this vault");
  if (b.targetUpperBinId !== account.upperBinId || b.cursorBinId < account.lowerBinId || b.cursorBinId > account.upperBinId ||
    account.upperBinId - account.lowerBinId + 1 > DLMM_MAX_POSITION_WIDTH)
    throw new ApiError(400, "Validation", "position range changed; refresh before adding liquidity");

  const amountXBaseUnits = BigInt(b.amountX);
  const amountYBaseUnits = BigInt(b.amountY);
  if (amountXBaseUnits === 0n && amountYBaseUnits === 0n)
    throw new ApiError(400, "Validation", "amountX or amountY must be greater than zero");
  const dlmm = await getPool(account.lbPair);
  const liveActiveBinId = (await getActiveBinIds([dlmm])).get(account.lbPair.toBase58()) ?? dlmm.lbPair.activeId;
  if (Math.abs(liveActiveBinId - b.activeBinId) > b.maxActiveBinSlippage)
    throw new ApiError(409, "Stale", "pool price moved during the wide position flow; refresh before adding more liquidity");
  return buildWideAddPlan({
    authority,
    ctx,
    position,
    program,
    dlmm,
    lowerBinId: account.lowerBinId,
    upperBinId: account.upperBinId,
    cursorBinId: b.cursorBinId,
    activeBinId: b.activeBinId,
    amountXBaseUnits,
    amountYBaseUnits,
    shape: b.shape,
    maxActiveBinSlippage: b.maxActiveBinSlippage,
  });
}
