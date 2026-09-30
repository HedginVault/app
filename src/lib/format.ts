import { NAV_PRECISION } from "./constants";

const toBig = (v: string | bigint) => (typeof v === "bigint" ? v : BigInt(v));

const groupInt = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * How a token's base units are shown: its decimals, plus for a Token-2022 ScaledUiAmount mint the
 * multiplier wallets and explorers apply (UI amount = raw × uiMultiplier). A bare number is decimals
 * with no scaling, which is what USD math (`usdValue`, priced per raw token) always wants.
 */
export type TokenUnit = number | { decimals: number; uiMultiplier?: number };

const unitOf = (unit: TokenUnit) =>
  typeof unit === "number" ? { decimals: unit, m: 1 } : { decimals: unit.decimals, m: unit.uiMultiplier ?? 1 };

/** Multipliers as a 1e12 fixed-point bigint, so raw ⇄ UI scaling stays exact integer math. */
const M_SCALE = 1_000_000_000_000n;
const fixedM = (m: number) => BigInt(Math.round(m * Number(M_SCALE)));

/** Raw base units → UI base units (same decimals), rounded toward zero. */
export const rawToUiUnits = (raw: bigint, m: number) => (m === 1 ? raw : (raw * fixedM(m)) / M_SCALE);
/** UI base units → raw base units, rounded toward zero so a parsed amount never exceeds what was typed. */
export const uiToRawUnits = (ui: bigint, m: number) => (m === 1 ? ui : (ui * M_SCALE) / fixedM(m));

/** Pool price (token Y per token X) in raw units → the UI-unit price wallets and Meteora show. */
export const toUiPrice = (rawPrice: number, x: TokenUnit, y: TokenUnit) => (rawPrice * unitOf(y).m) / unitOf(x).m;
/** Inverse of `toUiPrice`: a UI-unit price typed by the user → the raw-unit price bins are keyed on. */
export const toRawPrice = (uiPrice: number, x: TokenUnit, y: TokenUnit) => (uiPrice * unitOf(x).m) / unitOf(y).m;
/** USD per UI token, for showing a token's price (`priceUsd` itself is per raw token). */
export const uiPriceUsd = (token: { priceUsd: number | null; uiMultiplier?: number }) =>
  token.priceUsd === null ? null : token.priceUsd / (token.uiMultiplier ?? 1);

export function toUiNumber(raw: string | bigint, unit: TokenUnit): number {
  const { decimals, m } = unitOf(unit);
  return (Number(toBig(raw)) / 10 ** decimals) * m;
}

export function formatTokenAmount(
  raw: string | bigint,
  unit: TokenUnit,
  opts: { compact?: boolean; maxFraction?: number } = {},
): string {
  const { decimals, m } = unitOf(unit);
  const value = rawToUiUnits(toBig(raw), m);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const intPart = abs / base;

  if (opts.compact && intPart >= 1_000_000n) {
    const ui = Number(abs) / 10 ** decimals;
    const units: [number, string][] = [
      [1e9, "B"],
      [1e6, "M"],
    ];
    for (const [size, suffix] of units) {
      if (ui >= size) {
        const n = ui / size;
        // Only strip trailing zeros when a decimal point is present: "250" must not become "25".
        const s = n >= 100 ? n.toFixed(0) : n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
        return `${negative ? "-" : ""}${s}${suffix}`;
      }
    }
  }

  const maxFraction = opts.maxFraction ?? decimals;
  if (maxFraction < decimals) {
    const ui = Number(abs) / 10 ** decimals;
    const s = ui.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFraction,
    });
    return `${negative ? "-" : ""}${s}`;
  }
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const int = groupInt(intPart.toString());
  return `${negative ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatNav(navRaw: string | bigint): string {
  return (Number(toBig(navRaw)) / Number(NAV_PRECISION)).toFixed(4);
}

export function shortAddress(addr: string, chars = 4): string {
  return addr.length <= chars * 2 + 1 ? addr : `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatRelative(ts: number, now = Date.now() / 1000): string {
  const diff = Math.round(now - ts);
  const abs = Math.abs(diff);
  const unit = (n: number, u: string) => `${n}${u}`;
  let label: string;
  if (abs < 60) return diff >= 0 ? "just now" : "in a moment";
  if (abs < 3600) label = unit(Math.floor(abs / 60), "m");
  else if (abs < 86400) label = unit(Math.floor(abs / 3600), "h");
  else label = unit(Math.floor(abs / 86400), "d");
  return diff >= 0 ? `${label} ago` : `in ${label}`;
}

export function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function parseTokenAmount(input: string, unit: TokenUnit): bigint | null {
  const { decimals, m } = unitOf(unit);
  const trimmed = input.trim();
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const [int = "0", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const ui =
    BigInt(int || "0") * 10n ** BigInt(decimals) + BigInt((frac || "0").padEnd(decimals, "0"));
  return uiToRawUnits(ui, m);
}

/** USD value of a base-unit amount, or null when the price is unknown. */
export function usdValue(raw: string | bigint, decimals: number, priceUsd: number | null): number | null {
  if (priceUsd === null) return null;
  return toUiNumber(raw, decimals) * priceUsd;
}

export function formatUsd(n: number | null, opts: { compact?: boolean } = {}): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs === 0) return "$0.00";
  if (abs < 0.01) return `${sign}<$0.01`;
  if (opts.compact && abs >= 100_000) {
    const [size, suffix] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : [1e3, "K"];
    return `${sign}$${(abs / size).toFixed(2).replace(/\.?0+$/, "")}${suffix}`;
  }
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Token prices: two decimals at or above 1, four significant digits below. */
export function formatPrice(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Number(n.toPrecision(4)).toString();
}

export function formatShare(bps: number | null): string {
  if (bps === null) return "—";
  if (bps > 0 && bps < 10) return "<0.1%";
  return `${(bps / 100).toFixed(1)}%`;
}

/** Fraction digits for display: 2 at or above 1,000, 4 at or above 1, 6 below. */
export function displayFraction(raw: string | bigint, unit: TokenUnit): number {
  const ui = Math.abs(toUiNumber(raw, unit));
  return ui >= 1000 ? 2 : ui >= 1 ? 4 : 6;
}

/** Base units as a plain decimal string for an input field (no grouping, no trailing zeros). */
export function rawToInput(raw: string | bigint, unit: TokenUnit): string {
  return formatTokenAmount(raw, unit).replace(/,/g, "");
}
