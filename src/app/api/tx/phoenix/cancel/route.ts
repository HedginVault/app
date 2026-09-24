import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { loadPhoenixExchange, phoenixCancelIx, resolvePhoenixMarket } from "@/server/tx/phoenix";
import { phoenixCancelBody } from "@/server/tx/schemas";

export const POST = handlePost(phoenixCancelBody, async ({ payer, vault, symbol, orders }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  const [ex, market] = await Promise.all([loadPhoenixExchange(), resolvePhoenixMarket(symbol)]);
  return assemble(authority, [await phoenixCancelIx(getProgram(), ctx, authority, ex, new PublicKey(market.marketPubkey), orders)]);
});
