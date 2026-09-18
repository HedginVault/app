import { PublicKey } from "@solana/web3.js";
import { cached } from "./cache";
import type { Candle, ChartTarget, MarketTimeframe, OhlcvView } from "@/lib/types";
import { ApiError } from "./errors";
import { getPrices } from "./prices";
import { getTokenInfo } from "./tokens";
import { readPoolInfo } from "./tx/dlmm";

// Jupiter's public price history (the same source as core-engine's `jupiter-prices/charts`). A different host
// from the lite/pro API: no key, but Cloudflare 403s requests without a browser-like User-Agent.
const DATAPI = "https://datapi.jup.ag";
const CANDLES = 300;
const META_TTL_MS = 60 * 60_000;
const CANDLES_TTL_MS = 60_000;

export const TIMEFRAMES: Record<MarketTimeframe, string> = {
  "15m": "15_MINUTE",
  "1h": "1_HOUR",
  "4h": "4_HOUR",
  "1d": "1_DAY",
};

type Num = number | string;
interface RawCandle {
  time: Num;
  open: Num;
  high: Num;
  low: Num;
  close: Num;
  volume?: Num;
}

/**
 * USD candles for `mint`, ascending and de-duplicated, only before `before` (unix seconds) when paging back.
 * Empty when Jupiter has no history for the mint.
 */
const usdCandles = (mint: string, tf: MarketTimeframe, before?: number) =>
  cached(`jup:chart:${mint}:${tf}:${before ?? ""}`, CANDLES_TTL_MS, async (): Promise<Candle[]> => {
    const to = before ? before * 1000 : Date.now();
    const res = await fetch(
      `${DATAPI}/v2/charts/${mint}?interval=${TIMEFRAMES[tf]}&to=${to}&candles=${CANDLES}&type=price&quote=usd`,
      { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } },
    );
    if (!res.ok) throw new ApiError(502, "Upstream", `Jupiter charts ${res.status}`);
    const body = (await res.json()) as { candles?: RawCandle[]; data?: { candles?: RawCandle[] } };
    return (body.candles ?? body.data?.candles ?? [])
      .map((c) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume ?? 0),
      }))
      .filter((c) => c.close > 0 && (!before || c.time < before))
      .sort((a, b) => a.time - b.time)
      .filter((c, i, all) => i === 0 || c.time !== all[i - 1].time);
  });

/** A token's USD candles, or a flat series at its live price when Jupiter has no history for it. */
async function usdSeries(mint: string, tf: MarketTimeframe, before?: number): Promise<Candle[] | number | null> {
  const candles = await usdCandles(mint, tf, before);
  // Paging back past the start of a real history is the end of the chart, not a missing series.
  if (candles.length || (before && (await usdCandles(mint, tf)).length)) return candles;
  return (await getPrices([mint])).get(mint) ?? null;
}

const at = (s: Candle[] | number, time: number): Candle | undefined =>
  typeof s === "number" ? { time, open: s, high: s, low: s, close: s, volume: 0 } : s.find((c) => c.time === time);

/**
 * `base` priced in `quote`, from the two USD series. Open and close are exact ratios; each token's high and low
 * can land at different moments, so the wicks are approximated by the ratio of highs and ratio of lows.
 */
export function pairCandles(base: Candle[] | number, quote: Candle[] | number): Candle[] {
  const times = typeof base !== "number" ? base : typeof quote !== "number" ? quote : [];
  return times.flatMap(({ time }) => {
    const b = at(base, time);
    const q = at(quote, time);
    if (!b || !q) return [];
    const open = b.open / q.open;
    const close = b.close / q.close;
    return [
      {
        time,
        open,
        close,
        high: Math.max(open, close, b.high / q.high),
        low: Math.min(open, close, b.low / q.low),
        // Jupiter reports each token's USD volume across all venues, not the pool's.
        volume: b.volume,
      },
    ];
  });
}

const symbolOf = (mint: string) =>
  cached(`chart:symbol:${mint}`, META_TTL_MS, async () => (await getTokenInfo(new PublicKey(mint))).symbol);

const pairOf = (pool: string) =>
  cached(`chart:pool:${pool}`, META_TTL_MS, async () => {
    const { tokenX, tokenY } = await readPoolInfo(pool);
    return { x: { mint: tokenX.mint, symbol: tokenX.symbol }, y: { mint: tokenY.mint, symbol: tokenY.symbol } };
  });

/**
 * Candles for a token (USD) or for a pool (priced in its quote token, which matches how DLMM quotes a pair).
 * Both come from Jupiter's per-token USD history; a pool's candles are the ratio of its two tokens.
 */
export async function getOhlcv(
  target: ChartTarget,
  tf: MarketTimeframe,
  /** Unix seconds: only candles before this, for scrolling back in history. */
  before?: number,
): Promise<OhlcvView> {
  if ("mint" in target) {
    const [symbol, candles] = await Promise.all([symbolOf(target.mint), usdCandles(target.mint, tf, before)]);
    if (!candles.length && !before) throw new ApiError(404, "NotFound", "No price history for this token");
    return { name: `${symbol} / USD`, quote: "usd", candles };
  }

  const { x, y } = await pairOf(target.pool);
  // `base` pins the priced token so candles share units with DLMM bin prices (token Y per token X).
  const [base, quote] = target.base === y.mint ? [y, x] : [x, y];
  const [b, q] = await Promise.all([usdSeries(base.mint, tf, before), usdSeries(quote.mint, tf, before)]);
  if (b === null || q === null) throw new ApiError(404, "NotFound", "No price history for this pool");
  const candles = pairCandles(b, q);
  if (!candles.length && !before) throw new ApiError(404, "NotFound", "No price history for this pool");
  return { name: `${base.symbol} / ${quote.symbol}`, quote: quote.symbol, candles };
}
