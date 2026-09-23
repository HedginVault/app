"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings, usePool } from "@/hooks/queries";
import { useCandles } from "@/hooks/use-candles";
import { usePanel } from "@/hooks/use-panel";
import {
  CHART_RANGES,
  chartRange,
  changeSince,
  DEFAULT_RANGE,
  isIntraday,
  TIMEFRAME_OPTIONS,
  type ChartRangeId,
} from "@/lib/chart-ranges";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { PanelState } from "@/lib/panel-params";
import type { ChartTarget, HoldingsView, MarketTimeframe, PriceRange, VaultDetail } from "@/lib/types";
import { ActionPanel } from "./action-panel";
import { OpenPositions } from "./open-positions";
import { PriceChart } from "./price-chart";
import { TradingViewChart, useChartingLibrary } from "./tradingview-chart";

const WSOL = "So11111111111111111111111111111111111111112";
const DAY = 86_400;

/**
 * What the chart shows follows the trade panel: a swap charts the non-deposit side in USD
 * (USDC → SOL shows SOL); liquidity charts the pool priced as token X in token Y, the same units
 * as DLMM bin prices, so the position range can be drawn on it.
 */
function chartTarget(
  state: PanelState,
  depositMint: string,
  holdings: HoldingsView | undefined,
  draftPoolTokenX: string | undefined,
): ChartTarget | undefined {
  if (state.panel === "swap") return { mint: [state.to, state.from].find((m) => m && m !== depositMint) ?? WSOL };
  if ("position" in state) {
    const p = holdings?.positions.find((q) => q.kind === "lp" && q.position === state.position);
    return p?.kind === "lp" ? { pool: p.lbPair, base: p.tokenX.mint } : undefined;
  }
  // Wait for the pool's token X so the chart is fetched once, in the right units.
  return "pool" in state && state.pool && draftPoolTokenX ? { pool: state.pool, base: draftPoolTokenX } : undefined;
}

/** Chart plus trade panel for one action: the Swap tab (`panel="swap"`) or the Liquidity tab (`"lp"`). */
export function MarketsTab({
  v,
  owner,
  panel,
  onSwitch,
}: {
  v: VaultDetail;
  owner: string;
  panel: PanelState["panel"];
  /** Jump to the other action's tab, e.g. "swap for the missing token" from the liquidity form. */
  onSwitch: (s: PanelState) => void;
}) {
  const holdings = useHoldings(v.address);
  const { state: urlState, replace } = usePanel();
  const state: PanelState = urlState.panel === panel ? urlState : panel === "swap" ? { panel: "swap" } : { panel: "lp" };
  const [nonce, setNonce] = useState(0);
  // A lookback preset picks its own candle size; picking an interval directly clears the preset.
  const [lookback, setLookback] = useState<ChartRangeId | null>(DEFAULT_RANGE);
  const [tf, setTf] = useState<MarketTimeframe>(chartRange(DEFAULT_RANGE).tf);
  const draftPool = usePool(state.panel === "lp" && "pool" in state ? state.pool : undefined);
  const target = chartTarget(state, v.depositMint, holdings.data, draftPool.data?.tokenX.mint);
  // Range lines: the draft from the liquidity form, or the open position being managed.
  const [draftRange, setDraftRange] = useState<PriceRange | null>(null);
  // Dragging a Min/Max Bin line on the chart; `seq` forces the form to re-apply even same-valued repeats.
  const [dragRange, setDragRange] = useState<{ range: PriceRange; seq: number } | null>(null);
  const managed =
    state.panel === "lp" && "position" in state
      ? holdings.data?.positions.find((p) => p.kind === "lp" && p.position === state.position)
      : undefined;
  const range: PriceRange | null =
    state.panel !== "lp"
      ? null
      : managed?.kind === "lp"
        ? { min: Number(managed.range.lowerPrice), max: Number(managed.range.upperPrice) }
        : draftRange;
  // Other open positions in the charted pool, so a new layer can be placed around them.
  const chartedPool = target && "pool" in target ? target.pool : undefined;
  const otherRanges: PriceRange[] = [];
  if (state.panel === "lp" && chartedPool)
    for (const p of holdings.data?.positions ?? [])
      if (p.kind === "lp" && p.lbPair === chartedPool && !(managed?.kind === "lp" && p.position === managed.position))
        otherRanges.push({ min: Number(p.range.lowerPrice), max: Number(p.range.upperPrice) });
  const library = useChartingLibrary();
  const tv = library === "ready";
  const { latest: ohlcv, candles, newest, from, loadMore, covered } = useCandles(target, tf, lookback);

  const prefill = (s: PanelState) => {
    if (s.panel !== panel) return onSwitch(s);
    replace(s);
    setNonce((n) => n + 1);
  };

  const last = candles.at(-1)?.close;
  // Change over the selected lookback, or the last 24h when only an interval is picked. Daily and
  // weekly candles cannot resolve a 24h move, so that case shows none.
  const change =
    from !== undefined
      ? changeSince(candles, from)
      : isIntraday(tf) && newest !== undefined
        ? changeSince(candles, newest - DAY)
        : null;
  const changeLabel = lookback ? (lookback === "ALL" ? "all time" : chartRange(lookback).label) : "24H";
  const targetId = target ? ("mint" in target ? target.mint : `${target.pool}:${target.base ?? ""}`) : "";
  const quote = ohlcv.data?.quote === "usd" ? "$" : "";
  const quoteSuffix = ohlcv.data && ohlcv.data.quote !== "usd" ? ` ${ohlcv.data.quote}` : "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6 self-start">
      <Card className="min-w-0">
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
                  <span className={cn("text-sm tabular-nums", change >= 0 ? "text-sky-400" : "text-red-300")}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(2)}% {changeLabel}
                  </span>
                )}
              </div>
            </div>
            {/* TradingView brings its own interval picker */}
            {!tv && (
              <Segmented
                size="sm"
                value={tf}
                onChange={(id) => {
                  setTf(id);
                  setLookback(null);
                }}
                options={TIMEFRAME_OPTIONS}
              />
            )}
          </div>

          {!target ? (
            <div className="grid h-[360px] place-items-center text-center text-sm text-muted">
              Choose a pool in the Liquidity panel to see its chart.
            </div>
          ) : library === "loading" ? (
            <Skeleton className="h-[360px]" />
          ) : tv ? (
            <TradingViewChart target={target} range={range} otherRanges={otherRanges} />
          ) : ohlcv.error ? (
            <div className="grid h-[360px] place-items-center">
              <ErrorState message={ohlcv.error.message} onRetry={() => void ohlcv.refetch()} />
            </div>
          ) : !ohlcv.data ? (
            <Skeleton className="h-[360px]" />
          ) : (
            <PriceChart
              candles={candles}
              range={range}
              otherRanges={otherRanges}
              view={{ key: `${targetId}:${tf}:${lookback ?? ""}`, from }}
              ready={covered}
              intraday={isIntraday(tf)}
              onLoadMore={loadMore}
              onRangeChange={managed ? undefined : (r) => setDragRange((prev) => ({ range: r, seq: (prev?.seq ?? 0) + 1 }))}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            {!tv && target ? (
              <div role="radiogroup" aria-label="Lookback" className="flex gap-0.5">
                {CHART_RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={lookback === r.id}
                    onClick={() => {
                      setLookback(r.id);
                      setTf(r.tf);
                    }}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[12px] font-medium tabular-nums transition-colors",
                      lookback === r.id ? "bg-white/10 text-white" : "text-muted hover:text-foreground",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            ) : (
              <span />
            )}
            <p className="text-[11px] text-white/40">Market data: Jupiter</p>
          </div>
        </CardBody>
      </Card>
      {panel === "lp" && holdings.data && <OpenPositions holdings={holdings.data} state={state} onSelect={prefill} />}
      </div>

      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        {holdings.data ? (
          <ActionPanel
            v={v}
            owner={owner}
            holdings={holdings.data}
            state={state}
            replace={replace}
            nonce={nonce}
            onPrefill={prefill}
            onRangeChange={setDraftRange}
            dragRange={dragRange}
          />
        ) : holdings.error ? (
          <ErrorState message={`Holdings unavailable: ${holdings.error.message}`} onRetry={() => void holdings.refetch()} />
        ) : (
          <Skeleton className="h-96 rounded-card" />
        )}
      </div>
    </div>
  );
}
