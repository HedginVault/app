import { describe, expect, it } from "vitest";
import { CHART_RANGES, changeSince, mergeCandles, rangeStart } from "@/lib/chart-ranges";
import { TIMEFRAMES } from "@/server/markets";

const candle = (time: number, close: number, open = close) => ({ time, open, high: close, low: close, close, volume: 0 });

describe("mergeCandles", () => {
  it("sorts, de-duplicates and lets the newer page win", () => {
    const merged = mergeCandles([candle(3, 30), candle(1, 10), candle(2, 20)], [candle(3, 31), candle(4, 40)]);
    expect(merged.map((c) => [c.time, c.close])).toEqual([[1, 10], [2, 20], [3, 31], [4, 40]]);
  });
});

describe("rangeStart", () => {
  it("measures back from the newest candle, and 0 for the whole history", () => {
    expect(rangeStart("1W", 1_000_000)).toBe(1_000_000 - 7 * 86_400);
    expect(rangeStart("ALL", 1_000_000)).toBe(0);
  });

  it("only uses intervals the server serves", () => {
    for (const r of CHART_RANGES) expect(TIMEFRAMES).toHaveProperty(r.tf);
  });
});

describe("changeSince", () => {
  const candles = [candle(100, 10, 10), candle(200, 12, 11), candle(300, 15, 14)];
  it("runs from the first open inside the window to the newest close", () => {
    expect(changeSince(candles, 150)).toBeCloseTo(((15 - 11) / 11) * 100);
    expect(changeSince(candles, 0)).toBeCloseTo(50);
  });
  it("is null without two candles in the window", () => {
    expect(changeSince(candles, 250)).toBeNull();
    expect(changeSince([], 0)).toBeNull();
  });
});
