import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import type { PhoenixMarket, PhoenixTraderState } from "@/server/phoenix";
import { toPhoenixView } from "@/server/readers/phoenix";

const SLOT = 10_000n;
const vault = PublicKey.unique();
const trader = PublicKey.unique();
const canonicalMint = PublicKey.unique();
const base = { address: "strat-px", id: 3, createdTs: 1, lastActionTs: 5 };
const sol: PhoenixMarket = { markTicks: 11_684n, markSlot: SLOT, tickSize: 100n, cumulativeFundingRate: 27_329n, baseLotDecimals: 2 };
const state = (over: Partial<PhoenixTraderState> = {}): PhoenixTraderState => ({
  authority: vault, pdaIndex: 0, subaccountIndex: 0, collateral: 10_000_000n,
  positions: [{ assetId: 0n, baseLots: 3n, virtualQuoteLots: -3_421_500n, fundingSnapshot: 24_203n }],
  nativeSolLamports: 0n, splineMarkets: 0, withdrawQueued: false, ...over,
});
const input = (over: Partial<Parameters<typeof toPhoenixView>[0]> = {}) => ({
  base, vault, trader, canonicalMint, canonicalBalance: 0n,
  state: state() as PhoenixTraderState | Error,
  markets: new Map([[0n, sol]]) as Map<bigint, PhoenixMarket> | Error,
  slot: SLOT, names: new Map([[0, "SOL"]]), ...over,
});

describe("toPhoenixView", () => {
  it("values the account and describes each open position", () => {
    const v = toPhoenixView(input({ canonicalBalance: 42n }));
    expect(v).toEqual({
      ...base,
      type: "phoenix",
      traderAccount: trader.toBase58(),
      canonicalMint: canonicalMint.toBase58(),
      collateral: "10000000",
      equity: String(10_000_000n + 83_700n - 9_378n),
      canonicalBalance: "42",
      leverage: 3_505_200 / Number(10_000_000n + 83_700n - 9_378n),
      closable: false,
      positions: [{
        assetId: 0, symbol: "SOL", logo: null, side: "long", size: "0.03", entryPrice: "114.05", markPrice: "116.84",
        notional: "3505200", unrealizedPnl: "83700", accruedFunding: "-9378",
      }],
    });
  });

  it("skips zero-size entries and falls back to an asset label", () => {
    const flat = state({ positions: [{ assetId: 0n, baseLots: 0n, virtualQuoteLots: 0n, fundingSnapshot: 0n }] });
    const v0 = toPhoenixView(input({ state: flat }));
    expect(v0.type === "phoenix" && v0.positions).toEqual([]);
    const v = toPhoenixView(input({ names: new Map() }));
    expect(v.type === "phoenix" && v.positions[0].symbol).toBe("Asset #0");
  });

  it("has no leverage at zero equity", () => {
    const v = toPhoenixView(input({ state: state({ collateral: 0n, positions: [] }) }));
    expect(v).toMatchObject({ type: "phoenix", equity: "0", leverage: null, positions: [] });
  });

  describe("closable", () => {
    const emptyState = state({ collateral: 0n, positions: [] });

    it("is true for an empty account: no collateral, positions, queue or canonical balance", () => {
      const v = toPhoenixView(input({ state: emptyState }));
      expect(v).toMatchObject({ type: "phoenix", closable: true });
    });

    it("is false while a withdrawal is queued", () => {
      const v = toPhoenixView(input({ state: { ...emptyState, withdrawQueued: true } }));
      expect(v).toMatchObject({ type: "phoenix", closable: false });
    });

    it("is false with a zero-base-lot position entry, even though it renders no open positions", () => {
      const flat = state({ collateral: 0n, positions: [{ assetId: 0n, baseLots: 0n, virtualQuoteLots: 0n, fundingSnapshot: 0n }] });
      const v = toPhoenixView(input({ state: flat }));
      expect(v).toMatchObject({ type: "phoenix", positions: [], closable: false });
    });

    it("is false while the canonical balance awaits unwrap", () => {
      const v = toPhoenixView(input({ state: emptyState, canonicalBalance: 1n }));
      expect(v).toMatchObject({ type: "phoenix", closable: false });
    });
  });

  it.each([
    ["a stale mark", input({ markets: new Map([[0n, { ...sol, markSlot: 0n }]]) }), "phoenix_stale_mark:0"],
    ["another authority", input({ state: state({ authority: PublicKey.unique() }) }), `phoenix_trader_mismatch:${trader.toBase58()}`],
    ["an undecodable trader", input({ state: new Error(`phoenix_decode:${trader.toBase58()}`) }), `phoenix_decode:${trader.toBase58()}`],
    ["an undecodable asset map", input({ markets: new Error("phoenix_decode:map") }), "phoenix_decode:map"],
  ])("reports %s as an unreadable Phoenix strategy", (_, i, reason) => {
    expect(toPhoenixView(i)).toEqual({ ...base, type: "unreadable", protocol: "phoenix", position: trader.toBase58(), reason });
  });
});

describe("toPhoenixView logos", () => {
  it("attaches the market logo when Phoenix's market list has one", () => {
    const v = toPhoenixView(input({ logos: new Map([[0, "https://cdn/sol.svg"]]) }));
    expect(v.type === "phoenix" && v.positions[0].logo).toBe("https://cdn/sol.svg");
  });
});
