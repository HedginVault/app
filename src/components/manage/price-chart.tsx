"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/types";

const UP = "#34d399";
const DOWN = "#f87171";

/** Enough decimals to show movement on micro-priced tokens without drowning $100 prices in zeros. */
function precisionFor(price: number) {
  if (!(price > 0)) return 2;
  return Math.min(12, Math.max(2, Math.ceil(-Math.log10(price)) + 3));
}

/** TradingView lightweight-charts candles + volume. The chart is created once; data swaps in place. */
export function PriceChart({ candles, height = 360 }: { candles: Candle[]; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const price = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);

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

  return <div ref={el} style={{ height }} className="w-full" />;
}
