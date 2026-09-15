import { describe, expect, it } from "vitest";
import {
  binIdToPrice, clampWidth, distribution, priceToBinId, rangeForPlacement, rangeFromPrices, sidesForRange, suggestOtherSide,
} from "@/lib/dlmm-range";

describe("price <-> bin", () => {
  it("applies bin step compounding and the decimal shift (SOL 9 / USDC 6)", () => {
    expect(binIdToPrice(0, 10, 9, 6)).toBeCloseTo(1000, 9);
    expect(binIdToPrice(1, 10, 9, 6)).toBeCloseTo(1001, 9);
  });
  it("round-trips through priceToBinId", () => {
    for (const id of [-5000, -1, 0, 1, 4321]) {
      const p = binIdToPrice(id, 25, 9, 6);
      expect(priceToBinId(p * 1.000001, 25, 9, 6, "floor")).toBe(id);
      expect(priceToBinId(p * 0.999999, 25, 9, 6, "ceil")).toBe(id);
    }
  });
  it("rejects non-positive prices", () => {
    expect(priceToBinId(0, 10, 9, 6, "floor")).toBeNull();
  });
});

describe("ranges", () => {
  it("clamps width to 1..70", () => {
    expect(clampWidth(0)).toBe(1);
    expect(clampWidth(500)).toBe(70);
    expect(clampWidth(34.6)).toBe(35);
  });
  it("places ranges around, below and above the active bin (upper exclusive)", () => {
    expect(rangeForPlacement(100, 10, "both")).toEqual({ lowerBinId: 95, upperBinId: 105 });
    expect(rangeForPlacement(100, 10, "below")).toEqual({ lowerBinId: 90, upperBinId: 100 });
    expect(rangeForPlacement(100, 10, "above")).toEqual({ lowerBinId: 101, upperBinId: 111 });
    expect(rangeForPlacement(100, 999, "both").upperBinId - rangeForPlacement(100, 999, "both").lowerBinId).toBe(70);
  });
  it("builds a range from prices, clamped to 70 bins", () => {
    const lo = binIdToPrice(10, 10, 9, 6);
    const hi = binIdToPrice(20, 10, 9, 6);
    expect(rangeFromPrices(lo, hi, 10, 9, 6)).toEqual({ lowerBinId: 10, upperBinId: 21 });
    expect(rangeFromPrices(hi, lo, 10, 9, 6)).toBeNull();
    const wide = rangeFromPrices(lo, binIdToPrice(500, 10, 9, 6), 10, 9, 6)!;
    expect(wide.upperBinId - wide.lowerBinId).toBe(70);
  });
  it("reports which tokens a range needs", () => {
    expect(sidesForRange({ lowerBinId: 90, upperBinId: 100 }, 100)).toEqual({ x: false, y: true });
    expect(sidesForRange({ lowerBinId: 101, upperBinId: 111 }, 100)).toEqual({ x: true, y: false });
    expect(sidesForRange({ lowerBinId: 95, upperBinId: 105 }, 100)).toEqual({ x: true, y: true });
  });
});

describe("distribution", () => {
  const range = { lowerBinId: 96, upperBinId: 105 }; // bins 96..104, active 100
  it("spot spreads each side evenly; X at/above active, Y at/below", () => {
    const d = distribution(range, 100, "spot", 5, 5);
    expect(d).toHaveLength(9);
    expect(d.find((b) => b.binId === 96)).toEqual({ binId: 96, x: 0, y: 1 });
    expect(d.find((b) => b.binId === 104)).toEqual({ binId: 104, x: 1, y: 0 });
    expect(d.reduce((a, b) => a + b.x, 0)).toBeCloseTo(5, 9);
  });
  it("curve concentrates at the active bin, bid-ask at the edges", () => {
    const curve = distribution(range, 100, "curve", 5, 5);
    const bidAsk = distribution(range, 100, "bidAsk", 5, 5);
    const at = (d: typeof curve, id: number) => d.find((b) => b.binId === id)!;
    expect(at(curve, 101).x).toBeGreaterThan(at(curve, 104).x);
    expect(at(bidAsk, 104).x).toBeGreaterThan(at(bidAsk, 101).x);
  });
});

describe("suggestOtherSide", () => {
  it("matches value per bin across sides at the active price", () => {
    const range = { lowerBinId: 95, upperBinId: 106 }; // bins 95..105: 6 at/above active (100..105), 6 at/below (95..100)
    expect(suggestOtherSide("x", 2, 150, range, 100)).toBeCloseTo(300, 9);
    expect(suggestOtherSide("y", 300, 150, range, 100)).toBeCloseTo(2, 9);
    expect(suggestOtherSide("x", 2, 150, { lowerBinId: 90, upperBinId: 100 }, 100)).toBe(0);
  });
});
