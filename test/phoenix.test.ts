import { decodeTrader } from "@ellipsis-labs/rise";
import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkTrader, computeTraderEquity, decodeMarkets, decodeTraderState, describePosition, getPhoenixMarketNames, marketCategory, MAX_MARK_AGE_SLOTS, parseGlobalConfig,
  PHOENIX_PROGRAM_ID, scaleDecimal, type PhoenixMarket, type PhoenixPosition, type PhoenixTraderState,
} from "@/server/phoenix";
import { clearCache } from "@/server/cache";
import { accountInfo, hawkeyeEquity, loadPhoenixFixture } from "./phoenix-fixture";

const SLOT = 10_000n;
const market = (markTicks: bigint, tickSize = 10n, cumulativeFundingRate = 0n, markSlot = SLOT, baseLotDecimals = 0): PhoenixMarket =>
  ({ markTicks, markSlot, tickSize, cumulativeFundingRate, baseLotDecimals });
const position = (assetId: bigint, baseLots: bigint, virtualQuoteLots: bigint, fundingSnapshot = 0n): PhoenixPosition =>
  ({ assetId, baseLots, virtualQuoteLots, fundingSnapshot });

describe("computeTraderEquity", () => {
  it("is the collateral of a flat account", () => {
    expect(computeTraderEquity(1_000n, [], new Map(), SLOT)).toBe(1_000n);
  });

  it("adds uPnL at mark: long in profit, short in loss", () => {
    const markets = new Map([[0n, market(110n)], [1n, market(110n)]]);
    expect(computeTraderEquity(10_000n, [position(0n, 3n, -3_000n), position(1n, -2n, 2_000n)], markets, SLOT)).toBe(10_100n);
  });

  it("adds unsettled funding with Hawkeye's sign", () => {
    const markets = new Map([[0n, market(100n, 10n, 150n)], [1n, market(100n, 10n, 150n)]]);
    const positions = [position(0n, 3n, -3_000n, 100n), position(1n, -2n, 2_000n, 100n)];
    expect(computeTraderEquity(10_000n, positions, markets, SLOT)).toBe(10_000n - 150n + 100n);
  });

  it("clamps negative equity to zero", () => {
    expect(computeTraderEquity(100n, [position(0n, 1n, -1_000n)], new Map([[0n, market(10n)]]), SLOT)).toBe(0n);
  });

  it("ignores the mark of an entry without a position", () => {
    expect(computeTraderEquity(500n, [position(0n, 0n, 0n)], new Map([[0n, market(0n)]]), SLOT)).toBe(500n);
  });

  it("aborts on an asset missing from the map", () => {
    expect(() => computeTraderEquity(1n, [position(7n, 1n, 0n)], new Map(), SLOT)).toThrow("phoenix_asset_missing:7");
  });

  it("aborts on a mark older than the bound under an open position", () => {
    const stale = new Map([[0n, market(100n, 10n, 0n, SLOT - MAX_MARK_AGE_SLOTS - 1n)]]);
    expect(() => computeTraderEquity(1n, [position(0n, 1n, 0n)], stale, SLOT)).toThrow("phoenix_stale_mark:0");
  });

  it("accepts a mark at the bound, and any mark without a position", () => {
    const edge = new Map([[0n, market(100n, 10n, 0n, SLOT - MAX_MARK_AGE_SLOTS)]]);
    expect(computeTraderEquity(0n, [position(0n, 1n, -900n)], edge, SLOT)).toBe(100n);
    const stale = new Map([[0n, market(100n, 10n, 0n, 0n)]]);
    expect(computeTraderEquity(5n, [position(0n, 0n, 0n)], stale, SLOT)).toBe(5n);
  });

  it("aborts on a zero mark under an open position", () => {
    expect(() => computeTraderEquity(1n, [position(0n, 1n, 0n)], new Map([[0n, market(0n)]]), SLOT)).toThrow("phoenix_zero_mark:0");
  });
});

describe("checkTrader", () => {
  const vault = PublicKey.unique();
  const key = PublicKey.unique();
  const ok: PhoenixTraderState = {
    authority: vault, pdaIndex: 0, subaccountIndex: 0, collateral: 0n, positions: [],
    nativeSolLamports: 0n, splineMarkets: 0, withdrawQueued: false,
  };

  it("accepts the vault's cross-margin account", () => {
    expect(() => checkTrader(vault, key, ok)).not.toThrow();
  });

  it.each([
    ["another authority", { authority: PublicKey.unique() }, `phoenix_trader_mismatch:${key.toBase58()}`],
    ["a subaccount", { subaccountIndex: 1 }, `phoenix_trader_mismatch:${key.toBase58()}`],
    ["another pda index", { pdaIndex: 1 }, `phoenix_trader_mismatch:${key.toBase58()}`],
    ["native SOL collateral", { nativeSolLamports: 1n }, `phoenix_native_sol:${key.toBase58()}`],
    ["spline markets", { splineMarkets: 1 }, `phoenix_splines:${key.toBase58()}`],
  ])("rejects %s", (_, change, reason) => {
    expect(() => checkTrader(vault, key, { ...ok, ...change })).toThrow(reason);
  });
});

describe("parseGlobalConfig", () => {
  const keys = Array.from({ length: 6 }, () => PublicKey.unique());
  const data = Buffer.alloc(776);
  Buffer.from([37, 146, 212, 210, 47, 136, 111, 20]).copy(data);
  [296, 328, 360, 392, 424, 472].forEach((offset, i) => keys[i].toBuffer().copy(data, offset));

  it("reads the exchange accounts", () => {
    expect(parseGlobalConfig(accountInfo(data, PHOENIX_PROGRAM_ID))).toEqual({
      canonicalMint: keys[0], globalVault: keys[1], perpAssetMap: keys[2], globalTraderIndex: keys[3], activeTraderBuffer: keys[4], withdrawQueue: keys[5],
    });
  });

  it("rejects a foreign owner or discriminator", () => {
    expect(() => parseGlobalConfig(accountInfo(data, PublicKey.unique()))).toThrow("phoenix_decode:");
    expect(() => parseGlobalConfig(accountInfo(Buffer.alloc(776), PHOENIX_PROGRAM_ID))).toThrow("phoenix_decode:");
  });
});

describe("decodeMarkets", () => {
  it("decodes the SDK's mainnet perp asset map, including lot decimals", () => {
    const fx = JSON.parse(readFileSync("node_modules/@ellipsis-labs/rise/test-fixtures/sdk-account-fixtures.json", "utf8")).accounts[0];
    const markets = decodeMarkets(PublicKey.unique(), accountInfo(Buffer.from(fx.dataBase64, "base64"), PHOENIX_PROGRAM_ID));
    expect(markets.size).toBe(44);
    for (const m of markets.values()) expect(m.tickSize).toBeGreaterThan(0n);
    // asset 0 is SOL: tick size 100, 2 base lot decimals
    expect(markets.get(0n)).toMatchObject({ tickSize: 100n, baseLotDecimals: 2 });
  });

  it("rejects bytes it cannot decode", () => {
    const key = PublicKey.unique();
    expect(() => decodeMarkets(key, accountInfo(Buffer.alloc(16), PHOENIX_PROGRAM_ID))).toThrow(`phoenix_decode:${key.toBase58()}`);
  });
});

describe("mainnet fixture", () => {
  const fixture = loadPhoenixFixture();

  it.each(fixture.map((f) => [f.trader.toBase58(), f] as const))("equity equals Hawkeye for %s", (_, f) => {
    const { perpAssetMap } = parseGlobalConfig(f.accounts.globalConfig);
    const t = decodeTraderState(f.trader, f.accounts.trader);
    const markets = decodeMarkets(perpAssetMap, f.accounts.perpAssetMap);
    expect(t.collateral).toBe(f.hawkeye.collateral);
    expect(computeTraderEquity(t.collateral, t.positions, markets, BigInt(f.slot))).toBe(hawkeyeEquity(f.hawkeye));
  });

  it.each(fixture.map((f) => [f.trader.toBase58(), f] as const))("withdrawQueued matches rise's decoded withdrawQueueNode for %s", (_, f) => {
    const t = decodeTraderState(f.trader, f.accounts.trader);
    const raw = decodeTrader(f.accounts.trader.data);
    expect(typeof t.withdrawQueued).toBe("boolean");
    expect(t.withdrawQueued).toBe(raw.withdrawQueueNode !== null);
  });
});

describe("scaleDecimal", () => {
  it.each([
    [123n, 2, "1.23"],
    [5n, 4, "0.0005"],
    [-1500n, 3, "-1.5"],
    [100n, 2, "1"],
    [5n, -2, "500"],
    [0n, 6, "0"],
  ])("%s × 10^-%s = %s", (raw, decimals, out) => {
    expect(scaleDecimal(raw, decimals)).toBe(out);
  });
});

describe("describePosition", () => {
  // Values from a real mainnet SOL long: tick size 100, 2 base lot decimals.
  const sol = market(11_684n, 100n, 27_329n, SLOT, 2);
  it("describes a long", () => {
    expect(describePosition(position(0n, 3n, -3_421_500n, 24_203n), sol)).toEqual({
      side: "long",
      size: "0.03",
      entryPrice: "114.05",
      markPrice: "116.84",
      notional: 3_505_200n,
      unrealizedPnl: 83_700n,
      accruedFunding: -9_378n,
    });
  });

  // Values from a real mainnet BTC short: tick size 100, 4 base lot decimals.
  it("describes a short with a positive size", () => {
    const btc = market(85_428n, 100n, -127_914n, SLOT, 4);
    expect(describePosition(position(1n, -1n, 8_102_800n, -122_482n), btc)).toEqual({
      side: "short",
      size: "0.0001",
      entryPrice: "81028",
      markPrice: "85428",
      notional: 8_542_800n,
      unrealizedPnl: -440_000n,
      accruedFunding: -5_432n,
    });
  });

  it("scales markets with negative base lot decimals", () => {
    // PUMP-like: 1 base lot = 100 tokens
    const pump = market(41_880n, 10n, 0n, SLOT, -2); // 41_880 ticks × 10 = 418_800 quote lots per base lot
    const d = describePosition(position(26n, -1n, 439_730n), pump);
    expect(d).toMatchObject({ side: "short", size: "100", markPrice: "0.004188", entryPrice: "0.0043973" });
  });

  it("agrees with computeTraderEquity", () => {
    const p = position(0n, 3n, -3_421_500n, 24_203n);
    const d = describePosition(p, sol);
    expect(computeTraderEquity(1_000_000n, [p], new Map([[0n, sol]]), SLOT)).toBe(1_000_000n + d.unrealizedPnl + d.accruedFunding);
  });
});

describe("getPhoenixMarketNames", () => {
  beforeEach(clearCache);
  afterEach(() => vi.restoreAllMocks());

  it("maps asset ids to symbols", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ symbol: "SOL", assetId: 0 }, { symbol: "BTC", assetId: 1 }])));
    expect(await getPhoenixMarketNames()).toEqual(new Map([[0, "SOL"], [1, "BTC"]]));
  });

  it("returns an empty map on failure and negative-caches it until the cache is cleared", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("down", { status: 503 }));
    expect(await getPhoenixMarketNames()).toEqual(new Map());
    // An immediate second call is served the negative cache; it must not hit the network again.
    expect(await getPhoenixMarketNames()).toEqual(new Map());
    expect(fetch).toHaveBeenCalledTimes(1);

    clearCache();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([{ symbol: "SOL", assetId: 0 }])));
    expect(await getPhoenixMarketNames()).toEqual(new Map([[0, "SOL"]]));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("marketCategory", () => {
  it("classifies markets by their trading-hours calendar", () => {
    expect(marketCategory("cme_commodities")).toBe("commodities");
    expect(marketCategory("us_equities_extended")).toBe("equities");
    expect(marketCategory(undefined)).toBe("crypto");
    expect(marketCategory(null)).toBe("crypto");
  });
});
