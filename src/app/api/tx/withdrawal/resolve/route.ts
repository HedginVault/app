import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { loadVaultCtx } from "@/server/tx/context";
import { withdrawalResolveIx } from "@/server/tx/requests";

export const POST = handlePost(
  z.object({ payer: pubkey, vault: pubkey, withdrawer: pubkey }),
  async ({ payer, vault, withdrawer }) => {
    const ctx = await loadVaultCtx(vault);
    const ix = await withdrawalResolveIx(getProgram(), ctx, new PublicKey(payer), new PublicKey(withdrawer));
    return assemble(new PublicKey(payer), [ix]);
  },
);
