import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { getStrategyPda } from "@/server/pda";
import { getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmClosePositionIx } from "@/server/tx/dlmm";
import { closeStrategyIx } from "@/server/tx/vault";

export const POST = handlePost(z.object({ payer: pubkey, vault: pubkey, position: pubkey }), async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const program = getProgram();
  const position = new PublicKey(b.position);
  const account = await program.account.positionV2.fetch(position);
  if (account.upperBinId - account.lowerBinId + 1 > DLMM_INITIAL_POSITION_WIDTH) {
    // Wide positions are unwound in range transactions first. The program rejects this close
    // unless every bin is empty and all fees have been claimed.
    return assemble(authority, [await closeStrategyIx(program, ctx, authority, getStrategyPda(ctx.key, position))]);
  }
  const config = await readConfig();
  const ixs = await dlmmClosePositionIx(
    program,
    ctx,
    authority,
    position,
    new PublicKey(config.treasuryAuthority),
  );
  return assemble(authority, ixs);
});
