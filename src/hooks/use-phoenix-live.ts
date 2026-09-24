"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { phoenixGet, phoenixSocket, type SocketStatus } from "@/lib/phoenix-live";
import type { Candle } from "@/lib/types";

/** Poll interval for REST data while the socket is down; the socket keeps it live otherwise. */
const FALLBACK_POLL_MS = 5_000;

export interface MarketStats {
  markPrice: number;
  oraclePrice: number;
  prevDayMarkPrice: number;
  dayVolumeUsd: number;
  /** Base units. */
  openInterest: number;
  /** Current hourly funding rate in percent (0.0021 = 0.0021%/h); positive: longs pay shorts. */
  fundingRate: number;
}

export type BookLevel = [price: number, size: number];
export interface OrderBook {
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface Fill {
  id: string;
  price: number;
  /** Base units, always positive. */
  size: number;
  side: "buy" | "sell";
  time: number;
}

export function useSocketStatus(): SocketStatus {
  return useSyncExternalStore(
    (cb) => phoenixSocket().onStatus(cb),
    () => phoenixSocket().status,
    () => "connecting",
  );
}

interface RestStats {
  symbol: string;
  mark_price: number;
  oracle_price: number;
  prev_day_mark_price: number;
  day_volume_usd: number;
  open_interest: number;
  current_funding_rate: number;
}

const fromRest = (r: RestStats): MarketStats => ({
  markPrice: r.mark_price,
  oraclePrice: r.oracle_price,
  prevDayMarkPrice: r.prev_day_mark_price,
  dayVolumeUsd: r.day_volume_usd,
  openInterest: r.open_interest,
  fundingRate: r.current_funding_rate,
});

/** Every market's stats: a REST snapshot, then the socket's per-second updates. */
export function useMarketStats(): { stats: Map<string, MarketStats>; loading: boolean; error: Error | null } {
  const status = useSocketStatus();
  const seed = useQuery({
    queryKey: ["phoenix", "stats"],
    queryFn: async () =>
      new Map((await phoenixGet<{ markets: RestStats[] }>("/v1/markets/stats/latest")).markets.map((r) => [r.symbol, fromRest(r)])),
    refetchInterval: status === "live" ? false : FALLBACK_POLL_MS,
    staleTime: 30_000,
  });
  const [live, setLive] = useState(() => new Map<string, MarketStats>());
  useEffect(
    () =>
      phoenixSocket().subscribe(
        { channel: "marketStats" },
        (m) => m.channel === "marketStats",
        (m) =>
          setLive((prev) =>
            new Map(prev).set(m.symbol as string, {
              markPrice: m.markPrice as number,
              oraclePrice: m.oraclePrice as number,
              prevDayMarkPrice: m.prevDayMarkPrice as number,
              dayVolumeUsd: m.dayVolumeUsd as number,
              openInterest: m.openInterest as number,
              fundingRate: m.currentFundingRate as number,
            }),
          ),
      ),
    [],
  );
  const stats = new Map(seed.data ?? []);
  for (const [k, v] of live) stats.set(k, v);
  return { stats, loading: seed.isPending && live.size === 0, error: live.size === 0 ? seed.error : null };
}

/** L2 book for one market: a REST snapshot, then full-book socket updates. */
export function useOrderBook(symbol: string) {
  const status = useSocketStatus();
  const seed = useQuery({
    queryKey: ["phoenix", "book", symbol],
    queryFn: () => phoenixGet<OrderBook>(`/v1/view/orderbook/${encodeURIComponent(symbol)}`),
    refetchInterval: status === "live" ? false : FALLBACK_POLL_MS,
    enabled: !!symbol,
  });
  const [live, setLive] = useState<{ symbol: string; book: OrderBook } | null>(null);
  useEffect(() => {
    if (!symbol) return;
    return phoenixSocket().subscribe(
      { channel: "l2Book", coin: symbol },
      (m) => m.channel === "l2Book" && m.coin === symbol,
      (m) => setLive({ symbol, book: { bids: m.bids as BookLevel[], asks: m.asks as BookLevel[] } }),
    );
  }, [symbol]);
  const book = live?.symbol === symbol ? live.book : seed.data;
  return { book, loading: !book && seed.isPending, error: book ? null : seed.error };
}

interface RawFill {
  baseQty: string;
  price: string;
  timestamp: string;
  transactionSignature: string;
}

const toFill = (f: RawFill, i: number): Fill => ({
  id: `${f.transactionSignature}:${i}`,
  price: Number(f.price),
  size: Math.abs(Number(f.baseQty)),
  side: Number(f.baseQty) >= 0 ? "buy" : "sell",
  time: Date.parse(f.timestamp),
});

const MAX_FILLS = 40;

/** Latest market trades, newest first. */
export function useRecentTrades(symbol: string) {
  const seed = useQuery({
    queryKey: ["phoenix", "fills", symbol],
    queryFn: async () =>
      (await phoenixGet<{ data: RawFill[] }>(`/v1/trades/${encodeURIComponent(symbol)}/fills?limit=${MAX_FILLS}`)).data.map(toFill),
    enabled: !!symbol,
    staleTime: 30_000,
  });
  const [live, setLive] = useState<{ symbol: string; fills: Fill[] }>({ symbol, fills: [] });
  useEffect(() => {
    if (!symbol) return;
    return phoenixSocket().subscribe(
      { channel: "fills", marketSymbol: symbol },
      (m) => m.channel === "fills" && m.symbol === symbol,
      (m) =>
        setLive((prev) => ({
          symbol,
          fills: [...(m.fills as RawFill[]).map(toFill).reverse(), ...(prev.symbol === symbol ? prev.fills : [])].slice(0, MAX_FILLS),
        })),
    );
  }, [symbol]);
  const recent = live.symbol === symbol ? live.fills : [];
  const seen = new Set(recent.map((f) => f.id));
  const fills = [...recent, ...(seed.data ?? []).filter((f) => !seen.has(f.id))].slice(0, MAX_FILLS);
  return { fills, loading: seed.isPending && recent.length === 0, error: recent.length ? null : seed.error };
}

/** The forming candle for `symbol` at `timeframe` ("5m", "1h", …), streamed so the chart's last bar moves live. */
export function useLiveCandle(symbol: string, timeframe: string): Candle | null {
  const [candle, setCandle] = useState<{ key: string; candle: Candle } | null>(null);
  const key = `${symbol}:${timeframe}`;
  useEffect(() => {
    if (!symbol) return;
    return phoenixSocket().subscribe(
      { channel: "candles", symbol, timeframe },
      (m) => m.channel === "candle" && m.symbol === symbol && m.timeframe === timeframe,
      (m) => {
        const c = m.candle as { time: number; open: number; high: number; low: number; close: number; volume: number };
        setCandle({ key, candle: { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume } });
      },
    );
  }, [symbol, timeframe, key]);
  return candle?.key === key ? candle.candle : null;
}

export interface TraderTrade {
  id: string;
  time: number;
  symbol: string;
  side: "buy" | "sell";
  /** Base units, positive. */
  size: number;
  price: number;
  fee: number;
  realizedPnl: number;
  liquidity: string;
  /** "trade", "liquidation", … */
  kind: string;
  signature: string;
}

interface RawTraderTrade {
  fillId: string;
  subaccountIndex: number;
  marketSymbol: string;
  signature: string;
  timestamp: string;
  baseLotsDelta: string;
  price: string;
  fees: string;
  realizedPnl: string;
  liquidity: string;
  tradeType: string;
}

/** The vault trader's fills from perp-api, newest first. Only subaccount 0, the one the program trades. */
export function useTraderTrades(traderAccount: string | undefined) {
  return useQuery({
    queryKey: ["phoenix", "traderTrades", traderAccount],
    enabled: !!traderAccount,
    refetchInterval: 20_000,
    queryFn: async (): Promise<TraderTrade[]> =>
      (await phoenixGet<{ data: RawTraderTrade[] }>(`/v1/traders/${traderAccount}/trades_v2?limit=50`)).data
        .filter((t) => t.subaccountIndex === 0)
        .map((t) => ({
          id: t.fillId,
          time: Date.parse(t.timestamp),
          symbol: t.marketSymbol,
          side: Number(t.baseLotsDelta) >= 0 ? "buy" : "sell",
          size: Math.abs(Number(t.baseLotsDelta)),
          price: Number(t.price),
          fee: Number(t.fees),
          realizedPnl: Number(t.realizedPnl),
          liquidity: t.liquidity,
          kind: t.tradeType,
          signature: t.signature,
        })),
  });
}
