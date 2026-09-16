"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { FEE_INCREASE_DELAY } from "@/lib/constants";
import { formatBps, formatDate, formatTokenAmount, parseTokenAmount } from "@/lib/format";
import type { Status, VaultDetail } from "@/lib/types";
import { feeSchedule } from "@/lib/vault-logic";

/** Read outside the render scope: the fee schedule is a snapshot of the wall clock at paint. */
const nowSeconds = () => Date.now() / 1000;

const pctOf = (bps: number) => (bps / 100).toString();

/** Percent string -> integer bps, or null when it is not a percentage in [0, 100]. */
const toBps = (s: string) => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
};

/** Raw amount -> a plain edit string (no group separators, which `parseTokenAmount` rejects). */
const amountInput = (raw: string, decimals: number) =>
  formatTokenAmount(raw, decimals).replace(/,/g, "");

export function SettingsTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const { send, pending } = useSendTransaction();
  const initial = {
    perf: pctOf(v.performanceFeeBps),
    mgmt: pctOf(v.managementFeeBps),
    cap: amountInput(v.depositCap, v.depositDecimals),
    minDeposit: amountInput(v.minDeposit, v.depositDecimals),
    minWithdraw: amountInput(v.minWithdrawalShares, v.depositDecimals),
    status: v.status as Status,
  };
  const signature = [
    v.performanceFeeBps,
    v.managementFeeBps,
    v.depositCap,
    v.minDeposit,
    v.minWithdrawalShares,
    v.status,
  ].join(":");
  // The vault refetches every 20s and after every send. An untouched form follows those chain values
  // (React's "adjust state when props change" pattern) — otherwise `changes` would diff mount-time
  // strings against fresh ones and a Save would re-submit settings the manager never typed. A touched
  // form keeps the edits until Reset or a confirmed save.
  const [state, setState] = useState({ signature, form: initial, touched: false });
  const stale = state.signature !== signature && !state.touched;
  if (stale) setState({ signature, form: initial, touched: false });
  const form = stale ? initial : state.form;

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setState({ signature, form: { ...form, [k]: e.target.value }, touched: true });
  const reset = () => setState({ signature, form: initial, touched: false });

  const perf = toBps(form.perf);
  const mgmt = toBps(form.mgmt);
  const cap = parseTokenAmount(form.cap, v.depositDecimals);
  const minDeposit = parseTokenAmount(form.minDeposit, v.depositDecimals);
  const minWithdraw = parseTokenAmount(form.minWithdraw, v.depositDecimals);
  // `vault_update` rejects a zero minimum with `InvalidMinimumAmount`, so 0 is a client-side error.
  const minDepositError =
    minDeposit === null ? "Enter an amount" : minDeposit === 0n ? "Must be greater than 0" : null;
  const minWithdrawError =
    minWithdraw === null ? "Enter an amount" : minWithdraw === 0n ? "Must be greater than 0" : null;
  const invalid =
    perf === null ||
    mgmt === null ||
    cap === null ||
    minDepositError !== null ||
    minWithdrawError !== null;

  // Only changed fields are sent; untouched fields stay null on-chain.
  const changes: Record<string, unknown> = {};
  if (perf !== null && perf !== v.performanceFeeBps) changes.performanceFeeBps = perf;
  if (mgmt !== null && mgmt !== v.managementFeeBps) changes.managementFeeBps = mgmt;
  if (cap !== null && cap.toString() !== v.depositCap) changes.depositCap = cap.toString();
  if (minDeposit !== null && minDeposit.toString() !== v.minDeposit)
    changes.minDeposit = minDeposit.toString();
  if (minWithdraw !== null && minWithdraw.toString() !== v.minWithdrawalShares)
    changes.minWithdrawalShares = minWithdraw.toString();
  if (form.status !== v.status) changes.status = form.status;
  const dirty = Object.keys(changes).length > 0;
  const feeIncrease =
    (perf !== null && perf > v.performanceFeeBps) || (mgmt !== null && mgmt > v.managementFeeBps);
  const now = nowSeconds();
  const scheduled = feeSchedule(v, now);

  return (
    <Card>
      <CardHeader
        title="Vault settings"
        description="Fee decreases apply immediately. Fee increases take effect after a 7-day delay so depositors can exit first."
      />
      <CardBody>
        {scheduled && !scheduled.applied && (
          <p className="mb-4 rounded-[10px] bg-warning-soft px-4 py-3 text-[13px] text-amber-200">
            A fee change to {formatBps(scheduled.performanceFeeBps)} performance /{" "}
            {formatBps(scheduled.managementFeeBps)} management is scheduled for{" "}
            {formatDate(scheduled.effectiveTs)}. Submitting new fees replaces it.
          </p>
        )}
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid || !dirty) return;
            void send({
              label: "Update vault",
              vault: v.address,
              build: () =>
                api.build("vault/update", { payer: owner, vault: v.address, ...changes }),
              // The refetched vault becomes the new baseline, so the form follows it again.
              // Clearing `touched` lets the refetched vault become the new baseline again.
              onSuccess: () => setState((prev) => ({ ...prev, touched: false })),
            });
          }}
        >
          <Field label="Performance fee (%)" error={perf === null ? "0–100%" : null}>
            <Input inputMode="decimal" value={form.perf} onChange={set("perf")} />
          </Field>
          <Field label="Management fee (% / year)" error={mgmt === null ? "0–100%" : null}>
            <Input inputMode="decimal" value={form.mgmt} onChange={set("mgmt")} />
          </Field>
          <Field
            label={`Deposit cap (${v.depositSymbol})`}
            error={cap === null ? "Enter an amount" : null}
          >
            <Input inputMode="decimal" value={form.cap} onChange={set("cap")} />
          </Field>
          <Field
            label={`Minimum deposit (${v.depositSymbol})`}
            error={minDepositError}
          >
            <Input inputMode="decimal" value={form.minDeposit} onChange={set("minDeposit")} />
          </Field>
          <Field
            label="Minimum withdrawal (shares)"
            error={minWithdrawError}
          >
            <Input inputMode="decimal" value={form.minWithdraw} onChange={set("minWithdraw")} />
          </Field>
          <Field
            label="Status"
            hint="Paused blocks deposits and withdrawals. Reduce-only blocks deposits."
          >
            <select
              className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              value={form.status}
              onChange={set("status")}
            >
              <option value="normal">Normal</option>
              <option value="reduceOnly">Reduce only</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={invalid || !dirty} loading={pending}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={reset}
              disabled={!dirty && !invalid}
            >
              Reset
            </Button>
            {feeIncrease && (
              <span className="text-[13px] text-amber-300">
                Fee increase: effective{" "}
                {formatDate(Math.floor(now) + FEE_INCREASE_DELAY)}
              </span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
