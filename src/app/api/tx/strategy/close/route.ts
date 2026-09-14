import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { closeStrategyIx } from "@/server/tx/vault";

export const POST = handlePost(
  z.object({ payer: pubkey, vault: pubkey, strategy: pubkey }),
  async ({ payer, vault, strategy }) => {
    const authority = new PublicKey(payer);
    const ctx = await loadVaultCtx(vault);
    assertAuthority(ctx, authority);
    return assemble(authority, [await closeStrategyIx(getProgram(), ctx, authority, new PublicKey(strategy))]);
  },
);
