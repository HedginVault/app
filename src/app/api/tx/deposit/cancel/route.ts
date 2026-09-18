import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { loadVaultCtx } from "@/server/tx/context";
import { depositCancelIx } from "@/server/tx/requests";

export const POST = handlePost(z.object({ payer: pubkey, vault: pubkey }), async ({ payer, vault }) => {
  const ctx = await loadVaultCtx(vault);
  const ix = await depositCancelIx(getProgram(), ctx, new PublicKey(payer));
  return assemble(new PublicKey(payer), [ix]);
});
