"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { TokenLogo } from "@/components/token/token-logo";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocketStatus, type MarketStats } from "@/hooks/use-phoenix-live";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import { formatCountdown, formatMarketPrice, formatSignedPercent, fundingCountdown, priceDecimals } from "@/lib/perps";
import type { PhoenixMarketCategory, PhoenixMarketView } from "@/lib/types";

const change = (s: MarketStats | undefined) => (s && s.prevDayMarkPrice > 0 ? s.markPrice / s.prevDayMarkPrice - 1 : null);

function Metric({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="shrink-0" title={title}>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium tabular-nums">{children}</div>
    </div>
  );
}

/** Mark price that flashes toward its direction on each change, then settles. */
function LivePrice({ value, decimals }: { value: number | undefined; decimals: number }) {
  const prev = useRef(value);
  const [tone, setTone] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value === undefined || prev.current === undefined || value === prev.current) {
      prev.current = value;
      return;
    }
    setTone(value > prev.current ? "up" : "down");
    prev.current = value;
    const t = setTimeout(() => setTone(null), 600);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className={cn("text-xl font-semibold tabular-nums transition-colors duration-300", tone === "up" && "text-sky-400", tone === "down" && "text-red-400")}>
      {value === undefined ? "—" : `$${formatMarketPrice(value, decimals)}`}
    </span>
  );
}

function FundingCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-muted">{formatCountdown(fundingCountdown(now))}</span>;
}

type Category = "all" | PhoenixMarketCategory;

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "crypto", label: "Crypto" },
  { id: "commodities", label: "Commodities" },
  { id: "equities", label: "Equities" },
];

function MarketPicker({
  markets,
  stats,
  onSelect,
  onClose,
}: {
  markets: PhoenixMarketView[];
  stats: Map<string, MarketStats>;
  onSelect: (symbol: string) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category>("all");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const rows = useMemo(
    () =>
      markets
        .filter((m) => category === "all" || m.category === category)
        .sort((a, b) => (stats.get(b.symbol)?.dayVolumeUsd ?? 0) - (stats.get(a.symbol)?.dayVolumeUsd ?? 0)),
    [markets, stats, category],
  );
  const clamped = Math.min(active, Math.max(0, rows.length - 1));

  useEffect(() => {
    list.current?.children[clamped]?.scrollIntoView({ block: "nearest" });
  }, [clamped]);

  const pick = (c: Category) => {
    setCategory(c);
    setActive(0);
  };

  const onKey = (e: KeyboardEvent) => {
    const at = CATEGORIES.findIndex((c) => c.id === category);
    if (e.key === "ArrowDown") setActive(Math.min(rows.length - 1, clamped + 1));
    else if (e.key === "ArrowUp") setActive(Math.max(0, clamped - 1));
    else if (e.key === "ArrowRight") pick(CATEGORIES[(at + 1) % CATEGORIES.length].id);
    else if (e.key === "ArrowLeft") pick(CATEGORIES[(at + CATEGORIES.length - 1) % CATEGORIES.length].id);
    else if (e.key === "Enter" && rows[clamped]) onSelect(rows[clamped].symbol);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <div className="w-[min(calc(100vw-4rem),560px)]" onKeyDown={onKey}>
      <div role="group" aria-label="Market category" className="flex gap-1 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            autoFocus={c.id === category}
            aria-pressed={c.id === category}
            aria-controls="perp-market-list"
            onClick={() => pick(c.id)}
            className={cn(
              "h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-400",
              c.id === category ? "bg-accent-soft text-sky-400" : "text-muted hover:bg-white/[0.05] hover:text-white",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_84px_64px] px-2 pb-1 text-[11px] text-muted sm:grid-cols-[minmax(0,1fr)_96px_72px_88px]">
        <span>Market</span>
        <span className="text-right">Price</span>
        <span className="text-right">24h</span>
        <span className="hidden text-right sm:block">Volume</span>
      </div>
      <ul id="perp-market-list" ref={list} role="listbox" aria-label="Markets" className="max-h-96 overflow-y-auto">
        {rows.length === 0 && (
          <li className="px-2 py-6 text-center text-[13px] text-muted">
            No {CATEGORIES.find((c) => c.id === category)?.label.toLowerCase()} markets are tradable on cross margin right now
          </li>
        )}
        {rows.map((m, i) => {
          const s = stats.get(m.symbol);
          const c = change(s);
          return (
            <li key={m.symbol} role="option" aria-selected={i === clamped}>
              <button
                type="button"
                onClick={() => onSelect(m.symbol)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_84px_64px] items-center rounded-md px-2 py-2.5 text-left text-[13px] tabular-nums sm:grid-cols-[minmax(0,1fr)_96px_72px_88px] sm:py-2",
                  i === clamped ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <TokenLogo token={{ symbol: m.symbol, logo: m.logoUri }} size="sm" />
                  <span className="font-medium">{m.symbol}</span>
                  <span className="hidden truncate text-muted sm:inline">{m.name}</span>
                  <span className="rounded bg-white/[0.06] px-1 text-[10px] text-white/70">{m.maxLeverage}x</span>
                </span>
                <span className="text-right">{s ? formatMarketPrice(s.markPrice, priceDecimals(m)) : "—"}</span>
                <span className={cn("text-right", c === null ? "text-muted" : c >= 0 ? "text-sky-400" : "text-red-400")}>
                  {c === null ? "—" : formatSignedPercent(c)}
                </span>
                <span className="hidden text-right text-muted sm:block">{s ? formatUsd(s.dayVolumeUsd, { compact: true }) : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Market selector and the selected market's live stats, one strip across the trading column. */
export function MarketHeader({
  market,
  markets,
  stats,
  loading,
  onSelect,
}: {
  market: PhoenixMarketView;
  markets: PhoenixMarketView[];
  stats: Map<string, MarketStats>;
  loading: boolean;
  onSelect: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = useSocketStatus();
  const s = stats.get(market.symbol);
  const c = change(s);
  const decimals = priceDecimals(market);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <Card className="relative z-20">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-3 py-3 sm:px-4">
        <div ref={ref} className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <TokenLogo token={{ symbol: market.symbol, logo: market.logoUri }} size="lg" />
            <span className="text-left">
              <span className="flex items-center gap-2 text-[16px] font-semibold">
                {market.symbol}-PERP
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-sky-400">{market.maxLeverage}x</span>
              </span>
              <span className="block text-[12px] text-muted">{market.name}</span>
            </span>
            <svg aria-hidden viewBox="0 0 20 20" className={cn("size-4 text-muted transition-transform", open && "rotate-180")}>
              <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div className="absolute left-0 top-full z-30 mt-2 rounded-xl border border-border bg-surface p-2 shadow-2xl">
              <MarketPicker
                markets={markets}
                stats={stats}
                onClose={() => setOpen(false)}
                onSelect={(symbol) => {
                  onSelect(symbol);
                  setOpen(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Phones: selector and live mark share the first row, the stats sit in a grid below. */}
        <div className="ml-auto shrink-0 text-right sm:ml-0 sm:text-left">
          <LivePrice value={s?.markPrice} decimals={decimals} />
          <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted sm:justify-start">
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", status === "live" ? "bg-sky-400" : status === "connecting" ? "bg-amber-300" : "bg-red-400")}
            />
            {status === "live" ? "Live mark" : status === "connecting" ? "Connecting" : "Reconnecting, polling"}
          </div>
        </div>

        {loading && !s ? (
          <Skeleton className="h-9 w-full sm:w-80" />
        ) : (
          <div className="grid w-full grid-cols-3 gap-x-4 gap-y-3 border-t border-border pt-3 sm:flex sm:w-auto sm:min-w-0 sm:flex-1 sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 sm:border-0 sm:pt-0">
            <Metric label="Oracle">{s ? `$${formatMarketPrice(s.oraclePrice, decimals)}` : "—"}</Metric>
            <Metric label="24h change">
              <span className={c === null ? "" : c >= 0 ? "text-sky-400" : "text-red-400"}>
                {c === null ? (
                  "—"
                ) : (
                  <>
                    <span className="hidden sm:inline">{`${c >= 0 ? "+" : "−"}$${formatMarketPrice(Math.abs(s!.markPrice - s!.prevDayMarkPrice), decimals)} `}</span>
                    <span className="sm:hidden">{formatSignedPercent(c)}</span>
                    <span className="hidden sm:inline">({formatSignedPercent(c)})</span>
                  </>
                )}
              </span>
            </Metric>
            <Metric label="24h volume">{s ? formatUsd(s.dayVolumeUsd, { compact: true }) : "—"}</Metric>
            <Metric label="Open interest">{s ? formatUsd(s.openInterest * s.markPrice, { compact: true }) : "—"}</Metric>
            <Metric
              label="Funding (1h)"
              title={s ? `${(s.fundingRate * 24 * 365).toFixed(2)}% annualized. Positive: longs pay shorts.` : undefined}
            >
              <span className={s ? (s.fundingRate >= 0 ? "text-sky-400" : "text-red-400") : ""}>
                {s ? `${s.fundingRate.toFixed(4)}%` : "—"}
              </span>{" "}
              <FundingCountdown />
            </Metric>
          </div>
        )}
      </div>
    </Card>
  );
}
