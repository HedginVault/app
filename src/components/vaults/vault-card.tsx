"use client";

import Link from "next/link";
import { useState } from "react";
import { VerifiedMark } from "@/components/token/token-trust";
import { VERIFIED_VAULTS } from "@/lib/constants";
import { formatBps, formatNav, formatTokenAmount } from "@/lib/format";
import type { Status, VaultSummary } from "@/lib/types";

const status: Record<Status, { label: string; dot: string }> = {
  normal: { label: "Active", dot: "bg-sky-400" },
  reduceOnly: { label: "Withdraw only", dot: "bg-amber-400" },
  paused: { label: "Paused", dot: "bg-red-400" },
};

export function VaultCard({ v }: { v: VaultSummary }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const cap = BigInt(v.depositCap);
  const used = cap === 0n ? 0 : Math.min(100, Number((BigInt(v.totalAssets) * 10000n) / cap) / 100);
  const s = status[v.status];
  return (
    <Link
      href={`/vault/${v.address}`}
      className="group flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition duration-300 hover:-translate-y-1 hover:border-sky-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      <div className="flex items-center gap-3">
        {v.depositLogo && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.depositLogo}
            alt={v.depositSymbol}
            onError={() => setLogoFailed(true)}
            className="size-10 shrink-0 rounded-full bg-white/10"
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold">
            {v.depositSymbol.slice(0, 4)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-serif text-2xl leading-tight">
            <span className="truncate">{v.name}</span>
            {VERIFIED_VAULTS.has(v.address) && <VerifiedMark className="size-4" />}
          </h3>
          <p className="truncate text-sm text-white/50">
            {v.metadata?.managerName ?? "Unregistered manager"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-white/60">
          <span className={`size-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-white/50">Share price</dt>
          <dd className="mt-1 text-2xl font-medium tabular-nums">{formatNav(v.navPerShare)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Deposited</dt>
          <dd className="mt-1 truncate whitespace-nowrap text-2xl font-medium tabular-nums">
            {formatTokenAmount(v.totalAssets, v.depositDecimals, { compact: true })}{" "}
            <span className="text-sm text-white/50">{v.depositSymbol}</span>
          </dd>
        </div>
      </dl>

      {cap > 0n && (
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10" title={`${used.toFixed(0)}% of cap filled`}>
          <div className="h-full rounded-full bg-sky-400" style={{ width: `${used}%` }} />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
        <span className="text-white/50">
          Fees {formatBps(v.performanceFeeBps)} · {formatBps(v.managementFeeBps)}
        </span>
        <span className="flex items-center gap-1 font-medium text-sky-400">
          Open
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}
