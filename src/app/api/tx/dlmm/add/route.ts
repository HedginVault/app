import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { amountString, handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmAddLiquidityIx } from "@/server/tx/dlmm";

export const POST = handlePost(
  z.object({
    payer: pubkey,
    vault: pubkey,
    position: pubkey,
    amountX: amountString,
    amountY: amountString,
    shape: z.enum(["spot", "curve", "bidAsk"]),
    maxActiveBinSlippage: z.number().int().min(0).max(1000),
  }),
  async (b) => {
    const authority = new PublicKey(b.payer);
    const ctx = await loadVaultCtx(b.vault);
    assertAuthority(ctx, authority);
    const ixs = await dlmmAddLiquidityIx(
      getProgram(),
      ctx,
      authority,
      new PublicKey(b.position),
      new BN(b.amountX),
      new BN(b.amountY),
      b.shape,
      b.maxActiveBinSlippage,
    );
    return assemble(authority, ixs);
  },
);
