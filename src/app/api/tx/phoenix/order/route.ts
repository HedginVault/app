import { PublicKey } from "@solana/web3.js";
import { getProgram } from "@/server/program";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { loadMarkTicks, loadPhoenixExchange, phoenixOrderIx, resolvePhoenixMarket, toOrderParams } from "@/server/tx/phoenix";
import { phoenixOrderBody } from "@/server/tx/schemas";

export const POST = handlePost(phoenixOrderBody, async ({ payer, vault, symbol, side, size, reduceOnly, order }) => {
  const authority = new PublicKey(payer);
  const ctx = await loadVaultCtx(vault);
  assertAuthority(ctx, authority);
  const [ex, market] = await Promise.all([loadPhoenixExchange(), resolvePhoenixMarket(symbol)]);
  const markTicks = order.type === "market" ? await loadMarkTicks(ex, market.assetId) : 0n;
  const params = toOrderParams(
    order.type === "market"
      ? { side, size, reduceOnly, type: "market", slippageBps: order.slippageBps }
      : { side, size, reduceOnly, type: "limit", price: order.price, postOnly: order.postOnly },
    market,
    markTicks,
    BigInt(Date.now()),
  );
  return assemble(authority, [await phoenixOrderIx(getProgram(), ctx, authority, ex, new PublicKey(market.marketPubkey), params)]);
});
