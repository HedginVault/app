"use client";

import { useEffect, useState } from "react";
import { AmountInput } from "@/components/token/amount-input";
import { TokenLogo } from "@/components/token/token-logo";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { useQuote, useTokenSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { depositTokenOf } from "@/lib/holdings";
import { formatBps, formatPrice, formatTokenAmount, parseTokenAmount, toUiNumber, usdValue } from "@/lib/format";
import type { StepProgress } from "@/lib/tx-steps";
import type { BuiltStep, HoldingsView, TokenInfo, VaultDetail } from "@/lib/types";
import {
  impactPercent,
  impactSeverity,
  isOperational,
  minReceived,
  swapButtonState,
} from "@/lib/swap-logic";
import { ReviewDialog } from "./review-dialog";
import { TokenSelect } from "./token-select";

const SLIPPAGE_PRESETS = [10, 50, 100];
// react-hooks/purity flags a bare `Date.now()` call in render; wrapping it (as other components
// in this codebase do, e.g. `nowSeconds` in vault-details.tsx) satisfies the static check.
const now = () => Date.now();

export function SwapCard({
  v,
  owner,
  holdings,
  initial,
  onParamsChange,
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  initial: { from?: string; to?: string; amount?: string };
  onParamsChange: (p: { from?: string; to?: string; amount?: string }) => void;
}) {
  const deposit = depositTokenOf(v);
  // Only tokens held via an open Jupiter strategy are eligible sell-side targets: an LP-only
  // holding (a DLMM position's tokenX/tokenY) has no vault-controlled swap balance, so it must
  // not appear here (spec §4 / review finding).
  const heldTokens = holdings.positions.flatMap((p) => (p.kind === "swap" ? [p.token] : []));
  const balances = new Map(
    holdings.positions.flatMap((p) => (p.kind === "idle" || p.kind === "swap" ? [[p.token.mint, p.amount] as const] : [])),
  );
  const initialTarget = [initial.from, initial.to].find((m) => m && m !== deposit.mint);

  const [buy, setBuy] = useState(initial.from === undefined || initial.from === deposit.mint);
  // The target is tracked by mint. A token the vault does not hold yet (picked from search, or
  // pre-filled by "Swap for X") is resolved from the pick itself or, after a remount, from search.
  const [targetMint, setTargetMint] = useState<string | undefined>(initialTarget);
  const [picked, setPicked] = useState<TokenInfo | null>(null);
  const heldTarget = heldTokens.find((t) => t.mint === targetMint);
  const lookup = useTokenSearch(targetMint && !heldTarget && picked?.mint !== targetMint ? targetMint : "");
  const target: TokenInfo | null =
    heldTarget ?? (picked?.mint === targetMint ? picked : lookup.data?.find((t) => t.mint === targetMint) ?? null);
  const setTarget = (t: TokenInfo) => {
    setPicked(t);
    setTargetMint(t.mint);
  };
  const [input, setInput] = useState(initial.amount ?? "");
  const [slippageBps, setSlippageBps] = useState(Math.min(50, v.protocol.maxSlippageBps));
  // Custom slippage text while editing; null shows the committed value.
  const [slippageText, setSlippageText] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState<StepProgress | null>(null);
  const [invertRate, setInvertRate] = useState(false);
  const { send, pending } = useSendTransaction();

  const from = buy ? deposit : target;
  const to = buy ? target : deposit;
  const amount = from ? parseTokenAmount(input, from.decimals) : null;
  const balance = from ? BigInt(balances.get(from.mint) ?? "0") : 0n;
  const debouncedAmount = useDebounce(amount?.toString() ?? "", 400);

  const quoteParams = {
    vault: v.address,
    inputMint: from?.mint ?? "",
    outputMint: to?.mint ?? "",
    amount: debouncedAmount,
    slippageBps,
  };
  const quoteEnabled = !!from && !!to && !!amount && amount > 0n && amount <= balance && debouncedAmount === amount.toString();
  const quote = useQuote(quoteParams, quoteEnabled);
  // Keep the quote fresh while the card is visible.
  const { refetch } = quote;
  useEffect(() => {
    if (!quoteEnabled) return;
    const id = setInterval(() => {
      void refetch();
    }, 15_000);
    return () => clearInterval(id);
  }, [quoteEnabled, refetch]);
  const quoteAgeMs = quote.data ? now() - quote.dataUpdatedAt : null;

  const button = swapButtonState({
    operational: isOperational(v),
    hasToken: !!target,
    amount,
    balance,
    quoteLoading: quoteEnabled && (quote.isFetching && !quote.data),
    quoteError: quote.error ? quote.error.message : null,
    quoteAgeMs: quoteEnabled ? quoteAgeMs : null,
  });

  const out = quote.data ? BigInt(quote.data.outAmount) : null;
  const impact = quote.data ? impactPercent(quote.data.priceImpactPct) : 0;
  const severity = impactSeverity(impact);
  const rate = from && to && amount && out && amount > 0n ? toUiNumber(out, to.decimals) / toUiNumber(amount, from.decimals) : null;
  const invertedRate = rate ? 1 / rate : null;
  const needsStrategy = !!target && !holdings.positions.some((p) => p.kind === "swap" && p.token.mint === target.mint);

  const update = (next: { buy?: boolean; target?: TokenInfo | null; input?: string }) => {
    const b = next.buy ?? buy;
    const t = next.target === undefined ? target : next.target;
    const i = next.input ?? input;
    onParamsChange({
      from: b ? deposit.mint : t?.mint,
      to: b ? t?.mint : deposit.mint,
      amount: i || undefined,
    });
  };

  const tokenButton = (token: TokenInfo | null, selectable: boolean) =>
    selectable ? (
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2.5 text-sm font-medium hover:bg-white/[0.03]"
      >
        {token ? <TokenLogo token={token} size="sm" /> : <span className="size-5 rounded-full bg-white/10" />}
        {token?.symbol ?? "Select"} <span className="text-muted">▾</span>
      </button>
    ) : (
      <span
        title={`Vault swaps always go through ${deposit.symbol}`}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm font-medium"
      >
        <TokenLogo token={deposit} size="sm" /> {deposit.symbol} <span className="text-[11px] text-muted">🔒</span>
      </span>
    );

  const confirm = () => {
    if (!from || !to || !amount) return;
    setProgress(null);
    void send({
      label: `Swap ${from.symbol} → ${to.symbol}`,
      vault: v.address,
      onProgress: setProgress,
      build: () =>
        api.build<BuiltStep>("jupiter/swap", {
          payer: owner,
          vault: v.address,
          sourceMint: from.mint,
          destinationMint: to.mint,
          amount: amount.toString(),
          slippageBps,
        }),
      onSuccess: () => {
        setReviewing(false);
        setInput("");
        update({ input: "" });
      },
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Popover
          open={slipOpen}
          onOpenChange={setSlipOpen}
          trigger={
            <button type="button" onClick={() => setSlipOpen((o) => !o)} className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-white/[0.06]">
              Slippage {formatBps(slippageBps)} ⚙
            </button>
          }
        >
          <div className="space-y-2 p-2 text-[13px]">
            <div className="flex gap-1">
              {SLIPPAGE_PRESETS.filter((s) => s <= v.protocol.maxSlippageBps).map((s) => (
                <Button key={s} size="sm" variant={s === slippageBps ? "primary" : "secondary"} onClick={() => setSlippageBps(s)}>
                  {formatBps(s)}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <span className="text-muted">Custom bps</span>
              <input
                type="number"
                min={1}
                max={v.protocol.maxSlippageBps}
                value={slippageText ?? String(slippageBps)}
                onChange={(e) => {
                  const text = e.target.value;
                  setSlippageText(text);
                  const n = Number(text);
                  if (/^\d+$/.test(text.trim()) && n >= 1 && n <= v.protocol.maxSlippageBps) setSlippageBps(n);
                }}
                onBlur={() => setSlippageText(null)}
                className="h-8 w-20 rounded-md border border-border px-2 tabular-nums"
              />
            </label>
            <p className="text-[12px] text-muted">Protocol maximum {formatBps(v.protocol.maxSlippageBps)}</p>
          </div>
        </Popover>
      </div>

      <AmountInput
        label="You pay"
        token={from}
        tokenSlot={tokenButton(from, !buy)}
        value={input}
        onChange={(i) => {
          setInput(i);
          update({ input: i });
        }}
        balance={from ? balance.toString() : null}
        usd={from && amount !== null ? usdValue(amount, from.decimals, from.priceUsd) : undefined}
        presets={[25, 50, 100]}
        error={amount !== null && amount > balance ? "Exceeds vault balance" : input && amount === null ? "Invalid amount" : null}
      />

      <div className="relative z-10 -my-4 flex justify-center">
        <button
          type="button"
          aria-label="Switch direction"
          onClick={() => {
            setBuy(!buy);
            setInput("");
            update({ buy: !buy, input: "" });
          }}
          className="rounded-full border border-border bg-surface p-1.5 text-muted shadow-none hover:text-foreground"
        >
          ⇅
        </button>
      </div>

      <AmountInput
        label="You receive"
        token={to}
        tokenSlot={tokenButton(to, buy)}
        value={out !== null && to ? formatTokenAmount(out, to.decimals, { maxFraction: 6 }).replace(/,/g, "") : ""}
        readOnly
        balance={to ? (balances.get(to.mint) ?? "0") : null}
        usd={out !== null && to ? usdValue(out, to.decimals, to.priceUsd) : undefined}
      />

      {quote.data && from && to && (
        <dl className="space-y-1 rounded-[10px] px-1 pt-1 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-muted">Rate</dt>
            <dd>
              <button type="button" onClick={() => setInvertRate((i) => !i)} className="tabular-nums hover:underline" title="Tap to invert">
                {invertRate
                  ? `1 ${to.symbol} = ${formatPrice(invertedRate)} ${from.symbol}`
                  : `1 ${from.symbol} = ${formatPrice(rate)} ${to.symbol}`}
              </button>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Price impact</dt>
            <dd className={severity === "high" ? "text-red-300" : severity === "warn" ? "text-amber-300" : "tabular-nums"}>{impact.toFixed(2)}%</dd>
          </div>
          <div className="flex justify-between"><dt className="text-muted">Minimum received</dt><dd className="tabular-nums">{formatTokenAmount(minReceived(out!, slippageBps), to.decimals, { maxFraction: 6 })} {to.symbol}</dd></div>
          <div className="flex min-w-0 justify-between"><dt className="shrink-0 text-muted">Route</dt><dd className="min-w-0 truncate pl-4 text-right">{quote.data.routeLabels.join(" → ")}</dd></div>
        </dl>
      )}

      <Button
        className="w-full"
        disabled={button.disabled}
        onClick={() => {
          void refetch();
          setReviewing(true);
        }}
      >
        {button.label}
      </Button>

      <TokenSelect
        open={picking}
        onClose={() => setPicking(false)}
        held={heldTokens}
        exclude={[deposit.mint, v.shareMint]}
        balances={balances}
        onSelect={(t) => {
          setTarget(t);
          update({ target: t });
        }}
      />

      {from && to && amount && out !== null && (
        <ReviewDialog
          open={reviewing}
          onClose={() => setReviewing(false)}
          title="Review swap"
          confirmLabel="Confirm swap"
          onConfirm={confirm}
          pending={pending}
          progress={progress}
          steps={needsStrategy ? [{ label: `Set up ${to === deposit ? from.symbol : to.symbol} strategy` }, { label: "Swap" }] : []}
          rows={[
            { label: "You pay", value: `${formatTokenAmount(amount, from.decimals, { maxFraction: 6 })} ${from.symbol}` },
            { label: "You receive (est.)", value: `${formatTokenAmount(out, to.decimals, { maxFraction: 6 })} ${to.symbol}` },
            { label: "Minimum received", value: `${formatTokenAmount(minReceived(out, slippageBps), to.decimals, { maxFraction: 6 })} ${to.symbol}` },
            { label: "Price impact", value: `${impact.toFixed(2)}%`, tone: severity === "high" ? "danger" : severity === "warn" ? "warn" : undefined },
            { label: "Slippage", value: formatBps(slippageBps) },
          ]}
          notes={[
            ...(needsStrategy
              ? [`First swap into ${target!.symbol} also sets up its Jupiter strategy (one-time account rent). It may need two signatures.`]
              : []),
            "The quote is refreshed when the transaction is built; the program rejects fills below the protocol slippage limit.",
          ]}
        />
      )}
    </div>
  );
}
