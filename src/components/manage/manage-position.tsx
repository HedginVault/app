"use client";

import { useState } from "react";
import { AmountInput } from "@/components/token/amount-input";
import { PairLogo } from "@/components/token/token-logo";
import { TokenAmount } from "@/components/token/token-amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { DLMM_INITIAL_POSITION_WIDTH } from "@/lib/constants";
import { sidesForRange } from "@/lib/dlmm-range";
import { formatPrice, formatUsd, parseTokenAmount, usdValue } from "@/lib/format";
import type { LpMode } from "@/lib/panel-params";
import { isOperational } from "@/lib/swap-logic";
import type { DlmmShape, HoldingsView, LpPositionView, VaultDetail } from "@/lib/types";
import { ACTIVE_BIN_SLIPPAGE, SHAPES, vaultBalance } from "./liquidity-card";
import { ReviewDialog } from "./review-dialog";

const REMOVE_PRESETS = [25, 50, 75, 100];

export function ManagePosition({
  v,
  owner,
  holdings,
  position: p,
  mode,
  onModeChange,
  onDone,
  onSwapFor,
}: {
  v: VaultDetail;
  owner: string;
  holdings: HoldingsView;
  position: LpPositionView;
  mode: LpMode;
  onModeChange: (mode: LpMode) => void;
  onDone: () => void;
  onSwapFor: (p: { to: string; amount?: string }) => void;
}) {
  const { tokenX: x, tokenY: y, range } = p;
  const wide = range.upperBinId - range.lowerBinId + 1 > DLMM_INITIAL_POSITION_WIDTH;
  const hasDepositMint = x.mint === v.depositMint || y.mint === v.depositMint;
  const { send, pending } = useSendTransaction();
  const [reviewing, setReviewing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [zapping, setZapping] = useState(false);
  const [inputX, setInputX] = useState("");
  const [inputY, setInputY] = useState("");
  const [shape, setShape] = useState<DlmmShape>("spot");
  const [pct, setPct] = useState(100);
  const operational = isOperational(v);
  const sides = sidesForRange({ lowerBinId: range.lowerBinId, upperBinId: range.upperBinId + 1 }, range.activeBinId);

  const amountX = sides.x ? parseTokenAmount(inputX || "0", x.decimals) : 0n;
  const amountY = sides.y ? parseTokenAmount(inputY || "0", y.decimals) : 0n;
  const balX = vaultBalance(holdings, x.mint);
  const balY = vaultBalance(holdings, y.mint);
  const removeX = (BigInt(p.amountX) * BigInt(pct)) / 100n;
  const removeY = (BigInt(p.amountY) * BigInt(pct)) / 100n;
  const hasFees = BigInt(p.feeX) > 0n || BigInt(p.feeY) > 0n;

  const run = (label: string, path: string, body: Record<string, unknown>) =>
    void send({
      label,
      vault: v.address,
      build: () => api.build(path, { payer: owner, vault: v.address, ...body }),
      onSuccess: () => {
        setReviewing(false);
        setInputX("");
        setInputY("");
        if (mode !== "add") onDone();
      },
    });

  const addInvalid = amountX === null || amountY === null || (amountX === 0n && amountY === 0n);
  const addShort = (amountX ?? 0n) > balX || (amountY ?? 0n) > balY;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PairLogo x={x} y={y} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{x.symbol}-{y.symbol} position</div>
          <div className="text-[12px] tabular-nums text-muted">
            {formatPrice(Number(range.lowerPrice))} – {formatPrice(Number(range.upperPrice))} {y.symbol}
          </div>
        </div>
        <Badge tone={range.inRange ? "accent" : "warning"}>{range.inRange ? "In range" : "Out of range"}</Badge>
      </div>

      <Segmented
        value={mode}
        onChange={onModeChange}
        options={[
          { id: "add", label: "Add" },
          { id: "remove", label: "Remove" },
          { id: "claim", label: "Claim fees" },
        ]}
      />

      {mode === "add" && (
        <div className="space-y-2">
          <AmountInput label={`Add ${x.symbol}`} token={x} value={sides.x ? inputX : ""} onChange={setInputX} balance={balX.toString()} presets={[50, 100]} disabled={!sides.x}
            usd={amountX ? usdValue(amountX, x.decimals, x.priceUsd) : undefined}
            error={!sides.x ? `Position range is below the price: ${x.symbol} not used` : amountX === null ? "Invalid amount" : null} />
          <AmountInput label={`Add ${y.symbol}`} token={y} value={sides.y ? inputY : ""} onChange={setInputY} balance={balY.toString()} presets={[50, 100]} disabled={!sides.y}
            usd={amountY ? usdValue(amountY, y.decimals, y.priceUsd) : undefined}
            error={!sides.y ? `Position range is above the price: ${y.symbol} not used` : amountY === null ? "Invalid amount" : null} />
          {addShort && (
            <div className="flex items-center justify-between rounded-[10px] bg-warning-soft px-3 py-2 text-[12px] text-amber-200">
              <span>Not enough in the vault</span>
              <Button size="sm" variant="secondary" onClick={() => onSwapFor({ to: (amountX ?? 0n) > balX ? x.mint : y.mint })}>
                Swap for {(amountX ?? 0n) > balX ? x.symbol : y.symbol}
              </Button>
            </div>
          )}
          <Segmented size="sm" value={shape} onChange={setShape} options={SHAPES} />
          <Button className="w-full" disabled={!operational || addInvalid || addShort} onClick={() => setReviewing(true)}>
            {!operational ? "Vault not operational" : addShort ? "Insufficient vault balance" : addInvalid ? "Enter an amount" : "Review"}
          </Button>
        </div>
      )}

      {mode === "remove" && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {REMOVE_PRESETS.map((n) => (
              <Button key={n} size="sm" variant={pct === n ? "primary" : "secondary"} onClick={() => setPct(n)}>{n}%</Button>
            ))}
          </div>
          <Slider min={1} max={100} value={pct} onChange={setPct} aria-label="Percent to remove" />
          <dl className="space-y-1 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted">You get back</dt><dd><TokenAmount raw={removeX} token={x} align="right" usd={usdValue(removeX, x.decimals, x.priceUsd)} /></dd></div>
            <div className="flex justify-between"><dt /><dd><TokenAmount raw={removeY} token={y} align="right" usd={usdValue(removeY, y.decimals, y.priceUsd)} /></dd></div>
          </dl>
          <Button className="w-full" disabled={!operational || (BigInt(p.amountX) === 0n && BigInt(p.amountY) === 0n)} onClick={() => setReviewing(true)}>
            {operational ? `Review removing ${pct}%` : "Vault not operational"}
          </Button>
        </div>
      )}

      {mode === "claim" && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <TokenAmount raw={p.feeX} token={x} usd={usdValue(p.feeX, x.decimals, x.priceUsd)} />
            <TokenAmount raw={p.feeY} token={y} usd={usdValue(p.feeY, y.decimals, y.priceUsd)} />
          </div>
          <p className="text-[12px] text-muted">10% of claimed fees goes to the protocol treasury.</p>
          <Button className="w-full" disabled={!operational || !hasFees} onClick={() => setReviewing(true)}>
            {!operational ? "Vault not operational" : hasFees ? "Review claim" : "No fees to claim"}
          </Button>
        </div>
      )}

      <Button
        className="w-full"
        loading={pending}
        disabled={!operational || wide || !hasDepositMint}
        onClick={() => setZapping(true)}
      >
        Zap out to {v.depositSymbol}
      </Button>
      {wide && <p className="text-[12px] text-muted">For wide positions, remove liquidity and claim fees, then close the empty position. Swap returned non-deposit tokens separately.</p>}
      {!hasDepositMint && <p className="text-[12px] text-muted">Atomic zap out requires this pool to include {v.depositSymbol}.</p>}

      <Button
        variant="secondary"
        className="w-full"
        loading={pending}
        disabled={!operational || (wide && !p.closable)}
        onClick={() => setClosing(true)}
      >
        Close position
      </Button>

      <ConfirmDialog
        open={zapping}
        onClose={() => setZapping(false)}
        title={`Zap ${x.symbol}-${y.symbol} to ${v.depositSymbol}`}
        confirmLabel={`Zap out to ${v.depositSymbol}`}
        pending={pending}
        onConfirm={() =>
          run("Zap out", "dlmm/zap-out", {
            position: p.position,
            slippageBps: Math.min(50, v.protocol.maxSlippageBps),
          })
        }
      >
        In one atomic transaction, all liquidity is removed, fees are claimed, and only the non-{v.depositSymbol} balance added by this position is swapped through Jupiter. If the swap fails, the position stays open. Rent from the closed position is returned to your wallet; creating missing treasury or Jupiter strategy accounts can still cost rent.
      </ConfirmDialog>

      <ConfirmDialog
        open={closing}
        onClose={() => setClosing(false)}
        title={`Close ${x.symbol}-${y.symbol} position`}
        confirmLabel="Close position"
        pending={pending}
        onConfirm={() => run("Close position", "dlmm/close", { position: p.position })}
      >
        {wide
          ? "Remove all liquidity and claim fees first. The program closes this position only when every bin is empty."
          : p.closable
          ? "This empty position and its strategy are closed. Rent returns to your wallet."
          : "All liquidity is removed and fees claimed, then the position is closed. Rent returns to your wallet."}
      </ConfirmDialog>

      <ReviewDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        pending={pending}
        title={mode === "add" ? "Review add liquidity" : mode === "remove" ? "Review remove liquidity" : "Review fee claim"}
        confirmLabel={mode === "add" ? "Add liquidity" : mode === "remove" ? `Remove ${pct}%` : "Claim fees"}
        onConfirm={() =>
          mode === "add"
            ? run("Add liquidity", "dlmm/add", {
                position: p.position,
                amountX: (amountX ?? 0n).toString(),
                amountY: (amountY ?? 0n).toString(),
                shape,
                maxActiveBinSlippage: ACTIVE_BIN_SLIPPAGE,
              })
            : mode === "remove"
              ? run("Remove liquidity", "dlmm/remove", { position: p.position, bpsToRemove: pct * 100 })
              : run("Claim fees", "dlmm/claim-fee", { position: p.position })
        }
        rows={
          mode === "add"
            ? [
                { label: x.symbol, value: `${inputX || "0"} (${formatUsd(usdValue(amountX ?? 0n, x.decimals, x.priceUsd))})` },
                { label: y.symbol, value: `${inputY || "0"} (${formatUsd(usdValue(amountY ?? 0n, y.decimals, y.priceUsd))})` },
                { label: "Shape", value: SHAPES.find((s) => s.id === shape)!.label },
              ]
            : mode === "remove"
              ? [
                  { label: "Remove", value: `${pct}%` },
                  { label: `${x.symbol} back`, value: <TokenAmount raw={removeX} token={x} align="right" /> },
                  { label: `${y.symbol} back`, value: <TokenAmount raw={removeY} token={y} align="right" /> },
                ]
              : [
                  { label: `${x.symbol} fees`, value: <TokenAmount raw={p.feeX} token={x} align="right" /> },
                  { label: `${y.symbol} fees`, value: <TokenAmount raw={p.feeY} token={y} align="right" /> },
                ]
        }
        notes={[
          ...(mode === "claim" ? ["10% of claimed fees goes to the protocol treasury."] : []),
          ...(wide ? ["This wide position is processed in smaller ranges and sent after one batch wallet approval."] : []),
        ]}
      />
    </div>
  );
}
