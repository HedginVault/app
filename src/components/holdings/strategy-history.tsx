"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useStrategyHistory } from "@/hooks/queries";
import { formatTokenAmount } from "@/lib/format";
import type { StrategyHistoryToken } from "@/lib/types";

const amount = (value: string, token: StrategyHistoryToken) =>
  token.decimals === null ? `${value} base units` : formatTokenAmount(value, token.decimals);

const signedAmount = (value: string, token: StrategyHistoryToken) => {
  const raw = BigInt(value);
  const magnitude = raw < 0n ? -raw : raw;
  const formatted = token.decimals === null ? magnitude.toString() : formatTokenAmount(magnitude.toString(), token.decimals);
  return `${raw > 0n ? "+" : raw < 0n ? "−" : ""}${formatted}`;
};

const symbol = (token: StrategyHistoryToken) => token.symbol ?? `${token.mint.slice(0, 4)}…${token.mint.slice(-4)}`;

const duration = (openedTs: number | null, closedTs: number) => {
  if (openedTs === null) return "—";
  const seconds = Math.max(0, closedTs - openedTs);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const TokenLines = ({
  tokens,
  render,
}: {
  tokens: StrategyHistoryToken[];
  render: (token: StrategyHistoryToken) => string;
}) => (
  <div className="space-y-0.5">
    {tokens.map((token) => (
      <span key={token.mint} className="block whitespace-nowrap">
        {render(token)} {symbol(token)}
      </span>
    ))}
  </div>
);

const th = "pb-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted";
const td = "py-3 pr-4 align-top tabular-nums";

export function StrategyHistory({ address }: { address: string }) {
  const history = useStrategyHistory(address);
  if (history.error)
    return <ErrorState message={`Position history unavailable: ${history.error.message}`} onRetry={() => void history.refetch()} />;
  if (!history.data) return <Skeleton className="h-56 rounded-card" />;
  if (history.data.length === 0)
    return (
      <Card>
        <CardHeader title="Closed positions" description="Exact on-chain token cash flows for completed strategies" />
        <CardBody>
          <p className="text-sm text-muted">No closed positions have been indexed yet.</p>
        </CardBody>
      </Card>
    );

  return (
    <Card>
      <CardHeader title="Closed positions" description="Exact on-chain token cash flows for completed strategies" />
      <CardBody className="overflow-x-auto pt-0">
        <table className="w-full min-w-[760px] border-collapse font-mono text-sm">
          <thead>
            <tr className="border-b border-border [&>th:last-child]:pr-0">
              <th className={th}>#</th>
              <th className={th}>Type</th>
              <th className={th}>Closed</th>
              <th className={th}>Duration</th>
              <th className={th}>Deposited</th>
              <th className={th}>Withdrawn</th>
              <th className={th}>Realized PnL</th>
              <th className={th}>Fees (net)</th>
            </tr>
          </thead>
          <tbody>
            {history.data.map((position, index) => (
              <tr key={`${position.strategy}:${position.id ?? position.closeSignature}`} className="border-b border-border/60 last:border-b-0">
                <td className={`${td} text-muted`}>{history.data.length - index}</td>
                <td className={td}>
                  <span className="capitalize">{position.type ?? "legacy"}</span>
                  {!position.exact && (
                    <span
                      className="ml-2 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300"
                      title="Position predates exact on-chain accounting; totals may be incomplete."
                    >
                      Legacy
                    </span>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-white/70`}>{new Date(position.closedTs * 1000).toLocaleString()}</td>
                <td className={`${td} text-white/70`}>{duration(position.openedTs, position.closedTs)}</td>
                <td className={td}>
                  {position.tokens.length > 0 ? <TokenLines tokens={position.tokens} render={(t) => amount(t.contributed, t)} /> : "—"}
                </td>
                <td className={td}>
                  {position.tokens.length > 0 ? <TokenLines tokens={position.tokens} render={(t) => amount(t.returned, t)} /> : "—"}
                </td>
                <td className={td}>
                  {position.tokens.length > 0 ? (
                    <div className="space-y-0.5">
                      {position.tokens.map((token) => {
                        const raw = BigInt(token.realizedPnl);
                        return (
                          <span
                            key={token.mint}
                            className={`block whitespace-nowrap font-medium ${raw > 0n ? "text-emerald-400" : raw < 0n ? "text-rose-400" : "text-white/70"}`}
                          >
                            {signedAmount(token.realizedPnl, token)} {symbol(token)}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 pr-0 align-top tabular-nums">
                  {position.tokens.length > 0 ? <TokenLines tokens={position.tokens} render={(t) => amount(t.feesRetained, t)} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
