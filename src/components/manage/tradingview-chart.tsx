"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChartTarget, MarketTimeframe, PriceRange } from "@/lib/types";

/**
 * TradingView Charting Library (Advanced Charts) with our Jupiter-backed OHLCV route as the datafeed.
 *
 * The library is licensed and not on npm: copy the `charting_library/` folder from TradingView's private repo
 * into `app/public/charting_library/`. Until those files exist, `useChartingLibrary()` reports "missing" and
 * the Markets tab falls back to the lightweight chart.
 */

const LIBRARY_PATH = "/charting_library/";
const SCRIPT = `${LIBRARY_PATH}charting_library.standalone.js`;


// ponytail: hand-written slice of the library's typings; swap for `charting_library.d.ts` once the files are in.
interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface SymbolInfo {
  ticker: string;
  name: string;
  [key: string]: unknown;
}
type EntityId = string;
interface ActiveChart {
  setSymbol(symbol: string, cb?: () => void): void;
  createShape(point: { price: number; time?: number }, options: Record<string, unknown>): EntityId | Promise<EntityId>;
  createMultipointShape(points: { price: number; time: number }[], options: Record<string, unknown>): EntityId | Promise<EntityId>;
  removeEntity(id: EntityId): void;
}
interface Widget {
  onChartReady(cb: () => void): void;
  activeChart(): ActiveChart;
  remove(): void;
}

const RANGE = "#f97316";

/** Locked Min/Max Bin lines plus a shaded band extended across the whole chart, like Meteora. Returns the entity ids. */
function drawRange(chart: ActiveChart, range: PriceRange, other = false): Promise<EntityId[]> {
  const locked = { lock: true, disableSelection: true, disableSave: true, disableUndo: true };
  const color = other ? "#38bdf8" : RANGE;
  const fill = other ? "rgba(56,189,248,0.12)" : "rgba(249,115,22,0.16)";
  const line = (price: number, text: string) =>
    chart.createShape(
      { price },
      {
        shape: "horizontal_line",
        ...locked,
        overrides: { linecolor: color, linewidth: 1, linestyle: other ? 2 : 0, showLabel: !other, text, textcolor: color, horzLabelsAlign: "left", vertLabelsAlign: "top" },
      },
    );
  const now = Math.floor(Date.now() / 1000);
  const band = chart.createMultipointShape(
    [
      { time: now - 86_400, price: range.max },
      { time: now, price: range.min },
    ],
    {
      shape: "rectangle",
      ...locked,
      overrides: { color: "rgba(0,0,0,0)", backgroundColor: fill, fillBackground: true, extendLeft: true, extendRight: true, linewidth: 0 },
    },
  );
  // Older library builds return ids synchronously, newer ones return promises.
  return Promise.all([band, line(range.max, "Max Bin"), line(range.min, "Min Bin")].map((id) => Promise.resolve(id)));
}
declare global {
  interface Window {
    TradingView?: { widget: new (options: Record<string, unknown>) => Widget };
  }
}

const RESOLUTIONS: Record<string, MarketTimeframe> = { "5": "5m", "15": "15m", "60": "1h", "240": "4h", "1D": "1d", "1W": "1w" };
const POLL_MS = 60_000;

/** Tickers carry the target so resolveSymbol/getBars stay stateless: "mint:<address>" or "pool:<address>[:<base>]". */
const toTicker = (t: ChartTarget) =>
  "mint" in t ? `mint:${t.mint}` : "perp" in t ? `perp:${t.perp}` : `pool:${t.pool}${t.base ? `:${t.base}` : ""}`;
const fromTicker = (ticker: string): ChartTarget => {
  const [kind, address, base] = ticker.split(":");
  return kind === "pool" ? { pool: address, base } : kind === "perp" ? { perp: address } : { mint: address };
};

const pricescaleFor = (price: number) =>
  10 ** (price > 0 ? Math.min(12, Math.max(2, Math.ceil(-Math.log10(price)) + 3)) : 2);

function createDatafeed() {
  const timers = new Map<string, ReturnType<typeof setInterval>>();
  return {
    onReady: (cb: (config: unknown) => void) =>
      setTimeout(() => cb({ supported_resolutions: Object.keys(RESOLUTIONS), supports_marks: false, supports_time: true })),
    // Symbol search is disabled in the UI: the trade panel picks the market.
    searchSymbols: (_q: string, _e: string, _t: string, onResult: (r: unknown[]) => void) => onResult([]),
    resolveSymbol: (ticker: string, onResolve: (info: SymbolInfo) => void, onError: (reason: string) => void) => {
      const target = fromTicker(ticker);
      api
        .ohlcv(target, "1h")
        .then((view) => {
          const last = view.candles.at(-1)?.close ?? 0;
          setTimeout(() =>
            onResolve({
              ticker,
              name: view.name || ticker,
              description: view.quote === "usd" ? `${view.name} (USD)` : view.name,
              type: "crypto",
              session: "24x7",
              timezone: "Etc/UTC",
              exchange: "Jupiter",
              listed_exchange: "Jupiter",
              format: "price",
              minmov: 1,
              pricescale: pricescaleFor(last),
              has_intraday: true,
              has_daily: true,
              has_weekly_and_monthly: true,
              weekly_multipliers: ["1"],
              supported_resolutions: Object.keys(RESOLUTIONS),
              intraday_multipliers: ["5", "15", "60", "240"],
              volume_precision: 2,
              data_status: "streaming",
              currency_code: view.quote === "usd" ? "USD" : view.quote,
            }),
          );
        })
        .catch((e: Error) => onError(e.message));
    },
    getBars: (
      info: SymbolInfo,
      resolution: string,
      period: { from: number; to: number; firstDataRequest: boolean },
      onResult: (bars: Bar[], meta: { noData: boolean }) => void,
      onError: (reason: string) => void,
    ) => {
      const tf = RESOLUTIONS[resolution];
      if (!tf) return onResult([], { noData: true });
      // First request takes the newest page; scrolling back asks for candles before `period.to`.
      api
        .ohlcv(fromTicker(info.ticker), tf, period.firstDataRequest ? undefined : period.to)
        .then((view) => {
          const bars = view.candles
            .filter((c) => c.time >= period.from && c.time < period.to)
            .map((c) => ({ ...c, time: c.time * 1000 }));
          onResult(bars, { noData: bars.length === 0 });
        })
        .catch((e: Error) => onError(e.message));
    },
    subscribeBars: (info: SymbolInfo, resolution: string, onTick: (bar: Bar) => void, uid: string) => {
      const tf = RESOLUTIONS[resolution];
      if (!tf) return;
      // ponytail: polls the 60 s server cache; websocket feed if sub-minute updates ever matter.
      timers.set(
        uid,
        setInterval(() => {
          api
            .ohlcv(fromTicker(info.ticker), tf)
            .then((view) => {
              const last = view.candles.at(-1);
              if (last) onTick({ ...last, time: last.time * 1000 });
            })
            .catch(() => undefined);
        }, POLL_MS),
      );
    },
    unsubscribeBars: (uid: string) => {
      clearInterval(timers.get(uid));
      timers.delete(uid);
    },
  };
}

let loading: Promise<boolean> | null = null;

/** Loads the standalone bundle once; resolves false when the files are not deployed. */
function loadLibrary(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.TradingView) return Promise.resolve(true);
  loading ??= fetch(SCRIPT, { method: "HEAD" })
    .then((res) =>
      res.ok
        ? new Promise<boolean>((resolve) => {
            const s = document.createElement("script");
            s.src = SCRIPT;
            s.async = true;
            s.onload = () => resolve(!!window.TradingView);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
          })
        : false,
    )
    .catch(() => false);
  return loading;
}

export function useChartingLibrary(): "loading" | "ready" | "missing" {
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  useEffect(() => {
    let alive = true;
    void loadLibrary().then((ok) => alive && setState(ok ? "ready" : "missing"));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Full TradingView UI: drawing toolbar, indicators, chart types, intervals, screenshots. */
export function TradingViewChart({
  target,
  range = null,
  otherRanges,
  height = 520,
}: {
  target: ChartTarget;
  range?: PriceRange | null;
  /** The vault's other positions in the same pool, drawn muted. */
  otherRanges?: PriceRange[];
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<Widget | null>(null);
  const ready = useRef(false);
  const ticker = toTicker(target);
  const initialTicker = useRef(ticker);

  useEffect(() => {
    const w = new window.TradingView!.widget({
      container: container.current,
      library_path: LIBRARY_PATH,
      datafeed: createDatafeed(),
      symbol: initialTicker.current,
      interval: "240",
      theme: "dark",
      locale: "en",
      autosize: true,
      timezone: "Etc/UTC",
      disabled_features: ["header_symbol_search", "symbol_search_hot_key", "header_compare", "use_localstorage_for_settings"],
      enabled_features: ["study_templates"],
      loading_screen: { backgroundColor: "#080c14", foregroundColor: "#38bdf8" },
      overrides: {
        "paneProperties.background": "#080c14",
        "paneProperties.backgroundType": "solid",
        "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.04)",
        "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.04)",
        "mainSeriesProperties.candleStyle.upColor": "#38bdf8",
        "mainSeriesProperties.candleStyle.downColor": "#f87171",
        "mainSeriesProperties.candleStyle.borderUpColor": "#38bdf8",
        "mainSeriesProperties.candleStyle.borderDownColor": "#f87171",
        "mainSeriesProperties.candleStyle.wickUpColor": "#38bdf8",
        "mainSeriesProperties.candleStyle.wickDownColor": "#f87171",
      },
    });
    w.onChartReady(() => {
      ready.current = true;
    });
    widget.current = w;
    return () => {
      ready.current = false;
      widget.current = null;
      w.remove();
    };
  }, []);

  // Follow the trade panel without rebuilding the widget, so drawings and indicators survive a symbol switch.
  useEffect(() => {
    const w = widget.current;
    if (!w) return;
    if (ready.current) w.activeChart().setSymbol(ticker);
    else w.onChartReady(() => w.activeChart().setSymbol(ticker));
  }, [ticker]);

  // Redraw the range overlay whenever the draft range or position changes.
  const min = range?.min;
  const max = range?.max;
  useEffect(() => {
    const w = widget.current;
    if (!w || min == null || max == null) return;
    let ids: EntityId[] = [];
    let cancelled = false;
    const draw = () =>
      void drawRange(w.activeChart(), { min, max }).then((created) => {
        if (cancelled) created.forEach((id) => w.activeChart().removeEntity(id));
        else ids = created;
      });
    if (ready.current) draw();
    else w.onChartReady(draw);
    return () => {
      cancelled = true;
      if (widget.current === w) ids.forEach((id) => w.activeChart().removeEntity(id));
    };
  }, [min, max, ticker]);

  const othersKey = otherRanges?.map((r) => `${r.min}:${r.max}`).join(",") ?? "";
  useEffect(() => {
    const w = widget.current;
    if (!w || !othersKey) return;
    const list = othersKey.split(",").map((k) => ({ min: Number(k.split(":")[0]), max: Number(k.split(":")[1]) }));
    let ids: EntityId[] = [];
    let cancelled = false;
    const draw = () =>
      void Promise.all(list.map((r) => drawRange(w.activeChart(), r, true))).then((created) => {
        const flat = created.flat();
        if (cancelled) flat.forEach((id) => w.activeChart().removeEntity(id));
        else ids = flat;
      });
    if (ready.current) draw();
    else w.onChartReady(draw);
    return () => {
      cancelled = true;
      if (widget.current === w) ids.forEach((id) => w.activeChart().removeEntity(id));
    };
  }, [othersKey, ticker]);

  return <div ref={container} style={{ height }} className="w-full overflow-hidden rounded-[10px]" />;
}
