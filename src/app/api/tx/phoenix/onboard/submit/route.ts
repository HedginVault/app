import { PublicKey } from "@solana/web3.js";
import { handlePost } from "@/server/route";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { submitPhoenixOnboardTx } from "@/server/tx/phoenix";
import { phoenixOnboardSubmitBody } from "@/server/tx/schemas";

/** Hands the manager-signed onboarding transaction to Phoenix, which co-signs and sends it. */
export const POST = handlePost(phoenixOnboardSubmitBody, async ({ payer, vault, transaction }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  return submitPhoenixOnboardTx(transaction, ctx.key, authority);
});
