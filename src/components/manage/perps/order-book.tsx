"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderBook, useRecentTrades, type BookLevel } from "@/hooks/use-phoenix-live";
import { cn } from "@/lib/cn";
import { formatBaseSize, formatMarketPrice, priceDecimals } from "@/lib/perps";
import type { PhoenixMarketView } from "@/lib/types";

const LEVELS = 10;
/** Levels a side on phones. */
const COMPACT_LEVELS = 6;

function Row({
  level,
  total,
  max,
  side,
  decimals,
  sizeDecimals,
  onPick,
  compactHidden,
}: {
  level: BookLevel;
  total: number;
  max: number;
  side: "bid" | "ask";
  decimals: number;
  sizeDecimals: number;
  onPick: (price: number) => void;
  /** Hidden on phones, where the book shows fewer levels so the ticket stays close. */
  compactHidden?: boolean;
}) {
  const [price, size] = level;
  return (
    <li className={compactHidden ? "hidden sm:block" : undefined}>
      <button
        type="button"
        onClick={() => onPick(price)}
        title="Use as limit price"
        className="relative grid w-full grid-cols-3 px-3 py-[3px] text-right text-[12px] tabular-nums hover:bg-white/[0.05] focus-visible:bg-white/[0.07] focus-visible:outline-none"
      >
        {/* Cumulative depth, drawn from the right edge. */}
        <span
          aria-hidden
          className={cn("absolute inset-y-0 right-0", side === "bid" ? "bg-emerald-400/10" : "bg-red-400/10")}
          style={{ width: `${max > 0 ? (total / max) * 100 : 0}%` }}
        />
        <span className={cn("relative text-left", side === "bid" ? "text-emerald-400" : "text-red-400")}>{formatMarketPrice(price, decimals)}</span>
        <span className="relative">{formatBaseSize(size, sizeDecimals, true)}</span>
        <span className="relative text-muted">{formatBaseSize(total, sizeDecimals, true)}</span>
      </button>
    </li>
  );
}

const cumulative = (levels: BookLevel[]) => {
  let t = 0;
  return levels.map((l) => (t += l[1]));
};

function Book({ market, onPickPrice }: { market: PhoenixMarketView; onPickPrice: (price: number) => void }) {
  const { book, loading, error } = useOrderBook(market.symbol);
  const decimals = priceDecimals(market);
  const sizeDecimals = market.baseLotsDecimals;
  if (loading) return <Skeleton className="m-3 h-[540px]" />;
  if (!book) return <p className="px-3 py-10 text-center text-[13px] text-muted">{error ? "Order book unavailable." : "No orders."}</p>;
  const asks = book.asks.slice(0, LEVELS);
  const bids = book.bids.slice(0, LEVELS);
  const askTotals = cumulative(asks);
  const bidTotals = cumulative(bids);
  const max = Math.max(askTotals.at(-1) ?? 0, bidTotals.at(-1) ?? 0);
  const bestAsk = asks[0]?.[0];
  const bestBid = bids[0]?.[0];
  const spread = bestAsk !== undefined && bestBid !== undefined ? bestAsk - bestBid : null;

  return (
    <div>
      <div className="grid grid-cols-3 px-3 py-1.5 text-right text-[11px] text-muted">
        <span className="text-left">Price</span>
        <span>Size ({market.symbol})</span>
        <span>Total</span>
      </div>
      {/* Asks sit above the spread, best (lowest) ask nearest to it. */}
      <ul aria-label="Asks" className="flex flex-col-reverse">
        {asks.map((l, i) => (
          <Row key={`a${l[0]}`} level={l} total={askTotals[i]} max={max} side="ask" decimals={decimals} sizeDecimals={sizeDecimals} onPick={onPickPrice} compactHidden={i >= COMPACT_LEVELS} />
        ))}
      </ul>
      <div className="flex justify-between border-y border-border bg-white/[0.02] px-3 py-1.5 text-[12px] tabular-nums">
        <span className="text-muted">Spread</span>
        <span>
          {spread === null ? "—" : formatMarketPrice(spread, decimals)}
          {spread !== null && bestBid ? <span className="ml-2 text-muted">{((spread / bestBid) * 100).toFixed(3)}%</span> : null}
        </span>
      </div>
      <ul aria-label="Bids">
        {bids.map((l, i) => (
          <Row key={`b${l[0]}`} level={l} total={bidTotals[i]} max={max} side="bid" decimals={decimals} sizeDecimals={sizeDecimals} onPick={onPickPrice} compactHidden={i >= COMPACT_LEVELS} />
        ))}
      </ul>
    </div>
  );
}

function Trades({ market }: { market: PhoenixMarketView }) {
  const { fills, loading, error } = useRecentTrades(market.symbol);
  const decimals = priceDecimals(market);
  if (loading) return <Skeleton className="m-3 h-[380px]" />;
  if (fills.length === 0)
    return <p className="px-3 py-10 text-center text-[13px] text-muted">{error ? "Trades unavailable." : "No recent trades."}</p>;
  return (
    <div>
      <div className="grid grid-cols-3 px-3 py-1.5 text-right text-[11px] text-muted">
        <span className="text-left">Price</span>
        <span>Size ({market.symbol})</span>
        <span>Time</span>
      </div>
      <ul className="max-h-[540px] overflow-y-auto">
        {fills.map((f) => (
          <li key={f.id} className="grid grid-cols-3 px-3 py-[3px] text-right text-[12px] tabular-nums">
            <span className={cn("text-left", f.side === "buy" ? "text-emerald-400" : "text-red-400")}>{formatMarketPrice(f.price, decimals)}</span>
            <span>{formatBaseSize(f.size, market.baseLotsDecimals, true)}</span>
            <span className="text-muted">{new Date(f.time).toLocaleTimeString("en-US", { hour12: false })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Live L2 book and tape for the selected market. */
export function OrderBookPanel({ market, onPickPrice }: { market: PhoenixMarketView; onPickPrice: (price: number) => void }) {
  const [view, setView] = useState<"book" | "trades">("book");
  return (
    <Card className="min-w-0 overflow-hidden">
      <div role="tablist" className="flex border-b border-border">
        {(["book", "trades"] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "-mb-px flex-1 border-b-2 py-2.5 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-sky-400",
              view === id ? "border-sky-400 text-white" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {id === "book" ? "Order book" : "Trades"}
          </button>
        ))}
      </div>
      {view === "book" ? <Book market={market} onPickPrice={onPickPrice} /> : <Trades market={market} />}
    </Card>
  );
}
