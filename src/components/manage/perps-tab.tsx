"use client";

import type { ReactNode } from "react";
import { PositionCard } from "@/components/holdings/position-card";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings } from "@/hooks/queries";
import { formatPrice, formatUsd, shortAddress } from "@/lib/format";
import { formatLeverage, formatSignedUsd, perpTotals, signTone, usdc } from "@/lib/perps";
import type { ErrorPositionView, PerpPositionView, VaultDetail } from "@/lib/types";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function PerpAccount({ p }: { p: PerpPositionView }) {
  const totals = perpTotals(p);
  return (
    <Card>
      <CardHeader title="Phoenix cross-margin account" description={`Trader ${shortAddress(p.traderAccount)}`} />
      <CardBody className="space-y-5">
        <Address value={p.traderAccount} />
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
          <Stat label="Equity">{formatUsd(usdc(p.equity))}</Stat>
          <Stat label="Collateral">{formatUsd(usdc(p.collateral))}</Stat>
          <Stat label="Leverage">{formatLeverage(p.leverage)}</Stat>
          <Stat label="Unrealized PnL">
            <span className={signTone(totals.unrealizedPnl)}>{formatSignedUsd(totals.unrealizedPnl)}</span>
          </Stat>
          <Stat label="Accrued funding">
            <span className={signTone(totals.accruedFunding)}>{formatSignedUsd(totals.accruedFunding)}</span>
          </Stat>
        </div>
        {BigInt(p.canonicalBalance) > 0n && (
          <p className="text-[12px] text-muted">{formatUsd(usdc(p.canonicalBalance))} withdrawn from Phoenix, awaiting unwrap.</p>
        )}
        {p.positions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No open positions.</p>
        ) : (
          <>
            {/* Table from sm up; stacked cards on phones. */}
            <table className="hidden w-full text-[13px] tabular-nums sm:table">
              <thead className="text-[11px] text-muted">
                <tr className="text-right [&>th:first-child]:text-left">
                  <th className="pb-2 font-normal">Market</th>
                  <th className="pb-2 font-normal">Side</th>
                  <th className="pb-2 font-normal">Size</th>
                  <th className="pb-2 font-normal">Entry</th>
                  <th className="pb-2 font-normal">Mark</th>
                  <th className="pb-2 font-normal">Notional</th>
                  <th className="pb-2 font-normal">uPnL</th>
                  <th className="pb-2 font-normal">Funding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.positions.map((q) => (
                  <tr key={q.assetId} className="text-right [&>td:first-child]:text-left">
                    <td className="py-2 font-medium">{q.symbol}</td>
                    <td className="py-2">
                      <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                    </td>
                    <td className="py-2">{q.size}</td>
                    <td className="py-2">{formatPrice(Number(q.entryPrice))}</td>
                    <td className="py-2">{formatPrice(Number(q.markPrice))}</td>
                    <td className="py-2">{formatUsd(usdc(q.notional))}</td>
                    <td className={`py-2 ${signTone(q.unrealizedPnl)}`}>{formatSignedUsd(q.unrealizedPnl)}</td>
                    <td className={`py-2 ${signTone(q.accruedFunding)}`}>{formatSignedUsd(q.accruedFunding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-3 sm:hidden">
              {p.positions.map((q) => (
                <li key={q.assetId} className="rounded-lg border border-border p-3 text-[13px] tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{q.symbol}</span>
                    <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 [&>dd]:text-right [&>dt]:text-muted">
                    <dt>Size</dt><dd>{q.size}</dd>
                    <dt>Entry</dt><dd>{formatPrice(Number(q.entryPrice))}</dd>
                    <dt>Mark</dt><dd>{formatPrice(Number(q.markPrice))}</dd>
                    <dt>Notional</dt><dd>{formatUsd(usdc(q.notional))}</dd>
                    <dt>uPnL</dt><dd className={signTone(q.unrealizedPnl)}>{formatSignedUsd(q.unrealizedPnl)}</dd>
                    <dt>Funding</dt><dd className={signTone(q.accruedFunding)}>{formatSignedUsd(q.accruedFunding)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Read-only view of the vault's Phoenix accounts, from the same holdings query as the Portfolio. */
export function PerpsTab({ v }: { v: VaultDetail }) {
  const holdings = useHoldings(v.address);
  if (holdings.error)
    return <ErrorState message={`Holdings unavailable: ${holdings.error.message}`} onRetry={() => void holdings.refetch()} />;
  const h = holdings.data;
  if (!h) return <Skeleton className="h-72 rounded-card" />;

  const accounts = h.positions.filter((p): p is PerpPositionView => p.kind === "perp");
  const broken = h.positions.filter((p): p is ErrorPositionView => p.kind === "error" && p.protocol === "phoenix");
  if (accounts.length === 0 && broken.length === 0)
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-muted">No Phoenix account yet. Perp trading actions are coming soon.</CardBody>
      </Card>
    );
  return (
    <div className="space-y-6">
      {broken.length > 0 && (
        <Card>
          <div className="divide-y divide-border">
            {broken.map((p) => (
              <PositionCard key={p.strategy} position={p} depositToken={h.depositToken} />
            ))}
          </div>
        </Card>
      )}
      {accounts.map((p) => (
        <PerpAccount key={p.strategy} p={p} />
      ))}
    </div>
  );
}
