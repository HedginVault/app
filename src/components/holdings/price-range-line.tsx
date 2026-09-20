import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

/**
 * The position's price range as a track: min on the left, max on the right, a dot where the pool
 * price sits. Out of range the dot pins to the edge it left and the track turns amber.
 */
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
  const tone = inRange ? "bg-sky-400" : "bg-amber-400";
  return (
    <div>
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.06]">
        <div className={cn("absolute inset-y-0 left-0 rounded-full opacity-40", tone)} style={{ width: `${pos * 100}%` }} />
        <div
          className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", tone)}
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px] tabular-nums text-muted">
        <span>Min {formatPrice(lower)}</span>
        <span className={cn("font-medium", inRange ? "text-foreground" : "text-amber-300")}>
          {formatPrice(active)} {quoteSymbol}
        </span>
        <span>Max {formatPrice(upper)}</span>
      </div>
    </div>
  );
}
