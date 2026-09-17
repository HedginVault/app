"use client";

import { useState } from "react";
import { HoldingsSection } from "@/components/holdings/holdings-section";
import { SummaryStrip } from "@/components/holdings/summary-strip";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import type { MenuItem } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { useHoldings } from "@/hooks/queries";
import { usePanel } from "@/hooks/use-panel";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatTokenAmount, rawToInput } from "@/lib/format";
import type { PanelState } from "@/lib/panel-params";
import { isOperational } from "@/lib/swap-logic";
import type { PositionView, VaultDetail } from "@/lib/types";
import { ActionPanel } from "./action-panel";

export function OverviewTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const holdings = useHoldings(v.address);
  const { state, replace } = usePanel();
  const [nonce, setNonce] = useState(0);
  const [sheet, setSheet] = useState(false);
  const { send, pending } = useSendTransaction();

  const sh = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 4 })} shares`;
  const unclaimed = BigInt(v.unclaimedManagerFeeShares);

  const prefill = (s: PanelState) => {
    replace(s);
    setNonce((n) => n + 1);
    setSheet(true);
  };

  const closeStrategy = (strategy: string, what: string) => {
    if (window.confirm(`Close the ${what} strategy? Rent returns to your wallet.`))
      void send({
        label: `Close ${what}`,
        vault: v.address,
        build: () => api.build("strategy/close", { payer: owner, vault: v.address, strategy }),
      });
  };

  const operational = isOperational(v);
  const actionsFor = (p: PositionView): MenuItem[] => {
    if (p.kind === "error") return [];
    if (p.kind === "idle") return [{ label: `Swap ${p.token.symbol}`, onSelect: () => prefill({ panel: "swap", from: v.depositMint }) }];
    if (p.kind === "swap")
      return [
        { label: `Buy more ${p.token.symbol}`, onSelect: () => prefill({ panel: "swap", from: v.depositMint, to: p.token.mint }) },
        {
          label: `Sell ${p.token.symbol}`,
          disabled: BigInt(p.amount) === 0n,
          reason: "Nothing to sell",
          onSelect: () => prefill({ panel: "swap", from: p.token.mint, to: v.depositMint, amount: rawToInput(p.amount, p.token.decimals) }),
        },
        {
          label: "Close strategy",
          disabled: !operational || !p.closable || pending,
          reason: !operational ? "Vault not operational" : `Sell all ${p.token.symbol} first`,
          onSelect: () => closeStrategy(p.strategy, p.token.symbol),
        },
      ];
    const pair = `${p.tokenX.symbol}-${p.tokenY.symbol}`;
    const hasFees = BigInt(p.feeX) > 0n || BigInt(p.feeY) > 0n;
    return [
      { label: "Add liquidity", onSelect: () => prefill({ panel: "lp", position: p.position, mode: "add" }) },
      { label: "Remove liquidity", onSelect: () => prefill({ panel: "lp", position: p.position, mode: "remove" }) },
      { label: "Claim fees", disabled: !hasFees, reason: "No fees yet", onSelect: () => prefill({ panel: "lp", position: p.position, mode: "claim" }) },
      {
        label: "Close position",
        disabled: !operational || !p.closable || pending,
        reason: !operational ? "Vault not operational" : "Remove 100% and claim fees first",
        onSelect: () => closeStrategy(p.strategy, pair),
      },
    ];
  };

  return (
    <div className="space-y-6">
      <SummaryStrip v={v} holdings={holdings.data}>
        <Stat
          label="Your fees"
          value={sh(v.unclaimedManagerFeeShares)}
          tone={unclaimed > 0n ? "accent" : undefined}
          sub={
            <button
              type="button"
              className="font-medium text-emerald-400 hover:underline disabled:text-muted disabled:no-underline"
              disabled={unclaimed === 0n || pending}
              onClick={() =>
                void send({
                  label: "Claim manager fee",
                  vault: v.address,
                  build: () => api.build("vault/claim-fee", { payer: owner, vault: v.address }),
                })
              }
            >
              {unclaimed === 0n ? "Nothing to claim yet" : "Claim fees →"}
            </button>
          }
        />
      </SummaryStrip>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <HoldingsSection address={v.address} actionsFor={actionsFor} />
        <div
          className={cn(
            "lg:sticky lg:top-24 lg:block lg:self-start",
            sheet
              ? "fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl lg:static lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
              : "hidden",
          )}
        >
          <div className="mb-2 flex justify-end lg:hidden">
            <Button size="sm" variant="ghost" onClick={() => setSheet(false)}>Close</Button>
          </div>
          {holdings.data ? (
            <ActionPanel v={v} owner={owner} holdings={holdings.data} state={state} replace={replace} nonce={nonce} onPrefill={prefill} />
          ) : holdings.error ? (
            <ErrorState message={`Holdings unavailable: ${holdings.error.message}`} onRetry={() => void holdings.refetch()} />
          ) : (
            <Skeleton className="h-96 rounded-card" />
          )}
        </div>
      </div>

      {!sheet && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
          <Button className="w-full shadow-lg" onClick={() => setSheet(true)}>Trade</Button>
        </div>
      )}
    </div>
  );
}
