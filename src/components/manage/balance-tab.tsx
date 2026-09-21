"use client";

import { useState } from "react";
import { HoldingsSection } from "@/components/holdings/holdings-section";
import { SummaryStrip } from "@/components/holdings/summary-strip";
import type { MenuItem } from "@/components/ui/menu";
import { ManagePosition } from "@/components/manage/manage-position";
import { SwapCard } from "@/components/manage/swap-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { useHoldings } from "@/hooks/queries";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatTokenAmount, rawToInput } from "@/lib/format";
import type { PanelState } from "@/lib/panel-params";
import { isOperational } from "@/lib/swap-logic";
import type { LpPositionView, PositionView, VaultDetail } from "@/lib/types";

/** Balances and positions. Shortcut actions open a modal here, so managing never leaves this tab. */
export function BalanceTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const holdings = useHoldings(v.address);
  const { send, pending } = useSendTransaction();

  const sh = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 4 })} shares`;
  const unclaimed = BigInt(v.unclaimedManagerFeeShares);

  // Shortcut actions run in a modal so managing a position never leaves the Balance tab.
  const [action, setAction] = useState<PanelState | null>(null);
  const prefill = setAction;
  const managed =
    action?.panel === "lp" && "position" in action
      ? (holdings.data?.positions.find((p) => p.kind === "lp" && p.position === action.position) as LpPositionView | undefined)
      : undefined;

  // Destructive closes confirm in a modal instead of window.confirm.
  const [confirming, setConfirming] = useState<{ title: string; body: string; label: string; run: () => void } | null>(null);

  const closeStrategy = (strategy: string, what: string) =>
    setConfirming({
      title: `Close ${what} strategy`,
      body: "The strategy account is closed and its rent returns to your wallet.",
      label: "Close strategy",
      run: () =>
        void send({
          label: `Close ${what}`,
          vault: v.address,
          build: () => api.build("strategy/close", { payer: owner, vault: v.address, strategy }),
        }),
    });

  const closePosition = (position: string, pair: string) =>
    setConfirming({
      title: `Close ${pair} position`,
      body: "All liquidity is removed and fees claimed, then the position is closed. Rent returns to your wallet.",
      label: "Close position",
      run: () =>
        void send({
          label: `Close ${pair}`,
          vault: v.address,
          build: () => api.build("dlmm/close", { payer: owner, vault: v.address, position }),
        }),
    });

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
      { label: "Add liquidity", primary: true, onSelect: () => prefill({ panel: "lp", position: p.position, mode: "add" }) },
      {
        label: "Remove liquidity",
        primary: true,
        onSelect: () => prefill({ panel: "lp", position: p.position, mode: "remove" }),
      },
      {
        label: "Claim fees",
        primary: true,
        disabled: !hasFees,
        reason: "No fees yet",
        onSelect: () => prefill({ panel: "lp", position: p.position, mode: "claim" }),
      },
      {
        label: "Close position",
        primary: true,
        disabled: !operational || pending,
        reason: "Vault not operational",
        onSelect: () => closePosition(p.position, pair),
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
              className="font-medium text-sky-400 hover:underline disabled:text-muted disabled:no-underline"
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

      <HoldingsSection address={v.address} actionsFor={actionsFor} />

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={action?.panel === "lp" ? "Manage position" : "Swap"}
      >
        {action && holdings.data ? (
          action.panel === "swap" ? (
            <SwapCard v={v} owner={owner} holdings={holdings.data} initial={action} onParamsChange={(p) => setAction({ panel: "swap", ...p })} />
          ) : managed ? (
            <ManagePosition
              v={v}
              owner={owner}
              holdings={holdings.data}
              position={managed}
              mode={"position" in action ? action.mode : "add"}
              onModeChange={(mode) => setAction({ panel: "lp", position: managed.position, mode })}
              onDone={() => setAction(null)}
              onSwapFor={({ to, amount }) => setAction({ panel: "swap", from: v.depositMint, to, amount })}
            />
          ) : (
            <p className="text-[13px] text-muted">That position is no longer open.</p>
          )
        ) : (
          <Skeleton className="h-64" />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming?.title ?? ""}
        confirmLabel={confirming?.label}
        pending={pending}
        onConfirm={() => confirming?.run()}
      >
        {confirming?.body}
      </ConfirmDialog>
    </div>
  );
}
