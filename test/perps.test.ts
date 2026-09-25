import { describe, expect, it } from "vitest";
import { estimateLiquidationPrice, floorToLots, priceDecimals, formatCountdown, formatLeverage, formatSignedUsd, fundingCountdown, lotStep, perpTotals, postTradeNotional, signTone, sizeToLots, usdc, walkBook } from "@/lib/perps";

const pos = (unrealizedPnl: string, accruedFunding: string, notional: string) => ({
  assetId: 0, symbol: "SOL", logo: null, side: "long" as const, size: "1", entryPrice: "1", markPrice: "1", notional, unrealizedPnl, accruedFunding,
});

describe("perps helpers", () => {
  it("sums uPnL, funding and notional across positions", () => {
    expect(perpTotals({ positions: [pos("100", "-5", "1000"), pos("-40", "2", "500")] })).toEqual({
      unrealizedPnl: 60n, accruedFunding: -3n, notional: 1500n,
    });
    expect(perpTotals({ positions: [] })).toEqual({ unrealizedPnl: 0n, accruedFunding: 0n, notional: 0n });
  });

  it("formats signed USDC amounts and leverage", () => {
    expect(usdc("1500000")).toBe(1.5);
    expect(formatSignedUsd("83700")).toBe("+$0.08");
    expect(formatSignedUsd(-440_000n)).toBe("-$0.44");
    expect(formatSignedUsd("0")).toBe("$0.00");
    expect(formatLeverage(1.5234)).toBe("1.52x");
    expect(formatLeverage(null)).toBe("—");
  });

  it("gives a text tone for a signed amount, from a string or a bigint", () => {
    expect(signTone("10000")).toBe("text-emerald-400");
    expect(signTone("-10000")).toBe("text-red-400");
    expect(signTone("0")).toBe("text-muted");
    expect(signTone(10_000n)).toBe("text-emerald-400");
    expect(signTone(-10_000n)).toBe("text-red-400");
    // sub-cent amounts display as $0.00, so they read as neutral too
    expect(signTone(100n)).toBe("text-muted");
    expect(signTone(0n)).toBe("text-muted");
  });
});

describe("sizeToLots / lotStep", () => {
  it("scales by positive lot decimals and rejects finer sizes", () => {
    expect(sizeToLots("1.25", 2)).toBe(125n);
    expect(sizeToLots("1.255", 2)).toBeNull();
    expect(lotStep(2)).toBe("0.01");
  });

  it("handles negative lot decimals, where one lot is many units", () => {
    expect(sizeToLots("300", -2)).toBe(3n);
    expect(sizeToLots("250", -2)).toBeNull();
    expect(lotStep(-2)).toBe("100");
  });

  it.each(["", "0", "0.00", "abc", "-1"])("rejects %j", (s) => {
    expect(sizeToLots(s, 2)).toBeNull();
  });
});

describe("postTradeNotional", () => {
  const long = (symbol: string, size: string, markPrice: string) => ({ symbol, side: "long" as const, size, markPrice });

  it("adds a new market's exposure to the book", () => {
    expect(postTradeNotional([long("BTC", "0.1", "60000")], { symbol: "SOL", side: "long", size: 10, price: 150 })).toBe(6000 + 1500);
  });

  it("nets an opposite-side order against the open position", () => {
    expect(postTradeNotional([long("SOL", "10", "150")], { symbol: "SOL", side: "short", size: 4, price: 150 })).toBe(900);
    // flipping through zero leaves the excess as exposure
    expect(postTradeNotional([long("SOL", "10", "150")], { symbol: "SOL", side: "short", size: 12, price: 150 })).toBe(300);
  });
});

describe("floorToLots", () => {
  it("floors to the lot step without float noise", () => {
    expect(floorToLots(21.3579, 2)).toBe("21.35");
    expect(floorToLots(0.3, 1)).toBe("0.3");
    expect(floorToLots(0.004, 2)).toBe("0");
    expect(floorToLots(12_345, -2)).toBe("12300");
    expect(floorToLots(Number.NaN, 2)).toBe("0");
  });
});

describe("walkBook", () => {
  const asks: [number, number][] = [[100, 1], [101, 2], [103, 5]];
  it("averages across levels, best first", () => {
    expect(walkBook(asks, 2)).toEqual({ avgPrice: 100.5, worstPrice: 101, filled: 2 });
  });
  it("reports a partial fill when the book is thin", () => {
    expect(walkBook(asks, 10)?.filled).toBe(8);
    expect(walkBook([], 1)).toBeNull();
  });
});

describe("estimateLiquidationPrice", () => {
  // 25x max, maintenance 50% of initial → 2% maintenance rate
  const base = { otherMaintenance: 0, mark: 100, maxLeverage: 25, maintenanceFactor: 0.5 };

  it("puts a 5x long's liquidation ~18% below the mark", () => {
    // $1,000 equity, 50 SOL long at $100: 1000 + 50(p − 100) = 50·p·0.02 → p = 4000/49
    expect(estimateLiquidationPrice({ ...base, equity: 1_000, size: 50 })).toBeCloseTo(4000 / 49, 6);
  });

  it("puts a short's liquidation above the mark", () => {
    const p = estimateLiquidationPrice({ ...base, equity: 1_000, size: -50 })!;
    expect(p).toBeGreaterThan(100);
    // at p equity equals maintenance
    expect(1_000 - 50 * (p - 100)).toBeCloseTo(50 * p * 0.02, 6);
  });

  it("is null when flat or when the account cannot be liquidated", () => {
    expect(estimateLiquidationPrice({ ...base, equity: 1_000, size: 0 })).toBeNull();
    // a 1x long with maintenance below 100% never reaches maintenance above zero
    expect(estimateLiquidationPrice({ ...base, equity: 10_000, size: 50 })).toBeNull();
  });
});

describe("fundingCountdown", () => {
  it("counts down to the next whole hour", () => {
    expect(fundingCountdown(Date.UTC(2026, 0, 1, 10, 59, 30))).toBe(30);
    expect(formatCountdown(3_599)).toBe("00:59:59");
  });
});

describe("priceDecimals", () => {
  it.each([
    [{ tickSize: 100, baseLotsDecimals: 2 }, 2],
    [{ tickSize: 100, baseLotsDecimals: 4 }, 0],
    [{ tickSize: 100, baseLotsDecimals: -2 }, 6],
  ])("%o → %i", (m, d) => expect(priceDecimals(m)).toBe(d));
});

describe("formatSignedUsd", () => {
  it("rounds sub-cent amounts to $0.00 instead of a signed '<$0.01'", () => {
    expect(formatSignedUsd(-4_000n)).toBe("$0.00");
    expect(formatSignedUsd(6_000n)).toBe("+$0.01");
  });
});
