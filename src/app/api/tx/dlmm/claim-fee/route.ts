import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { DLMM_MAX_ADD_BINS_PER_TX } from "@/lib/dlmm-wide";
import { ApiError } from "@/server/errors";
import { getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmClaimFeeIx } from "@/server/tx/dlmm";
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
  if (b.cursorBinId === undefined && account.upperBinId - account.lowerBinId + 1 <= DLMM_INITIAL_POSITION_WIDTH)
    return assemble(authority, await dlmmClaimFeeIx(program, ctx, authority, position, new PublicKey(config.treasuryAuthority)));
  const lowerBinId = b.cursorBinId ?? account.lowerBinId;
  if (lowerBinId < account.lowerBinId || lowerBinId > account.upperBinId)
    throw new ApiError(400, "Validation", "cursor must be inside the position");
  let chunkSize = DLMM_MAX_ADD_BINS_PER_TX;
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
    const built = await assemble(authority, ixs);
    return upperBinId < account.upperBinId
      ? { ...built, next: { path: "dlmm/claim-fee", body: { vault: b.vault, position: b.position, cursorBinId: upperBinId + 1 } } }
      : built;
  }
  throw new ApiError(400, "Validation", "invalid position range");
});
