import { describe, expect, it } from "vitest";
import { valueHoldings, type RawHolding } from "@/lib/valuation";

const USDC = "USDC1111111111111111111111111111111111111111";
const SOL = "So11111111111111111111111111111111111111112";
const deposit = { mint: USDC, decimals: 6 };
const h = (kind: RawHolding["kind"], mint: string, decimals: number, amount: bigint, strategy: string | null = "s"): RawHolding =>
  ({ kind, mint, decimals, amount, strategy });

describe("valueHoldings", () => {
  it("values deposit-mint holdings at face value and converts others by price ratio", () => {
    const r = valueHoldings({
      deposit,
      holdings: [h("idle", USDC, 6, 5_000_000n, null), h("jupiter", SOL, 9, 2_000_000_000n)],
      prices: new Map([[USDC, 1], [SOL, 100]]),
    });
    expect(r.holdings.map((x) => x.value)).toEqual([5_000_000n, 200_000_000n]);
    expect(r.total).toBe(205_000_000n);
    expect(r.partial).toBe(false);
  });

  it("counts pending DLMM fees at 90%, deposit mint included", () => {
    const r = valueHoldings({
      deposit,
      holdings: [h("dlmm_fee_x", SOL, 9, 1_000_000_000n), h("dlmm_fee_y", USDC, 6, 10_000_000n)],
      prices: new Map([[USDC, 1], [SOL, 100]]),
    });
    expect(r.holdings.map((x) => x.value)).toEqual([90_000_000n, 9_000_000n]);
  });

  it("rounds down like the keeper", () => {
    const r = valueHoldings({
      deposit,
      holdings: [h("jupiter", SOL, 9, 1n)],
      prices: new Map([[USDC, 3], [SOL, 1]]),
    });
    expect(r.holdings[0].value).toBe(0n);
  });

  it("marks unpriced holdings null, excludes them from the total and reports them", () => {
    const r = valueHoldings({
      deposit,
      holdings: [h("idle", USDC, 6, 1_000_000n, null), h("jupiter", SOL, 9, 1n), h("dlmm_x", SOL, 9, 1n)],
      prices: new Map([[USDC, 1]]),
    });
    expect(r.holdings.map((x) => x.value)).toEqual([1_000_000n, null, null]);
    expect(r.total).toBe(1_000_000n);
    expect(r.partial).toBe(true);
    expect(r.unpriced).toEqual([SOL]);
  });

  it("treats a missing deposit price as unpriced for every non-deposit holding", () => {
    const r = valueHoldings({ deposit, holdings: [h("jupiter", SOL, 9, 1n)], prices: new Map([[SOL, 100]]) });
    expect(r.holdings[0].value).toBeNull();
    expect(r.partial).toBe(true);
  });
});
