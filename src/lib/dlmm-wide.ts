import type { DlmmShape } from "./types";

export const DLMM_MAX_ADD_BINS_PER_TX = 26;

/** Split a requested range into contiguous inclusive chunks for Meteora liquidity CPIs. */
export function nextBinChunk(cursorBinId: number, upperBinId: number, maxBins = DLMM_MAX_ADD_BINS_PER_TX) {
  return { lowerBinId: cursorBinId, upperBinId: Math.min(upperBinId, cursorBinId + maxBins - 1) };
}

/** Allocate each side's base units by its weights over the whole requested range. */
export function amountForBinChunk(
  lowerBinId: number,
  upperBinId: number,
  activeBinId: number,
  chunkLowerBinId: number,
  chunkUpperBinId: number,
  shape: DlmmShape,
  amountXBaseUnits: bigint,
  amountYBaseUnits: bigint,
) {
  const allocation = (side: "x" | "y", totalAmount: bigint) => {
    const first = side === "x" ? Math.max(lowerBinId, activeBinId) : lowerBinId;
    const last = side === "x" ? upperBinId : Math.min(upperBinId, activeBinId);
    if (first > last || totalAmount === 0n) return 0n;
    const minDistance = side === "x" ? first - activeBinId : activeBinId - last;
    const maxDistance = side === "x" ? last - activeBinId : activeBinId - first;
    const weight = (binId: number) => {
      const distance = Math.abs(binId - activeBinId);
      return BigInt(shape === "spot" ? 1 : shape === "bidAsk" ? distance + 1 : minDistance + maxDistance - distance + 1);
    };
    let totalWeight = 0n;
    let beforeWeight = 0n;
    let throughWeight = 0n;
    for (let binId = first; binId <= last; binId++) {
      const w = weight(binId);
      totalWeight += w;
      if (binId < chunkLowerBinId) beforeWeight += w;
      if (binId <= chunkUpperBinId) throughWeight += w;
    }
    return (totalAmount * throughWeight) / totalWeight - (totalAmount * beforeWeight) / totalWeight;
  };
  return { amountXBaseUnits: allocation("x", amountXBaseUnits), amountYBaseUnits: allocation("y", amountYBaseUnits) };
}
