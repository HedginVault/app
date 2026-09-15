"use client";

import { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PairLogo } from "@/components/token/token-logo";
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
        placeholder="Search token, pair (SOL-USDC) or pool address"
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
          className="w-full rounded-card border border-border px-3 py-2.5 text-left text-sm font-medium hover:border-emerald-300 hover:bg-slate-50"
        >
          Open pool {shortAddress(pasted)}
        </button>
      )}
      {search.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : search.error ? (
        <p className="text-[13px] text-muted">Pool search unavailable. Paste a pool address to open it directly.</p>
      ) : pools.length === 0 ? (
        <p className="text-[13px] text-muted">No DLMM pools found.</p>
      ) : (
        <ul className="space-y-2">
          {pools.map((p) => {
            const held = [p.tokenX, p.tokenY].filter((t) => heldMints.has(t.mint));
            return (
              <li key={p.address}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="w-full rounded-card border border-border px-3 py-2.5 text-left hover:border-emerald-300 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <PairLogo x={p.tokenX} y={p.tokenY} size="sm" />
                    <span className="text-sm font-medium">{p.name}</span>
                    <Badge>bin {p.binStep}</Badge>
                    {[p.tokenX, p.tokenY].some((t) => !t.verified) && <Badge tone="warning">Unverified token</Badge>}
                  </div>
                  <div className="mt-1.5 grid grid-cols-4 gap-2 text-[12px] tabular-nums">
                    <span><span className="block text-muted">TVL</span>{formatUsd(p.tvl, { compact: true })}</span>
                    <span><span className="block text-muted">24h vol</span>{formatUsd(p.volume24h, { compact: true })}</span>
                    <span><span className="block text-muted">Fee</span>{p.baseFeePct}%</span>
                    <span><span className="block text-muted">24h fee/TVL</span>{p.feeTvl24h.toFixed(2)}%</span>
                  </div>
                  {held.length > 0 && (
                    <div className="mt-1.5 text-[12px] text-emerald-700">Vault holds {held.map((t) => t.symbol).join(" / ")}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
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
