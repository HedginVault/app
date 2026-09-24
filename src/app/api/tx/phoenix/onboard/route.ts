import { PublicKey } from "@solana/web3.js";
import { ApiError } from "@/server/errors";
import { getPhoenixTraderAddress, isTraderReady } from "@/server/phoenix";
import { getConnection } from "@/server/program";
import { handlePost } from "@/server/route";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { buildPhoenixOnboardTx } from "@/server/tx/phoenix";
import { phoenixVaultBody } from "@/server/tx/schemas";

/** Phoenix's onboarding transaction for the vault's trader; the manager signs it only as fee payer. */
export const POST = handlePost(phoenixVaultBody, async ({ payer, vault }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  const trader = await getConnection().getAccountInfo(getPhoenixTraderAddress(ctx.key));
  if (trader && isTraderReady(trader)) throw new ApiError(409, "PhoenixAlreadyOnboarded", "The vault's Phoenix trader is already onboarded");
  return buildPhoenixOnboardTx(ctx.key, authority);
});
