"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PositionCard } from "@/components/holdings/position-card";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings, usePhoenixManager } from "@/hooks/queries";
import { useMarketStats } from "@/hooks/use-phoenix-live";
import { priceDecimals } from "@/lib/perps";
import type { ErrorPositionView, PerpPositionView, VaultDetail } from "@/lib/types";
import { AccountPanel, type TransferRequest } from "./perps/account-panel";
import { MarketHeader } from "./perps/market-header";
import { OrderBookPanel } from "./perps/order-book";
import { OrderTicket, type PickedPrice } from "./perps/order-ticket";
import { PerpChart } from "./perps/perp-chart";
import { PositionsPanel } from "./perps/positions-panel";
import { SetupPanel } from "./perps/setup-panel";
import type { ChartLine } from "./price-chart";

const DEFAULT_MARKET = "SOL";
const ENTRY = "rgba(255,255,255,0.7)";
const LIQ = "#fbbf24";
const BUY = "#38bdf8";
const SELL = "#f87171";

/**
 * Phoenix perps for the vault's own cross-margin account, laid out like a perps exchange: market,
 * chart, book and positions on the left; the order ticket and account on the right.
 */
export function PerpsTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const holdings = useHoldings(v.address);
  const manager = usePhoenixManager(v.address);
  const { stats, loading: statsLoading } = useMarketStats();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState<PickedPrice | null>(null);
  const [transfer, setTransfer] = useState<TransferRequest | null>(null);

  const m = manager.data;
  const account = holdings.data?.positions.find((p): p is PerpPositionView => p.kind === "perp");
  const broken = holdings.data?.positions.filter((p): p is ErrorPositionView => p.kind === "error" && p.protocol === "phoenix") ?? [];
  const markets = useMemo(() => new Map((m?.markets ?? []).map((x) => [x.symbol, x])), [m?.markets]);
  const wanted = search.get("market") ?? account?.positions[0]?.symbol ?? DEFAULT_MARKET;
  const market = markets.get(wanted) ?? markets.get(DEFAULT_MARKET) ?? m?.markets[0];

  const selectMarket = (symbol: string) => {
    const p = new URLSearchParams(search.toString());
    p.set("market", symbol);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (manager.error)
    return <ErrorState message={`Phoenix unavailable: ${manager.error.message}`} onRetry={() => void manager.refetch()} />;
  if (!m || !market)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-card" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[480px] rounded-card" />
          <Skeleton className="h-[480px] rounded-card" />
        </div>
      </div>
    );

  const position = account?.positions.find((q) => q.symbol === market.symbol);
  const liq = m.account?.liquidationPrices[market.symbol];
  const d = priceDecimals(market);
  const lines: ChartLine[] = [
    ...(position ? [{ price: Number(position.entryPrice), title: `Entry ${position.side}`, color: ENTRY, dashed: true }] : []),
    ...(liq ? [{ price: Number(liq), title: "Liq.", color: LIQ }] : []),
    ...(m.openOrders ?? [])
      .filter((o) => o.symbol === market.symbol)
      .map((o) => ({
        price: Number(Number(o.price).toFixed(d)),
        title: `${o.side === "long" ? "Buy" : "Sell"} ${o.size}`,
        color: o.side === "long" ? BUY : SELL,
        dashed: true,
      })),
  ];

  return (
    <div className="space-y-4">
      {broken.length > 0 && holdings.data && (
        <Card>
          <div className="divide-y divide-border">
            {broken.map((p) => (
              <PositionCard key={p.strategy} position={p} depositToken={holdings.data!.depositToken} />
            ))}
          </div>
        </Card>
      )}
      {/*
        One grid, three arrangements:
        - phones: header → chart → book → ticket → account → positions, stacked;
        - tablets (md): chart full width, then book and positions on the left beside the ticket and account;
        - desktop (lg+): header, chart | book, positions on the left, the ticket in a sticky right column.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:grid-rows-[auto_auto_auto_1fr] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_1fr] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 md:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-1">
          <MarketHeader market={market} markets={m.markets} stats={stats} loading={statsLoading} onSelect={selectMarket} />
        </div>
        {/* On tablets this wrapper dissolves so the chart and book place themselves in the outer grid. */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:contents lg:col-start-1 lg:row-start-2 lg:grid xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 md:col-span-2 lg:col-span-1">
            <PerpChart symbol={market.symbol} lines={lines} />
          </div>
          <div className="min-w-0 md:col-start-1 md:row-start-3 md:self-start lg:col-start-auto lg:row-start-auto lg:self-auto">
            <OrderBookPanel market={market} onPickPrice={(price) => setPicked((p) => ({ price, seq: (p?.seq ?? 0) + 1 }))} />
          </div>
        </div>
        <div className="min-w-0 space-y-4 md:col-start-2 md:row-span-2 md:row-start-3 md:self-start lg:sticky lg:top-24 lg:row-span-3 lg:row-start-1">
          {m.status === "ready" ? (
            <>
              <OrderTicket
                v={v}
                owner={owner}
                m={m}
                market={market}
                stats={stats.get(market.symbol)}
                account={account}
                picked={picked}
                onAddCollateral={() => setTransfer((t) => ({ direction: "toPhoenix", seq: (t?.seq ?? 0) + 1 }))}
              />
              <AccountPanel v={v} owner={owner} m={m} account={account} transfer={transfer} />
            </>
          ) : (
            <SetupPanel v={v} owner={owner} m={m} />
          )}
        </div>
        <div className="min-w-0 md:col-start-1 md:row-start-4 md:self-start lg:row-start-3">
          <PositionsPanel v={v} owner={owner} m={m} account={account} stats={stats} markets={markets} onSelectMarket={selectMarket} />
        </div>
      </div>
    </div>
  );
}
