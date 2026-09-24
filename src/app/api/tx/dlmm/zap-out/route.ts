import { PublicKey } from "@solana/web3.js";
import { DLMM_INITIAL_POSITION_WIDTH, DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import { DLMM_MAX_EXIT_BINS_PER_TX, nextBinChunk } from "@/lib/dlmm-wide";
import type { BuiltTransaction } from "@/lib/types";
import { getStrategyPda } from "@/server/pda";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost } from "@/server/route";
import { assemble, refreshUnsignedBatch } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmZapOutIxs } from "@/server/tx/dlmm";
import { dlmmZapOutBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";
import { closeStrategyIx } from "@/server/tx/vault";

export const POST = handlePost(dlmmZapOutBody, async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const position = new PublicKey(b.position);
  const account = await getProgram().account.positionV2.fetch(position);
  if (!account.owner.equals(ctx.key))
    throw new ApiError(403, "Denied", "position does not belong to this vault");
  const width = account.upperBinId - account.lowerBinId + 1;
  if (width < 1 || width > DLMM_MAX_POSITION_WIDTH)
    throw new ApiError(400, "Validation", "position must span 1 to 1400 bins");
  const cursorBinId = b.cursorBinId ?? account.lowerBinId;
  if (cursorBinId < account.lowerBinId || cursorBinId > account.upperBinId)
    throw new ApiError(400, "Validation", "cursor must be inside the position");
  const config = await readConfig();
  const slippageBps = Math.min(b.slippageBps, config.maxSlippageBps);
  if (width > DLMM_INITIAL_POSITION_WIDTH || b.cursorBinId !== undefined) {
    const built: BuiltTransaction[] = [];
    let lowerBinId = cursorBinId;
    let jupiterStrategyInitialized = false;
    while (lowerBinId <= account.upperBinId) {
      let maxBins = DLMM_MAX_EXIT_BINS_PER_TX;
      while (true) {
        const range = nextBinChunk(lowerBinId, account.upperBinId, maxBins);
        const attemptedBins = range.upperBinId - range.lowerBinId + 1;
        const { ixs, lookupTables, initializesStrategy } = await dlmmZapOutIxs(
          getProgram(), ctx, authority, position, new PublicKey(config.treasuryAuthority), slippageBps,
          range, jupiterStrategyInitialized,
        );
        if (fitsInTransaction(authority, ixs, lookupTables)) {
          try {
            const transaction = await assemble(authority, ixs, {
              lookupTables,
              // A preceding range creates the Jupiter strategy. Relay preflight checks dependent ranges.
              deferSimulation: jupiterStrategyInitialized,
            });
            built.push({ ...transaction, sendConcurrently: !initializesStrategy });
            jupiterStrategyInitialized ||= initializesStrategy;
            lowerBinId = range.upperBinId + 1;
            break;
          } catch (error) {
            const computeExceeded = error instanceof ApiError && error.code === "SimulationFailed" &&
              /ComputationalBudgetExceeded|computational budget exceeded|exceeded.*compute units/i.test(
                [error.message, ...(error.logs ?? [])].join("\n"),
              );
            if (!computeExceeded || attemptedBins === 1) throw error;
          }
        } else if (attemptedBins === 1) {
          throw new ApiError(422, "TransactionTooLarge", "A single-bin zap out does not fit in a Solana transaction");
        }
        maxBins = Math.max(1, Math.floor(attemptedBins / 2));
      }
    }
    const closeIx = await closeStrategyIx(getProgram(), ctx, authority, getStrategyPda(ctx.key, position));
    built.push(await assemble(authority, [closeIx], { deferSimulation: true }));
    // Quotes and simulations for a large position can take time. Start the whole batch's
    // blockhash lifetime together, immediately before handing it to the wallet.
    return refreshUnsignedBatch(built);
  }

  const { ixs, lookupTables } = await dlmmZapOutIxs(
    getProgram(),
    ctx,
    authority,
    position,
    new PublicKey(config.treasuryAuthority),
    slippageBps,
  );
  if (!fitsInTransaction(authority, ixs, lookupTables))
    throw new ApiError(422, "TransactionTooLarge", "Atomic zap out does not fit in a Solana transaction");
  return assemble(authority, ixs, { lookupTables });
});
