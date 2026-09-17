"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings, useOhlcv } from "@/hooks/queries";
import { usePanel } from "@/hooks/use-panel";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { PanelState } from "@/lib/panel-params";
import type { HoldingsView, MarketTimeframe, VaultDetail } from "@/lib/types";
import { ActionPanel } from "./action-panel";
import { PriceChart } from "./price-chart";
import { TradingViewChart, useChartingLibrary } from "./tradingview-chart";

const WSOL = "So11111111111111111111111111111111111111112";
const TIMEFRAMES: { id: MarketTimeframe; label: string }[] = [
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1d", label: "1D" },
];

/**
 * What the chart shows follows the trade panel: a swap charts the non-deposit side in USD
 * (USDC → SOL shows SOL), liquidity charts the chosen pool in its quote token.
 */
function chartTarget(state: PanelState, depositMint: string, holdings: HoldingsView | undefined) {
  if (state.panel === "swap") return { mint: [state.to, state.from].find((m) => m && m !== depositMint) ?? WSOL };
  const pool =
    "position" in state
      ? holdings?.positions.find((p) => p.kind === "lp" && p.position === state.position)
      : undefined;
  const lbPair = pool?.kind === "lp" ? pool.lbPair : "pool" in state ? state.pool : undefined;
  return lbPair ? { pool: lbPair } : undefined;
}

export function MarketsTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const holdings = useHoldings(v.address);
  const { state, replace } = usePanel();
  const [nonce, setNonce] = useState(0);
  const [tf, setTf] = useState<MarketTimeframe>("1h");
  const target = chartTarget(state, v.depositMint, holdings.data);
  const library = useChartingLibrary();
  const tv = library === "ready";
  const ohlcv = useOhlcv(target, tf);

  const prefill = (s: PanelState) => {
    replace(s);
    setNonce((n) => n + 1);
  };

  const candles = ohlcv.data?.candles ?? [];
  const last = candles.at(-1)?.close;
  // Change over the last 24h of loaded candles (or the whole window when it is shorter).
  const dayAgo = candles.find((c) => c.time >= (candles.at(-1)?.time ?? 0) - 86_400)?.open;
  const change = last != null && dayAgo ? ((last - dayAgo) / dayAgo) * 100 : null;
  const quote = ohlcv.data?.quote === "usd" ? "$" : "";
  const quoteSuffix = ohlcv.data && ohlcv.data.quote !== "usd" ? ` ${ohlcv.data.quote}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="min-w-0 self-start">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-muted">
                {!target ? "Pick a pool" : ohlcv.data?.name || "Loading market…"}
                {target && "pool" in target && <span className="ml-2 text-[11px] text-white/40">pool price</span>}
              </div>
              <div className="mt-0.5 flex items-baseline gap-3">
                <span className="text-2xl font-medium tabular-nums tracking-tight">
                  {last != null ? `${quote}${formatPrice(last)}${quoteSuffix}` : "—"}
                </span>
                {change != null && (
                  <span className={cn("text-sm tabular-nums", change >= 0 ? "text-emerald-400" : "text-red-300")}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)}% 24h
                  </span>
                )}
              </div>
            </div>
            {/* TradingView brings its own interval picker */}
            {!tv && <Segmented size="sm" value={tf} onChange={setTf} options={TIMEFRAMES} />}
          </div>

          {!target ? (
            <div className="grid h-[360px] place-items-center text-center text-sm text-muted">
              Choose a pool in the Liquidity panel to see its chart.
            </div>
          ) : library === "loading" ? (
            <Skeleton className="h-[360px]" />
          ) : tv ? (
            <TradingViewChart target={target} />
          ) : ohlcv.error ? (
            <div className="grid h-[360px] place-items-center">
              <ErrorState message={ohlcv.error.message} onRetry={() => void ohlcv.refetch()} />
            </div>
          ) : !ohlcv.data ? (
            <Skeleton className="h-[360px]" />
          ) : (
            <PriceChart candles={candles} />
          )}
          <p className="text-right text-[11px] text-white/40">Market data: GeckoTerminal</p>
        </CardBody>
      </Card>

      <div className="lg:sticky lg:top-24 lg:self-start">
        {holdings.data ? (
          <ActionPanel v={v} owner={owner} holdings={holdings.data} state={state} replace={replace} nonce={nonce} onPrefill={prefill} />
        ) : holdings.error ? (
          <ErrorState message={`Holdings unavailable: ${holdings.error.message}`} onRetry={() => void holdings.refetch()} />
        ) : (
          <Skeleton className="h-96 rounded-card" />
        )}
      </div>
    </div>
  );
}
