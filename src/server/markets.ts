import { cached } from "./cache";
import type { MarketTimeframe, OhlcvView } from "@/lib/types";
import { ApiError } from "./errors";

const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
// GeckoTerminal's free tier allows ~30 calls/min per server, so everything is memoized.
const POOL_TTL_MS = 60 * 60_000;
const CANDLES_TTL_MS = 60_000;

export const TIMEFRAMES: Record<MarketTimeframe, { unit: "minute" | "hour" | "day"; aggregate: number }> = {
  "15m": { unit: "minute", aggregate: 15 },
  "1h": { unit: "hour", aggregate: 1 },
  "4h": { unit: "hour", aggregate: 4 },
  "1d": { unit: "day", aggregate: 1 },
};

async function gt<T>(path: string): Promise<T> {
  const res = await fetch(`${GT}${path}`, { headers: { accept: "application/json;version=20230302" } });
  if (res.status === 404) throw new ApiError(404, "NotFound", "No market data for this token or pool");
  if (!res.ok) throw new ApiError(502, "Upstream", `GeckoTerminal ${res.status}`);
  return (await res.json()) as T;
}

interface PoolRow {
  attributes: { address: string; name: string };
}

/** Most liquid pool for `mint` (GeckoTerminal sorts by liquidity). */
const topPool = (mint: string) =>
  cached(`gt:pool:${mint}`, POOL_TTL_MS, async () => {
    const body = await gt<{ data: PoolRow[] }>(`/tokens/${mint}/pools?page=1`);
    const pool = body.data[0];
    if (!pool) throw new ApiError(404, "NotFound", "No market for this token");
    return pool.attributes;
  });

interface OhlcvBody {
  data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } };
  meta?: { base?: { symbol: string }; quote?: { symbol: string } };
}

/**
 * Candles for a token (USD, via its most liquid pool) or for a specific pool (priced in its quote token,
 * which matches how DLMM quotes a pair).
 */
export async function getOhlcv(
  target: { mint: string } | { pool: string },
  tf: MarketTimeframe,
  /** Unix seconds: only candles before this, for scrolling back in history. */
  before?: number,
): Promise<OhlcvView> {
  const { unit, aggregate } = TIMEFRAMES[tf];
  const byMint = "mint" in target;
  const pool = byMint ? await topPool(target.mint) : { address: target.pool, name: "" };
  const query = byMint ? `currency=usd&token=${target.mint}` : "currency=token&token=base";
  const page = before ? `&before_timestamp=${before}` : "";
  return cached(`gt:ohlcv:${pool.address}:${query}:${tf}:${before ?? ""}`, CANDLES_TTL_MS, async () => {
    const body = await gt<OhlcvBody>(`/pools/${pool.address}/ohlcv/${unit}?aggregate=${aggregate}&limit=300&${query}${page}`);
    const base = body.meta?.base?.symbol;
    const quote = body.meta?.quote?.symbol;
    return {
      pool: pool.address,
      name: pool.name || (base && quote ? `${base} / ${quote}` : ""),
      quote: byMint ? "usd" : (quote ?? ""),
      // Newest-first upstream; the chart wants ascending, de-duplicated times.
      candles: body.data.attributes.ohlcv_list
        .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
        .sort((a, b) => a.time - b.time)
        .filter((c, i, all) => i === 0 || c.time !== all[i - 1].time),
    };
  });
}
