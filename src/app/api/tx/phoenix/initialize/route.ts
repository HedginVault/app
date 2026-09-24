import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { loadPhoenixExchange, phoenixInitializeIx } from "@/server/tx/phoenix";
import { phoenixVaultBody } from "@/server/tx/schemas";

export const POST = handlePost(phoenixVaultBody, async ({ payer, vault }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  const ex = await loadPhoenixExchange();
  return assemble(authority, [await phoenixInitializeIx(getProgram(), ctx, authority, ex)]);
});
