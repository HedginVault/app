"use client";

import { useEffect, useState } from "react";
import { AmountInput } from "@/components/token/amount-input";
import { PairLogo } from "@/components/token/token-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePool } from "@/hooks/queries";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import {
  binIdToPrice,
  distribution,
  rangeForPlacement,
  priceToBinId,
  type BinRange,
  type Placement,
} from "@/lib/dlmm-range";
import { formatPrice, formatTokenAmount, formatUsd, parseTokenAmount, toUiNumber, usdValue } from "@/lib/format";
import { depositTokenOf } from "@/lib/holdings";
import { isOperational } from "@/lib/swap-logic";
import type { StepProgress } from "@/lib/tx-steps";
import type { BuiltStep, DlmmShape, HoldingsView, PriceRange, TokenInfo, VaultDetail } from "@/lib/types";
import { PoolSelect } from "./pool-select";
import { RangePicker, ShapeIcon } from "./range-picker";
import { ReviewDialog } from "./review-dialog";

export const ACTIVE_BIN_SLIPPAGE = 10;
const DEFAULT_WIDTH = 35;
export const SHAPES: { id: DlmmShape; label: string }[] = [
  { id: "spot", label: "Spot" },
  { id: "curve", label: "Curve" },
  { id: "bidAsk", label: "Bid-Ask" },
];

export function vaultBalance(holdings: HoldingsView, mint: string): bigint {
  for (const p of holdings.positions) if ((p.kind === "idle" || p.kind === "swap") && p.token.mint === mint) return BigInt(p.amount);
  return 0n;
}

export function toInput(ui: number, decimals: number): string {
  if (!(ui > 0) || !Number.isFinite(ui)) return "";
  return ui.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, "");
}

/** Amount of the deposit token (with 1% headroom) that buys `shortUi` of `token`, when both are priced. */
export function depositNeeded(shortUi: number, token: TokenInfo, deposit: TokenInfo): string | undefined {
  if (token.priceUsd === null || deposit.priceUsd === null || deposit.priceUsd <= 0) return undefined;
  return toInput(((shortUi * token.priceUsd) / deposit.priceUsd) * 1.01, deposit.decimals);
}

export function LiquidityCard({
  v,
  owner,
  holdings,
  pool: poolAddress,
  onPoolChange,
  onSwapFor,
  onOpenedPartially,
  onRangeChange,
  dragRange,
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  pool: string | undefined;
  onPoolChange: (pool: string | undefined) => void;
  onSwapFor: (p: { to: string; amount?: string }) => void;
  /** The position was created but funding it failed; the caller can send the manager to add liquidity. */
  onOpenedPartially?: (position: string) => void;
  /** Draft range in raw pool prices (token Y per token X), null while there is none; drives the chart overlay. */
  onRangeChange?: (range: PriceRange | null) => void;
  /** A Min/Max Bin line being dragged on the chart; feeds back into the range picker and price inputs. */
  dragRange?: { range: PriceRange; seq: number } | null;
}) {
  const deposit = depositTokenOf(v);
  const pool = usePool(poolAddress);
  const heldMints = new Set(holdings.tokens.map((t) => t.token.mint));

  if (!poolAddress)
    return <PoolSelect defaultQuery={deposit.symbol} heldMints={heldMints} onSelect={(p) => onPoolChange(p.address)} />;
  if (pool.error)
    return (
      <div className="space-y-3 text-[13px]">
        <p className="text-danger">{pool.error.message}</p>
        <Button size="sm" variant="secondary" onClick={() => onPoolChange(undefined)}>Choose another pool</Button>
      </div>
    );
  if (!pool.data) return <Skeleton className="h-96" />;
  return (
    <ConfigurePosition
      key={pool.data.lbPair}
      v={v}
      owner={owner}
      holdings={holdings}
      pool={pool.data}
      onChangePool={() => onPoolChange(undefined)}
      onSwapFor={onSwapFor}
      onOpenedPartially={onOpenedPartially}
      onRangeChange={onRangeChange}
      dragRange={dragRange}
    />
  );
}

/** The range and price shown when Review was clicked; the dialog and the transaction use these. */
interface ReviewedRange {
  range: BinRange;
  activeBinId: number;
  activePrice: number;
}

function ConfigurePosition({
  v,
  owner,
  holdings,
  pool,
  onChangePool,
  onSwapFor,
  onOpenedPartially,
  onRangeChange,
  dragRange,
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  pool: NonNullable<ReturnType<typeof usePool>["data"]>;
  onChangePool: () => void;
  onSwapFor: (p: { to: string; amount?: string }) => void;
  onOpenedPartially?: (position: string) => void;
  onRangeChange?: (range: PriceRange | null) => void;
  dragRange?: { range: PriceRange; seq: number } | null;
}) {
  const { tokenX: x, tokenY: y, binStep, activeBinId: active } = pool;
  const deposit = depositTokenOf(v);
  const [inverted, setInverted] = useState(false);
  const [shape, setShape] = useState<DlmmShape>("spot");
  const [inputX, setInputX] = useState("");
  const [inputY, setInputY] = useState("");
  // Which side was auto-filled by dragging across the active bin, so it keeps tracking the funded
  // side's value; cleared the moment the user edits that side by hand.
  const [autoSide, setAutoSide] = useState<"x" | "y" | null>(null);
  const editInputX = (v: string) => {
    setInputX(v);
    setAutoSide((s) => (s === "x" ? null : s));
  };
  const editInputY = (v: string) => {
    setInputY(v);
    setAutoSide((s) => (s === "y" ? null : s));
  };
  // The field being typed into; committed on blur so half-typed numbers don't move the range.
  const [editing, setEditing] = useState<{ field: string; text: string } | null>(null);
  // Non-null while the review dialog is open; frozen so a moving active bin cannot change what was reviewed.
  const [reviewed, setReviewed] = useState<ReviewedRange | null>(null);
  const [progress, setProgress] = useState<StepProgress | null>(null);
  const { send, pending } = useSendTransaction();

  const price = (bin: number) => binIdToPrice(bin, binStep, x.decimals, y.decimals);
  const activePrice = Number(pool.activePrice);
  const show = (p: number) => formatPrice(inverted ? 1 / p : p);

  const balX = vaultBalance(holdings, x.mint);
  const balY = vaultBalance(holdings, y.mint);
  const amountX = parseTokenAmount(inputX || "0", x.decimals);
  const amountY = parseTokenAmount(inputY || "0", y.decimals);
  const uiX = amountX ? toUiNumber(amountX, x.decimals) : 0;
  const uiY = amountY ? toUiNumber(amountY, y.decimals) : 0;
  const shortX = amountX !== null && amountX > balX;
  const shortY = amountY !== null && amountY > balY;

  // The amounts pick the side: X alone sits above the pool price, Y alone below, both straddle it.
  const placement: Placement | null = uiX > 0 && uiY > 0 ? "both" : uiX > 0 ? "above" : uiY > 0 ? "below" : null;
  const [rangeState, setRangeState] = useState<{ placement: Placement | null; range: BinRange }>(() => ({
    placement,
    range: rangeForPlacement(active, DEFAULT_WIDTH, placement ?? "both"),
  }));
  // Switching side resets the range to a default width on that side ("adjust state when props change").
  if (placement !== null && placement !== rangeState.placement)
    setRangeState({ placement, range: rangeForPlacement(active, DEFAULT_WIDTH, placement) });
  const range = placement !== null && placement !== rangeState.placement ? rangeForPlacement(active, DEFAULT_WIDTH, placement) : rangeState.range;
  const locked = placement === null;

  const minPrice = price(range.lowerBinId);
  const maxPrice = price(range.upperBinId - 1);
  const chart = locked ? [] : distribution(range, active, shape, uiX, uiY).map((b) => ({ ...b, x: b.x * activePrice }));
  const last = range.upperBinId - 1;
  useEffect(() => {
    onRangeChange?.(locked ? null : { min: minPrice, max: maxPrice });
  }, [locked, minPrice, maxPrice, onRangeChange]);
  useEffect(() => () => onRangeChange?.(null), [onRangeChange]);
  // One-sided ranges anchor the pool price to an edge: X (above) starts at the left, Y (below) ends at the right.
  const domain = {
    lo: placement === "above" ? active : Math.min(active - DLMM_MAX_POSITION_WIDTH, range.lowerBinId),
    hi: placement === "below" ? active : Math.max(active + DLMM_MAX_POSITION_WIDTH, last),
  };

  /**
   * Sets inclusive bins. Keeps the range on the side the amounts fund, lower <= last, and the width
   * within the program max by stopping the edge being moved.
   */
  const setBins = (lower: number, lastBin: number, moved: "lower" | "last") => {
    if (placement === null) return;
    if (placement === "above") lower = Math.max(lower, active + 1);
    if (placement === "below") lastBin = Math.min(lastBin, active);
    if (placement === "both") [lower, lastBin] = [Math.min(lower, active), Math.max(lastBin, active)];
    if (lastBin < lower) [lower, lastBin] = moved === "lower" ? [lastBin, lastBin] : [lower, lower];
    if (lastBin - lower + 1 > DLMM_MAX_POSITION_WIDTH) {
      // Stop the handle being moved at the max width; never drag the other edge along.
      if (moved === "lower") lower = lastBin - DLMM_MAX_POSITION_WIDTH + 1;
      else lastBin = lower + DLMM_MAX_POSITION_WIDTH - 1;
    }
    setRangeState({ placement, range: { lowerBinId: lower, upperBinId: lastBin + 1 } });
  };
  /** Displayed edge -> raw bin edge. Inverted display flips which bin is the min, and the direction of "+". */
  const nudge = (edge: "min" | "max", dir: 1 | -1) => {
    const d = inverted ? -dir : dir;
    if ((edge === "min") !== inverted) setBins(range.lowerBinId + d, last, "lower");
    else setBins(range.lowerBinId, last + d, "last");
  };

  /** A raw (non-inverted) pool price moves only the bin it names, through setBins's placement/width clamps. */
  const applyRawPrice = (own: "lower" | "last", raw: number) => {
    if (!(raw > 0 && Number.isFinite(raw))) return;
    const bin = priceToBinId(raw, binStep, x.decimals, y.decimals, own === "lower" ? "floor" : "ceil");
    if (bin !== null) setBins(own === "lower" ? bin : range.lowerBinId, own === "last" ? bin : last, own);
  };
  /** A typed price moves only its own edge: displayed min/max map to lower/last bin (swapped when inverted). */
  const applyPrice = (edge: "min" | "max", v: number) => {
    if (v > 0 && Number.isFinite(v)) applyRawPrice((edge === "min") !== inverted ? "lower" : "last", inverted ? 1 / v : v);
    setEditing(null);
  };

  // A Min/Max Bin line dragged on the chart: apply whichever raw edge moved further from where it is now.
  // Dragging the far edge of a single-sided draft across the active bin turns it into a both-sided
  // range; the newly-needed side is auto-filled to the same total USD value as the funded side.
  // Adjusted during render, gated on `seq` (not the range values), like the placement reset above: an
  // effect would set state a frame late and cascade an extra render for every mousemove of the drag.
  const [lastDragSeq, setLastDragSeq] = useState<number | undefined>(undefined);
  if (dragRange && !locked && dragRange.seq !== lastDragSeq) {
    setLastDragSeq(dragRange.seq);
    const { min, max } = dragRange.range;
    const rawEdge: "lower" | "last" = Math.abs(max - maxPrice) > Math.abs(min - minPrice) ? "last" : "lower";
    const raw = rawEdge === "last" ? max : min;
    const bin = raw > 0 && Number.isFinite(raw) ? priceToBinId(raw, binStep, x.decimals, y.decimals, rawEdge === "lower" ? "floor" : "ceil") : null;
    if (bin !== null) {
      if (placement === "below" && rawEdge === "last" && bin > active) {
        const upperBinId = Math.min(bin + 1, range.lowerBinId + DLMM_MAX_POSITION_WIDTH);
        setInputX(toInput(uiY / activePrice, x.decimals));
        setAutoSide("x");
        setRangeState({ placement: "both", range: { lowerBinId: range.lowerBinId, upperBinId } });
      } else if (placement === "above" && rawEdge === "lower" && bin <= active) {
        const lowerBinId = Math.max(bin, range.upperBinId - DLMM_MAX_POSITION_WIDTH);
        setInputY(toInput(uiX * activePrice, y.decimals));
        setAutoSide("y");
        setRangeState({ placement: "both", range: { lowerBinId, upperBinId: range.upperBinId } });
      } else {
        applyRawPrice(rawEdge, raw);
      }
    }
  }

  // The auto-filled side keeps tracking the funded side's value as it changes (typed or preset), not
  // just at the moment it crossed. Also adjusted during render, for the same reason as the block above.
  if (autoSide === "x") {
    const want = toInput(uiY / activePrice, x.decimals);
    if (want !== inputX) setInputX(want);
  } else if (autoSide === "y") {
    const want = toInput(uiX * activePrice, y.decimals);
    if (want !== inputY) setInputY(want);
  }

  const invalid = amountX === null || amountY === null;
  const empty = !invalid && locked;
  const button = !isOperational(v)
    ? { label: "Vault not operational", disabled: true }
    : invalid
      ? { label: "Invalid amount", disabled: true }
      : empty
        ? { label: "Enter an amount", disabled: true }
        : shortX || shortY
          ? { label: "Insufficient vault balance", disabled: true }
          : { label: "Review position", disabled: false };

  const shortfall = (token: TokenInfo, amount: bigint | null, bal: bigint) =>
    amount !== null && amount > bal && token.mint !== deposit.mint ? (
      <div className="flex items-center justify-between rounded-[10px] bg-warning-soft px-3 py-2 text-[12px] text-amber-200">
        <span>Vault holds {formatTokenAmount(bal, token.decimals, { maxFraction: 4 })} {token.symbol}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onSwapFor({ to: token.mint, amount: depositNeeded(toUiNumber(amount - bal, token.decimals), token, deposit) })
          }
        >
          Swap for {token.symbol}
        </Button>
      </div>
    ) : null;

  const confirm = async () => {
    if (!reviewed) return;
    const { range: r } = reviewed;
    setProgress(null);
    let position: string | undefined;
    let succeeded = false;
    const signatures = await send({
      label: `Open ${x.symbol}-${y.symbol} position`,
      vault: v.address,
      onProgress: setProgress,
      build: async () => {
        const built = await api.build<BuiltStep & { position: string }>("dlmm/open", {
          payer: owner,
          vault: v.address,
          lbPair: pool.lbPair,
          lowerBinId: r.lowerBinId,
          upperBinId: r.upperBinId,
          amountX: (amountX ?? 0n).toString(),
          amountY: (amountY ?? 0n).toString(),
          shape,
          maxActiveBinSlippage: ACTIVE_BIN_SLIPPAGE,
        });
        position = built.position;
        return built;
      },
      onSuccess: () => {
        succeeded = true;
        setReviewed(null);
        setInputX("");
        setInputY("");
      },
    });
    // Some transactions landed but not all: the position exists and is unfunded.
    if (!succeeded && signatures && signatures.length > 0 && position) {
      setReviewed(null);
      onOpenedPartially?.(position);
    }
  };

  const quote = inverted ? x.symbol : y.symbol;
  const base = inverted ? y.symbol : x.symbol;
  const shownRange = reviewed?.range ?? range;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PairLogo x={x} y={y} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{x.symbol}-{y.symbol}</div>
          <button type="button" onClick={() => setInverted(!inverted)} className="text-[12px] tabular-nums text-muted hover:text-foreground">
            1 {base} = {show(activePrice)} {quote} ⇄
          </button>
        </div>
        <Button size="sm" variant="ghost" onClick={onChangePool}>Change</Button>
      </div>

      <div className="space-y-2">
        <AmountInput
          label={`Deposit ${x.symbol}`}
          token={x}
          value={inputX}
          onChange={editInputX}
          balance={balX.toString()}
          usd={amountX ? usdValue(amountX, x.decimals, x.priceUsd) : undefined}
          presets={[50, 100]}
          error={amountX === null ? "Invalid amount" : null}
        />
        {shortfall(x, amountX, balX)}
        <AmountInput
          label={`Deposit ${y.symbol}`}
          token={y}
          value={inputY}
          onChange={editInputY}
          balance={balY.toString()}
          usd={amountY ? usdValue(amountY, y.decimals, y.priceUsd) : undefined}
          presets={[50, 100]}
          error={amountY === null ? "Invalid amount" : null}
        />
        {shortfall(y, amountY, balY)}
        <p className="text-[12px] text-muted">
          {placement === "above"
            ? `Only ${x.symbol}: range sits above the pool price.`
            : placement === "below"
              ? `Only ${y.symbol}: range sits below the pool price.`
              : placement === "both"
                ? "Both tokens: range spans the pool price."
                : `${x.symbol} alone goes above the pool price, ${y.symbol} alone below, both span it.`}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[12px] font-medium text-muted">Strategy</div>
        <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
          {SHAPES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={shape === o.id}
              onClick={() => setShape(o.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2 text-[13px] font-medium transition-colors",
                shape === o.id ? "bg-white/10 text-white" : "text-muted hover:text-foreground",
              )}
            >
              <span className={shape === o.id ? "text-sky-400" : undefined}>
                <ShapeIcon shape={o.id} />
              </span>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
            Price range
            <button type="button" aria-label="Reset range" title="Reset range" disabled={locked} onClick={() => setRangeState({ placement, range: rangeForPlacement(active, DEFAULT_WIDTH, placement ?? "both") })} className="hover:text-foreground">
              ↺
            </button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-indigo-400" />{x.symbol}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-sky-400" />{y.symbol}</span>
          </div>
        </div>
        <RangePicker
          domain={domain}
          lower={range.lowerBinId}
          last={last}
          activeBinId={active}
          bins={chart}
          priceLabel={`${show(activePrice)} ${quote}`}
          tickLabel={(bin) => show(price(bin))}
          onChange={setBins}
          disabled={locked}
        />

        {(["min", "max"] as const).map((edge) => {
          const p = edge === "min" ? (inverted ? maxPrice : minPrice) : inverted ? minPrice : maxPrice;
          const shown = inverted ? 1 / p : p;
          const current = inverted ? 1 / activePrice : activePrice;
          const pct = ((shown - current) / current) * 100;
          const label = edge === "min" ? "Min" : "Max";
          const field = (kind: "price" | "pct") => `${edge}-${kind}`;
          const text = (kind: "price" | "pct", fallback: string) => (editing?.field === field(kind) ? editing.text : fallback);
          const commit = (kind: "price" | "pct") => {
            if (editing?.field !== field(kind)) return;
            const n = Number(editing.text);
            if (editing.text.trim() === "" || !Number.isFinite(n)) return setEditing(null);
            const target = kind === "price" ? n : current * (1 + n / 100);
            applyPrice(edge, inverted ? 1 / target : target);
          };
          return (
            <div key={edge}>
              <div className="mb-1 text-[12px] text-muted">
                {label} price <span className="text-white/40">({quote}/{base})</span>
              </div>
              <div className={cn("grid grid-cols-[minmax(0,1fr)_6rem_2rem] overflow-hidden rounded-xl border border-border bg-white/[0.03]", locked && "opacity-50")}>
                <Input
                  aria-label={`${label} price`}
                  className="rounded-none border-0 bg-transparent focus:ring-0"
                  inputMode="decimal"
                  disabled={locked}
                  value={text("price", show(p))}
                  onChange={(e) => setEditing({ field: field("price"), text: e.target.value })}
                  onBlur={() => commit("price")}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
                <label className="flex items-center border-l border-border pr-2">
                  <Input
                    aria-label={`${label} price change from current, percent`}
                    className={cn("rounded-none border-0 bg-transparent pr-0.5 text-right focus:ring-0", pct < 0 ? "text-red-300" : "text-sky-400")}
                    inputMode="decimal"
                    disabled={locked}
                    value={text("pct", `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}`)}
                    onChange={(e) => setEditing({ field: field("pct"), text: e.target.value })}
                    onBlur={() => commit("pct")}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                  <span className="text-[12px] text-muted">%</span>
                </label>
                <div className="grid grid-rows-2 border-l border-border text-muted">
                  <button type="button" aria-label={`Raise ${edge} price by one bin`} disabled={locked} onClick={() => nudge(edge, 1)} className="hover:bg-white/[0.06] hover:text-foreground">+</button>
                  <button type="button" aria-label={`Lower ${edge} price by one bin`} disabled={locked} onClick={() => nudge(edge, -1)} className="border-t border-border hover:bg-white/[0.06] hover:text-foreground">−</button>
                </div>
              </div>
            </div>
          );
        })}
        <p className="text-[12px] text-muted">
          Total bins: <span className="tabular-nums text-foreground">{range.upperBinId - range.lowerBinId}</span> / {DLMM_MAX_POSITION_WIDTH}
        </p>
      </div>

      <Button className="w-full" disabled={button.disabled} onClick={() => setReviewed({ range, activeBinId: active, activePrice })}>
        {button.label}
      </Button>

      <ReviewDialog
        open={reviewed !== null}
        onClose={() => setReviewed(null)}
        title="Review new position"
        confirmLabel="Open position"
        onConfirm={() => void confirm()}
        pending={pending}
        progress={progress}
        steps={[{ label: "Create position" }, { label: "Add liquidity" }]}
        rows={[
          { label: "Pool", value: `${x.symbol}-${y.symbol} · bin step ${binStep}` },
          { label: "Min price", value: `${formatPrice(price(shownRange.lowerBinId))} ${y.symbol}` },
          { label: "Current price", value: `${formatPrice(reviewed?.activePrice ?? activePrice)} ${y.symbol}` },
          { label: "Max price", value: `${formatPrice(price(shownRange.upperBinId - 1))} ${y.symbol}` },
          { label: "Width", value: `${shownRange.upperBinId - shownRange.lowerBinId} bins` },
          { label: "Shape", value: SHAPES.find((s) => s.id === shape)!.label },
          { label: `Deposit ${x.symbol}`, value: `${formatTokenAmount(amountX ?? 0n, x.decimals, { maxFraction: 6 })} (${formatUsd(usdValue(amountX ?? 0n, x.decimals, x.priceUsd))})` },
          { label: `Deposit ${y.symbol}`, value: `${formatTokenAmount(amountY ?? 0n, y.decimals, { maxFraction: 6 })} (${formatUsd(usdValue(amountY ?? 0n, y.decimals, y.priceUsd))})` },
        ]}
        notes={[
          "Position account rent is paid by your wallet and refunded when the position is closed.",
          `Fails if the active bin moves more than ${ACTIVE_BIN_SLIPPAGE} bins before it lands.`,
          "If creating and funding the position does not fit one transaction, your wallet asks for a second signature.",
        ]}
      />
    </div>
  );
}
