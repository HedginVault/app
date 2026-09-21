"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type IPrimitivePaneView,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
  type Time,
  type ISeriesApi,
  type LogicalRange,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle, PriceRange } from "@/lib/types";

/** Pixels of slack around a range line's y-position that still counts as grabbing it. */
const HIT_PX = 6;

const UP = "#38bdf8";
const DOWN = "#f87171";
const RANGE = "#f97316";
const RANGE_FILL = "rgba(249,115,22,0.16)";

/** Orange band between the range's min and max price, drawn under the candles and redrawn with every scale change. */
class RangeBand implements ISeriesPrimitive<Time> {
  private range: PriceRange | null = null;
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private readonly view: IPrimitivePaneView = {
    zOrder: () => "bottom",
    renderer: () => ({
      draw: (target) =>
        target.useBitmapCoordinateSpace(({ context, bitmapSize, verticalPixelRatio }) => {
          const series = this.attachment?.series;
          if (!series || !this.range) return;
          const top = series.priceToCoordinate(this.range.max);
          const bottom = series.priceToCoordinate(this.range.min);
          if (top === null || bottom === null) return;
          context.fillStyle = RANGE_FILL;
          context.fillRect(0, Math.min(top, bottom) * verticalPixelRatio, bitmapSize.width, Math.abs(bottom - top) * verticalPixelRatio);
        }),
    }),
  };
  attached(param: SeriesAttachedParameter<Time>) {
    this.attachment = param;
  }
  detached() {
    this.attachment = null;
  }
  paneViews() {
    return [this.view];
  }
  setRange(range: PriceRange | null) {
    this.range = range;
    this.attachment?.requestUpdate();
  }
}

/** Enough decimals to show movement on micro-priced tokens without drowning $100 prices in zeros. */
function precisionFor(price: number) {
  if (!(price > 0)) return 2;
  return Math.min(12, Math.max(2, Math.ceil(-Math.log10(price)) + 3));
}

/** Bars shown when no lookback preset is active: enough for trend, few enough to read each candle. */
const DEFAULT_BARS = 120;
/** Empty bars kept right of the newest candle so it is not pinned against the price scale. */
const RIGHT_OFFSET = 4;
/** Older history is requested once the view scrolls within this many bars of the oldest loaded candle. */
const LOAD_MORE_BARS = 30;

/** What the chart frames when `key` changes: the window from `from` (unix seconds) to now, or the latest bars. */
export interface ChartView {
  key: string;
  from?: number;
}

/**
 * TradingView lightweight-charts candles + volume. The chart is created once; data swaps in place.
 * The user's zoom and pan survive live refreshes and history prepends; `view` reframes it only when
 * its key changes (new market, interval or lookback).
 */
export function PriceChart({
  candles,
  range = null,
  height = 360,
  view,
  ready = true,
  intraday = true,
  onLoadMore,
  onRangeChange,
}: {
  candles: Candle[];
  /** LP range drawn as Min/Max Bin lines with a shaded band, like Meteora. */
  range?: PriceRange | null;
  height?: number;
  view?: ChartView;
  /** False while history for `view.from` is still loading, so the frame waits for the data. */
  ready?: boolean;
  /** Time labels on the axis; off for daily and weekly candles. */
  intraday?: boolean;
  /** Called when the user scrolls near the oldest loaded candle. */
  onLoadMore?: () => void;
  /** Present makes the Min/Max Bin lines draggable; called with the edited range as the user drags. */
  onRangeChange?: (range: PriceRange) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const price = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const band = useRef(new RangeBand());
  const lines = useRef<IPriceLine[]>([]);
  const loadMore = useRef(onLoadMore);
  const shown = useRef<{ first: number; last: number; count: number } | null>(null);
  const framed = useRef<string | null>(null);
  const rangeRef = useRef(range);
  const onRangeChangeRef = useRef(onRangeChange);
  const dragging = useRef<"min" | "max" | null>(null);

  useEffect(() => {
    loadMore.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    rangeRef.current = range;
    onRangeChangeRef.current = onRangeChange;
  }, [range, onRangeChange]);

  useEffect(() => {
    const c = createChart(el.current!, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.55)",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      // Resizes (autoSize settling, the window changing) keep the framed time window, not the bar spacing.
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false, lockVisibleTimeRangeOnResize: true },
      crosshair: { horzLine: { labelBackgroundColor: "#0f151f" }, vertLine: { labelBackgroundColor: "#0f151f" } },
    });
    price.current = c.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    volume.current = c.addSeries(HistogramSeries, { priceScaleId: "", priceFormat: { type: "volume" } });
    c.priceScale("").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.current = c;
    // A new chart instance (remount, StrictMode's double effect run) starts unframed and empty.
    framed.current = null;
    shown.current = null;
    price.current.attachPrimitive(band.current);
    const nearOldest = (r: LogicalRange | null) => {
      if (r && r.from < LOAD_MORE_BARS) loadMore.current?.();
    };
    c.timeScale().subscribeVisibleLogicalRangeChange(nearOldest);

    // Min/Max Bin lines double as drag handles when `onRangeChange` is wired up: grab within
    // HIT_PX of a line, drag to a new price, and suspend chart pan/zoom for the gesture.
    const container = el.current!;
    const lineNear = (y: number) => {
      const r = rangeRef.current;
      const series = price.current;
      if (!r || !series) return null;
      const maxY = series.priceToCoordinate(r.max);
      const minY = series.priceToCoordinate(r.min);
      if (maxY !== null && Math.abs(y - maxY) <= HIT_PX) return "max" as const;
      if (minY !== null && Math.abs(y - minY) <= HIT_PX) return "min" as const;
      return null;
    };
    const yInContainer = (e: MouseEvent) => e.clientY - container.getBoundingClientRect().top;
    const onMouseMove = (e: MouseEvent) => {
      if (!onRangeChangeRef.current) return;
      const y = yInContainer(e);
      if (dragging.current) {
        const p = price.current?.coordinateToPrice(y);
        const r = rangeRef.current;
        if (p === null || p === undefined || !r) return;
        const next =
          dragging.current === "max" ? { min: r.min, max: Math.max(p, r.min) } : { min: Math.min(p, r.max), max: r.max };
        onRangeChangeRef.current(next);
      } else {
        container.style.cursor = lineNear(y) ? "ns-resize" : "";
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!onRangeChangeRef.current) return;
      const hit = lineNear(yInContainer(e));
      if (!hit) return;
      dragging.current = hit;
      c.applyOptions({ handleScroll: false, handleScale: false });
      e.preventDefault();
      e.stopPropagation();
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = null;
      c.applyOptions({ handleScroll: true, handleScale: true });
    };
    container.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      c.timeScale().unsubscribeVisibleLogicalRangeChange(nearOldest);
      container.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      c.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.applyOptions({ timeScale: { timeVisible: intraday } });
  }, [intraday]);

  const viewKey = view?.key;
  const viewFrom = view?.from;
  useEffect(() => {
    const c = chart.current;
    if (!c || !price.current || !volume.current) return;
    const scale = c.timeScale();
    const before = scale.getVisibleLogicalRange();
    const prev = shown.current;

    const last = candles.at(-1)?.close ?? 0;
    const precision = precisionFor(last);
    price.current.applyOptions({ priceFormat: { type: "price", precision, minMove: 10 ** -precision } });
    price.current.setData(
      candles.map((k) => ({ time: k.time as UTCTimestamp, open: k.open, high: k.high, low: k.low, close: k.close })),
    );
    volume.current.setData(
      candles.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? "rgba(56,189,248,0.25)" : "rgba(248,113,113,0.25)",
      })),
    );
    const first = candles[0];
    const newest = candles.at(-1);
    shown.current = first && newest ? { first: first.time, last: newest.time, count: candles.length } : null;
    if (!first || !newest) return;

    if (framed.current !== (viewKey ?? "")) {
      // Wait for the preset's history so the frame is drawn once, not re-snapped as pages arrive.
      if (!ready) return;
      framed.current = viewKey ?? "";
      // One logical-range call: the time scale applies ranges lazily, so a second call reading the
      // first back would see the stale range and overwrite it.
      const start = viewFrom === undefined ? candles.length - DEFAULT_BARS : Math.max(0, candles.findIndex((k) => k.time >= viewFrom));
      const frame = () => scale.setVisibleLogicalRange({ from: start, to: candles.length - 1 + RIGHT_OFFSET });
      // Right after mount `autoSize` has not measured the container yet; a frame set at width 0 is lost.
      if (scale.width() > 0) frame();
      else {
        const sized = () => {
          scale.unsubscribeSizeChange(sized);
          frame();
        };
        scale.subscribeSizeChange(sized);
      }
      return;
    }

    // Logical indexes are positions in the data, so older bars pushed in at the front would shift the
    // view back in time. Re-anchor it, and follow new live bars only if the newest one was on screen.
    if (!before || !prev) return;
    const prepended = candles.findIndex((k) => k.time >= prev.first);
    const appended = candles.length - 1 - candles.findLastIndex((k) => k.time <= prev.last);
    const following = before.to >= prev.count - 1;
    const shift = Math.max(0, prepended) + (following ? appended : 0);
    if (shift) scale.setVisibleLogicalRange({ from: before.from + shift, to: before.to + shift });
  }, [candles, viewKey, viewFrom, ready]);

  useEffect(() => {
    const series = price.current;
    if (!series) return;
    band.current.setRange(range);
    for (const line of lines.current) series.removePriceLine(line);
    lines.current = range
      ? [
          { price: range.max, title: "Max Bin" },
          { price: range.min, title: "Min Bin" },
        ].map((l) => series.createPriceLine({ ...l, color: RANGE, lineWidth: 1, lineStyle: 0, axisLabelVisible: true }))
      : [];
    // Keep the range in view even when price trades far outside it.
    series.applyOptions({
      autoscaleInfoProvider: (base: () => AutoscaleInfo | null) => {
        const info = base();
        if (!info?.priceRange || !range) return info;
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, range.min),
            maxValue: Math.max(info.priceRange.maxValue, range.max),
          },
        };
      },
    });
  }, [range?.min, range?.max]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={el} className="w-full min-w-0 overflow-hidden" style={{ height }} />
  );
}
