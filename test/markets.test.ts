import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // uncharted in these fixtures
const JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const POOL = "BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y";

vi.mock("@/server/tokens", () => ({
  getTokenInfo: async (mint: { toBase58(): string }) => ({ symbol: mint.toBase58() === SOL ? "SOL" : "JUP" }),
}));
vi.mock("@/server/tx/dlmm", () => ({
  readPoolInfo: async () => ({ tokenX: { mint: SOL, symbol: "SOL" }, tokenY: { mint: USDC, symbol: "USDC" } }),
}));

import { clearCache } from "@/server/cache";
import { getOhlcv, pairCandles } from "@/server/markets";

const candle = (time: number, price: number) => ({ time, open: price, high: price + 1, low: price - 1, close: price, volume: 10 });

/** Jupiter's charts endpoint: SOL at 100/102, JUP at 2, nothing for USDC (priced at $1 by /price/v3). */
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clearCache();
  fetchMock = vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/price/v3")) return new Response(JSON.stringify({ [USDC]: { usdPrice: 1 } }));
    const mint = u.pathname.split("/").at(-1);
    const to = Number(u.searchParams.get("to")) / 1000;
    const candles =
      mint === SOL
        ? [candle(7200, 102), candle(3600, 100), candle(3600, 100)].filter((c) => c.time < to)
        : mint === JUP
          ? [candle(3600, 2), candle(7200, 2)]
          : [];
    return new Response(JSON.stringify({ candles }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("getOhlcv", () => {
  it("charts a mint in USD from Jupiter, ascending and de-duplicated", async () => {
    const view = await getOhlcv({ mint: SOL }, "1h");
    expect(view).toMatchObject({ name: "SOL / USD", quote: "usd" });
    expect(view.candles.map((c) => [c.time, c.close])).toEqual([[3600, 100], [7200, 102]]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.host).toBe("datapi.jup.ag");
    expect(url.searchParams.get("interval")).toBe("1_HOUR");
    expect(fetchMock.mock.calls[0][1].headers["user-agent"]).toBeTruthy();
  });

  it("pages back with `to` in milliseconds", async () => {
    const view = await getOhlcv({ mint: SOL }, "15m", 7200);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("to")).toBe("7200000");
    expect(view.candles.map((c) => c.time)).toEqual([3600]);
  });

  it("404s a mint without history on the first page", async () => {
    await expect(getOhlcv({ mint: USDC }, "1h")).rejects.toMatchObject({ status: 404 });
  });

  it("prices a pool in its quote token, using the live price when the quote has no history", async () => {
    const view = await getOhlcv({ pool: POOL, base: SOL }, "1h");
    expect(view).toMatchObject({ name: "SOL / USDC", quote: "USDC" });
    expect(view.candles.map((c) => c.close)).toEqual([100, 102]);

    const flipped = await getOhlcv({ pool: POOL, base: USDC }, "1h");
    expect(flipped).toMatchObject({ name: "USDC / SOL", quote: "SOL" });
    expect(flipped.candles.map((c) => c.close)).toEqual([1 / 100, 1 / 102]);
  });

  it("keeps the flat quote when paging a pool back", async () => {
    const view = await getOhlcv({ pool: POOL, base: SOL }, "1h", 7200);
    expect(view.candles.map((c) => c.close)).toEqual([100]);
  });
});

describe("pairCandles", () => {
  it("divides matching candles and keeps the wicks outside open/close", () => {
    const [c] = pairCandles([candle(1, 10)], [{ ...candle(1, 2), high: 2.5, low: 1.5 }]);
    expect(c).toMatchObject({ time: 1, open: 5, close: 5, volume: 10 });
    expect(c.high).toBeGreaterThanOrEqual(5);
    expect(c.low).toBeLessThanOrEqual(5);
    expect(pairCandles([candle(1, 10)], [candle(2, 2)])).toEqual([]);
  });
});
