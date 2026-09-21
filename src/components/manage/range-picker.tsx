"use client";

import { cn } from "@/lib/cn";
import type { DlmmShape } from "@/lib/types";

/** Tiny bar glyph per shape, echoing how liquidity spreads around the price. */
export function ShapeIcon({ shape }: { shape: DlmmShape }) {
  const heights =
    shape === "spot" ? [6, 6, 6, 6, 6, 6, 6] : shape === "curve" ? [2, 4, 7, 9, 7, 4, 2] : [9, 7, 4, 2, 4, 7, 9];
  return (
    <svg viewBox="0 0 20 10" className="h-2.5 w-5" aria-hidden>
      {heights.map((h, i) => (
        <rect key={i} x={i * 3} y={10 - h} width="2" height={h} rx="0.5" fill="currentColor" />
      ))}
    </svg>
  );
}

// Placeholder silhouette shown blurred while no amount is entered.
const GHOST = Array.from({ length: 40 }, (_, i) => 35 + 45 * Math.exp(-((i - 20) ** 2) / 120));

/**
 * Meteora-style range picker.
 * Top: liquidity preview over the selected bins only, so bars always fill the width. Bars are keyed by
 * position, so when the range changes each bar eases from its old height to its new one; extra bars grow up.
 * Bottom: the wider bin domain with selected/active bins tinted and a two-handle slider on top.
 */
export function RangePicker({
  domain,
  lower,
  last,
  activeBinId,
  bins,
  priceLabel,
  tickLabel,
  onChange,
  disabled = false,
}: {
  domain: { lo: number; hi: number };
  /** Inclusive first and last bin of the range. */
  lower: number;
  last: number;
  activeBinId: number;
  /** Value (in token Y units) per bin inside the range. */
  bins: { binId: number; x: number; y: number }[];
  priceLabel: string;
  tickLabel: (binId: number) => string;
  onChange: (lower: number, last: number, moved: "lower" | "last") => void;
  /** Locks the handles and shows a placeholder until the manager enters an amount. */
  disabled?: boolean;
}) {
  const width = last - lower + 1;
  const byId = new Map(bins.map((b) => [b.binId, b]));
  const max = Math.max(0, ...bins.map((b) => b.x + b.y));
  // Pool price marker inside the selected range; pinned to the nearer edge when the range sits on one side.
  const markerPct = Math.min(100, Math.max(0, ((activeBinId - lower + 0.5) / width) * 100));
  const markerAlign = markerPct < 20 ? "left" : markerPct > 80 ? "right" : "center";

  const span = domain.hi - domain.lo;
  const domainPct = (bin: number) => ((bin - domain.lo) / span) * 100;
  const thumb =
    "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent focus-visible:outline-none " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(0,0,0,0.4)] active:[&::-webkit-slider-thumb]:cursor-grabbing focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-white/60 " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-accent";

  return (
    <div className="select-none space-y-3">
      {/* ── liquidity preview ── */}
      {disabled ? (
        <div className="relative h-36">
          <div className="flex h-full items-end gap-[2px] blur-sm" aria-hidden>
            {GHOST.map((h, i) => (
              <div key={i} className={cn("flex-1 rounded-t-[4px]", i < 20 ? "bg-indigo-400/40" : "bg-sky-400/40")} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-medium">No liquidity selected</span>
            <span className="text-[12px] text-muted">Enter an amount and select a price range</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="relative h-36 pt-10">
            <div
              className="pointer-events-none absolute inset-y-0 z-10 transition-[left] duration-300 ease-out"
              style={{ left: `${markerPct}%` }}
            >
              <div
                className={cn(
                  "absolute top-0 rounded-md bg-[#252b36] px-1.5 py-1 text-center text-[10px] leading-[1.4] font-medium whitespace-nowrap",
                  markerAlign === "left" ? "left-0" : markerAlign === "right" ? "right-0" : "-translate-x-1/2",
                )}
              >
                <div className="text-muted">Pool price</div>
                <div className="tabular-nums">{priceLabel}</div>
              </div>
              <div className="absolute top-10 bottom-0 border-l-2 border-dashed border-white/90" />
            </div>
            <div className="flex h-full items-end gap-[2px] border-b border-white/15">
              {Array.from({ length: width }, (_, i) => {
                const b = byId.get(lower + i);
                const total = b ? b.x + b.y : 0;
                const h = max > 0 && total > 0 ? Math.max((total / max) * 100, 2) : 0;
                return (
                  <div key={i} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={tickLabel(lower + i)}>
                    {/* keyed by position: an existing bar eases to its new height, a new bar grows up */}
                    <div
                      className="flex origin-bottom animate-bin-rise flex-col overflow-hidden rounded-t-[4px] transition-[height] duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:brightness-125 motion-reduce:animate-none motion-reduce:transition-none"
                      style={{ height: `${h}%` }}
                    >
                      <div className="bg-indigo-400 transition-[flex-grow] duration-700" style={{ flexGrow: total > 0 ? b!.x / total : 0 }} />
                      <div className="bg-sky-400 transition-[flex-grow] duration-700" style={{ flexGrow: total > 0 ? b!.y / total : 0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted">
            <span>{tickLabel(lower)}</span>
            {width > 2 && <span>{tickLabel(Math.round((lower + last) / 2))}</span>}
            <span>{tickLabel(last)}</span>
          </div>
        </div>
      )}

      {/* ── domain strip + slider ── */}
      <div className={cn(disabled && "opacity-40")}>
        <div className="relative">
          <div className="flex h-8 items-end gap-px" aria-hidden>
            {Array.from({ length: span + 1 }, (_, i) => {
              const bin = domain.lo + i;
              const selected = !disabled && bin >= lower && bin <= last;
              return (
                <div
                  key={bin}
                  className={cn(
                    "h-full flex-1 rounded-t-[1px] transition-colors duration-200",
                    bin === activeBinId ? "bg-accent" : selected ? "bg-accent/35" : "bg-white/[0.08]",
                  )}
                />
              );
            })}
          </div>
          <div className="absolute inset-x-0 -bottom-2.5 h-5">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
            {!disabled && (
              <div
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${domainPct(lower)}%`, width: `${domainPct(last) - domainPct(lower)}%` }}
              />
            )}
            {/* native range inputs: keyboard + touch for free; only the thumbs take pointer events */}
            {(["lower", "last"] as const).map((edge) => (
              <input
                key={edge}
                type="range"
                aria-label={edge === "lower" ? "Lowest bin" : "Highest bin"}
                min={domain.lo}
                max={domain.hi}
                value={edge === "lower" ? lower : last}
                disabled={disabled}
                onChange={(e) =>
                  edge === "lower" ? onChange(Number(e.target.value), last, "lower") : onChange(lower, Number(e.target.value), "last")
                }
                className={cn(thumb, disabled && "hidden")}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-between text-[10px] tabular-nums text-muted">
          <span>{tickLabel(domain.lo)}</span>
          <span>{tickLabel(Math.round((domain.lo + domain.hi) / 2))}</span>
          <span>{tickLabel(domain.hi)}</span>
        </div>
      </div>
    </div>
  );
}
