import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkTrader, computeTraderEquity, decodeMarkets, decodeTraderState, MAX_MARK_AGE_SLOTS, parseGlobalConfig,
  PHOENIX_PROGRAM_ID, type PhoenixMarket, type PhoenixPosition, type PhoenixTraderState,
} from "@/server/phoenix";
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
  const ok: PhoenixTraderState = { authority: vault, pdaIndex: 0, subaccountIndex: 0, collateral: 0n, positions: [], nativeSolLamports: 0n, splineMarkets: 0 };

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
  const keys = [PublicKey.unique(), PublicKey.unique(), PublicKey.unique(), PublicKey.unique()];
  const data = Buffer.alloc(776);
  Buffer.from([37, 146, 212, 210, 47, 136, 111, 20]).copy(data);
  [296, 360, 392, 424].forEach((offset, i) => keys[i].toBuffer().copy(data, offset));

  it("reads the exchange accounts", () => {
    expect(parseGlobalConfig(accountInfo(data, PHOENIX_PROGRAM_ID))).toEqual({
      canonicalMint: keys[0], perpAssetMap: keys[1], globalTraderIndex: keys[2], activeTraderBuffer: keys[3],
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
});
