import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { loadPhoenixExchange, phoenixEmberWithdrawIx } from "@/server/tx/phoenix";
import { phoenixVaultBody } from "@/server/tx/schemas";

/** Unwraps canonical tokens a queued Phoenix withdrawal delivered into USDC. */
export const POST = handlePost(phoenixVaultBody, async ({ payer, vault }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  const ex = await loadPhoenixExchange();
  return assemble(authority, [await phoenixEmberWithdrawIx(getProgram(), ctx, authority, ex)]);
});
