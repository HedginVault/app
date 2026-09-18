"use client";

import { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PairLogo } from "@/components/token/token-logo";
import { VerifiedMark } from "@/components/token/token-trust";
import { usePoolSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { formatUsd, shortAddress } from "@/lib/format";
import type { PoolSearchResult } from "@/lib/types";

const isPublicKey = (s: string) => {
  if (!s) return false;
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
};

export function PoolSelect({
  onSelect,
  heldMints,
  defaultQuery,
}: {
  onSelect: (pool: PoolSearchResult) => void;
  heldMints: Set<string>;
  defaultQuery: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounce(query.trim() || defaultQuery, 300);
  const search = usePoolSearch(debounced, page);
  const pools = [...(search.data?.pools ?? [])].sort((a, b) => b.tvl - a.tvl);
  const trimmed = query.trim();
  // A pasted pool address opens directly, whether or not search is up.
  const pasted = isPublicKey(trimmed) ? trimmed : null;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search pool, e.g. SOL-USDC or address"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
      {pasted && (
        <button
          type="button"
          onClick={() => onSelect({ address: pasted } as PoolSearchResult)}
          className="w-full rounded-card border border-border px-3 py-2.5 text-left text-sm font-medium hover:border-emerald-400/40 hover:bg-white/[0.03]"
        >
          Open pool {shortAddress(pasted)}
        </button>
      )}
      {search.isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : search.error ? (
        <p className="text-[13px] text-muted">Pool search unavailable. Paste a pool address to open it directly.</p>
      ) : pools.length === 0 ? (
        <p className="text-[13px] text-muted">No DLMM pools found.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4rem] gap-2 border-b border-border px-3 py-2 text-[11px] text-muted">
            <span>Pool</span>
            <span className="text-right">TVL</span>
            <span className="text-right" title="24h fees earned relative to TVL">24h yield</span>
          </div>
          {/* ponytail: fixed-height scroll keeps the panel short; the page size already caps rows */}
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {pools.map((p) => {
              const held = [p.tokenX, p.tokenY].filter((t) => heldMints.has(t.mint));
              return (
                <li key={p.address}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    title={`24h volume ${formatUsd(p.volume24h, { compact: true })}`}
                    className="grid w-full grid-cols-[minmax(0,1fr)_4.5rem_4rem] items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PairLogo x={p.tokenX} y={p.tokenY} size="sm" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 truncate text-[13px] font-medium">
                          {p.tokenX.symbol}
                          {p.tokenX.verified && <VerifiedMark />}
                          <span className="text-muted">/</span>
                          {p.tokenY.symbol}
                          {p.tokenY.verified && <VerifiedMark />}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          Bin {p.binStep} · {p.baseFeePct}% fee
                          {held.length > 0 && <span className="text-emerald-400"> · Vault holds {held.map((t) => t.symbol).join("/")}</span>}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-[13px] tabular-nums">{formatUsd(p.tvl, { compact: true })}</span>
                    <span className="text-right text-[13px] tabular-nums text-emerald-400">{p.feeTvl24h.toFixed(2)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {search.data && search.data.pages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-muted">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</Button>
          <span>Page {search.data.page} of {search.data.pages}</span>
          <Button size="sm" variant="ghost" disabled={page >= search.data.pages} onClick={() => setPage(page + 1)}>Next →</Button>
        </div>
      )}
    </div>
  );
}
