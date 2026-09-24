import { PublicKey } from "@solana/web3.js";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmZapOutIxs } from "@/server/tx/dlmm";
import { dlmmZapOutBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";

export const POST = handlePost(dlmmZapOutBody, async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const position = new PublicKey(b.position);
  const account = await getProgram().account.positionV2.fetch(position);
  if (account.upperBinId - account.lowerBinId + 1 > DLMM_INITIAL_POSITION_WIDTH)
    throw new ApiError(400, "Validation", "wide positions must be removed and claimed in ranges before closing");
  const config = await readConfig();
  const slippageBps = Math.min(b.slippageBps, config.maxSlippageBps);
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
