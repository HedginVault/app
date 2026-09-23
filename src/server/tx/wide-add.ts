import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { z } from "zod";
import { DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import { amountForBinChunk, DLMM_MAX_ADD_BINS_PER_TX, nextBinChunk } from "@/lib/dlmm-wide";
import { getActiveBinIds, getPool } from "@/server/dlmm-pool";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmAddLiquidityForRangeIx, missingBinArrayIxs } from "@/server/tx/dlmm";
import { wideStepBody } from "@/server/tx/next-steps";
import { dlmmWideAddBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";

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
  let cursorBinId = b.cursorBinId;
  while (cursorBinId <= account.upperBinId) {
    let maxBins = DLMM_MAX_ADD_BINS_PER_TX;
    while (maxBins >= 1) {
      const chunk = nextBinChunk(cursorBinId, account.upperBinId, maxBins);
      const allocation = amountForBinChunk(
        account.lowerBinId, account.upperBinId, b.activeBinId,
        chunk.lowerBinId, chunk.upperBinId, b.shape, amountXBaseUnits, amountYBaseUnits,
      );
      if (allocation.amountXBaseUnits === 0n && allocation.amountYBaseUnits === 0n) {
        cursorBinId = chunk.upperBinId + 1;
        break;
      }
      const binArrays = await missingBinArrayIxs(dlmm, chunk.lowerBinId, chunk.upperBinId, authority);
      const add = await dlmmAddLiquidityForRangeIx(
        program, ctx, authority, position, dlmm, chunk.lowerBinId, chunk.upperBinId,
        new BN(allocation.amountXBaseUnits.toString()), new BN(allocation.amountYBaseUnits.toString()),
        b.shape, b.maxActiveBinSlippage,
      );
      const ixs = [...binArrays, ...add];
      if (!fitsInTransaction(authority, ixs)) {
        if (maxBins === 1) throw new ApiError(400, "Validation", "one bin does not fit in a transaction for this pool");
        maxBins = Math.max(1, Math.floor(maxBins / 2));
        continue;
      }
      const nextCursorBinId = chunk.upperBinId + 1;
      const remaining = nextCursorBinId <= account.upperBinId
        ? amountForBinChunk(
            account.lowerBinId, account.upperBinId, b.activeBinId,
            nextCursorBinId, account.upperBinId, b.shape, amountXBaseUnits, amountYBaseUnits,
          )
        : { amountXBaseUnits: 0n, amountYBaseUnits: 0n };
      return {
        ...(await assemble(authority, ixs)),
        ...(remaining.amountXBaseUnits > 0n || remaining.amountYBaseUnits > 0n
          ? { next: { path: "dlmm/add-range", body: { ...wideStepBody(b), cursorBinId: nextCursorBinId } } }
          : {}),
      };
    }
  }
  throw new ApiError(400, "Validation", "no liquidity remains for the selected bins");
}
