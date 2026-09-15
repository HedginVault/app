import { cn } from "@/lib/cn";

export interface ChartBin {
  binId: number;
  /** Token X share of the bin, in token-Y value units. */
  x: number;
  /** Token Y share of the bin. */
  y: number;
}

/** Stacked bar per bin: Y (sky) below, X (emerald) above, active bin outlined. Scrolls horizontally when wide. */
export function BinChart({
  bins,
  activeBinId,
  xLabel,
  yLabel,
  height = 96,
}: {
  bins: ChartBin[];
  activeBinId: number;
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const max = Math.max(0, ...bins.map((b) => b.x + b.y));
  if (bins.length === 0) return null;
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-px" style={{ height, minWidth: bins.length * 5 }}>
          {bins.map((b) => {
            const total = b.x + b.y;
            const pct = max > 0 ? (total / max) * 100 : 0;
            return (
              <div
                key={b.binId}
                title={`Bin ${b.binId}`}
                className={cn(
                  "flex h-full min-w-1 flex-1 flex-col justify-end",
                  b.binId === activeBinId && "rounded-sm outline outline-1 outline-slate-400",
                )}
              >
                <div className="flex flex-col overflow-hidden rounded-t-sm" style={{ height: `${Math.max(pct, total > 0 ? 2 : 0)}%` }}>
                  <div className="bg-emerald-500" style={{ flexGrow: total > 0 ? b.x / total : 0 }} />
                  <div className="bg-sky-400" style={{ flexGrow: total > 0 ? b.y / total : 0 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-500" />{xLabel}</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-sky-400" />{yLabel}</span>
        <span className="flex items-center gap-1"><span className="size-2 rounded-sm outline outline-1 outline-slate-400" />Active bin</span>
      </div>
    </div>
  );
}
