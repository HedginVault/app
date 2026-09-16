"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatTokenAmount, parseTokenAmount } from "@/lib/format";
import type { UserPosition, VaultDetail } from "@/lib/types";
import { estimateShares, validateDeposit } from "@/lib/vault-logic";

/** Read outside the render scope: the forms validate against a snapshot of the wall clock. */
const nowSeconds = () => Date.now() / 1000;

/** A position that trips none of the amount checks, so `validateDeposit` can supply the wording. */
const PROBE: UserPosition = {
  shares: "0",
  valueAtNav: "0",
  depositTokenBalance: "0",
  depositRequest: null,
  withdrawalRequest: null,
};

export function DepositForm({ v, position, owner }: { v: VaultDetail; position: UserPosition; owner: string }) {
  const [input, setInput] = useState("");
  const { send, pending } = useSendTransaction();
  const now = nowSeconds();
  const amount = parseTokenAmount(input, v.depositDecimals);
  const error = input === "" ? null : amount === null ? "Enter a valid amount" : validateDeposit(v, amount, position, now);
  // The vault-level gates come first inside `validateDeposit`, so a zero amount returns their
  // wording verbatim; surface it before the user types anything.
  const closed =
    v.protocol.status !== "normal" || v.status !== "normal" || BigInt(v.navPerShare) === 0n
      ? validateDeposit(v, 0n, PROBE, now)
      : null;
  const shares = amount ? estimateShares(amount, BigInt(v.navPerShare)) : 0n;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!amount || error) return;
        void send({
          label: "Deposit request",
          vault: v.address,
          build: () => api.build("deposit/create", { payer: owner, vault: v.address, amount: amount.toString() }),
          onSuccess: () => setInput(""),
        });
      }}
    >
      {closed && (
        <p className="rounded-[10px] border border-amber-400/30 bg-warning-soft px-3 py-2 text-[12px] text-amber-300">{closed}</p>
      )}
      <Field label={`Amount (${v.depositSymbol})`} error={error} hint={`Wallet balance ${formatTokenAmount(position.depositTokenBalance, v.depositDecimals)} ${v.depositSymbol}`}>
        <div className="relative">
          <Input inputMode="decimal" placeholder="0.00" value={input} onChange={(e) => setInput(e.target.value)} disabled={!!closed} className="pr-16" />
          <button type="button" disabled={!!closed} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-medium text-emerald-400 hover:bg-accent-soft disabled:text-white/40 disabled:hover:bg-transparent" onClick={() => setInput(formatTokenAmount(position.depositTokenBalance, v.depositDecimals).replace(/,/g, ""))}>
            Max
          </button>
        </div>
      </Field>
      <dl className="space-y-1 text-[13px]">
        <div className="flex justify-between"><dt className="text-muted">Estimated shares</dt><dd className="tabular-nums">{formatTokenAmount(shares, v.depositDecimals, { maxFraction: 4 })}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Minted</dt><dd>At next NAV update</dd></div>
      </dl>
      <Button type="submit" className="w-full" disabled={!amount || !!error || !!closed} loading={pending}>
        Request deposit
      </Button>
    </form>
  );
}
