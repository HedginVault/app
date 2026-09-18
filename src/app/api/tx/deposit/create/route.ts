import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getConnection, getProgram } from "@/server/program";
import { decodeTokenAmount } from "@/server/rpc";
import { amountString, handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { loadVaultCtx } from "@/server/tx/context";
import { depositCreateIx } from "@/server/tx/requests";
import { isNativeMint, wrapSolIxs, wsolAta } from "@/server/wsol";

export const POST = handlePost(
  z.object({ payer: pubkey, vault: pubkey, amount: amountString }),
  async ({ payer, vault, amount }) => {
    const ctx = await loadVaultCtx(vault);
    const depositor = new PublicKey(payer);
    // A SOL vault takes wSOL; wrap whatever native SOL the wallet's wSOL ATA is short by in the same tx.
    const wrap = isNativeMint(ctx.depositMint)
      ? wrapSolIxs(depositor, BigInt(amount), decodeTokenAmount(await getConnection().getAccountInfo(wsolAta(depositor))))
      : [];
    const ix = await depositCreateIx(getProgram(), ctx, depositor, new BN(amount));
    return assemble(depositor, [...wrap, ix]);
  },
);
