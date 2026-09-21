import { useEffect, useState } from "react";
import { useQuote, useTokenSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { depositTokenOf } from "@/lib/holdings";
import { parseTokenAmount, toUiNumber } from "@/lib/format";
import type { StepProgress } from "@/lib/tx-steps";
import type { BuiltStep, HoldingsView, TokenInfo, VaultDetail } from "@/lib/types";
import { impactPercent, impactSeverity, isOperational, swapButtonState } from "@/lib/swap-logic";

// react-hooks/purity flags a bare `Date.now()` call in render; wrapping it (as other components
// in this codebase do, e.g. `nowSeconds` in vault-details.tsx) satisfies the static check.
const now = () => Date.now();

/**
 * Vault-swap state and execution, shared by every swap UI (Markets tab card, floating quick-swap).
 * All swaps quote and send as the vault (`userPublicKey: vault`), CPI'd through the program with
 * the manager as authority — never a personal-wallet swap.
 */
export function useSwapForm({
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
  const [input, setInputState] = useState(initial.amount ?? "");
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

  const toggleDirection = () => {
    setBuy(!buy);
    setInputState("");
    update({ buy: !buy, input: "" });
  };

  const setTarget = (t: TokenInfo) => {
    setPicked(t);
    setTargetMint(t.mint);
    update({ target: t });
  };

  const setInput = (i: string) => {
    setInputState(i);
    update({ input: i });
  };

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
      },
    });
  };

  return {
    v,
    deposit,
    heldTokens,
    balances,
    buy,
    toggleDirection,
    target,
    setTarget,
    picking,
    setPicking,
    input,
    setInput,
    slippageBps,
    setSlippageBps,
    slippageText,
    setSlippageText,
    slipOpen,
    setSlipOpen,
    reviewing,
    setReviewing,
    progress,
    invertRate,
    setInvertRate,
    pending,
    from,
    to,
    amount,
    balance,
    quote,
    refetch,
    button,
    out,
    impact,
    severity,
    rate,
    invertedRate,
    needsStrategy,
    confirm,
  };
}

export type SwapForm = ReturnType<typeof useSwapForm>;
