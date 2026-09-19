import type { Candle, MarketTimeframe } from "./types";

export const TIMEFRAME_OPTIONS: { id: MarketTimeframe; label: string }[] = [
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
];

/** Daily and weekly candles open at midnight UTC, so the axis shows dates only. */
export const isIntraday = (tf: MarketTimeframe) => tf !== "1d" && tf !== "1w";

export type ChartRangeId = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

const DAY = 86_400;

/**
 * Lookback presets, TradingView-style: each pins a window and the candle size that fills it with
 * roughly 90–365 bars. `seconds: null` is the token's whole history.
 */
export const CHART_RANGES: { id: ChartRangeId; label: string; seconds: number | null; tf: MarketTimeframe }[] = [
  // Labelled in hours/days so they never read as the 1D / 1W candle intervals next to them.
  { id: "1D", label: "24H", seconds: DAY, tf: "5m" },
  { id: "1W", label: "7D", seconds: 7 * DAY, tf: "1h" },
  { id: "1M", label: "1M", seconds: 30 * DAY, tf: "4h" },
  { id: "3M", label: "3M", seconds: 90 * DAY, tf: "1d" },
  { id: "1Y", label: "1Y", seconds: 365 * DAY, tf: "1d" },
  { id: "ALL", label: "All", seconds: null, tf: "1w" },
];

export const DEFAULT_RANGE: ChartRangeId = "1M";

export const chartRange = (id: ChartRangeId) => CHART_RANGES.find((r) => r.id === id)!;

/** Unix seconds the preset's window starts at, measured back from the newest candle; 0 for the whole history. */
export function rangeStart(id: ChartRangeId, newest: number): number {
  const { seconds } = chartRange(id);
  return seconds === null ? 0 : newest - seconds;
}

/** Ascending and de-duplicated by time; on a clash `newer` wins, so a refreshed live candle replaces its old copy. */
export function mergeCandles(older: Candle[], newer: Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const c of older) byTime.set(c.time, c);
  for (const c of newer) byTime.set(c.time, c);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Percent change from the first candle at or after `from` to the newest close; null without two points. */
export function changeSince(candles: Candle[], from: number): number | null {
  const start = candles.find((c) => c.time >= from);
  const last = candles.at(-1);
  if (!start || !last || start === last || !start.open) return null;
  return ((last.close - start.open) / start.open) * 100;
}
