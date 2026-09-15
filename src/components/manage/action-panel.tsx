"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import type { PanelState } from "@/lib/panel-params";
import { isOperational } from "@/lib/swap-logic";
import type { HoldingsView, LpPositionView, VaultDetail } from "@/lib/types";
import { LiquidityCard } from "./liquidity-card";
import { ManagePosition } from "./manage-position";
import { SwapCard } from "./swap-card";

export function ActionPanel({
  v,
  owner,
  holdings,
  state,
  replace,
  nonce,
  onPrefill,
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  state: PanelState;
  replace: (s: PanelState) => void;
  nonce: number;
  /** Replace the state and remount the card (used by shortcuts inside the panel). */
  onPrefill: (s: PanelState) => void;
}) {
  const swapFor = ({ to, amount }: { to: string; amount?: string }) =>
    onPrefill({ panel: "swap", from: v.depositMint, to, amount });
  const managed =
    state.panel === "lp" && "position" in state
      ? (holdings.positions.find((p) => p.kind === "lp" && p.position === state.position) as LpPositionView | undefined)
      : undefined;

  return (
    <Card>
      <CardBody className="space-y-4">
        <Tabs
          tabs={[
            { id: "swap", label: "Swap" },
            { id: "lp", label: "Liquidity" },
          ]}
          value={state.panel}
          onChange={(id) => onPrefill(id === "swap" ? { panel: "swap" } : { panel: "lp" })}
        />
        {!isOperational(v) && (
          <p className="rounded-[10px] border border-amber-200 bg-warning-soft px-3 py-2 text-[12px] text-amber-800">
            {v.protocol.status !== "normal" ? `Protocol is ${v.protocol.status}` : `Vault is ${v.status}`}: strategy actions are disabled.
          </p>
        )}
        {state.panel === "swap" ? (
          <SwapCard
            key={`swap-${nonce}`}
            v={v}
            owner={owner}
            holdings={holdings}
            initial={state}
            onParamsChange={(p) => replace({ panel: "swap", ...p })}
          />
        ) : "position" in state ? (
          managed ? (
            <ManagePosition
              key={`manage-${nonce}`}
              v={v}
              owner={owner}
              holdings={holdings}
              position={managed}
              mode={state.mode}
              onModeChange={(mode) => replace({ panel: "lp", position: state.position, mode })}
              onDone={() => undefined}
              onSwapFor={swapFor}
            />
          ) : (
            <div className="space-y-2 text-[13px] text-muted">
              <p>That position is no longer open.</p>
              <Button size="sm" variant="secondary" onClick={() => onPrefill({ panel: "lp" })}>Open a new position</Button>
            </div>
          )
        ) : (
          <LiquidityCard
            key={`lp-${nonce}`}
            v={v}
            owner={owner}
            holdings={holdings}
            pool={state.pool}
            onPoolChange={(pool) => replace(pool ? { panel: "lp", pool } : { panel: "lp" })}
            onSwapFor={swapFor}
            onOpenedPartially={(position) => {
              toast("Position created; add liquidity to finish");
              onPrefill({ panel: "lp", position, mode: "add" });
            }}
          />
        )}
      </CardBody>
    </Card>
  );
}
