"use client";

import { useState, type ReactNode } from "react";
import { TokenLogo } from "@/components/token/token-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTraderTrades, type MarketStats } from "@/hooks/use-phoenix-live";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { explorerUrl } from "@/lib/constants";
import { formatUsd } from "@/lib/format";
import {
  floorToLots,
  formatBaseSize,
  formatMarketPrice,
  formatSignedPercent,
  formatSignedUsd,
  formatSignedUsdValue,
  priceDecimals,
  signTone,
  signToneValue,
} from "@/lib/perps";
import type { PerpPositionView, PhoenixManagerView, PhoenixMarketView, PhoenixPerpPositionView, VaultDetail } from "@/lib/types";

/** A reduce-only close crosses the book, so it gets more room than the ticket's default. */
const CLOSE_SLIPPAGE_BPS = 100;
type Tab = "positions" | "orders" | "history";

const Th = ({ children, left }: { children?: ReactNode; left?: boolean }) => (
  <th scope="col" className={cn("px-3 py-2 font-normal", left ? "text-left" : "text-right")}>
    {children}
  </th>
);
const Td = ({ children, left, className }: { children: ReactNode; left?: boolean; className?: string }) => (
  <td className={cn("px-3 py-2.5", left ? "text-left" : "text-right", className)}>{children}</td>
);

function MarketCell({
  market,
  symbol,
  onSelect,
  extra,
}: {
  market?: PhoenixMarketView;
  symbol: string;
  onSelect: (s: string) => void;
  extra?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(symbol)}
      className="flex items-center gap-2 rounded-md text-left hover:text-sky-300"
      title={`Show ${symbol}`}
    >
      <TokenLogo token={{ symbol, logo: market?.logoUri ?? null }} size="sm" />
      <span className="font-medium">{symbol}</span>
      {extra}
    </button>
  );
}

function SideTag({ side }: { side: "long" | "short" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-medium",
        side === "long" ? "bg-emerald-400/10 text-emerald-400" : "bg-danger-soft text-red-300",
      )}
    >
      {side === "long" ? "Long" : "Short"}
    </span>
  );
}

function MobileStat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={className}>{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-[13px] text-muted">{children}</p>;
}

function CloseDialog({
  v,
  owner,
  position,
  market,
  mark,
  onClose,
}: {
  v: VaultDetail;
  owner: string;
  position: PhoenixPerpPositionView | null;
  market?: PhoenixMarketView;
  mark: number | undefined;
  onClose: () => void;
}) {
  const { send, pending } = useSendTransaction();
  const [pct, setPct] = useState(100);
  if (!position)
    return (
      <Dialog open={false} onClose={onClose} title="Close position">
        {null}
      </Dialog>
    );
  const d = market ? priceDecimals(market) : 2;
  const full = Number(position.size);
  const size = pct === 100 ? position.size : floorToLots((full * pct) / 100, market?.baseLotsDecimals ?? 0);
  const px = mark ?? Number(position.markPrice);
  const pnl = (position.side === "long" ? 1 : -1) * Number(size) * (px - Number(position.entryPrice));
  const submit = () =>
    void send({
      label: `Close ${size} ${position.symbol}`,
      vault: v.address,
      build: () =>
        api.build("phoenix/order", {
          payer: owner,
          vault: v.address,
          symbol: position.symbol,
          side: position.side === "long" ? "short" : "long",
          size,
          reduceOnly: true,
          order: { type: "market", slippageBps: CLOSE_SLIPPAGE_BPS },
        }),
      onSuccess: onClose,
    });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Close ${position.symbol} ${position.side}`}
      footer={
        <Button variant="danger" className="w-full" onClick={submit} loading={pending} disabled={!(Number(size) > 0)}>
          Close {formatBaseSize(Number(size), market?.baseLotsDecimals ?? 4)} {position.symbol} at market
        </Button>
      }
    >
      <div className="space-y-4 text-[13px]">
        <div role="radiogroup" aria-label="Amount to close" className="grid grid-cols-4 gap-1">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pct === p}
              onClick={() => setPct(p)}
              className={cn(
                "h-10 rounded-lg text-[13px] font-medium",
                pct === p ? "bg-white/10 text-white" : "bg-white/[0.03] text-muted hover:text-foreground",
              )}
            >
              {p}%
            </button>
          ))}
        </div>
        <dl className="space-y-2 tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted">Size</dt>
            <dd>
              {formatBaseSize(Number(size), market?.baseLotsDecimals ?? 4)} of {position.size} {position.symbol}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Entry / mark</dt>
            <dd>
              ${formatMarketPrice(Number(position.entryPrice), d)} / ${formatMarketPrice(px, d)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Est. realized PnL</dt>
            <dd className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
              {pnl >= 0 ? "+" : "−"}
              {formatUsd(Math.abs(pnl))}
            </dd>
          </div>
        </dl>
        <p className="text-[12px] text-muted">
          Reduce-only market order. Fills in full within {CLOSE_SLIPPAGE_BPS / 100}% of the mark, or fails without trading.
        </p>
      </div>
    </Dialog>
  );
}

/** Positions, resting orders and fills of the vault's Phoenix account. */
export function PositionsPanel({
  v,
  owner,
  m,
  account,
  stats,
  markets,
  onSelectMarket,
}: {
  v: VaultDetail;
  owner: string;
  m: PhoenixManagerView;
  account: PerpPositionView | undefined;
  stats: Map<string, MarketStats>;
  markets: Map<string, PhoenixMarketView>;
  onSelectMarket: (symbol: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("positions");
  const [closing, setClosing] = useState<PhoenixPerpPositionView | null>(null);
  const { send, pending } = useSendTransaction();
  const trades = useTraderTrades(m.status === "ready" ? m.traderAccount : undefined);
  const positions = account?.positions ?? [];
  const rows = positions.map((q) => {
    const mk = markets.get(q.symbol);
    const mark = stats.get(q.symbol)?.markPrice ?? Number(q.markPrice);
    const entry = Number(q.entryPrice);
    const dir = q.side === "long" ? 1 : -1;
    const liq = m.account?.liquidationPrices[q.symbol];
    return {
      q,
      mk,
      d: mk ? priceDecimals(mk) : 2,
      mark,
      entry,
      value: Number(q.size) * mark,
      // Live from the streamed mark, so it moves with the header price rather than the 20 s holdings refresh.
      pnl: dir * Number(q.size) * (mark - entry),
      move: entry > 0 ? (dir * (mark - entry)) / entry : null,
      liq: liq ? Number(liq) : null,
    };
  });
  const orders = m.openOrders ?? [];
  const orderMarkets = [...new Set(orders.map((o) => o.symbol))];

  const cancel = (symbol: string, which: "all" | typeof orders) =>
    void send({
      label: which === "all" ? `Cancel ${symbol} orders` : `Cancel ${symbol} order`,
      vault: v.address,
      build: () =>
        api.build("phoenix/cancel", {
          payer: owner,
          vault: v.address,
          symbol,
          orders:
            which === "all"
              ? "all"
              : which.map((o) => ({
                  priceInTicks: o.priceInTicks,
                  orderSequenceNumber: o.orderSequenceNumber,
                })),
        }),
    });

  const tabs: { id: Tab; label: string }[] = [
    {
      id: "positions",
      label: `Positions${positions.length ? ` (${positions.length})` : ""}`,
    },
    {
      id: "orders",
      label: `Open orders${orders.length ? ` (${orders.length})` : ""}`,
    },
    { id: "history", label: "Trade history" },
  ];

  return (
    <Card className="min-w-0">
      <div className="flex items-center justify-between border-b border-border pr-3">
        <div role="tablist" className="flex overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px min-w-max border-b-2 px-4 py-3 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-sky-400",
                tab === t.id ? "border-sky-400 text-white" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "orders" && orderMarkets.length === 1 && (
          <Button size="sm" variant="ghost" onClick={() => cancel(orderMarkets[0], "all")} loading={pending}>
            Cancel all
          </Button>
        )}
      </div>

      {/* `relative` keeps the tables' absolutely positioned sr-only labels inside the scroll area; without it they stretch the page on phones. */}
      <div className="relative overflow-x-auto">
        {tab === "positions" &&
          (positions.length === 0 ? (
            <Empty>
              {m.status === "ready" ? "No open positions. Place an order to open one." : "Enable perps trading to open positions."}
            </Empty>
          ) : (
            <>
              <table className="hidden w-full min-w-[820px] text-[13px] tabular-nums xl:table">
                <thead className="text-[11px] text-muted">
                  <tr>
                    <Th left>Market</Th>
                    <Th>Size</Th>
                    <Th>Value</Th>
                    <Th>Entry</Th>
                    <Th>Mark</Th>
                    <Th>Liq. price</Th>
                    <Th>PnL</Th>
                    <Th>Funding</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.q.assetId} className="hover:bg-white/[0.02]">
                      <Td left>
                        <MarketCell market={r.mk} symbol={r.q.symbol} onSelect={onSelectMarket} extra={<SideTag side={r.q.side} />} />
                      </Td>
                      <Td>
                        {r.q.size} {r.q.symbol}
                      </Td>
                      <Td>{formatUsd(r.value)}</Td>
                      <Td>${formatMarketPrice(r.entry, r.d)}</Td>
                      <Td>${formatMarketPrice(r.mark, r.d)}</Td>
                      <Td className="text-amber-300">{r.liq ? `$${formatMarketPrice(r.liq, r.d)}` : "—"}</Td>
                      <Td className={signToneValue(r.pnl)}>
                        {formatSignedUsdValue(r.pnl)}
                        {r.move !== null && <span className="ml-1 text-[11px] opacity-80">{formatSignedPercent(r.move)}</span>}
                      </Td>
                      <Td className={signTone(r.q.accruedFunding)}>{formatSignedUsd(r.q.accruedFunding)}</Td>
                      <Td>
                        <Button size="sm" variant="secondary" onClick={() => setClosing(r.q)}>
                          Close
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-border xl:hidden">
                {rows.map((r) => (
                  <li key={r.q.assetId} className="space-y-3 p-4 text-[13px] tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <MarketCell market={r.mk} symbol={r.q.symbol} onSelect={onSelectMarket} extra={<SideTag side={r.q.side} />} />
                      <span className={cn("text-right", signToneValue(r.pnl))}>
                        {formatSignedUsdValue(r.pnl)}
                        {r.move !== null && <span className="ml-1 text-[11px] opacity-80">{formatSignedPercent(r.move)}</span>}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-[12px]">
                      <MobileStat label="Size">
                        {r.q.size} {r.q.symbol}
                      </MobileStat>
                      <MobileStat label="Entry">${formatMarketPrice(r.entry, r.d)}</MobileStat>
                      <MobileStat label="Mark">${formatMarketPrice(r.mark, r.d)}</MobileStat>
                      <MobileStat label="Value">{formatUsd(r.value)}</MobileStat>
                      <MobileStat label="Liq. price" className="text-amber-300">
                        {r.liq ? `$${formatMarketPrice(r.liq, r.d)}` : "—"}
                      </MobileStat>
                      <MobileStat label="Funding" className={signTone(r.q.accruedFunding)}>
                        {formatSignedUsd(r.q.accruedFunding)}
                      </MobileStat>
                    </dl>
                    <Button variant="secondary" className="w-full" onClick={() => setClosing(r.q)}>
                      Close position
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ))}

        {tab === "orders" &&
          (m.openOrders === null ? (
            <Empty>Open orders are unavailable from Phoenix right now.</Empty>
          ) : orders.length === 0 ? (
            <Empty>No open orders. Limit orders rest here until filled or cancelled.</Empty>
          ) : (
            <>
              <table className="hidden w-full min-w-[640px] text-[13px] tabular-nums xl:table">
                <thead className="text-[11px] text-muted">
                  <tr>
                    <Th left>Market</Th>
                    <Th>Side</Th>
                    <Th>Price</Th>
                    <Th>Size</Th>
                    <Th>Value</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => {
                    const mk = markets.get(o.symbol);
                    const d = mk ? priceDecimals(mk) : 2;
                    return (
                      <tr key={`${o.symbol}:${o.orderSequenceNumber}`} className="hover:bg-white/[0.02]">
                        <Td left>
                          <MarketCell
                            market={mk}
                            symbol={o.symbol}
                            onSelect={onSelectMarket}
                            extra={o.reduceOnly ? <span className="text-[11px] text-muted">reduce-only</span> : undefined}
                          />
                        </Td>
                        <Td className={o.side === "long" ? "text-emerald-400" : "text-red-400"}>{o.side === "long" ? "Buy" : "Sell"}</Td>
                        <Td>${formatMarketPrice(Number(o.price), d)}</Td>
                        <Td>
                          {o.size} {o.symbol}
                        </Td>
                        <Td>{formatUsd(Number(o.size) * Number(o.price))}</Td>
                        <Td>
                          <Button size="sm" variant="secondary" onClick={() => cancel(o.symbol, [o])} loading={pending}>
                            Cancel
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="divide-y divide-border xl:hidden">
                {orders.map((o) => {
                  const mk = markets.get(o.symbol);
                  const d = mk ? priceDecimals(mk) : 2;
                  return (
                    <li
                      key={`${o.symbol}:${o.orderSequenceNumber}`}
                      className="flex items-center justify-between gap-3 p-4 text-[13px] tabular-nums"
                    >
                      <div className="min-w-0 space-y-1">
                        <MarketCell market={mk} symbol={o.symbol} onSelect={onSelectMarket} />
                        <div className="text-[12px]">
                          <span className={o.side === "long" ? "text-emerald-400" : "text-red-400"}>{o.side === "long" ? "Buy" : "Sell"}</span>{" "}
                          {o.size} @ ${formatMarketPrice(Number(o.price), d)}
                          {o.reduceOnly && <span className="ml-1 text-muted">· reduce-only</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => cancel(o.symbol, [o])} loading={pending}>
                        Cancel
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          ))}

        {tab === "history" &&
          (trades.isPending && m.status === "ready" ? (
            <Skeleton className="m-4 h-24" />
          ) : trades.error ? (
            <Empty>Trade history is unavailable from Phoenix right now.</Empty>
          ) : !trades.data?.length ? (
            <Empty>No trades yet.</Empty>
          ) : (
            <table className="w-full min-w-[760px] text-[13px] tabular-nums">
              <thead className="text-[11px] text-muted">
                <tr>
                  <Th left>Time</Th>
                  <Th left>Market</Th>
                  <Th>Side</Th>
                  <Th>Price</Th>
                  <Th>Size</Th>
                  <Th>Fee</Th>
                  <Th>Realized PnL</Th>
                  <Th>
                    <span className="sr-only">Transaction</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trades.data.map((t) => {
                  const mk = markets.get(t.symbol);
                  return (
                    <tr key={t.id}>
                      <Td left className="text-muted">
                        {new Date(t.time).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </Td>
                      <Td left>
                        <MarketCell
                          market={mk}
                          symbol={t.symbol}
                          onSelect={onSelectMarket}
                          extra={t.kind !== "trade" ? <span className="text-[11px] capitalize text-amber-300">{t.kind}</span> : undefined}
                        />
                      </Td>
                      <Td className={t.side === "buy" ? "text-emerald-400" : "text-red-400"}>{t.side === "buy" ? "Buy" : "Sell"}</Td>
                      <Td>${formatMarketPrice(t.price, mk ? priceDecimals(mk) : 2)}</Td>
                      <Td>
                        {formatBaseSize(t.size, mk?.baseLotsDecimals ?? 4)} {t.symbol}
                      </Td>
                      <Td className="text-muted">{formatUsd(t.fee)}</Td>
                      <Td className={t.realizedPnl > 0 ? "text-emerald-400" : t.realizedPnl < 0 ? "text-red-400" : "text-muted"}>
                        {t.realizedPnl === 0 ? "—" : `${t.realizedPnl > 0 ? "+" : "−"}${formatUsd(Math.abs(t.realizedPnl))}`}
                      </Td>
                      <Td>
                        <a
                          href={explorerUrl("tx", t.signature)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-sky-400 hover:text-sky-300"
                        >
                          View ↗
                        </a>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
      </div>
      <CloseDialog
        key={closing ? `${closing.symbol}:${closing.size}` : "none"}
        v={v}
        owner={owner}
        position={closing}
        market={closing ? markets.get(closing.symbol) : undefined}
        mark={closing ? stats.get(closing.symbol)?.markPrice : undefined}
        onClose={() => setClosing(null)}
      />
    </Card>
  );
}
