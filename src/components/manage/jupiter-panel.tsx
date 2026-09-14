"use client";

import { useState, type ChangeEvent } from "react";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useQuote } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatBps, formatTokenAmount, parseTokenAmount } from "@/lib/format";
import type { JupiterStrategyView, VaultDetail } from "@/lib/types";

const selectClass =
  "h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

/**
 * Jupiter reports `priceImpactPct` as a decimal FRACTION, not percent units: a 1,000,000 USDC → SOL
 * quote returns "0.00060887…" for an impact of ~0.061%. Scale by 100 before rendering.
 */
const formatImpact = (pct: string) => `${(Number(pct) * 100).toFixed(3)}%`;

/** Raw amount -> a plain edit string (no group separators, which `parseTokenAmount` rejects). */
const toEditString = (raw: string, decimals: number) =>
  formatTokenAmount(raw, decimals).replace(/,/g, "");

export function JupiterPanel({
  v,
  owner,
  strategies,
}: {
  v: VaultDetail;
  owner: string;
  strategies: JupiterStrategyView[];
}) {
  const { send, pending } = useSendTransaction();
  const [newMint, setNewMint] = useState("");
  const [selected, setSelected] = useState<string>(strategies[0]?.targetMint ?? "");
  const [back, setBack] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [slippage, setSlippage] = useState("50");

  // Derived, not synced: the first strategy stands in until the manager picks one, and a stale pick
  // (the selected strategy was just closed) falls back instead of hiding the form.
  const effective = strategies.some((s) => s.targetMint === selected)
    ? selected
    : (strategies[0]?.targetMint ?? "");
  const strategy = strategies.find((s) => s.targetMint === effective);
  // The deposit token is always one leg: "in" spends idle deposit tokens, "back" spends the target.
  const source = strategy
    ? back
      ? {
          mint: strategy.targetMint,
          symbol: strategy.symbol,
          decimals: strategy.decimals,
          balance: strategy.vaultBalance,
        }
      : {
          mint: v.depositMint,
          symbol: v.depositSymbol,
          decimals: v.depositDecimals,
          balance: v.idleBalance,
        }
    : null;
  const dest = strategy
    ? back
      ? { mint: v.depositMint, symbol: v.depositSymbol, decimals: v.depositDecimals }
      : { mint: strategy.targetMint, symbol: strategy.symbol, decimals: strategy.decimals }
    : null;
  const amount = source ? parseTokenAmount(amountInput, source.decimals) : null;
  const slippageBps = Math.min(Math.max(Number(slippage) || 0, 1), v.protocol.maxSlippageBps);
  const amountError =
    amount === null && amountInput !== ""
      ? "Enter a valid amount"
      : amount && source && amount > BigInt(source.balance)
        ? "Exceeds vault balance"
        : null;
  const debounced = useDebounce(amount?.toString() ?? "", 400);
  const quote = useQuote(
    {
      vault: v.address,
      inputMint: source?.mint ?? "",
      outputMint: dest?.mint ?? "",
      amount: debounced,
      slippageBps,
    },
    !!source && !!dest && debounced !== "" && debounced !== "0" && !amountError,
  );

  return (
    <Card>
      <CardHeader
        title="Jupiter swaps"
        description="One strategy record per target mint. Swaps move idle deposit tokens into the target and back."
      />
      <CardBody className="space-y-6">
        <div className="space-y-2">
          {strategies.length === 0 && (
            <p className="text-sm text-muted">No Jupiter strategies yet.</p>
          )}
          {strategies.map((s) => (
            <div
              key={s.address}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <span className="font-medium">{s.symbol}</span> <Address value={s.targetMint} />
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                {formatTokenAmount(s.vaultBalance, s.decimals, { maxFraction: 4 })} {s.symbol}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={BigInt(s.vaultBalance) !== 0n}
                  loading={pending}
                  title={BigInt(s.vaultBalance) !== 0n ? "Swap the balance back first" : undefined}
                  onClick={() =>
                    void send({
                      label: "Close strategy",
                      vault: v.address,
                      build: () =>
                        api.build("strategy/close", {
                          payer: owner,
                          vault: v.address,
                          strategy: s.address,
                        }),
                    })
                  }
                >
                  Close
                </Button>
              </span>
            </div>
          ))}
        </div>

        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send({
              label: "Add Jupiter strategy",
              vault: v.address,
              build: () =>
                api.build("jupiter/initialize", {
                  payer: owner,
                  vault: v.address,
                  targetMint: newMint.trim(),
                }),
              onSuccess: () => setNewMint(""),
            });
          }}
        >
          <div className="flex-1">
            <Field label="New target mint">
              <Input
                value={newMint}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewMint(e.target.value)}
                placeholder="Mint address"
              />
            </Field>
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={newMint.trim().length < 32}
            loading={pending}
          >
            Add strategy
          </Button>
        </form>

        {strategy && source && dest && (
          <form
            className="grid gap-4 rounded-[10px] bg-slate-50 p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!amount || amountError) return;
              void send({
                label: "Jupiter swap",
                vault: v.address,
                build: () =>
                  api.build("jupiter/swap", {
                    payer: owner,
                    vault: v.address,
                    sourceMint: source.mint,
                    destinationMint: dest.mint,
                    amount: amount.toString(),
                    slippageBps,
                  }),
                onSuccess: () => setAmountInput(""),
              });
            }}
          >
            <Field label="Strategy">
              <select
                className={selectClass}
                value={effective}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value)}
              >
                {strategies.map((s) => (
                  <option key={s.targetMint} value={s.targetMint}>
                    {s.symbol}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Direction">
              <select
                className={selectClass}
                value={back ? "back" : "in"}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setBack(e.target.value === "back")}
              >
                <option value="in">
                  {v.depositSymbol} → {strategy.symbol}
                </option>
                <option value="back">
                  {strategy.symbol} → {v.depositSymbol}
                </option>
              </select>
            </Field>
            <Field
              label={`Amount (${source.symbol})`}
              error={amountError}
              hint={`Vault balance ${formatTokenAmount(source.balance, source.decimals, { maxFraction: 4 })}`}
            >
              <div className="relative">
                <Input
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAmountInput(e.target.value)}
                  className="pr-16"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-medium text-emerald-700 hover:bg-accent-soft"
                  onClick={() => setAmountInput(toEditString(source.balance, source.decimals))}
                >
                  Max
                </button>
              </div>
            </Field>
            <Field label="Slippage (bps)" hint={`Protocol cap ${formatBps(v.protocol.maxSlippageBps)}`}>
              <Input
                inputMode="numeric"
                value={slippage}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSlippage(e.target.value)}
              />
            </Field>
            <div className="text-[13px] sm:col-span-2">
              {quote.isFetching ? (
                <span className="text-muted">Fetching quote…</span>
              ) : quote.error ? (
                <span className="text-danger">{quote.error.message}</span>
              ) : quote.data ? (
                <span>
                  Receive ≈{" "}
                  <span className="font-medium tabular-nums">
                    {formatTokenAmount(quote.data.outAmount, dest.decimals, { maxFraction: 6 })}{" "}
                    {dest.symbol}
                  </span>{" "}
                  · impact {formatImpact(quote.data.priceImpactPct)} · via{" "}
                  {quote.data.routeLabels.join(" → ") || "direct"}
                </span>
              ) : (
                <span className="text-muted">Enter an amount to see a quote.</span>
              )}
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={!amount || !!amountError || !quote.data}
                loading={pending}
              >
                Swap
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
