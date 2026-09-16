"use client";

import { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenLogo } from "@/components/token/token-logo";
import { TokenScore, VerifiedMark } from "@/components/token/token-trust";
import { useTokenSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { formatTokenAmount, formatUsd, shortAddress } from "@/lib/format";
import type { TokenInfo, TokenSearchResult } from "@/lib/types";

const isPublicKey = (s: string) => {
  if (!s) return false;
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
};

/**
 * Common targets shown before the user types (SOL, JUP, WBTC, USDT), filtered against `exclude`.
 * Jupiter search accepts a comma-separated list of mints, not of symbols.
 */
const DEFAULT_QUERY = [
  "So11111111111111111111111111111111111111112",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
].join(",");

function Row({ token, balance, onPick }: { token: TokenInfo & Partial<TokenSearchResult>; balance?: string; onPick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPick} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-white/[0.03]">
        <TokenLogo token={token} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {token.symbol}
            {token.verified && <VerifiedMark />}
            {token.organicScore != null && <TokenScore score={token.organicScore} label={token.organicScoreLabel ?? null} />}
          </span>
          <span className="block truncate text-[12px] text-muted">
            {token.name ?? token.symbol} · {shortAddress(token.mint)}
          </span>
        </span>
        <span className="text-right text-[12px] tabular-nums text-muted">
          {balance !== undefined ? `${formatTokenAmount(balance, token.decimals, { maxFraction: 4 })} held` : token.liquidityUsd != null ? `${formatUsd(token.liquidityUsd, { compact: true })} liq.` : ""}
        </span>
      </button>
    </li>
  );
}

export function TokenSelect({
  open,
  onClose,
  onSelect,
  held,
  exclude,
  balances,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  held: TokenInfo[];
  exclude: string[];
  balances: Map<string, string>;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const search = useTokenSearch(debounced.trim() || DEFAULT_QUERY);
  const blocked = new Set(exclude);
  const heldMints = new Set(held.map((t) => t.mint));
  const q = query.trim().toLowerCase();
  const heldShown = held.filter(
    (t) => !blocked.has(t.mint) && (!q || t.symbol.toLowerCase().includes(q) || t.mint.toLowerCase() === q),
  );
  const results = (search.data ?? []).filter((t) => !blocked.has(t.mint) && !heldMints.has(t.mint));
  // A pasted mint is offered only when search returned its metadata (decimals, symbol); the
  // client never guesses a token's shape.
  const trimmed = query.trim();
  const pasted =
    isPublicKey(trimmed) && !blocked.has(trimmed) && !results.some((t) => t.mint === trimmed) && !heldShown.some((t) => t.mint === trimmed)
      ? (search.data?.find((t) => t.mint === trimmed) ?? null)
      : null;
  const pick = (t: TokenInfo) => {
    onSelect(t);
    setQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Select a token">
      <Input autoFocus placeholder="Search name, symbol or paste a mint" value={query} onChange={(e) => setQuery(e.target.value)} />
      {heldShown.length > 0 && (
        <section className="mt-4">
          <h3 className="px-2 text-[12px] font-medium uppercase tracking-wide text-muted">In vault</h3>
          <ul className="mt-1">
            {heldShown.map((t) => (
              <Row key={t.mint} token={t} balance={balances.get(t.mint)} onPick={() => pick(t)} />
            ))}
          </ul>
        </section>
      )}
      <section className="mt-4">
        <h3 className="px-2 text-[12px] font-medium uppercase tracking-wide text-muted">{q ? "Results" : "Popular"}</h3>
        {pasted && (
          <button
            type="button"
            onClick={() => pick(pasted)}
            className="mt-1 w-full rounded-[10px] px-2 py-2 text-left text-sm font-medium hover:bg-white/[0.03]"
          >
            Use token {shortAddress(pasted.mint)}
          </button>
        )}
        {search.isLoading ? (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : search.error ? (
          <p className="px-2 py-3 text-[13px] text-muted">Token search unavailable. Try again shortly.</p>
        ) : results.length === 0 ? (
          <p className="px-2 py-3 text-[13px] text-muted">No tokens found.</p>
        ) : (
          <ul className="mt-1">
            {results.map((t) => (
              <Row key={t.mint} token={t} onPick={() => pick(t)} />
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  );
}
