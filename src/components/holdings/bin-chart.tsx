"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { displayFraction, formatPrice, formatTokenAmount, formatUsd, toUiNumber } from "@/lib/format";
import type { TokenInfo } from "@/lib/types";

export interface PositionBin {
  binId: number;
  amountX: string;
  amountY: string;
}

/** What a bin still holds, valued in USD when prices are known and in quote terms otherwise. */
function binSplit(b: PositionBin, x: TokenInfo, y: TokenInfo, activePrice: number) {
  const ux = toUiNumber(b.amountX, x.decimals);
  const uy = toUiNumber(b.amountY, y.decimals);
  const priced = x.priceUsd !== null && y.priceUsd !== null;
  const vx = priced ? ux * x.priceUsd! : ux * activePrice;
  const vy = priced ? uy * y.priceUsd! : uy;
  return { vx, vy, total: vx + vy, priced };
}

const amountOf = (raw: string, t: TokenInfo) =>
  `${formatTokenAmount(raw, t.decimals, { maxFraction: displayFraction(raw, t.decimals) })} ${t.symbol}`;

/**
 * The position's range and its remaining liquidity in one chart. One bar per owned bin: height is
 * what the bin still holds relative to the fullest bin, and the bar is split into its X and Y parts
 * so a bin the price has crossed reads as converted. The pool price is a line through its bin —
 * out of range it pins to the edge it left and turns amber.
 */
export function BinChart({
  bins,
  tokenX: x,
  tokenY: y,
  range,
  priceLabel,
}: {
  bins: PositionBin[];
  tokenX: TokenInfo;
  tokenY: TokenInfo;
  range: { activeBinId: number; inRange: boolean; lowerPrice: string; upperPrice: string; activePrice: string };
  priceLabel: (binId: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (bins.length === 0) return null;
  const activePrice = Number(range.activePrice);
  const splits = bins.map((b) => binSplit(b, x, y, activePrice));
  const max = Math.max(...splits.map((s) => s.total));
  const priced = splits[0].priced;
  const scale = (v: number) => (priced ? formatUsd(v) : `${formatPrice(v)} ${y.symbol}`);

  // Centre of the active bin; clamped to the nearer edge when the price sits outside the range.
  const idx = bins.findIndex((b) => b.binId === range.activeBinId);
  const slot = idx >= 0 ? idx : range.activeBinId < bins[0].binId ? -0.5 : bins.length - 0.5;
  const markerPct = Math.min(100, Math.max(0, ((slot + 0.5) / bins.length) * 100));
  const markerAlign = markerPct < 15 ? "left" : markerPct > 85 ? "right" : "center";
  const tone = range.inRange ? "text-sky-300 border-sky-300" : "text-amber-300 border-amber-400";
  const hovered = hover !== null ? { bin: bins[hover], split: splits[hover] } : null;
  const hoverPct = hover !== null ? ((hover + 0.5) / bins.length) * 100 : 0;
  const hoverAlign = hoverPct < 20 ? "left" : hoverPct > 80 ? "right" : "center";

  return (
    <div>
      <div className="relative mt-1 h-28 pt-8">
        {hovered && (
          <BinTooltip
            bin={hovered.bin}
            split={hovered.split}
            tokenX={x}
            tokenY={y}
            price={priceLabel(hovered.bin.binId)}
            active={hovered.bin.binId === range.activeBinId}
            scale={scale}
            leftPct={hoverPct}
            align={hoverAlign}
          />
        )}
        <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${markerPct}%` }}>
          <div
            className={cn(
              "absolute top-0 whitespace-nowrap text-[11px] font-medium tabular-nums",
              tone,
              markerAlign === "left" ? "left-0" : markerAlign === "right" ? "right-0" : "-translate-x-1/2",
            )}
          >
            {formatPrice(activePrice)} {y.symbol}
          </div>
          <div className={cn("absolute top-7 bottom-0 border-l border-dashed", tone)} />
        </div>

        <div
          className="flex h-full items-end gap-px border-b border-white/10"
          role="img"
          aria-label={`Liquidity across ${bins.length} bins, fullest ${scale(max)}`}
          onPointerLeave={() => setHover(null)}
        >
          {bins.map((b, i) => {
            const s = splits[i];
            const height = max > 0 ? Math.max((s.total / max) * 100, 2) : 2;
            return (
              <div
                key={b.binId}
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                {/* Empty bins keep a 2% stub so the range's width stays readable. */}
                <div
                  className={cn(
                    "flex flex-col-reverse overflow-hidden rounded-t-[2px] transition-[filter]",
                    hover === i ? "brightness-125" : hover !== null && "brightness-75",
                  )}
                  style={{ height: `${height}%` }}
                >
                  <div className="bg-sky-400/80" style={{ flexGrow: s.total > 0 ? s.vy / s.total : 1 }} />
                  <div className="bg-emerald-400/80" style={{ flexGrow: s.total > 0 ? s.vx / s.total : 0 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between text-[11px] tabular-nums text-muted">
        <span>Min {formatPrice(Number(range.lowerPrice))}</span>
        <span>Max {formatPrice(Number(range.upperPrice))}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <Legend swatch={<span className="size-2 rounded-full bg-emerald-400/80" />} label={x.symbol} />
        <Legend swatch={<span className="size-2 rounded-full bg-sky-400/80" />} label={y.symbol} />
        <Legend swatch={<span className={cn("h-3 border-l border-dashed", tone)} />} label="Pool price" />
      </div>
    </div>
  );
}

/** Hover card for one bin: its price level, what it holds of each token, and the total. */
function BinTooltip({
  bin,
  split,
  tokenX: x,
  tokenY: y,
  price,
  active,
  scale,
  leftPct,
  align,
}: {
  bin: PositionBin;
  split: ReturnType<typeof binSplit>;
  tokenX: TokenInfo;
  tokenY: TokenInfo;
  price: string;
  active: boolean;
  scale: (v: number) => string;
  leftPct: number;
  align: "left" | "center" | "right";
}) {
  return (
    <div className="pointer-events-none absolute bottom-full z-20 mb-1" style={{ left: `${leftPct}%` }}>
      <div
        role="tooltip"
        className={cn(
          "absolute bottom-0 w-max min-w-48 rounded-[10px] border border-border bg-surface px-3 py-2 shadow-lg",
          align === "left" ? "left-0" : align === "right" ? "right-0" : "-translate-x-1/2",
        )}
      >
        <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] text-muted">
          <span className="tabular-nums">
            1 {x.symbol} = <span className="text-foreground">{price}</span>
          </span>
          {active && <span className="font-medium text-sky-300">Active</span>}
        </div>
        <TooltipRow swatch="bg-emerald-400/80" amount={amountOf(bin.amountX, x)} value={scale(split.vx)} />
        <TooltipRow swatch="bg-sky-400/80" amount={amountOf(bin.amountY, y)} value={scale(split.vy)} />
        <div className="mt-1.5 flex items-center justify-between gap-6 border-t border-white/[0.08] pt-1.5 text-[11px]">
          <span className="text-muted">Liquidity · bin {bin.binId}</span>
          <span className="font-semibold tabular-nums text-foreground">{scale(split.total)}</span>
        </div>
      </div>
    </div>
  );
}

const TooltipRow = ({ swatch, amount, value }: { swatch: string; amount: string; value: string }) => (
  <div className="flex items-center justify-between gap-6 text-[12px] tabular-nums">
    <span className="inline-flex items-center gap-1.5 text-foreground">
      <span className={cn("size-2 rounded-full", swatch)} />
      {amount}
    </span>
    <span className="text-muted">{value}</span>
  </div>
);

const Legend = ({ swatch, label }: { swatch: ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    {swatch}
    {label}
  </span>
);
