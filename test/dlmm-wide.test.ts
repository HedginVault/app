import { describe, expect, it } from "vitest";
import { amountForBinChunk, nextBinChunk } from "@/lib/dlmm-wide";

describe("wide DLMM range funding", () => {
  it("covers 149 bins in two 91-capped deposit instructions", () => {
    const first = nextBinChunk(0, 148);
    const second = nextBinChunk(first.upperBinId + 1, 148);
    expect(first).toEqual({ lowerBinId: 0, upperBinId: 90 });
    expect(second).toEqual({ lowerBinId: 91, upperBinId: 148 });
  });

  it("chunks an inclusive 1400-bin range without gaps", () => {
    const chunks = [];
    for (let cursor = -700; cursor <= 699;) {
      const chunk = nextBinChunk(cursor, 699);
      chunks.push(chunk);
      cursor = chunk.upperBinId + 1;
    }
    expect(chunks[0]).toEqual({ lowerBinId: -700, upperBinId: -610 });
    expect(chunks.at(-1)?.upperBinId).toBe(699);
    expect(chunks.reduce((sum, c) => sum + c.upperBinId - c.lowerBinId + 1, 0)).toBe(1400);
  });

  it("conserves both base-unit amounts across all chunks and shapes", () => {
    for (const shape of ["spot", "curve", "bidAsk"] as const) {
      let totalX = 0n;
      let totalY = 0n;
      for (let cursor = -700; cursor <= 699;) {
        const { upperBinId } = nextBinChunk(cursor, 699);
        const amount = amountForBinChunk(-700, 699, 0, cursor, upperBinId, shape, 1_000_001n, 2_000_003n);
        totalX += amount.amountXBaseUnits;
        totalY += amount.amountYBaseUnits;
        cursor = upperBinId + 1;
      }
      expect(totalX).toBe(1_000_001n);
      expect(totalY).toBe(2_000_003n);
    }
  });

  it("leaves empty-side chunks unfunded", () => {
    expect(amountForBinChunk(100, 199, 0, 100, 125, "spot", 50n, 0n)).toEqual({
      amountXBaseUnits: 13n,
      amountYBaseUnits: 0n,
    });
    expect(amountForBinChunk(100, 199, 0, 100, 125, "spot", 0n, 50n)).toEqual({
      amountXBaseUnits: 0n,
      amountYBaseUnits: 0n,
    });
  });
});
