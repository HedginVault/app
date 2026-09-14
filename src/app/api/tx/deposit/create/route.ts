import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { amountString, handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { loadVaultCtx } from "@/server/tx/context";
import { depositCreateIx } from "@/server/tx/requests";

export const POST = handlePost(
  z.object({ payer: pubkey, vault: pubkey, amount: amountString }),
  async ({ payer, vault, amount }) => {
    const ctx = await loadVaultCtx(vault);
    const ix = await depositCreateIx(getProgram(), ctx, new PublicKey(payer), new BN(amount));
    return assemble(new PublicKey(payer), [ix]);
  },
);
