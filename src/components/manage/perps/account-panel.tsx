"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TokenLogo } from "@/components/token/token-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatUsd, parseTokenAmount, rawToInput } from "@/lib/format";
import { formatLeverage, perpTotals, USDC_DECIMALS, usdc } from "@/lib/perps";
import { isOperational } from "@/lib/swap-logic";
import type { PerpPositionView, PhoenixManagerView, VaultDetail } from "@/lib/types";
import { PhoenixIcon } from "../powered-by";

/** Which way vault USDC moves: into the Phoenix account as collateral, or back to the vault's idle balance. */
export type TransferDirection = "toPhoenix" | "toVault";

/** Asks the account panel to open its transfer section in a direction and focus the amount, e.g. from the ticket. */
export interface TransferRequest {
  direction: TransferDirection;
  seq: number;
}

function Line({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]" title={hint}>
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

/** One side of a transfer: where the USDC sits and how much of it can move. */
function Endpoint({ role, icon, name, balance, caption }: { role: string; icon: ReactNode; name: string; balance: string; caption: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted">{role}</div>
        <div className="truncate text-[13px] font-medium">{name}</div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-medium tabular-nums">{balance}</div>
        <div className="text-[11px] text-muted">{caption}</div>
      </div>
    </div>
  );
}

/**
 * Moves the vault's own USDC between its idle balance and its Phoenix account. Nothing leaves the vault:
 * collateral in Phoenix still counts toward NAV.
 */
function CollateralTransfer({
  v,
  owner,
  m,
  request,
}: {
  v: VaultDetail;
  owner: string;
  m: PhoenixManagerView;
  request: TransferRequest | null;
}) {
  const { send, pending } = useSendTransaction();
  const [direction, setDirection] = useState<TransferDirection>("toPhoenix");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // A request from the ticket ("Insufficient margin → add funds") switches direction and focuses the amount.
  const [seenSeq, setSeenSeq] = useState(request?.seq ?? 0);
  if (request && request.seq !== seenSeq) {
    setSeenSeq(request.seq);
    setDirection(request.direction);
    setInput("");
  }
  useEffect(() => {
    if (!request) return;
    inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    inputRef.current?.focus({ preventScroll: true });
  }, [request]);

  const toPhoenix = direction === "toPhoenix";
  const idle = v.idleBalance;
  const withdrawable = m.withdrawable;
  const available = toPhoenix ? idle : withdrawable;
  const amount = parseTokenAmount(input, USDC_DECIMALS);
  // Adding collateral needs an operational vault; returning it stays open in reduce-only so the manager can unwind.
  const allowed = toPhoenix ? isOperational(v) : v.status !== "paused" && v.protocol.status !== "paused";
  const error =
    input && amount === null
      ? "Invalid amount"
      : amount !== null && available !== null && amount > BigInt(available)
        ? toPhoenix
          ? "More than the vault's idle USDC"
          : "More than the account can release"
        : null;

  const vaultSide = (
    <Endpoint
      role={toPhoenix ? "From" : "To"}
      icon={<TokenLogo token={{ symbol: "USDC", logo: v.depositLogo }} size="sm" />}
      name="Vault idle balance"
      balance={formatUsd(usdc(idle))}
      caption="idle USDC"
    />
  );
  const phoenixSide = (
    <Endpoint
      role={toPhoenix ? "To" : "From"}
      icon={<PhoenixIcon />}
      name="Phoenix account"
      balance={withdrawable === null ? "—" : formatUsd(usdc(withdrawable))}
      caption="withdrawable"
    />
  );

  const submit = () => {
    if (!amount) return;
    void send({
      label: toPhoenix ? "Add collateral to Phoenix" : "Return collateral to vault",
      vault: v.address,
      build: () => api.build(`phoenix/${toPhoenix ? "deposit" : "withdraw"}`, { payer: owner, vault: v.address, amount: amount.toString() }),
      onSuccess: () => setInput(""),
    });
  };

  return (
    <section aria-labelledby="perp-transfer-title" className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h4 id="perp-transfer-title" className="text-[13px] font-semibold">
          Collateral
        </h4>
        <div role="radiogroup" aria-label="Transfer direction" className="flex gap-0.5 rounded-lg bg-white/[0.05] p-0.5">
          {(["toPhoenix", "toVault"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => {
                setDirection(d);
                setInput("");
              }}
              className={cn("h-8 rounded-md px-2.5 text-[12px] font-medium", direction === d ? "bg-white/10 text-white" : "text-muted hover:text-foreground")}
            >
              {d === "toPhoenix" ? "Add" : "Remove"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative space-y-1.5">
        {toPhoenix ? vaultSide : phoenixSide}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-[13px] text-muted"
        >
          ↓
        </span>
        {toPhoenix ? phoenixSide : vaultSide}
      </div>

      <div>
        <label htmlFor="perp-transfer-amount" className="sr-only">
          Amount in USDC
        </label>
        <div className={cn("flex h-11 items-center gap-2 rounded-xl border bg-white/[0.03] pl-3 pr-1 focus-within:border-accent", error ? "border-red-400/40" : "border-border")}>
          <input
            ref={inputRef}
            id="perp-transfer-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setInput(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tabular-nums outline-none placeholder:text-white/30"
          />
          <span className="text-[12px] text-muted">USDC</span>
          <button
            type="button"
            disabled={available === null}
            onClick={() => available !== null && setInput(rawToInput(available, USDC_DECIMALS))}
            className="h-9 rounded-md px-2.5 text-[12px] font-medium text-sky-400 hover:bg-accent-soft disabled:text-white/30"
          >
            Max
          </button>
        </div>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>

      <Button className="w-full" onClick={submit} loading={pending} disabled={!amount || !!error || !allowed}>
        {!allowed
          ? "Vault not operational"
          : amount
            ? toPhoenix
              ? `Move ${formatUsd(usdc(amount))} into Phoenix`
              : `Move ${formatUsd(usdc(amount))} back to vault`
            : toPhoenix
              ? "Add collateral"
              : "Remove collateral"}
      </Button>
      <p className="text-[11px] text-muted">
        {toPhoenix
          ? "The vault's own USDC backs its perp positions and still counts toward NAV."
          : "Phoenix may queue a large withdrawal; queued USDC arrives later and is unwrapped here."}
      </p>
    </section>
  );
}

/** Margin account summary with collateral moves between the vault and the account. */
export function AccountPanel({
  v,
  owner,
  m,
  account,
  transfer,
}: {
  v: VaultDetail;
  owner: string;
  m: PhoenixManagerView;
  account: PerpPositionView | undefined;
  transfer: TransferRequest | null;
}) {
  const { send, pending } = useSendTransaction();
  const a = m.account;
  const equity = a ? usdc(a.equity) : account ? usdc(account.equity) : null;
  const initial = a ? usdc(a.initialMargin) : null;
  const maintenance = a ? usdc(a.maintenanceMargin) : null;
  const available = equity !== null && initial !== null ? Math.max(0, equity - initial) : null;
  const ratio = equity && maintenance !== null ? maintenance / equity : null;
  const notional = account ? usdc(perpTotals(account).notional) : 0;
  const canonical = BigInt(account?.canonicalBalance ?? "0");
  const sweep = () =>
    void send({ label: "Unwrap withdrawn USDC", vault: v.address, build: () => api.build("phoenix/sweep", { payer: owner, vault: v.address }) });

  return (
    <Card>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">Phoenix account</h3>
          {a && (
            <span className={cn("rounded px-1.5 py-0.5 text-[11px] capitalize", a.riskState === "healthy" ? "bg-accent-soft text-sky-400" : "bg-danger-soft text-red-300")}>
              {a.riskState}
            </span>
          )}
        </div>
        <Line label="Equity" hint="Collateral plus unrealized PnL and unsettled funding.">{equity === null ? "—" : formatUsd(equity)}</Line>
        <Line label="Available to trade" hint="Equity minus the initial margin of open positions and orders.">
          {available === null ? "—" : formatUsd(available)}
        </Line>
        <Line label="Margin used">{initial === null ? "—" : formatUsd(initial)}</Line>
        <Line label="Account leverage">{equity ? formatLeverage(notional / equity) : "—"}</Line>
        <div>
          <Line label="Margin ratio" hint="Maintenance margin / equity. The account is liquidated at 100%.">
            <span className={ratio !== null && ratio > 0.5 ? "text-amber-300" : undefined}>{ratio === null ? "—" : `${(ratio * 100).toFixed(1)}%`}</span>
          </Line>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
            <div
              className={cn("h-full rounded-full", ratio !== null && ratio > 0.5 ? "bg-amber-300" : "bg-sky-400")}
              style={{ width: `${Math.min(100, (ratio ?? 0) * 100)}%` }}
            />
          </div>
        </div>
        {canonical > 0n && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-warning-soft px-3 py-2 text-[12px]">
            <span className="text-amber-300">{formatUsd(usdc(canonical))} returned from Phoenix, awaiting unwrap.</span>
            <Button size="sm" variant="secondary" onClick={sweep} loading={pending}>
              Unwrap
            </Button>
          </div>
        )}
        <CollateralTransfer v={v} owner={owner} m={m} request={transfer} />
      </div>
    </Card>
  );
}
