import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmClosePositionIx } from "@/server/tx/dlmm";

export const POST = handlePost(z.object({ payer: pubkey, vault: pubkey, position: pubkey }), async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const config = await readConfig();
  const ixs = await dlmmClosePositionIx(
    getProgram(),
    ctx,
    authority,
    new PublicKey(b.position),
    new PublicKey(config.treasuryAuthority),
  );
  return assemble(authority, ixs);
});
