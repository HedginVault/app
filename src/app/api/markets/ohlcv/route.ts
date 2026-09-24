import { ApiError } from "@/server/errors";
import type { MarketTimeframe } from "@/lib/types";
import { getOhlcv, TIMEFRAMES } from "@/server/markets";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { handleGet, pubkey } from "@/server/route";

export const GET = handleGet(async (_p, search, req) => {
  if (req) rateLimit(`markets:${clientIp(req)}`);
  const tf = (search.get("tf") ?? "1h") as MarketTimeframe;
  if (!(tf in TIMEFRAMES)) throw new ApiError(400, "Validation", `tf must be one of ${Object.keys(TIMEFRAMES).join(", ")}`);
  const before = search.get("before");
  const beforeTs = before === null ? undefined : Number(before);
  if (beforeTs !== undefined && !(Number.isInteger(beforeTs) && beforeTs > 0))
    throw new ApiError(400, "Validation", "before must be a unix timestamp in seconds");
  const perp = search.get("perp");
  if (perp !== null) {
    if (!/^[A-Za-z0-9]{1,16}$/.test(perp)) throw new ApiError(400, "Validation", "perp must be a market symbol");
    return getOhlcv({ perp }, tf, beforeTs);
  }
  const mint = search.get("mint");
  const pool = search.get("pool");
  const address = pubkey.safeParse(mint ?? pool ?? "");
  const base = search.get("base");
  if (base !== null && !pubkey.safeParse(base).success) throw new ApiError(400, "Validation", "base must be a public key");
  if (!address.success) throw new ApiError(400, "Validation", "mint or pool must be a public key");
  return getOhlcv(mint ? { mint: address.data } : { pool: address.data, base: base ?? undefined }, tf, beforeTs);
});
