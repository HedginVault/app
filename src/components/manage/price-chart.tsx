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
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle, PriceRange } from "@/lib/types";

const UP = "#34d399";
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

/** TradingView lightweight-charts candles + volume. The chart is created once; data swaps in place. */
export function PriceChart({
  candles,
  range = null,
  height = 360,
}: {
  candles: Candle[];
  /** LP range drawn as Min/Max Bin lines with a shaded band, like Meteora. */
  range?: PriceRange | null;
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const price = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const band = useRef(new RangeBand());
  const lines = useRef<IPriceLine[]>([]);

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
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#111815" }, vertLine: { labelBackgroundColor: "#111815" } },
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
    price.current.attachPrimitive(band.current);
    return () => {
      c.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (!price.current || !volume.current) return;
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
        color: k.close >= k.open ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)",
      })),
    );
    chart.current?.timeScale().fitContent();
  }, [candles]);

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
    <div ref={el} className="w-full" style={{ height }} />
  );
}
