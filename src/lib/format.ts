import { NAV_PRECISION } from "./constants";

const toBig = (v: string | bigint) => (typeof v === "bigint" ? v : BigInt(v));

const groupInt = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function toUiNumber(raw: string | bigint, decimals: number): number {
  return Number(toBig(raw)) / 10 ** decimals;
}

export function formatTokenAmount(
  raw: string | bigint,
  decimals: number,
  opts: { compact?: boolean; maxFraction?: number } = {},
): string {
  const value = toBig(raw);
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

export function parseTokenAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const [int = "0", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const raw =
    BigInt(int || "0") * 10n ** BigInt(decimals) + BigInt((frac || "0").padEnd(decimals, "0"));
  return raw;
}
