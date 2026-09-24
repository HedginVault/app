"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { isOperational } from "@/lib/swap-logic";
import type { PhoenixManagerView, VaultDetail } from "@/lib/types";
import { PhoenixMark } from "../powered-by";

function Step({ n, title, body, state, action }: { n: number; title: string; body: string; state: "done" | "current" | "todo"; action: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold",
          state === "done" ? "bg-sky-400 text-accent-foreground" : state === "current" ? "border border-sky-400 text-sky-400" : "border border-border text-muted",
        )}
      >
        {state === "done" ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className={cn("text-[14px] font-medium", state === "todo" && "text-muted")}>{title}</div>
          <p className="mt-0.5 text-[12px] text-muted">{body}</p>
        </div>
        {state === "current" && action}
      </div>
    </li>
  );
}

/** The two transactions before trading: register the vault's trader account, then have Phoenix onboard it. */
export function SetupPanel({ v, owner, m }: { v: VaultDetail; owner: string; m: PhoenixManagerView }) {
  const { send, pending } = useSendTransaction();
  const body = { payer: owner, vault: v.address };
  const blocked = !m.usdcVault
    ? `Phoenix settles in USDC; this vault's deposit token is ${v.depositSymbol}.`
    : !isOperational(v)
      ? "The vault and protocol must be operational to set up Phoenix."
      : null;
  const initialize = () => void send({ label: "Create Phoenix account", vault: v.address, build: () => api.build("phoenix/initialize", body) });
  const onboard = () =>
    void send({
      label: "Activate Phoenix account",
      vault: v.address,
      build: () => api.build("phoenix/onboard", body),
      // Phoenix's onboarder co-signs and sends this one, so it bypasses the app relay.
      submit: (transaction) => api.build<{ signature: string }>("phoenix/onboard/submit", { ...body, transaction }),
    });

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-3">
            <PhoenixMark className="text-[14px]" />
          </div>
          <h3 className="text-[15px] font-semibold">Enable perps trading</h3>
          <p className="mt-1 text-[12px] text-muted">The vault trades from its own Phoenix cross-margin account. Two quick transactions, once per vault.</p>
        </div>
        {blocked && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-amber-300">{blocked}</p>}
        <ol className="space-y-4">
          <Step
            n={1}
            title="Create account"
            body="Registers the vault's Phoenix trader account and records it as a strategy. You pay the account rent."
            state={m.status === "none" ? "current" : "done"}
            action={
              <Button size="sm" onClick={initialize} loading={pending} disabled={!!blocked}>
                Create account
              </Button>
            }
          />
          <Step
            n={2}
            title="Activate trading"
            body="Phoenix enables deposits and orders for the account. You sign as fee payer only; Phoenix co-signs and submits."
            state={m.status === "ready" ? "done" : m.status === "registered" ? "current" : "todo"}
            action={
              <Button size="sm" onClick={onboard} loading={pending} disabled={!m.usdcVault}>
                Activate
              </Button>
            }
          />
          <Step n={3} title="Add collateral" body="Move some of the vault's idle USDC into the account, then place orders." state="todo" action={null} />
        </ol>
      </div>
    </Card>
  );
}
