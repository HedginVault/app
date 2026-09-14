import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { dlmmRemoveLiquidityIx } from "@/server/tx/dlmm";

export const POST = handlePost(
  z.object({ payer: pubkey, vault: pubkey, position: pubkey, bpsToRemove: z.number().int().min(1).max(10_000) }),
  async (b) => {
    const authority = new PublicKey(b.payer);
    const ctx = await loadVaultCtx(b.vault);
    assertAuthority(ctx, authority);
    const ixs = await dlmmRemoveLiquidityIx(getProgram(), ctx, authority, new PublicKey(b.position), b.bpsToRemove);
    return assemble(authority, ixs);
  },
);
