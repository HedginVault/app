import { DLMM_MAX_POSITION_WIDTH } from "./constants";
import type { DlmmShape } from "./types";

export type Placement = "both" | "below" | "above";

/** Builder convention: `upperBinId` is exclusive, width = upper − lower. */
export interface BinRange {
  lowerBinId: number;
  upperBinId: number;
}

/** Human price of `binId` in token Y per token X. */
export function binIdToPrice(binId: number, binStep: number, decimalsX: number, decimalsY: number): number {
  return Math.pow(1 + binStep / 10_000, binId) * Math.pow(10, decimalsX - decimalsY);
}

export function priceToBinId(
  price: number,
  binStep: number,
  decimalsX: number,
  decimalsY: number,
  round: "floor" | "ceil",
): number | null {
  if (!(price > 0) || !Number.isFinite(price)) return null;
  const raw = Math.log(price / Math.pow(10, decimalsX - decimalsY)) / Math.log(1 + binStep / 10_000);
  // Snap float noise so an exact bin price maps to its own bin under both rounding modes.
  const snapped = Math.abs(raw - Math.round(raw)) < 1e-9 ? Math.round(raw) : raw;
  const result = Math[round](snapped);
  // Normalize signed zero to positive zero
  return result === 0 ? 0 : result;
}

export const clampWidth = (width: number) =>
  Math.max(1, Math.min(DLMM_MAX_POSITION_WIDTH, Math.round(width)));

export function rangeForPlacement(activeBinId: number, width: number, placement: Placement): BinRange {
  const w = clampWidth(width);
  // Below ends on the active bin itself, so the max price is the pool price (0%).
  if (placement === "below") return { lowerBinId: activeBinId - w + 1, upperBinId: activeBinId + 1 };
  if (placement === "above") return { lowerBinId: activeBinId + 1, upperBinId: activeBinId + 1 + w };
  const lowerBinId = activeBinId - Math.floor(w / 2);
  return { lowerBinId, upperBinId: lowerBinId + w };
}

export function rangeFromPrices(
  minPrice: number,
  maxPrice: number,
  binStep: number,
  decimalsX: number,
  decimalsY: number,
): BinRange | null {
  if (!(maxPrice > minPrice)) return null;
  const lower = priceToBinId(minPrice, binStep, decimalsX, decimalsY, "floor");
  const last = priceToBinId(maxPrice, binStep, decimalsX, decimalsY, "ceil");
  if (lower === null || last === null) return null;
  const upper = Math.max(lower + 1, last + 1);
  return { lowerBinId: lower, upperBinId: Math.min(upper, lower + DLMM_MAX_POSITION_WIDTH) };
}

/** Y (quote) sits in bins at or below the active bin, X (base) at or above it. */
export function sidesForRange(range: BinRange, activeBinId: number) {
  return { x: range.upperBinId - 1 >= activeBinId, y: range.lowerBinId <= activeBinId };
}

const binsOf = (range: BinRange) =>
  Array.from({ length: Math.max(0, range.upperBinId - range.lowerBinId) }, (_, i) => range.lowerBinId + i);

/**
 * Per-side weight by distance from the active bin. Bid-ask grows linearly toward the range edge;
 * curve is its mirror image, largest at the price and shrinking linearly to the edge.
 */
function weight(shape: DlmmShape, distance: number, span: { min: number; max: number }): number {
  if (shape === "spot") return 1;
  if (shape === "bidAsk") return distance + 1;
  return span.min + span.max - distance + 1;
}

/** Preview of how amounts spread over bins. An approximation of the SDK strategies, for display only. */
export function distribution(range: BinRange, activeBinId: number, shape: DlmmShape, amountX: number, amountY: number) {
  const bins = binsOf(range);
  const xBins = bins.filter((b) => b >= activeBinId);
  const yBins = bins.filter((b) => b <= activeBinId);
  // Measured from the active bin, or from the nearest range edge when the range sits on one side of it.
  const spanX = { min: xBins.length ? xBins[0] - activeBinId : 0, max: xBins.length ? xBins[xBins.length - 1] - activeBinId : 0 };
  const spanY = { min: yBins.length ? activeBinId - yBins[yBins.length - 1] : 0, max: yBins.length ? activeBinId - yBins[0] : 0 };
  const wx = (b: number) => weight(shape, b - activeBinId, spanX);
  const wy = (b: number) => weight(shape, activeBinId - b, spanY);
  const sumX = xBins.reduce((a, b) => a + wx(b), 0);
  const sumY = yBins.reduce((a, b) => a + wy(b), 0);
  return bins.map((binId) => ({
    binId,
    x: binId >= activeBinId && sumX > 0 ? (amountX * wx(binId)) / sumX : 0,
    y: binId <= activeBinId && sumY > 0 ? (amountY * wy(binId)) / sumY : 0,
  }));
}

/** Suggests the other token's amount so each side carries equal value per bin at the active price. */
export function suggestOtherSide(
  side: "x" | "y",
  amount: number,
  activePrice: number,
  range: BinRange,
  activeBinId: number,
): number {
  const bins = binsOf(range);
  const xBins = bins.filter((b) => b >= activeBinId).length;
  const yBins = bins.filter((b) => b <= activeBinId).length;
  if (xBins === 0 || yBins === 0 || !(activePrice > 0)) return 0;
  return side === "x" ? ((amount * activePrice) / xBins) * yBins : (amount / activePrice / yBins) * xBins;
}
