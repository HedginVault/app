"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { type ChartRangeId, mergeCandles, rangeStart } from "@/lib/chart-ranges";
import type { Candle, ChartTarget, MarketTimeframe } from "@/lib/types";
import { useOhlcv } from "./queries";

interface History {
  key: string;
  candles: Candle[];
  /** Jupiter returned an empty page: nothing older exists. */
  done: boolean;
  /** The `before` of a page that failed; paging stops there rather than retrying on every scroll. */
  failedAt: number | null;
}

const NONE: Candle[] = [];
const empty = (key: string): History => ({ key, candles: NONE, done: false, failedAt: null });

const targetKey = (t: ChartTarget) => ("mint" in t ? t.mint : `${t.pool}:${t.base ?? ""}`);

/**
 * The live page from `useOhlcv` (newest candles, refreshed every minute) plus older pages fetched on
 * demand: `loadMore()` when the chart scrolls to its left edge, and automatically until the history
 * reaches the start of the `lookback` window (`from`, unix seconds, 0 = everything). Older candles
 * never change, so they are fetched once and only the live page polls.
 */
export function useCandles(target: ChartTarget | undefined, tf: MarketTimeframe, lookback: ChartRangeId | null) {
  const latest = useOhlcv(target, tf);
  const newest = latest.data?.candles.at(-1)?.time;
  const from = lookback && newest !== undefined ? rangeStart(lookback, newest) : undefined;
  const key = target ? `${targetKey(target)}:${tf}` : "";
  const [stored, setHistory] = useState<History>(() => empty(key));
  // History from a previous market or interval is ignored until the first page for this one lands.
  const history = stored.key === key ? stored : empty(key);
  const inflight = useRef<string | null>(null);

  const candles = useMemo(
    () => mergeCandles(history.candles, latest.data?.candles ?? []),
    [history.candles, latest.data?.candles],
  );
  const oldest = candles[0]?.time;
  const exhausted = history.done || (oldest !== undefined && history.failedAt === oldest);

  const loadMore = useCallback(() => {
    if (!target || oldest === undefined || exhausted) return;
    const request = `${key}:${oldest}`;
    if (inflight.current === request) return;
    inflight.current = request;
    const current = (h: History) => (h.key === key ? h : empty(key));
    api
      .ohlcv(target, tf, oldest)
      .then((page) =>
        setHistory((h) => ({
          ...current(h),
          candles: mergeCandles(page.candles, current(h).candles),
          done: page.candles.length === 0,
        })),
      )
      .catch(() => setHistory((h) => ({ ...current(h), failedAt: oldest })))
      .finally(() => {
        if (inflight.current === request) inflight.current = null;
      });
  }, [target, tf, key, oldest, exhausted]);

  // A preset reaching further back than the live page keeps paging until the window is covered.
  const covered = from === undefined || exhausted || (oldest !== undefined && oldest <= from);
  useEffect(() => {
    if (!covered) loadMore();
  }, [covered, loadMore]);

  return { latest, candles, newest, from, loadMore, covered };
}
