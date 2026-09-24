import { describe, expect, it } from "vitest";
import { formatLeverage, formatSignedUsd, perpTotals, usdc } from "@/lib/perps";

const pos = (unrealizedPnl: string, accruedFunding: string, notional: string) => ({
  assetId: 0, symbol: "SOL", side: "long" as const, size: "1", entryPrice: "1", markPrice: "1", notional, unrealizedPnl, accruedFunding,
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
});
