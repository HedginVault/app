"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatBps, formatTokenAmount, parseTokenAmount } from "@/lib/format";
import type { UserPosition, VaultDetail } from "@/lib/types";
import { estimatePayout, validateWithdrawal } from "@/lib/vault-logic";

/** Read outside the render scope: the forms validate against a snapshot of the wall clock. */
const nowSeconds = () => Date.now() / 1000;

/** A position that trips none of the amount checks, so `validateWithdrawal` supplies the wording. */
const PROBE: UserPosition = {
  shares: "0",
  valueAtNav: "0",
  depositTokenBalance: "0",
  depositRequest: null,
  withdrawalRequest: null,
};

export function WithdrawForm({ v, position, owner }: { v: VaultDetail; position: UserPosition; owner: string }) {
  const [input, setInput] = useState("");
  const { send, pending } = useSendTransaction();
  const now = nowSeconds();
  const shares = parseTokenAmount(input, v.depositDecimals);
  const error = input === "" ? null : shares === null ? "Enter a valid amount" : validateWithdrawal(v, shares, position, now);
  // Only a pause closes withdrawals; the paused checks come first inside `validateWithdrawal`, so
  // a zero amount returns their wording verbatim.
  const closed =
    v.protocol.status === "paused" || v.status === "paused"
      ? validateWithdrawal(v, 0n, PROBE, now)
      : null;
  const payout = shares ? estimatePayout(shares, BigInt(v.navPerShare)) : 0n;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!shares || error) return;
        void send({
          label: "Withdrawal request",
          vault: v.address,
          build: () => api.build("withdrawal/create", { payer: owner, vault: v.address, shares: shares.toString() }),
          onSuccess: () => setInput(""),
        });
      }}
    >
      {closed && (
        <p className="rounded-[10px] border border-amber-200 bg-warning-soft px-3 py-2 text-[12px] text-amber-700">{closed}</p>
      )}
      <Field label="Shares" error={error} hint={`Share balance ${formatTokenAmount(position.shares, v.depositDecimals)}`}>
        <div className="relative">
          <Input inputMode="decimal" placeholder="0.00" value={input} onChange={(e) => setInput(e.target.value)} disabled={!!closed} className="pr-16" />
          <button type="button" disabled={!!closed} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-medium text-emerald-700 hover:bg-accent-soft disabled:text-slate-400 disabled:hover:bg-transparent" onClick={() => setInput(formatTokenAmount(position.shares, v.depositDecimals).replace(/,/g, ""))}>
            Max
          </button>
        </div>
      </Field>
      <dl className="space-y-1 text-[13px]">
        <div className="flex justify-between"><dt className="text-muted">Estimated payout</dt><dd className="tabular-nums">{formatTokenAmount(payout, v.depositDecimals, { maxFraction: 2 })} {v.depositSymbol}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Paid</dt><dd>At next NAV, capped at {formatBps(v.protocol.maxEpochOutflowBps)} of assets per epoch</dd></div>
      </dl>
      <Button type="submit" className="w-full" disabled={!shares || !!error || !!closed} loading={pending}>
        Request withdrawal
      </Button>
    </form>
  );
}
