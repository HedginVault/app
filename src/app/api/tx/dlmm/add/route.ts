import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmAddLiquidityIx } from "@/server/tx/dlmm";
import { dlmmAddBody } from "@/server/tx/schemas";

export const POST = handlePost(
  dlmmAddBody,
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
