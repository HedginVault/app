import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { amountString, handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { loadVaultCtx } from "@/server/tx/context";
import { withdrawalCreateIx } from "@/server/tx/requests";

export const POST = handlePost(
  z.object({ payer: pubkey, vault: pubkey, shares: amountString }),
  async ({ payer, vault, shares }) => {
    const ctx = await loadVaultCtx(vault);
    const ix = await withdrawalCreateIx(getProgram(), ctx, new PublicKey(payer), new BN(shares));
    return assemble(new PublicKey(payer), [ix]);
  },
);
