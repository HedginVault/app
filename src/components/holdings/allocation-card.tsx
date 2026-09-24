"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { PairLogo, TokenLogo } from "@/components/token/token-logo";
import { TokenAmount } from "@/components/token/token-amount";
import { barWidths, toSlices, type SliceInput } from "@/lib/allocation";
import { formatShare, formatUsd } from "@/lib/format";
import { positionKey } from "@/lib/holdings";
import type { HoldingsView, PositionView } from "@/lib/types";
import type { ReactNode } from "react";

type Mode = "token" | "position";

const positionLabel = (p: PositionView) =>
  p.kind === "idle"
    ? `Idle · ${p.token.symbol}`
    : p.kind === "swap"
      ? `${p.token.symbol} · Jupiter`
      : p.kind === "lp"
        ? `${p.tokenX.symbol}-${p.tokenY.symbol} · DLMM`
        : p.kind === "perp"
          ? "Phoenix Perps"
          : "Unreadable position";

const positionIcon = (p: PositionView): ReactNode =>
  p.kind === "lp" ? (
    <PairLogo x={p.tokenX} y={p.tokenY} size="sm" />
  ) : p.kind === "error" ? (
    <span className="size-5 shrink-0 rounded-full bg-warning-soft" />
  ) : p.kind === "perp" ? (
    <span className="size-5 shrink-0 rounded-full bg-accent-soft" />
  ) : (
    <TokenLogo token={p.token} size="sm" />
  );

export function AllocationCard({ holdings: h }: { holdings: HoldingsView }) {
  const [mode, setMode] = useState<Mode>("token");
  const total = BigInt(h.totalValue);

  const rows: (SliceInput & { icon: ReactNode; amount: ReactNode })[] =
    mode === "token"
      ? h.tokens
          .filter((t) => t.amount !== "0")
          .map((t) => ({
            key: t.token.mint,
            label: t.token.symbol,
            value: t.value === null ? null : BigInt(t.value),
            usd: t.usd,
            icon: <TokenLogo token={t.token} size="sm" />,
            amount: <TokenAmount raw={t.amount} token={t.token} align="right" />,
          }))
      : h.positions.map((p) => ({
          key: positionKey(p),
          label: positionLabel(p),
          value: p.value === null ? null : BigInt(p.value),
          usd: p.usd,
          icon: positionIcon(p),
          amount: p.value === null ? <span className="text-muted">—</span> : <TokenAmount raw={p.value} token={h.depositToken} align="right" />,
        }));
  const slices = toSlices(rows, total);
  const widths = barWidths(slices);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return (
    <Card>
      <CardHeader
        title="Allocation"
        description={`Live value ${formatUsd(h.totalUsd, { compact: true })}`}
        action={
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[{ id: "token", label: "By token" }, { id: "position", label: "By position" }]}
          />
        }
      />
      <CardBody className="space-y-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label="Allocation bar">
          {slices.map((s, i) => (
            <div key={s.key} style={{ width: `${widths[i]}%`, background: s.color }} title={`${s.label} ${formatShare(s.shareBps)}`} />
          ))}
        </div>
        <ul className="divide-y divide-border">
          {slices.map((s) => {
            const row = byKey.get(s.key);
            return (
              <li key={s.key} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                {row?.icon}
                <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                <span className="hidden sm:block">{row?.amount}</span>
                <span className="w-24 text-right tabular-nums">{formatUsd(s.usd)}</span>
                <span className="w-14 text-right tabular-nums text-muted">{formatShare(s.shareBps)}</span>
              </li>
            );
          })}
        </ul>
        {h.unpriced.length > 0 && (
          <p className="text-[12px] text-amber-300">
            Price unavailable for {h.unpriced.join(", ")}; excluded from percentages and totals.
          </p>
        )}
        {h.positions.some((p) => p.kind === "error") && (
          <p className="text-[12px] text-amber-300">
            Some positions could not be read; excluded from percentages and totals.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
