"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBps, formatNav, formatTokenAmount } from "@/lib/format";
import type { VaultSummary } from "@/lib/types";

export function VaultCard({ v }: { v: VaultSummary }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const cap = BigInt(v.depositCap);
  const used = cap === 0n ? 0 : Math.min(100, Number((BigInt(v.totalAssets) * 10000n) / cap) / 100);
  // A sliver of a bar must not read as "0%".
  const usedLabel = used > 0 && used < 1 ? "<1%" : `${used.toFixed(0)}%`;
  return (
    <Link
      href={`/vault/${v.address}`}
      className="group block rounded-card border border-border bg-surface p-5 transition-shadow hover:shadow-[0_4px_20px_-8px_rgba(15,23,42,0.15)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {v.depositLogo && !logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.depositLogo}
              alt={v.depositSymbol}
              onError={() => setLogoFailed(true)}
              className="size-10 shrink-0 rounded-full bg-slate-100"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-700">
              {v.depositSymbol.slice(0, 4)}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-semibold tracking-tight group-hover:text-emerald-700">
              {v.name}
            </h3>
            <p className="truncate text-[12px] text-muted">
              {v.metadata?.managerName ?? "Unregistered manager"} · {v.depositSymbol}
            </p>
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {v.metadata?.strategy && (
        <p className="mt-3 line-clamp-2 text-[13px] text-slate-600">{v.metadata.strategy}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[12px] text-muted">NAV / share</dt>
          <dd className="font-medium tabular-nums">{formatNav(v.navPerShare)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Total assets</dt>
          <dd className="font-medium tabular-nums">
            {formatTokenAmount(v.totalAssets, v.depositDecimals, { compact: true })}{" "}
            {v.depositSymbol}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Fees</dt>
          <dd className="font-medium tabular-nums">
            {formatBps(v.performanceFeeBps)} perf · {formatBps(v.managementFeeBps)} mgmt
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Cap used</dt>
          <dd className="font-medium tabular-nums">{usedLabel}</dd>
        </div>
      </dl>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-accent" style={{ width: `${used}%` }} />
      </div>
    </Link>
  );
}
