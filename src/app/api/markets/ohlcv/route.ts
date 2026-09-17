import { ApiError } from "@/server/errors";
import type { MarketTimeframe } from "@/lib/types";
import { getOhlcv, TIMEFRAMES } from "@/server/markets";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { handleGet, pubkey } from "@/server/route";

export const GET = handleGet(async (_p, search, req) => {
  if (req) rateLimit(`markets:${clientIp(req)}`);
  const tf = (search.get("tf") ?? "1h") as MarketTimeframe;
  if (!(tf in TIMEFRAMES)) throw new ApiError(400, "Validation", `tf must be one of ${Object.keys(TIMEFRAMES).join(", ")}`);
  const mint = search.get("mint");
  const pool = search.get("pool");
  const address = pubkey.safeParse(mint ?? pool ?? "");
  if (!address.success) throw new ApiError(400, "Validation", "mint or pool must be a public key");
  const before = search.get("before");
  const beforeTs = before === null ? undefined : Number(before);
  if (beforeTs !== undefined && !(Number.isInteger(beforeTs) && beforeTs > 0))
    throw new ApiError(400, "Validation", "before must be a unix timestamp in seconds");
  return getOhlcv(mint ? { mint: address.data } : { pool: address.data }, tf, beforeTs);
});
