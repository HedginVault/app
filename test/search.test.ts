import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/server/cache";
import { ApiError } from "@/server/errors";
import { searchPools, searchTokens } from "@/server/search";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const jupToken = (id: string, over: Record<string, unknown> = {}) => ({
  id, symbol: id === SOL ? "SOL" : "USDC", name: "n", icon: `https://x/${id}.png`, decimals: id === SOL ? 9 : 6,
  usdPrice: 100, liquidity: 5_000_000, isVerified: true, organicScore: 98.4, organicScoreLabel: "high", ...over,
});

const meteoraPool = (over: Record<string, unknown> = {}) => ({
  address: "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
  name: "SOL-USDC",
  token_x: { address: SOL, symbol: "SOL", decimals: 9, is_verified: true },
  token_y: { address: USDC, symbol: "USDC", decimals: 6, is_verified: true },
  pool_config: { bin_step: 4, base_fee_pct: 0.04 },
  tvl: 4_700_000,
  current_price: 100.9,
  volume: { "24h": 41_000_000 },
  fees: { "24h": 16_000 },
  fee_tvl_ratio: { "24h": 0.34 },
  is_blacklisted: false,
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clearCache();
  fetchMock = vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/tokens/v2/search")) {
      const q = u.searchParams.get("query")!;
      if (q === "boom") return new Response("nope", { status: 500 });
      const ids = q.includes(",") ? q.split(",") : [SOL, USDC];
      return new Response(
        JSON.stringify(ids.map((id) => jupToken(id, id === USDC ? { isVerified: false, usdPrice: null, organicScore: undefined, organicScoreLabel: "bogus" } : {}))),
      );
    }
    if (u.pathname === "/pools") {
      return new Response(
        JSON.stringify({ total: 2, pages: 1, current_page: 1, page_size: 20, data: [meteoraPool(), meteoraPool({ address: "bad", is_blacklisted: true })] }),
      );
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("searchTokens", () => {
  it("maps Jupiter results and caches per trimmed query", async () => {
    const r = await searchTokens(" SOL ");
    expect(r[0]).toEqual({ mint: SOL, symbol: "SOL", name: "n", decimals: 9, logo: `https://x/${SOL}.png`, priceUsd: 100, verified: true, liquidityUsd: 5_000_000, organicScore: 98.4, organicScoreLabel: "high" });
    expect(r[1]).toMatchObject({ mint: USDC, verified: false, priceUsd: null, organicScore: null, organicScoreLabel: null });
    await searchTokens("SOL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the query to Jupiter in its original case (mint addresses are case-sensitive)", async () => {
    await searchTokens(SOL);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(new URL(url).searchParams.get("query")).toBe(SOL);
  });

  it("reports an upstream failure as 502 SearchUnavailable", async () => {
    await expect(searchTokens("boom")).rejects.toMatchObject({ status: 502, code: "SearchUnavailable" });
    await expect(searchTokens("boom")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("searchPools", () => {
  it("maps Meteora pools, drops blacklisted ones and attaches logos", async () => {
    const page = await searchPools("SOL-USDC", 1);
    expect(page).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(page.pools).toHaveLength(1);
    expect(page.pools[0]).toEqual({
      address: "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
      name: "SOL-USDC",
      tokenX: { mint: SOL, symbol: "SOL", decimals: 9, verified: true, logo: `https://x/${SOL}.png` },
      tokenY: { mint: USDC, symbol: "USDC", decimals: 6, verified: true, logo: `https://x/${USDC}.png` },
      binStep: 4,
      baseFeePct: 0.04,
      tvl: 4_700_000,
      volume24h: 41_000_000,
      fees24h: 16_000,
      feeTvl24h: 0.34,
      currentPrice: 100.9,
    });
  });
});
