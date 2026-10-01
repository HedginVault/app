import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { DLMM_MAX_EXIT_BINS_PER_TX } from "@/lib/dlmm-wide";
import type { BuiltTransaction } from "@/lib/types";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmClaimFeeIx } from "@/server/tx/dlmm";
import { pairStrategySetupIxs, readPairMints } from "@/server/tx/pair-strategy";
import { fitsInTransaction } from "@/server/tx/size";

export const POST = handlePost(z.object({ payer: pubkey, vault: pubkey, position: pubkey, cursorBinId: z.number().int().optional() }), async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const config = await readConfig();
  const position = new PublicKey(b.position);
  const program = getProgram();
  const account = await program.account.positionV2.fetch(position);
  if (!account.owner.equals(ctx.key)) throw new ApiError(403, "Denied", "position does not belong to this vault");
  // a position opened before pair strategies were enforced needs them before fees can be claimed
  const setup = await pairStrategySetupIxs(program, ctx, authority, await readPairMints(program, account.lbPair));
  if (b.cursorBinId === undefined && account.upperBinId - account.lowerBinId + 1 <= DLMM_INITIAL_POSITION_WIDTH)
    return assemble(authority, [
      ...setup,
      ...(await dlmmClaimFeeIx(program, ctx, authority, position, new PublicKey(config.treasuryAuthority))),
    ]);
  let lowerBinId = b.cursorBinId ?? account.lowerBinId;
  if (lowerBinId < account.lowerBinId || lowerBinId > account.upperBinId)
    throw new ApiError(400, "Validation", "cursor must be inside the position");
  const built: BuiltTransaction[] = setup.length ? [await assemble(authority, setup)] : [];
  while (lowerBinId <= account.upperBinId) {
    let chunkSize = DLMM_MAX_EXIT_BINS_PER_TX;
    while (chunkSize >= 1) {
      const upperBinId = Math.min(account.upperBinId, lowerBinId + chunkSize - 1);
      const ixs = await dlmmClaimFeeIx(
        program, ctx, authority, position, new PublicKey(config.treasuryAuthority), { lowerBinId, upperBinId },
      );
      if (!fitsInTransaction(authority, ixs)) {
        if (chunkSize === 1) throw new ApiError(400, "Validation", "one bin does not fit in a transaction for this pool");
        chunkSize = Math.max(1, Math.floor(chunkSize / 2));
        continue;
      }
      built.push({ ...(await assemble(authority, ixs, { deferSimulation: setup.length > 0 })), sendConcurrently: true });
      lowerBinId = upperBinId + 1;
      break;
    }
  }
  return built;
});
