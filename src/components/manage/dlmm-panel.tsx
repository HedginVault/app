"use client";

import { useState, type ChangeEvent } from "react";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePool } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { DLMM_MAX_POSITION_WIDTH } from "@/lib/constants";
import { formatTokenAmount, parseTokenAmount } from "@/lib/format";
import type { BuiltTransaction, DlmmShape, DlmmStrategyView, VaultDetail } from "@/lib/types";

const selectClass =
  "h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

/** `maxActiveBinSlippage` is a bin count the route validates as an integer in 0..1000. */
const MAX_ACTIVE_BIN_SLIPPAGE = 1000;

/** Bin prices are geometric in the bin index: `activePrice * (1 + binStep/1e4) ^ (binId - activeId)`. */
const binPriceFrom = (activePrice: string, binStep: number, activeId: number, binId: number) =>
  (Number(activePrice) * Math.pow(1 + binStep / 10_000, binId - activeId)).toPrecision(6);

function CreatePosition({ v, owner }: { v: VaultDetail; owner: string }) {
  const { send, pending } = useSendTransaction();
  const [lbPair, setLbPair] = useState("");
  const [width, setWidth] = useState("69");
  const debouncedPair = useDebounce(lbPair.trim(), 400);
  const pool = usePool(debouncedPair.length >= 32 ? debouncedPair : undefined);
  const typed = Math.floor(Number(width) || 0);
  const w = Math.min(DLMM_MAX_POSITION_WIDTH, Math.max(1, typed));
  // The route rejects anything wider, so say so instead of silently submitting a different range.
  const clamped = typed > DLMM_MAX_POSITION_WIDTH;
  const lower = pool.data ? pool.data.activeBinId - Math.floor(w / 2) : null;
  // The requested upper bound is exclusive: the position account stores `upper - 1` as its last bin.
  const upper = lower !== null ? lower + w : null;

  return (
    <form
      className="grid gap-4 rounded-[10px] bg-slate-50 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = pool.data;
        if (!data) return;
        void send({
          label: "Create DLMM position",
          vault: v.address,
          build: () =>
            api.build<BuiltTransaction & { position: string }>("dlmm/initialize", {
              payer: owner,
              vault: v.address,
              lbPair: data.lbPair,
              width: w,
            }),
          onSuccess: () => setLbPair(""),
        });
      }}
    >
      <Field label="Pool (LB pair address)" error={pool.error ? pool.error.message : null}>
        <Input
          value={lbPair}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLbPair(e.target.value)}
          placeholder="Meteora DLMM pool address"
        />
      </Field>
      <Field
        label="Width (bins)"
        hint={`Centered on the active bin · 1–${DLMM_MAX_POSITION_WIDTH} bins`}
      >
        <Input
          inputMode="numeric"
          value={width}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setWidth(e.target.value)}
        />
        {clamped && (
          <span className="mt-1 block text-[12px] text-amber-700">
            A new position holds at most {DLMM_MAX_POSITION_WIDTH} bins — clamped to{" "}
            {DLMM_MAX_POSITION_WIDTH}.
          </span>
        )}
      </Field>
      <div className="text-[13px] sm:col-span-2">
        {pool.isFetching ? (
          <span className="text-muted">Loading pool…</span>
        ) : pool.data && lower !== null && upper !== null ? (
          <span>
            {pool.data.tokenX.symbol}/{pool.data.tokenY.symbol} · bin step {pool.data.binStep} ·
            active bin {pool.data.activeBinId} at {Number(pool.data.activePrice).toPrecision(6)} ·
            range{" "}
            <span className="font-medium tabular-nums">
              {lower}…{upper}
            </span>{" "}
            ({binPriceFrom(pool.data.activePrice, pool.data.binStep, pool.data.activeBinId, lower)} –{" "}
            {binPriceFrom(pool.data.activePrice, pool.data.binStep, pool.data.activeBinId, upper)}{" "}
            {pool.data.tokenY.symbol})
            <span className="mt-1 block text-muted">
              The upper bound is exclusive: the position will hold {w} bins and store{" "}
              <span className="tabular-nums">{upper - 1}</span> as its on-chain upper bin.
            </span>
          </span>
        ) : (
          <span className="text-muted">Enter a pool address to preview the range.</span>
        )}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" disabled={!pool.data} loading={pending}>
          Create position
        </Button>
      </div>
    </form>
  );
}

function PositionRow({ v, owner, s }: { v: VaultDetail; owner: string; s: DlmmStrategyView }) {
  const { send, pending } = useSendTransaction();
  const [open, setOpen] = useState<"add" | "remove" | null>(null);
  const [amountX, setAmountX] = useState("");
  const [amountY, setAmountY] = useState("");
  const [shape, setShape] = useState<DlmmShape>("spot");
  const [slippage, setSlippage] = useState("50");
  const [removePct, setRemovePct] = useState("100");
  const x = parseTokenAmount(amountX || "0", s.tokenX.decimals);
  const y = parseTokenAmount(amountY || "0", s.tokenY.decimals);
  // `dlmm/add` requires an integer in 0..1000 bins; clamp rather than let the route 400.
  const binSlippage = Math.min(
    MAX_ACTIVE_BIN_SLIPPAGE,
    Math.max(0, Math.floor(Number(slippage) || 0)),
  );
  const removeBps = Math.round(Number(removePct) * 100);
  const removeError = removeBps >= 1 && removeBps <= 10_000 ? null : "1–100";
  const empty = BigInt(s.amountX) === 0n && BigInt(s.amountY) === 0n;
  const noFees = BigInt(s.pendingFeeX) === 0n && BigInt(s.pendingFeeY) === 0n;
  const inRange = s.activeBinId >= s.lowerBinId && s.activeBinId <= s.upperBinId;

  return (
    <div className="rounded-[10px] border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-medium">
            {s.tokenX.symbol}/{s.tokenY.symbol} <Address value={s.position} />{" "}
            <span className={`text-[12px] ${inRange ? "text-emerald-700" : "text-amber-700"}`}>
              {inRange ? "in range" : "out of range"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[12px] text-muted">
            <span className="tabular-nums">
              bins {s.lowerBinId}…{s.upperBinId} · active {s.activeBinId}
            </span>{" "}
            · pool <Address value={s.lbPair} />
          </div>
        </div>
        <div className="text-right tabular-nums">
          <div>
            {formatTokenAmount(s.amountX, s.tokenX.decimals, { maxFraction: 4 })} {s.tokenX.symbol} ·{" "}
            {formatTokenAmount(s.amountY, s.tokenY.decimals, { maxFraction: 2 })} {s.tokenY.symbol}
          </div>
          <div className="text-[12px] text-muted">
            fees {formatTokenAmount(s.pendingFeeX, s.tokenX.decimals, { maxFraction: 4 })}{" "}
            {s.tokenX.symbol} ·{" "}
            {formatTokenAmount(s.pendingFeeY, s.tokenY.decimals, { maxFraction: 4 })}{" "}
            {s.tokenY.symbol}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(open === "add" ? null : "add")}
        >
          Add liquidity
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(open === "remove" ? null : "remove")}
          disabled={empty}
        >
          Remove
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          disabled={noFees}
          onClick={() =>
            void send({
              label: "Claim DLMM fees",
              vault: v.address,
              build: () =>
                api.build("dlmm/claim-fee", {
                  payer: owner,
                  vault: v.address,
                  position: s.position,
                }),
            })
          }
        >
          Claim fees
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          disabled={!empty}
          title={empty ? undefined : "Remove all liquidity first"}
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
      </div>
      {open === "add" && (
        <form
          className="grid gap-3 border-t border-border bg-slate-50 px-4 py-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (x === null || y === null || (x === 0n && y === 0n)) return;
            void send({
              label: "Add liquidity",
              vault: v.address,
              build: () =>
                api.build("dlmm/add", {
                  payer: owner,
                  vault: v.address,
                  position: s.position,
                  amountX: x.toString(),
                  amountY: y.toString(),
                  shape,
                  maxActiveBinSlippage: binSlippage,
                }),
              onSuccess: () => {
                setAmountX("");
                setAmountY("");
                setOpen(null);
              },
            });
          }}
        >
          <Field label={`${s.tokenX.symbol} amount`} error={x === null ? "Invalid" : null}>
            <Input
              inputMode="decimal"
              value={amountX}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAmountX(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label={`${s.tokenY.symbol} amount`} error={y === null ? "Invalid" : null}>
            <Input
              inputMode="decimal"
              value={amountY}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAmountY(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Shape">
            <select
              className={selectClass}
              value={shape}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setShape(e.target.value as DlmmShape)}
            >
              <option value="spot">Spot</option>
              <option value="curve">Curve</option>
              <option value="bidAsk">Bid-Ask</option>
            </select>
          </Field>
          <Field label="Max active bin slippage" hint={`0–${MAX_ACTIVE_BIN_SLIPPAGE} bins`}>
            <Input
              inputMode="numeric"
              value={slippage}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSlippage(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-4">
            <Button
              type="submit"
              size="sm"
              loading={pending}
              disabled={x === null || y === null || (x === 0n && y === 0n)}
            >
              Add liquidity
            </Button>
          </div>
        </form>
      )}
      {open === "remove" && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-border bg-slate-50 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (removeError) return;
            void send({
              label: "Remove liquidity",
              vault: v.address,
              build: () =>
                api.build("dlmm/remove", {
                  payer: owner,
                  vault: v.address,
                  position: s.position,
                  bpsToRemove: removeBps,
                }),
              onSuccess: () => setOpen(null),
            });
          }}
        >
          <Field label="Percentage to remove" hint="1–100" error={removeError}>
            <Input
              inputMode="decimal"
              value={removePct}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRemovePct(e.target.value)}
              className="w-32"
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            variant="danger"
            loading={pending}
            disabled={!!removeError}
          >
            Remove liquidity
          </Button>
        </form>
      )}
    </div>
  );
}

export function DlmmPanel({
  v,
  owner,
  strategies,
}: {
  v: VaultDetail;
  owner: string;
  strategies: DlmmStrategyView[];
}) {
  return (
    <Card>
      <CardHeader
        title="Meteora DLMM positions"
        description="Each position is a strategy record. Token ATAs for the pool are created on the first liquidity action."
      />
      <CardBody className="space-y-4">
        {strategies.length === 0 && <p className="text-sm text-muted">No DLMM positions yet.</p>}
        {strategies.map((s) => (
          <PositionRow key={s.address} v={v} owner={owner} s={s} />
        ))}
        <CreatePosition v={v} owner={owner} />
      </CardBody>
    </Card>
  );
}
