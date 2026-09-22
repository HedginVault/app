"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useStrategyHistory } from "@/hooks/queries";
import { formatTokenAmount } from "@/lib/format";
import type { StrategyHistoryToken } from "@/lib/types";

const signed = (token: StrategyHistoryToken) => {
  const value = BigInt(token.realizedPnl);
  const magnitude = value < 0n ? -value : value;
  const formatted = token.decimals === null ? magnitude.toString() : formatTokenAmount(magnitude.toString(), token.decimals);
  return `${value > 0n ? "+" : value < 0n ? "−" : ""}${formatted}`;
};

const amount = (value: string, token: StrategyHistoryToken) =>
  token.decimals === null ? `${value} base units` : formatTokenAmount(value, token.decimals);

export function StrategyHistory({ address }: { address: string }) {
  const history = useStrategyHistory(address);
  if (history.error)
    return <ErrorState message={`Position history unavailable: ${history.error.message}`} onRetry={() => void history.refetch()} />;
  if (!history.data) return <Skeleton className="h-56 rounded-card" />;
  if (history.data.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Closed positions" description="Exact on-chain token cash flows for completed strategies" />
      <div className="divide-y divide-border">
        {history.data.map((position) => (
          <article key={`${position.strategy}:${position.id ?? position.closeSignature}`} className="space-y-4 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium capitalize">{position.type ?? "Legacy"} position{position.id === null ? "" : ` #${position.id}`}</p>
                <p className="mt-1 text-xs text-muted">
                  Closed {new Date(position.closedTs * 1000).toLocaleString()}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs ${position.exact ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
                {position.exact ? "Exact" : "Legacy · incomplete"}
              </span>
            </div>
            {position.tokens.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr><th className="pb-2 font-medium">Token</th><th className="pb-2 font-medium">Contributed</th><th className="pb-2 font-medium">Returned</th><th className="pb-2 font-medium">Fees</th><th className="pb-2 text-right font-medium">Realized PnL</th></tr>
                  </thead>
                  <tbody>
                    {position.tokens.map((token) => (
                      <tr key={token.mint} className="border-t border-border/70 tabular-nums">
                        <td className="py-3">{token.symbol ?? `${token.mint.slice(0, 4)}…${token.mint.slice(-4)}`}</td>
                        <td className="py-3 text-white/70">{amount(token.contributed, token)}</td>
                        <td className="py-3 text-white/70">{amount(token.returned, token)}</td>
                        <td className="py-3 text-white/70">
                          <span className="block">Gross {amount(token.feesGross, token)}</span>
                          <span className="block text-xs text-muted">Treasury {amount(token.feesTreasury, token)} · vault {amount(token.feesRetained, token)}</span>
                        </td>
                        <td className="py-3 text-right font-medium">{signed(token)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ))}
      </div>
    </Card>
  );
}
