"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandles } from "@/hooks/use-candles";
import { useLiveCandle } from "@/hooks/use-phoenix-live";
import { mergeCandles } from "@/lib/chart-ranges";
import type { MarketTimeframe } from "@/lib/types";
import { PhoenixMark } from "../powered-by";
import { PriceChart, type ChartLine } from "../price-chart";

const TIMEFRAMES: { id: Exclude<MarketTimeframe, "1w">; label: string }[] = [
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
];
/** Matches the order book beside it (ten levels a side plus headers); shorter on phones, where the book stacks below. */
const HEIGHT = 540;
const COMPACT_HEIGHT = 360;
const WIDE = "(min-width: 1024px)";
const useChartHeight = () =>
  useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia(WIDE);
      q.addEventListener("change", cb);
      return () => q.removeEventListener("change", cb);
    },
    () => (window.matchMedia(WIDE).matches ? HEIGHT : COMPACT_HEIGHT),
    () => HEIGHT,
  );

/** Phoenix trade candles for the selected market, the forming bar streamed live, with position and order lines. */
export function PerpChart({ symbol, lines }: { symbol: string; lines: ChartLine[] }) {
  const [tf, setTf] = useState<Exclude<MarketTimeframe, "1w">>("15m");
  const target = useMemo(() => ({ perp: symbol }), [symbol]);
  const { latest, candles, loadMore } = useCandles(target, tf, null);
  const live = useLiveCandle(symbol, tf);
  const height = useChartHeight();
  const merged = useMemo(() => (live ? mergeCandles(candles, [live]) : candles), [candles, live]);

  return (
    <Card className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <Segmented size="sm" value={tf} onChange={setTf} options={TIMEFRAMES} />
        <div className="flex items-center gap-3 text-[11px] text-muted">
          {lines.map((l) => (
            <span key={l.title} className="hidden items-center gap-1.5 sm:flex">
              <span aria-hidden className="h-px w-3" style={{ backgroundColor: l.color }} />
              {l.title}
            </span>
          ))}
          <span className="flex items-center gap-1.5" title="Trade candles from Phoenix">
            Data <PhoenixMark className="text-[12px]" />
          </span>
        </div>
      </div>
      <div className="px-2 py-2">
        {latest.error ? (
          <div className="grid place-items-center" style={{ height }}>
            <ErrorState message={`Chart unavailable: ${latest.error.message}`} onRetry={() => void latest.refetch()} />
          </div>
        ) : !latest.data ? (
          <Skeleton className="h-[360px] lg:h-[540px]" />
        ) : (
          <PriceChart candles={merged} height={height} view={{ key: `${symbol}:${tf}` }} intraday={tf !== "1d"} onLoadMore={loadMore} lines={lines} />
        )}
      </div>
    </Card>
  );
}
