import { describe, expect, it } from "vitest";
import { barWidths, PALETTE, shareBps, toSlices } from "@/lib/allocation";

describe("shareBps", () => {
  it("rounds down and returns null for unknown values or empty totals", () => {
    expect(shareBps(1n, 3n)).toBe(3333);
    expect(shareBps(null, 10n)).toBeNull();
    expect(shareBps(5n, 0n)).toBeNull();
  });
});

describe("toSlices", () => {
  const item = (key: string, value: bigint | null) => ({ key, label: key.toUpperCase(), value, usd: value === null ? null : Number(value) });

  it("sorts by value, nulls last, and assigns palette colours in order", () => {
    const s = toSlices([item("a", 10n), item("b", null), item("c", 30n)], 40n);
    expect(s.map((x) => x.key)).toEqual(["c", "a", "b"]);
    expect(s.map((x) => x.shareBps)).toEqual([7500, 2500, null]);
    expect(s[0].color).toBe(PALETTE[0]);
  });

  it("folds the tail into Other beyond maxSlices", () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map((n) => item(`t${n}`, BigInt(n)));
    const s = toSlices(items, 28n, 4);
    expect(s.map((x) => x.key)).toEqual(["t7", "t6", "t5", "other"]);
    expect(s[3]).toMatchObject({ label: "Other", value: 10n, usd: 10, shareBps: 3571, color: PALETTE[PALETTE.length - 1] });
  });

  it("six items with default maxSlices get six distinct colors, none equal to Other", () => {
    const items = [1, 2, 3, 4, 5, 6].map((n) => item(`t${n}`, BigInt(n)));
    const s = toSlices(items, 21n);
    expect(s.map((x) => x.key)).toEqual(["t6", "t5", "t4", "t3", "t2", "t1"]);
    expect(s).toHaveLength(6);
    const colors = s.map((x) => x.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(6);
    expect(colors).not.toContain(PALETTE[PALETTE.length - 1]);
  });
});

describe("barWidths", () => {
  it("gives every non-zero slice at least 2% and sums to 100", () => {
    const s = toSlices(
      [{ key: "big", label: "B", value: 9990n, usd: null }, { key: "tiny", label: "T", value: 10n, usd: null }],
      10_000n,
    );
    const w = barWidths(s);
    expect(w[1]).toBeGreaterThanOrEqual(2);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });
  it("returns zeros when nothing is known", () => {
    expect(barWidths(toSlices([{ key: "x", label: "X", value: null, usd: null }], 0n))).toEqual([0]);
  });
});
