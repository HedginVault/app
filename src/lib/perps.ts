import { formatUsd, parseTokenAmount, toUiNumber } from "./format";
import type { PerpPositionView } from "./types";

/** Phoenix amounts are USDC atoms: one quote lot each. */
export const USDC_DECIMALS = 6;

export const usdc = (raw: string | bigint) => toUiNumber(raw, USDC_DECIMALS);

export function perpTotals(p: Pick<PerpPositionView, "positions">) {
  return p.positions.reduce(
    (a, q) => ({
      unrealizedPnl: a.unrealizedPnl + BigInt(q.unrealizedPnl),
      accruedFunding: a.accruedFunding + BigInt(q.accruedFunding),
      notional: a.notional + BigInt(q.notional),
    }),
    { unrealizedPnl: 0n, accruedFunding: 0n, notional: 0n },
  );
}

/** "+$1.23" / "−$1.23"; amounts under half a cent read "$0.00" rather than a signed "<$0.01". */
export const formatSignedUsd = (raw: string | bigint) => formatSignedUsdValue(usdc(raw));

/** `formatSignedUsd` for a USD number. */
export function formatSignedUsdValue(n: number): string {
  const cents = Math.round(Math.abs(n) * 100) / 100;
  if (cents === 0) return "$0.00";
  return `${n > 0 ? "+" : "-"}${formatUsd(cents)}`;
}

/** Tone for a USD number, neutral when it rounds to $0.00. */
export const signToneValue = (n: number) => {
  const cents = Math.round(n * 100);
  return cents > 0 ? "text-emerald-400" : cents < 0 ? "text-red-400" : "text-muted";
};

export const formatLeverage = (leverage: number | null) => (leverage === null ? "—" : `${leverage.toFixed(2)}x`);

/** Tailwind text color for a signed USDC amount: positive, negative, zero. */
export const signTone = (raw: string | bigint) => {
  // Matches `formatSignedUsd`: anything that displays as $0.00 reads as neutral.
  const n = Math.round(usdc(raw) * 100);
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted";
};

/** The smallest order size step of a market, as a decimal string: 10^-baseLotsDecimals. */
export const lotStep = (baseLotsDecimals: number) =>
  baseLotsDecimals >= 0 ? (1 / 10 ** baseLotsDecimals).toFixed(baseLotsDecimals) : String(10 ** -baseLotsDecimals);

/**
 * Whole base units → base lots, or null when the size is malformed, zero or not a multiple of the
 * lot step. `baseLotsDecimals` may be negative (one lot = 100 units at -2).
 */
export function sizeToLots(size: string, baseLotsDecimals: number): bigint | null {
  if (baseLotsDecimals >= 0) {
    const lots = parseTokenAmount(size, baseLotsDecimals);
    return lots && lots > 0n ? lots : null;
  }
  const units = parseTokenAmount(size, 0);
  const step = 10n ** BigInt(-baseLotsDecimals);
  return units && units > 0n && units % step === 0n ? units / step : null;
}

/**
 * Gross notional after an order fills at `price`, in USD; pure. The order nets against an open
 * position in the same market, so an opposite-side order lowers exposure until it flips it.
 */
export function postTradeNotional(
  positions: Pick<PerpPositionView["positions"][number], "symbol" | "side" | "size" | "markPrice">[],
  order: { symbol: string; side: "long" | "short"; size: number; price: number },
): number {
  let net = order.side === "long" ? order.size : -order.size;
  let others = 0;
  for (const q of positions) {
    const signed = (q.side === "long" ? 1 : -1) * Number(q.size);
    if (q.symbol === order.symbol) net += signed;
    else others += Math.abs(signed) * Number(q.markPrice);
  }
  return others + Math.abs(net) * order.price;
}

/** Base units floored to whole lots, as the decimal string the order route takes; "0" when under one lot. */
export function floorToLots(base: number, baseLotsDecimals: number): string {
  if (!(base > 0) || !Number.isFinite(base)) return "0";
  if (baseLotsDecimals >= 0) {
    // The epsilon absorbs float noise like 2.9999999 lots from 0.3 / 0.1.
    const lots = Math.floor(base * 10 ** baseLotsDecimals + 1e-9);
    return lots === 0 ? "0" : (lots / 10 ** baseLotsDecimals).toFixed(baseLotsDecimals);
  }
  const step = 10 ** -baseLotsDecimals;
  return String(Math.floor(base / step + 1e-9) * step);
}

/**
 * Average price of taking `size` base units from one side of the book (asks for a buy, bids for a
 * sell), best level first. `filled` < `size` means the visible book is too thin.
 */
export function walkBook(levels: [price: number, size: number][], size: number): { avgPrice: number; worstPrice: number; filled: number } | null {
  let filled = 0;
  let cost = 0;
  let worstPrice = 0;
  for (const [price, available] of levels) {
    if (filled >= size) break;
    const take = Math.min(available, size - filled);
    filled += take;
    cost += take * price;
    worstPrice = price;
  }
  return filled > 0 ? { avgPrice: cost / filled, worstPrice, filled } : null;
}

/**
 * Estimated cross-margin liquidation price for one market after an order, holding every other
 * position's value fixed. Liquidation is where equity falls to maintenance margin:
 *   equity + s·(p − mark) = otherMaintenance + |s|·p·r
 * with s the signed size after the order, r = maintenance factor / max leverage. Null when flat or
 * when no positive price liquidates the account.
 */
export function estimateLiquidationPrice(a: {
  /** Account equity at `mark` after the order's fee and slippage, USD. */
  equity: number;
  /** Maintenance margin of every other position, USD. */
  otherMaintenance: number;
  /** Signed base size in this market after the order. */
  size: number;
  mark: number;
  maxLeverage: number;
  maintenanceFactor: number;
}): number | null {
  const { equity, otherMaintenance, size: s, mark, maxLeverage, maintenanceFactor } = a;
  if (s === 0) return null;
  const r = maintenanceFactor / maxLeverage;
  const p = (otherMaintenance - equity + s * mark) / (s - Math.abs(s) * r);
  return Number.isFinite(p) && p > 0 ? p : null;
}

/** Seconds until the next funding payment, which Phoenix settles on each whole interval (hourly). */
export const fundingCountdown = (nowMs: number, intervalSeconds = 3_600) => intervalSeconds - (Math.floor(nowMs / 1000) % intervalSeconds);

export const formatCountdown = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, "0")).join(":");

/** Signed percent with two decimals, e.g. "+1.24%". */
export const formatSignedPercent = (fraction: number) => `${fraction >= 0 ? "+" : ""}${(fraction * 100).toFixed(2)}%`;

/** Decimals of one price tick in USD: tick = tickSize × 10^baseLotsDecimals / 10^6 (SOL: 0.01 → 2, BTC: 1 → 0). */
export function priceDecimals(m: { tickSize: number; baseLotsDecimals: number }): number {
  const tick = (m.tickSize * 10 ** m.baseLotsDecimals) / 1e6;
  return tick > 0 ? Math.min(10, Math.max(0, Math.ceil(-Math.log10(tick) - 1e-9))) : 2;
}

/** A price at the market's tick precision, grouped: "1,234.56". */
export const formatMarketPrice = (n: number | null | undefined, decimals: number) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** A base-unit size at the market's lot precision. */
export const formatBaseSize = (n: number, baseLotsDecimals: number, fixed = false) =>
  n.toLocaleString("en-US", { minimumFractionDigits: fixed ? Math.max(0, baseLotsDecimals) : 0, maximumFractionDigits: Math.max(0, baseLotsDecimals) });
