/** Thin bar showing where the active price sits inside the position's range. */
export function PriceRangeLine({
  lower,
  upper,
  active,
  inRange,
}: {
  lower: number;
  upper: number;
  active: number;
  inRange: boolean;
}) {
  const span = upper - lower;
  const pos = span > 0 ? Math.min(1, Math.max(0, (active - lower) / span)) : 0.5;
  return (
    <div className="relative h-1 w-full max-w-40 rounded-full bg-white/[0.06]">
      <div
        className={`absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${inRange ? "bg-emerald-400" : "bg-amber-400"}`}
        style={{ left: `${pos * 100}%` }}
      />
    </div>
  );
}
