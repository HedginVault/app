"use client";

import { HoldingsSection } from "@/components/holdings/holdings-section";
import { SummaryStrip } from "@/components/holdings/summary-strip";
import type { MenuItem } from "@/components/ui/menu";
import { Stat } from "@/components/ui/stat";
import { useHoldings } from "@/hooks/queries";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatTokenAmount, rawToInput } from "@/lib/format";
import type { PanelState } from "@/lib/panel-params";
import { isOperational } from "@/lib/swap-logic";
import type { PositionView, VaultDetail } from "@/lib/types";

/** Balances and positions. Trade actions hand off to the Markets tab via `onTrade`. */
export function BalanceTab({ v, owner, onTrade }: { v: VaultDetail; owner: string; onTrade: (s: PanelState) => void }) {
  const holdings = useHoldings(v.address);
  const { send, pending } = useSendTransaction();

  const sh = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 4 })} shares`;
  const unclaimed = BigInt(v.unclaimedManagerFeeShares);

  const prefill = onTrade;

  const closeStrategy = (strategy: string, what: string) => {
    if (window.confirm(`Close the ${what} strategy? Rent returns to your wallet.`))
      void send({
        label: `Close ${what}`,
        vault: v.address,
        build: () => api.build("strategy/close", { payer: owner, vault: v.address, strategy }),
      });
  };

  const closePosition = (position: string, pair: string) => {
    if (window.confirm(`Remove all liquidity, claim fees, and close the ${pair} position? Rent returns to your wallet.`))
      void send({
        label: `Close ${pair}`,
        vault: v.address,
        build: () => api.build("dlmm/close", { payer: owner, vault: v.address, position }),
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
    </div>
  );
}
