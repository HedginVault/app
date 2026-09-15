import { formatPrice } from "@/lib/format";

/** Min · current · max on one line, with the current price marker clamped to the edges when out of range. */
export function PriceRangeLine({
  lower,
  upper,
  active,
  inRange,
  quoteSymbol,
}: {
  lower: number;
  upper: number;
  active: number;
  inRange: boolean;
  quoteSymbol: string;
}) {
  const span = upper - lower;
  const pos = span > 0 ? Math.min(1, Math.max(0, (active - lower) / span)) : 0.5;
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-slate-100">
        <div className={inRange ? "absolute inset-0 rounded-full bg-emerald-200" : "absolute inset-0 rounded-full bg-amber-100"} />
        <div
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${inRange ? "bg-emerald-600" : "bg-amber-500"}`}
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-[12px] tabular-nums">
        <span className="text-muted">Min {formatPrice(lower)}</span>
        <span className="text-center font-medium">{formatPrice(active)} {quoteSymbol}</span>
        <span className="text-right text-muted">Max {formatPrice(upper)}</span>
      </div>
    </div>
  );
}
