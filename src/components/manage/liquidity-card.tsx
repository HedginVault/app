"use client";

import { useState } from "react";
import { BinChart } from "@/components/holdings/bin-chart";
import { AmountInput } from "@/components/token/amount-input";
import { PairLogo } from "@/components/token/token-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { usePool } from "@/hooks/queries";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import {
  binIdToPrice,
  clampWidth,
  distribution,
  rangeForPlacement,
  rangeFromPrices,
  sidesForRange,
  suggestOtherSide,
  type BinRange,
  type Placement,
} from "@/lib/dlmm-range";
import { formatPrice, formatTokenAmount, formatUsd, parseTokenAmount, toUiNumber, usdValue } from "@/lib/format";
import { depositTokenOf } from "@/lib/holdings";
import { isOperational } from "@/lib/swap-logic";
import type { StepProgress } from "@/lib/tx-steps";
import type { BuiltStep, DlmmShape, HoldingsView, TokenInfo, VaultDetail } from "@/lib/types";
import { PoolSelect } from "./pool-select";
import { ReviewDialog } from "./review-dialog";

export const ACTIVE_BIN_SLIPPAGE = 10;
const WIDTH_PRESETS = [10, 35, DLMM_MAX_POSITION_WIDTH];
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
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  pool: string | undefined;
  onPoolChange: (pool: string | undefined) => void;
  onSwapFor: (p: { to: string; amount?: string }) => void;
  /** The position was created but funding it failed; the caller can send the manager to add liquidity. */
  onOpenedPartially?: (position: string) => void;
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
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  pool: NonNullable<ReturnType<typeof usePool>["data"]>;
  onChangePool: () => void;
  onSwapFor: (p: { to: string; amount?: string }) => void;
  onOpenedPartially?: (position: string) => void;
}) {
  const { tokenX: x, tokenY: y, binStep, activeBinId: active } = pool;
  const deposit = depositTokenOf(v);
  const [inverted, setInverted] = useState(false);
  const [placement, setPlacement] = useState<Placement>(x.mint === deposit.mint ? "above" : y.mint === deposit.mint ? "below" : "both");
  const [width, setWidth] = useState(35);
  const [custom, setCustom] = useState<BinRange | null>(null);
  const [shape, setShape] = useState<DlmmShape>("spot");
  const [inputX, setInputX] = useState("");
  const [inputY, setInputY] = useState("");
  const [minText, setMinText] = useState<string | null>(null);
  const [maxText, setMaxText] = useState<string | null>(null);
  // Non-null while the review dialog is open; frozen so a moving active bin cannot change what was reviewed.
  const [reviewed, setReviewed] = useState<ReviewedRange | null>(null);
  const [progress, setProgress] = useState<StepProgress | null>(null);
  const { send, pending } = useSendTransaction();

  const price = (bin: number) => binIdToPrice(bin, binStep, x.decimals, y.decimals);
  const activePrice = Number(pool.activePrice);
  const range = custom ?? rangeForPlacement(active, width, placement);
  const sides = sidesForRange(range, active);
  const minPrice = price(range.lowerBinId);
  const maxPrice = price(range.upperBinId - 1);
  const show = (p: number) => formatPrice(inverted ? 1 / p : p);

  const balX = vaultBalance(holdings, x.mint);
  const balY = vaultBalance(holdings, y.mint);
  const amountX = sides.x ? parseTokenAmount(inputX || "0", x.decimals) : 0n;
  const amountY = sides.y ? parseTokenAmount(inputY || "0", y.decimals) : 0n;
  const uiX = amountX ? toUiNumber(amountX, x.decimals) : 0;
  const uiY = amountY ? toUiNumber(amountY, y.decimals) : 0;
  const shortX = amountX !== null && amountX > balX;
  const shortY = amountY !== null && amountY > balY;

  const chart = distribution(range, active, shape, uiX, uiY).map((b) => ({ ...b, x: b.x * activePrice }));

  const setX = (text: string) => {
    setInputX(text);
    if (sides.x && sides.y) {
      const ui = Number(text);
      setInputY(Number.isFinite(ui) ? toInput(suggestOtherSide("x", ui, activePrice, range, active), y.decimals) : "");
    }
  };
  const setY = (text: string) => {
    setInputY(text);
    if (sides.x && sides.y) {
      const ui = Number(text);
      setInputX(Number.isFinite(ui) ? toInput(suggestOtherSide("y", ui, activePrice, range, active), x.decimals) : "");
    }
  };
  const applyPrice = (edge: "min" | "max", text: string) => {
    const v = Number(text);
    let rawMin = minPrice;
    let rawMax = maxPrice;
    if (v > 0 && Number.isFinite(v)) {
      if (!inverted) {
        if (edge === "min") rawMin = v;
        else rawMax = v;
      } else {
        // displayed min = 1/rawMax, displayed max = 1/rawMin
        if (edge === "min") rawMax = 1 / v;
        else rawMin = 1 / v;
      }
      const next = rangeFromPrices(Math.min(rawMin, rawMax), Math.max(rawMin, rawMax), binStep, x.decimals, y.decimals);
      if (next) setCustom(next);
    }
    setMinText(null);
    setMaxText(null);
  };

  const invalid = amountX === null || amountY === null;
  const empty = !invalid && amountX === 0n && amountY === 0n;
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
        <div className="text-[12px] font-medium text-muted">Range</div>
        <Segmented
          size="sm"
          value={custom ? ("custom" as Placement) : placement}
          onChange={(p) => {
            setCustom(null);
            setPlacement(p);
          }}
          options={[
            { id: "below", label: `Below price (${y.symbol})` },
            { id: "both", label: "Both sides" },
            { id: "above", label: `Above price (${x.symbol})` },
          ]}
        />
        <div className="flex items-center gap-2">
          {WIDTH_PRESETS.map((w) => (
            <Button key={w} size="sm" variant={!custom && width === w ? "primary" : "secondary"} onClick={() => { setCustom(null); setWidth(w); }}>
              {w} bins
            </Button>
          ))}
        </div>
        <Slider min={1} max={DLMM_MAX_POSITION_WIDTH} value={custom ? range.upperBinId - range.lowerBinId : width} onChange={(w) => { setCustom(null); setWidth(clampWidth(w)); }} aria-label="Range width in bins" />
        <div className="grid grid-cols-2 gap-2">
          {(["min", "max"] as const).map((edge) => {
            const p = edge === "min" ? (inverted ? maxPrice : minPrice) : inverted ? minPrice : maxPrice;
            const text = edge === "min" ? minText : maxText;
            const setText = edge === "min" ? setMinText : setMaxText;
            const shown = inverted ? 1 / p : p;
            const current = inverted ? 1 / activePrice : activePrice;
            const pct = ((shown - current) / current) * 100;
            return (
              <label key={edge} className="block rounded-[10px] border border-border px-3 py-2">
                <span className="text-[12px] text-muted">{edge === "min" ? "Min" : "Max"} price ({quote}/{base})</span>
                <Input
                  className="mt-1 h-8 border-0 px-0 focus:ring-0"
                  inputMode="decimal"
                  value={text ?? show(p)}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={() => text !== null && applyPrice(edge, text)}
                />
                <span className="text-[11px] tabular-nums text-muted">{pct >= 0 ? "+" : ""}{pct.toFixed(2)}% from current</span>
              </label>
            );
          })}
        </div>
        <p className="text-[12px] text-muted">{range.upperBinId - range.lowerBinId} bins · max {DLMM_MAX_POSITION_WIDTH}</p>
      </div>

      <div className="space-y-2">
        <div className="text-[12px] font-medium text-muted">Shape</div>
        <Segmented size="sm" value={shape} onChange={setShape} options={SHAPES} />
      </div>

      <div className="space-y-2">
        <AmountInput
          label={`Deposit ${x.symbol}`}
          token={x}
          value={sides.x ? inputX : ""}
          onChange={setX}
          balance={balX.toString()}
          usd={amountX ? usdValue(amountX, x.decimals, x.priceUsd) : undefined}
          presets={[50, 100]}
          disabled={!sides.x}
          error={!sides.x ? `Range is below the price: ${x.symbol} not used` : amountX === null ? "Invalid amount" : null}
        />
        {sides.x && shortfall(x, amountX, balX)}
        <AmountInput
          label={`Deposit ${y.symbol}`}
          token={y}
          value={sides.y ? inputY : ""}
          onChange={setY}
          balance={balY.toString()}
          usd={amountY ? usdValue(amountY, y.decimals, y.priceUsd) : undefined}
          presets={[50, 100]}
          disabled={!sides.y}
          error={!sides.y ? `Range is above the price: ${y.symbol} not used` : amountY === null ? "Invalid amount" : null}
        />
        {sides.y && shortfall(y, amountY, balY)}
      </div>

      {(uiX > 0 || uiY > 0) && (
        <BinChart bins={chart} activeBinId={active} xLabel={x.symbol} yLabel={y.symbol} height={80} />
      )}

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
