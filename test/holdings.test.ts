import { describe, expect, it } from "vitest";
import { buildHoldingsView, isEmptyPosition, positionKey } from "@/lib/holdings";
import type { DlmmStrategyView, JupiterStrategyView, PhoenixStrategyView, UnreadableStrategyView, VaultDetail } from "@/lib/types";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

const vault = (over: Partial<VaultDetail> = {}) =>
  ({
    address: "vault",
    depositMint: USDC,
    depositSymbol: "USDC",
    depositDecimals: 6,
    depositLogo: "https://x/usdc.png",
    depositPriceUsd: 1,
    idleBalance: "1000000000", // 1000 USDC
    unmanagedHoldings: [],
    totalAssets: "1350000000",
    ...over,
  }) as VaultDetail;

const sol = (priceUsd: number | null) => ({ mint: SOL, symbol: "SOL", decimals: 9, logo: null, priceUsd });
const usdc = { mint: USDC, symbol: "USDC", decimals: 6, logo: null, priceUsd: 1 };

const jupiter = (priceUsd: number | null): JupiterStrategyView => ({
  type: "jupiter", address: "strat-jup", id: 0, createdTs: 1, lastActionTs: 2,
  targetMint: SOL, symbol: "SOL", decimals: 9, logo: null, priceUsd,
  vaultBalance: "2000000000", // 2 SOL
});

const dlmm = (priceUsd: number | null): DlmmStrategyView => ({
  type: "dlmm", address: "strat-lp", id: 1, createdTs: 1, lastActionTs: 3,
  position: "pos", lbPair: "pair", tokenX: sol(priceUsd), tokenY: usdc,
  lowerBinId: 90, upperBinId: 110, activeBinId: 100, binStep: 10,
  lowerPrice: "90", upperPrice: "110", activePrice: "100",
  amountX: "1000000000", amountY: "50000000", // 1 SOL, 50 USDC
  pendingFeeX: "100000000", pendingFeeY: "1000000", // 0.1 SOL, 1 USDC
  bins: [{ binId: 100, amountX: "1000000000", amountY: "50000000" }],
  pnlUsd: null, pnlPct: null,
});

const CANONICAL = "Canon1ca1Mint11111111111111111111111111111";

const phoenix = (over: Partial<PhoenixStrategyView> = {}): PhoenixStrategyView => ({
  type: "phoenix", address: "strat-px", id: 2, createdTs: 1, lastActionTs: 6,
  traderAccount: "trader", canonicalMint: CANONICAL,
  collateral: "300000000", equity: "320000000", canonicalBalance: "5000000", // 300, 320, 5 USDC
  leverage: 1.5,
  closable: false,
  positions: [{
    assetId: 0, symbol: "SOL", logo: null, side: "long", size: "2", entryPrice: "100", markPrice: "110",
    notional: "220000000", unrealizedPnl: "20000000", accruedFunding: "0",
  }],
  ...over,
});

describe("buildHoldingsView", () => {
  it("values positions, merges token exposure and compares with NAV", () => {
    const h = buildHoldingsView(vault(), [dlmm(100), jupiter(100)]);
    // 1000 idle + 200 SOL + LP (100 + 50 + 0.1 SOL×100×0.9 + 1×0.9)
    expect(h.totalValue).toBe("1359900000");
    expect(h.totalUsd).toBeCloseTo(1359.9, 6);
    expect(h.navDeltaBps).toBe(73);
    expect(h.partial).toBe(false);

    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "swap", "lp"]);
    expect(h.positions[1]).toMatchObject({ value: "200000000", shareBps: 1470, closable: false });
    const lp = h.positions[2];
    expect(lp.kind === "lp" && lp.range).toMatchObject({ inRange: true, binStep: 10, upperBinId: 110 });
    expect(lp.value).toBe("159900000");

    expect(h.tokens.map((t) => [t.token.symbol, t.amount, t.value])).toEqual([
      ["USDC", "1051000000", "1050900000"],
      ["SOL", "3100000000", "309000000"],
    ]);
  });

  it("marks unpriced tokens instead of guessing", () => {
    const h = buildHoldingsView(vault(), [jupiter(null), dlmm(null)]);
    expect(h.partial).toBe(true);
    expect(h.unpriced).toEqual(["SOL"]);
    expect(h.totalValue).toBe("1050900000");
    const swap = h.positions.find((p) => p.kind === "swap")!;
    expect(swap).toMatchObject({ value: null, usd: null, shareBps: null });
    expect(h.positions.at(-1)!.value).toBeNull(); // unknown values sort last
  });

  it("reports an unreadable position as an error row and marks the view partial", () => {
    const base = buildHoldingsView(vault(), [dlmm(100), jupiter(100)]);
    const broken: UnreadableStrategyView = {
      type: "unreadable", address: "strat-bad", id: 2, createdTs: 1, lastActionTs: 4,
      protocol: "dlmm", position: "pos-bad", reason: "Position read failed",
    };
    const h = buildHoldingsView(vault(), [broken, dlmm(100), jupiter(100)]);

    expect(h.partial).toBe(true);
    expect(h.unpriced).toEqual([]);
    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "swap", "lp", "error"]);
    expect(h.positions.at(-1)).toEqual({
      kind: "error", strategy: "strat-bad", protocol: "dlmm", position: "pos-bad", reason: "Position read failed",
      value: null, usd: null, shareBps: null, lastActionTs: 4,
    });
    // It contributes nothing: every other value, share and the total are unchanged.
    expect(h.totalValue).toBe(base.totalValue);
    expect(h.positions.slice(0, 3)).toEqual(base.positions);
    expect(h.tokens).toEqual(base.tokens);
  });

  it("groups spot positions before LPs regardless of value", () => {
    const small: JupiterStrategyView = { ...jupiter(100), address: "strat-jup-2", vaultBalance: "100000000" }; // 0.1 SOL = 10 USDC
    const h = buildHoldingsView(vault(), [dlmm(100), small, jupiter(100)]);
    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "swap", "swap", "lp"]);
    expect(h.positions.map((p) => p.value)).toEqual(["1000000000", "200000000", "10000000", "159900000"]);
  });

  it("surfaces an unmanaged token balance as an idle position", () => {
    const FEELSGOOD = "FeeL1111111111111111111111111111111111111";
    const feelsgood = { mint: FEELSGOOD, symbol: "FEELSGOOD", decimals: 6, logo: null, priceUsd: 2 };
    const h = buildHoldingsView(
      vault({ unmanagedHoldings: [{ token: feelsgood, amount: "5000000" }] }), // 5 FEELSGOOD
      [jupiter(100)],
    );
    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "idle", "swap"]);
    expect(h.positions.map(positionKey)).toEqual([`idle:${USDC}`, `idle:${FEELSGOOD}`, "swap:strat-jup"]);
    expect(new Set(h.positions.map(positionKey)).size).toBe(h.positions.length);
    expect(h.positions[1]).toMatchObject({ kind: "idle", token: feelsgood, amount: "5000000", value: "10000000" });
    expect(h.tokens.map((t) => t.token.symbol)).toContain("FEELSGOOD");
  });

  it("drops an unmanaged holding that duplicates a Jupiter strategy's target mint", () => {
    // The vault's target-mint token account IS the Jupiter strategy's balance, so a raw scan of
    // owned token accounts sees it too — it must not also surface as a separate idle position.
    const h = buildHoldingsView(vault({ unmanagedHoldings: [{ token: sol(100), amount: "2000000000" }] }), [jupiter(100)]);
    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "swap"]);
    expect(h.tokens.map((t) => [t.token.symbol, t.amount])).toEqual([
      ["USDC", "1000000000"],
      ["SOL", "2000000000"],
    ]);
  });

  it("flags closable positions and out-of-range LPs", () => {
    const empty = { ...jupiter(100), vaultBalance: "0" };
    const lpOut = { ...dlmm(100), activeBinId: 200, amountX: "0", amountY: "0", pendingFeeX: "0", pendingFeeY: "0" };
    const h = buildHoldingsView(vault({ totalAssets: "0" }), [empty, lpOut]);
    expect(h.navDeltaBps).toBeNull();
    expect(h.positions.find((p) => p.kind === "swap")).toMatchObject({ closable: true });
    const lp = h.positions.find((p) => p.kind === "lp");
    expect(lp).toMatchObject({ closable: true, range: { inRange: false } });
  });

  it("marks zero-balance idle, swap, and closable lp positions empty; nonzero ones stay", () => {
    const empty = { ...jupiter(100), vaultBalance: "0" };
    const lpOut = { ...dlmm(100), amountX: "0", amountY: "0", pendingFeeX: "0", pendingFeeY: "0" };
    const h = buildHoldingsView(vault({ idleBalance: "0", totalAssets: "0" }), [empty, lpOut]);
    expect(h.positions.map(isEmptyPosition)).toEqual([true, true, true]);

    const nonEmpty = buildHoldingsView(vault(), [dlmm(100), jupiter(100)]);
    expect(nonEmpty.positions.map(isEmptyPosition)).toEqual([false, false, false]);
  });
});

describe("buildHoldingsView with Phoenix", () => {
  it("books equity and the canonical balance at 1:1 in USDC, like the keeper", () => {
    const h = buildHoldingsView(vault(), [phoenix()]);
    // 1000 idle + 320 equity + 5 canonical
    expect(h.totalValue).toBe("1325000000");
    expect(h.partial).toBe(false);
    const perp = h.positions.find((p) => p.kind === "perp")!;
    expect(perp).toMatchObject({
      kind: "perp", strategy: "strat-px", traderAccount: "trader", value: "325000000",
      equity: "320000000", collateral: "300000000", canonicalBalance: "5000000", leverage: 1.5, closable: false,
    });
    expect(h.tokens.map((t) => [t.token.symbol, t.amount])).toEqual([["USDC", "1325000000"]]);
  });

  it("does not count the canonical-mint ATA again as an unmanaged holding", () => {
    const canonical = { mint: CANONICAL, symbol: "eUSDC", decimals: 6, logo: null, priceUsd: 1 };
    const h = buildHoldingsView(vault({ unmanagedHoldings: [{ token: canonical, amount: "5000000" }] }), [phoenix()]);
    expect(h.totalValue).toBe("1325000000");
    expect(h.positions.filter((p) => p.kind === "idle")).toHaveLength(1);
  });

  it("sorts perp after LP and before unreadable rows", () => {
    const broken: UnreadableStrategyView = {
      type: "unreadable", protocol: "phoenix", address: "strat-bad", id: 9, createdTs: 1, lastActionTs: 4,
      position: "trader-bad", reason: "phoenix_stale_mark:0",
    };
    const h = buildHoldingsView(vault(), [broken, phoenix(), dlmm(100), jupiter(100)]);
    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "swap", "lp", "perp", "error"]);
    expect(h.positions.at(-1)).toMatchObject({ kind: "error", protocol: "phoenix", position: "trader-bad" });
  });

  it("marks an empty account closable and keeps it visible", () => {
    const h = buildHoldingsView(vault(), [
      phoenix({ equity: "0", collateral: "0", canonicalBalance: "0", leverage: null, positions: [], closable: true }),
    ]);
    const perp = h.positions.find((p) => p.kind === "perp")!;
    expect(perp).toMatchObject({ closable: true, value: "0" });
    expect(isEmptyPosition(perp)).toBe(false);
  });

  it("is not closable while the canonical balance awaits unwrap", () => {
    const h = buildHoldingsView(vault(), [phoenix({ equity: "0", collateral: "0", positions: [], closable: false })]);
    expect(h.positions.find((p) => p.kind === "perp")).toMatchObject({ closable: false });
  });
});
