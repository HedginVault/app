"use client";

import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavHistory } from "@/hooks/queries";
import { NAV_PRECISION } from "@/lib/constants";
import type { NavHistoryPoint } from "@/lib/types";

const UP = "#34d399";
const DOWN = "#f87171";

/** One share's value in deposit-mint UI units: `nav_per_share` is already scaled by `NAV_PRECISION` alone (matches `formatNav`). */
const navPerShareUi = (point: NavHistoryPoint) => Number(BigInt(point.navPerShare)) / Number(NAV_PRECISION);

export function NavChart({ address, depositSymbol }: { address: string; depositSymbol: string }) {
  const history = useNavHistory(address);
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "rgba(255,255,255,0.55)", fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#0f151f" }, vertLine: { labelBackgroundColor: "#0f151f" } },
      // The chart sits mid-page: let the wheel and vertical swipes scroll the page instead of zooming/panning.
      handleScroll: { mouseWheel: false, vertTouchDrag: false },
      handleScale: { mouseWheel: false },
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
    };
  }, []);

  const points = history.data;
  const latest = points?.at(-1);
  const first = points?.[0];
  const delta = useMemo(() => {
    if (!latest || !first) return null;
    const latestUi = navPerShareUi(latest);
    const firstUi = navPerShareUi(first);
    if (firstUi === 0) return null;
    return { abs: latestUi - firstUi, pct: ((latestUi - firstUi) / firstUi) * 100 };
  }, [latest, first]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !points || points.length === 0) return;
    const up = !delta || delta.abs >= 0;
    series.current?.applyOptions({ lineColor: up ? UP : DOWN, topColor: up ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)", bottomColor: "rgba(0,0,0,0)" });
    if (!series.current) {
      series.current = c.addSeries(AreaSeries, {
        lineColor: up ? UP : DOWN,
        topColor: up ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)",
        bottomColor: "rgba(0,0,0,0)",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
      });
    }
    series.current.setData(
      points.filter((p) => p.ts !== null).map((p) => ({ time: p.ts as UTCTimestamp, value: navPerShareUi(p) })),
    );
    c.timeScale().fitContent();
  }, [points, delta]);

  if (history.error) return <ErrorState message={`NAV history unavailable: ${history.error.message}`} onRetry={() => void history.refetch()} />;

  const format = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  return (
    <Card>
      <CardHeader title="NAV per share" description={`Posted once per epoch, denominated in ${depositSymbol}`} />
      <div className="px-6 pb-2">
        {!points ? (
          <Skeleton className="h-9 w-40" />
        ) : points.length === 0 ? (
          <p className="text-sm text-muted">No NAV history yet.</p>
        ) : (
          <>
            <p className="font-serif text-3xl">
              {format(navPerShareUi(latest!))} <span className="text-lg text-muted">{depositSymbol}</span>
            </p>
            {delta && (
              <p className={`mt-1 text-sm ${delta.abs >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {delta.abs >= 0 ? "+" : ""}
                {format(delta.abs)} · {delta.pct >= 0 ? "+" : ""}
                {delta.pct.toFixed(2)}%
              </p>
            )}
          </>
        )}
      </div>
      <div ref={el} className="h-72 w-full min-w-0 overflow-hidden px-2 pb-4" />
    </Card>
  );
}
