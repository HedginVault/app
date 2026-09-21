"use client";

import { useState } from "react";
import { TokenLogo } from "@/components/token/token-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings } from "@/hooks/queries";
import { useSwapForm } from "@/hooks/use-swap-form";
import { formatPrice, formatTokenAmount, usdValue } from "@/lib/format";
import { minReceived } from "@/lib/swap-logic";
import type { TokenInfo, VaultDetail } from "@/lib/types";
import { PoweredBy } from "./powered-by";
import { ReviewDialog } from "./review-dialog";
import { TokenSelect } from "./token-select";

/** A vault-swap shortcut that floats over every manage tab, not just Markets. */
export function QuickSwap({ v, owner }: { v: VaultDetail; owner: string }) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<{ from?: string; to?: string; amount?: string }>({});
  const holdings = useHoldings(v.address);

  return (
    <div className="fixed bottom-4 left-4 z-40 w-80">
      {open && (
        <div className="mb-2 overflow-hidden rounded-2xl border border-border bg-[#0d121b] shadow-2xl">
          {holdings.data ? (
            <QuickSwapForm v={v} owner={owner} holdings={holdings.data} initial={params} onParamsChange={setParams} />
          ) : (
            <div className="p-3">
              <Skeleton className="h-64" />
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-full border border-border bg-[#0d121b] text-lg shadow-lg hover:bg-white/[0.06]"
        aria-label={open ? "Collapse quick swap" : "Open quick swap"}
      >
        {open ? "⌄" : "⇄"}
      </button>
    </div>
  );
}

function QuickSwapForm({
  v,
  owner,
  holdings,
  initial,
  onParamsChange,
}: {
  v: VaultDetail;
  owner: string;
  holdings: NonNullable<ReturnType<typeof useHoldings>["data"]>;
  initial: { from?: string; to?: string; amount?: string };
  onParamsChange: (p: { from?: string; to?: string; amount?: string }) => void;
}) {
  const {
    deposit,
    heldTokens,
    balances,
    buy,
    toggleDirection,
    target,
    setTarget,
    picking,
    setPicking,
    input,
    setInput,
    slippageBps,
    reviewing,
    setReviewing,
    progress,
    pending,
    from,
    to,
    amount,
    balance,
    quote,
    refetch,
    button,
    out,
    impact,
    severity,
    rate,
    needsStrategy,
    confirm,
  } = useSwapForm({ v, owner, holdings, initial, onParamsChange });

  const tokenPill = (token: TokenInfo | null, selectable: boolean) => (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => selectable && setPicking(true)}
      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-3 text-sm font-semibold hover:bg-white/[0.12] disabled:hover:bg-white/[0.08]"
    >
      {token ? <TokenLogo token={token} size="sm" /> : <span className="size-5 rounded-full bg-white/10" />}
      {token?.symbol ?? "Select"}
      {selectable && <span className="text-muted">▾</span>}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">Swap</span>
        <button
          type="button"
          onClick={() => void refetch()}
          aria-label="Refresh quote"
          className="rounded-full p-1.5 text-muted hover:bg-white/[0.08]"
        >
          ↻
        </button>
      </div>

      <div className="space-y-1 px-3 pb-3">
        <div className="rounded-xl bg-white/[0.05] px-3 py-3">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>Selling</span>
            {from && balance != null && (
              <span className="tabular-nums">{formatTokenAmount(balance, from.decimals, { maxFraction: 4 })} {from.symbol}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            {tokenPill(from, !buy)}
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={input}
              aria-label="Selling amount"
              onChange={(e) => setInput(e.target.value.replace(/,/g, "."))}
              className="min-w-0 flex-1 bg-transparent text-right text-2xl font-semibold tabular-nums tracking-tight outline-none placeholder:text-white/30"
            />
          </div>
          <div className="mt-1 text-right text-[12px] tabular-nums text-muted">
            {from && amount !== null ? `$${usdValue(amount, from.decimals, from.priceUsd)?.toFixed(2) ?? "0"}` : "$0"}
          </div>
        </div>

        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            aria-label="Switch direction"
            onClick={toggleDirection}
            className="rounded-full border border-border bg-[#0d121b] p-1.5 text-muted hover:text-foreground"
          >
            ⇅
          </button>
        </div>

        <div className="rounded-xl bg-white/[0.05] px-3 py-3">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>Buying</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            {tokenPill(to, buy)}
            <span className="min-w-0 flex-1 truncate text-right text-2xl font-semibold tabular-nums tracking-tight">
              {out !== null && to ? formatTokenAmount(out, to.decimals, { maxFraction: 6 }).replace(/,/g, "") : "0.00"}
            </span>
          </div>
          <div className="mt-1 text-right text-[12px] tabular-nums text-muted">
            {out !== null && to ? `$${usdValue(out, to.decimals, to.priceUsd)?.toFixed(2) ?? "0"}` : "$0"}
          </div>
        </div>

        {quote.data && from && to && (
          <dl className="space-y-1 px-1 pt-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted">Rate</dt>
              <dd className="tabular-nums">1 {from.symbol} = {formatPrice(rate)} {to.symbol}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Price impact</dt>
              <dd className={severity === "high" ? "text-red-300" : severity === "warn" ? "text-amber-300" : "tabular-nums"}>{impact.toFixed(2)}%</dd>
            </div>
          </dl>
        )}

        <Button
          className="mt-2 h-12 w-full rounded-2xl bg-lime-300 text-[15px] text-[#14210a] hover:bg-lime-200 disabled:bg-lime-300/30 disabled:text-[#14210a]/40"
          disabled={button.disabled}
          onClick={() => {
            void refetch();
            setReviewing(true);
          }}
        >
          {button.label}
        </Button>
      </div>

      <PoweredBy protocol="jupiter" />

      <TokenSelect
        open={picking}
        onClose={() => setPicking(false)}
        held={heldTokens}
        exclude={[deposit.mint, v.shareMint]}
        balances={balances}
        onSelect={setTarget}
      />

      {from && to && amount && out !== null && (
        <ReviewDialog
          open={reviewing}
          onClose={() => setReviewing(false)}
          title="Review swap"
          confirmLabel="Confirm swap"
          onConfirm={confirm}
          pending={pending}
          progress={progress}
          steps={needsStrategy ? [{ label: `Set up ${to === deposit ? from.symbol : to.symbol} strategy` }, { label: "Swap" }] : []}
          rows={[
            { label: "You pay", value: `${formatTokenAmount(amount, from.decimals, { maxFraction: 6 })} ${from.symbol}` },
            { label: "You receive (est.)", value: `${formatTokenAmount(out, to.decimals, { maxFraction: 6 })} ${to.symbol}` },
            { label: "Minimum received", value: `${formatTokenAmount(minReceived(out, slippageBps), to.decimals, { maxFraction: 6 })} ${to.symbol}` },
            { label: "Price impact", value: `${impact.toFixed(2)}%`, tone: severity === "high" ? "danger" : severity === "warn" ? "warn" : undefined },
          ]}
          notes={[
            ...(needsStrategy
              ? [`First swap into ${target!.symbol} also sets up its Jupiter strategy (one-time account rent). It may need two signatures.`]
              : []),
            "The quote is refreshed when the transaction is built; the program rejects fills below the protocol slippage limit.",
          ]}
        />
      )}
    </div>
  );
}
