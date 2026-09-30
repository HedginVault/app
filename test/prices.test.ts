import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/server/cache";
import { getPrices, rawUsdPrice } from "@/server/prices";

const mint = (i: number) => `M${i.toString().padStart(43, "0")}`;

describe("getPrices", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("chunks ids at 50, dedupes, caches, and omits unpriced mints", async () => {
    clearCache();
    const fetchMock = vi.fn(async (url: string) => {
      const ids = new URL(url).searchParams.get("ids")!.split(",");
      const body: Record<string, { usdPrice: number } | null> = {};
      ids.forEach((id, i) => (body[id] = i === 0 ? null : { usdPrice: 1.5 }));
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const ids = Array.from({ length: 120 }, (_, i) => mint(i));
    const prices = await getPrices([...ids, ids[0]]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(prices.get(ids[1])).toBe(1.5);
    expect(prices.has(ids[0])).toBe(false);

    await getPrices(ids.slice(0, 10));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns an empty map when Jupiter is unreachable", async () => {
    clearCache();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fetch failed"); }));
    expect((await getPrices([mint(1)])).size).toBe(0);
  });

  it("falls back to the lite host when the Jupiter env vars are present but blank", async () => {
    vi.resetModules();
    vi.stubEnv("JUPITER_API_HOST", "");
    vi.stubEnv("JUPITER_API_KEY", "");
    const blank = await import("@/server/prices");
    expect(blank.JUPITER_HOST).toBe("https://lite-api.jup.ag");
    expect(blank.jupiterHeaders()).toEqual({ "Content-Type": "application/json" });

    vi.resetModules();
    vi.stubEnv("JUPITER_API_KEY", "secret");
    const keyed = await import("@/server/prices");
    expect(keyed.JUPITER_HOST).toBe("https://api.jup.ag");
    expect(keyed.jupiterHeaders()).toMatchObject({ "x-api-key": "secret" });

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("prices a ScaledUiAmount mint per raw token", async () => {
    clearCache();
    // OPENAI PreStocks as Jupiter reported it: multiplier 1 -> 1.4861347 effective 2026-07-17.
    const body = {
      [mint(1)]: {
        usdPrice: 1510.806200159171,
        scaledUiConfig: { multiplier: 1, newMultiplier: 1.4861347, newMultiplierEffectiveAt: "2026-07-17T16:30:00Z" },
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    expect((await getPrices([mint(1)])).get(mint(1))).toBeCloseTo(2245.2615, 3); // Jupiter's usdPricePrescaled
  });
});

describe("rawUsdPrice", () => {
  const cfg = { multiplier: 1.0009, newMultiplier: 1.0017, newMultiplierEffectiveAt: "2026-09-10T00:30:00Z" };
  const at = (iso: string) => Date.parse(iso);

  it("switches to the new multiplier at its effective time", () => {
    expect(rawUsdPrice({ usdPrice: 100, scaledUiConfig: cfg }, at("2026-09-10T00:29:59Z"))).toBeCloseTo(100.09, 9);
    expect(rawUsdPrice({ usdPrice: 100, scaledUiConfig: cfg }, at("2026-09-10T00:30:00Z"))).toBeCloseTo(100.17, 9);
  });

  it("passes unscaled prices through and rejects unusable ones", () => {
    expect(rawUsdPrice({ usdPrice: 42 }, 0)).toBe(42);
    expect(rawUsdPrice({ usdPrice: 42, scaledUiConfig: null }, 0)).toBe(42);
    expect(rawUsdPrice({ usdPrice: 0 }, 0)).toBeUndefined();
    const bad = { multiplier: 0, newMultiplier: Number.NaN, newMultiplierEffectiveAt: "2026-01-01T00:00:00Z" };
    expect(rawUsdPrice({ usdPrice: 100, scaledUiConfig: bad }, at("2026-06-01T00:00:00Z"))).toBeUndefined();
    expect(rawUsdPrice({ usdPrice: 100, scaledUiConfig: bad }, at("2025-06-01T00:00:00Z"))).toBeUndefined();
  });
});
