"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useOrderBook, type MarketStats } from "@/hooks/use-phoenix-live";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import {
  estimateLiquidationPrice,
  floorToLots,
  formatBaseSize,
  formatLeverage,
  formatMarketPrice,
  lotStep,
  postTradeNotional,
  priceDecimals,
  usdc,
  walkBook,
} from "@/lib/perps";
import { isOperational } from "@/lib/swap-logic";
import type { PerpPositionView, PhoenixManagerView, PhoenixMarketView, VaultDetail } from "@/lib/types";
import { PoweredBy } from "../powered-by";
import { ReviewDialog, type ReviewRow } from "../review-dialog";

type Side = "long" | "short";
type OrderType = "market" | "limit";
/** What the amount field means: USDC margin (size = margin × leverage) or the position size in the asset. */
type Unit = "usdc" | "base";

const SLIPPAGE_PRESETS = [10, 50, 100, 200];
const PERCENTS = [25, 50, 75, 100];
const DECIMAL = /^\d*\.?\d*$/;

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: "warn" | "danger" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className={cn("tabular-nums", tone === "warn" && "text-amber-300", tone === "danger" && "text-red-300")}>{children}</span>
    </div>
  );
}

/** A toggle styled like the rest of the app's checkboxes, with a 40px hit area. */
function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint: string }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px]" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

export interface PickedPrice {
  price: number;
  seq: number;
}

/** Order entry for the selected market: side, type, amount in USDC margin or asset size, leverage. */
export function OrderTicket({
  v,
  owner,
  m,
  market,
  stats,
  account,
  picked,
  onAddCollateral,
}: {
  v: VaultDetail;
  owner: string;
  m: PhoenixManagerView;
  market: PhoenixMarketView;
  stats: MarketStats | undefined;
  account: PerpPositionView | undefined;
  /** A price clicked in the order book; switches to a limit order at that price. */
  picked: PickedPrice | null;
  /** Opens the account panel's collateral section on "Add", when the ticket runs short of margin. */
  onAddCollateral: () => void;
}) {
  const { send, pending } = useSendTransaction();
  const { book } = useOrderBook(market.symbol);
  const [side, setSide] = useState<Side>("long");
  const [type, setType] = useState<OrderType>("market");
  const [unit, setUnit] = useState<Unit>("usdc");
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(() => Math.min(5, market.maxLeverage));
  const [limitPrice, setLimitPrice] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [slipOpen, setSlipOpen] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const decimals = priceDecimals(market);
  // A new market starts clean: its units, price scale and leverage cap all differ.
  const [symbol, setSymbol] = useState(market.symbol);
  if (symbol !== market.symbol) {
    setSymbol(market.symbol);
    setAmount("");
    setLimitPrice("");
    setLeverage(Math.min(leverage, market.maxLeverage));
  }
  // A price clicked in the book turns the ticket into a limit order at that price.
  const [pickedSeq, setPickedSeq] = useState(picked?.seq ?? 0);
  if (picked && picked.seq !== pickedSeq) {
    setPickedSeq(picked.seq);
    setType("limit");
    setLimitPrice(picked.price.toFixed(decimals));
  }

  const mark = stats?.markPrice ?? Number(market.markPrice);
  const levels = side === "long" ? book?.asks : book?.bids;
  const limit = type === "limit" ? Number(limitPrice) : NaN;
  // Sizing uses the limit, or for a market order the mark; the book walk below refines the expected fill.
  const refPrice = type === "limit" ? limit : mark;
  const typed = Number(amount);
  const lev = Math.max(1, Math.min(leverage, market.maxLeverage));
  const rawBase = !(typed > 0) || !(refPrice > 0) ? 0 : unit === "usdc" ? (typed * lev) / refPrice : typed;
  const size = floorToLots(rawBase, market.baseLotsDecimals);
  const base = Number(size);
  const fill = type === "market" && base > 0 && levels ? walkBook(levels, base) : null;
  const fillPrice = type === "market" ? fill?.avgPrice ?? mark : limit;
  const notional = base * (fillPrice > 0 ? fillPrice : mark);
  const margin = notional / lev;
  const impact = fill && mark > 0 ? (fill.avgPrice - mark) / mark : null;
  const takerFee = type === "market" || !postOnly;
  const fee = notional * (takerFee ? market.takerFee : market.makerFee);

  // Account state (perp-api, USDC atoms), and this market's open position (on-chain).
  const acct = m.account;
  const equity = acct ? usdc(acct.equity) : account ? usdc(account.equity) : null;
  const available = acct ? Math.max(0, usdc(acct.equity) - usdc(acct.initialMargin)) : null;
  const position = account?.positions.find((q) => q.symbol === market.symbol);
  const current = position ? (position.side === "long" ? 1 : -1) * Number(position.size) : 0;
  const reducing = current !== 0 && Math.sign(current) !== (side === "long" ? 1 : -1);
  const delta = (side === "long" ? 1 : -1) * base;
  const after = reduceOnly && reducing ? (Math.abs(delta) > Math.abs(current) ? 0 : current + delta) : current + delta;
  const r = market.maintenanceFactor / market.maxLeverage;
  const liq =
    acct && base > 0
      ? estimateLiquidationPrice({
          equity: usdc(acct.equity) - fee + (side === "long" ? 1 : -1) * base * (mark - fillPrice),
          otherMaintenance: Math.max(0, usdc(acct.maintenanceMargin) - Math.abs(current) * mark * r),
          size: after,
          mark,
          maxLeverage: market.maxLeverage,
          maintenanceFactor: market.maintenanceFactor,
        })
      : null;
  const accountLeverage =
    equity && equity > 0 && base > 0
      ? postTradeNotional(account?.positions ?? [], { symbol: market.symbol, side, size: base, price: mark }) / equity
      : null;

  const maxBase = unit === "base" && available !== null && refPrice > 0 ? (reduceOnly && reducing ? Math.abs(current) : (available * lev) / refPrice) : null;
  const setPercent = (pct: number) => {
    if (reduceOnly && reducing) {
      const units = (Math.abs(current) * pct) / 100;
      setUnit("base");
      setAmount(floorToLots(units, market.baseLotsDecimals));
    } else if (unit === "usdc" && available !== null) setAmount(((available * pct) / 100).toFixed(2));
    else if (maxBase !== null) setAmount(floorToLots((maxBase * pct) / 100, market.baseLotsDecimals));
  };
  const switchUnit = (next: Unit) => {
    if (next === unit) return;
    // Carry the amount across so switching only changes how it is expressed.
    if (typed > 0 && refPrice > 0) setAmount(next === "base" ? size : margin.toFixed(2));
    setUnit(next);
  };

  const increasing = !reduceOnly && !(reducing && Math.abs(delta) <= Math.abs(current));
  const operational = isOperational(v);
  const exitOnly = v.status !== "paused" && v.protocol.status !== "paused";
  const error = (() => {
    if (!(mark > 0)) return "No mark price";
    if (type === "limit" && limitPrice && !(limit > 0)) return "Enter a limit price";
    if (!amount) return null;
    if (!(typed > 0)) return "Enter an amount";
    if (base <= 0) return `Minimum size ${lotStep(market.baseLotsDecimals)} ${market.symbol}`;
    if (reduceOnly && !reducing) return "Nothing to reduce on this side";
    if (increasing && available !== null && margin > available + 1e-6) return "Insufficient margin";
    if (type === "market" && fill && fill.filled < base) return "Not enough liquidity on the book";
    if (type === "market" && impact !== null && Math.abs(impact) * 10_000 > slippageBps) return "Price impact above slippage";
    return null;
  })();
  const allowed = operational || (exitOnly && type === "market" && reduceOnly);
  const ready = !error && base > 0 && (type === "market" || limit > 0) && allowed;
  const cta = !allowed
    ? "Vault not operational"
    : error ?? (base > 0 ? `${side === "long" ? "Long" : "Short"} ${formatBaseSize(base, market.baseLotsDecimals)} ${market.symbol}` : "Enter an amount");

  const rows: ReviewRow[] = [
    { label: "Market", value: `${market.symbol}-PERP` },
    { label: "Side", value: side === "long" ? "Long" : "Short" },
    { label: "Size", value: `${formatBaseSize(base, market.baseLotsDecimals)} ${market.symbol} (${formatUsd(notional)})` },
    type === "market"
      ? { label: "Est. fill", value: `$${formatMarketPrice(fillPrice, decimals)} (max ${slippageBps / 100}% from mark)` }
      : { label: "Limit price", value: `$${formatMarketPrice(limit, decimals)}${postOnly ? ", post-only" : ""}` },
    ...(increasing ? [{ label: "Margin", value: `${formatUsd(margin)} at ${lev}x` }] : []),
    { label: takerFee ? "Fee (taker)" : "Fee (maker)", value: formatUsd(fee) },
    { label: "Est. liquidation", value: liq ? `$${formatMarketPrice(liq, decimals)}` : "—" },
    ...(accountLeverage !== null ? [{ label: "Account leverage", value: formatLeverage(accountLeverage), tone: accountLeverage > market.maxLeverage / 2 ? ("warn" as const) : undefined }] : []),
  ];

  const submit = () =>
    void send({
      label: `${side === "long" ? "Long" : "Short"} ${size} ${market.symbol}`,
      vault: v.address,
      build: () =>
        api.build("phoenix/order", {
          payer: owner,
          vault: v.address,
          symbol: market.symbol,
          side,
          size,
          reduceOnly,
          order: type === "market" ? { type, slippageBps } : { type, price: limit.toFixed(decimals), postOnly },
        }),
      onSuccess: () => {
        setReviewing(false);
        setAmount("");
      },
    });

  const tone = side === "long" ? "green" : "red";
  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="pt-2">
          <PoweredBy protocol="phoenix" />
        </div>
        <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
          {(["long", "short"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={cn(
                "h-10 rounded-lg text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-sky-400",
                side === s ? (s === "long" ? "bg-emerald-400 text-accent-foreground" : "bg-red-400 text-white") : "text-muted hover:text-foreground",
              )}
            >
              {s === "long" ? "Long" : "Short"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div role="tablist" className="flex gap-4">
            {(["market", "limit"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={type === t}
                onClick={() => setType(t)}
                className={cn("min-h-10 text-[13px] font-medium", type === t ? "text-white" : "text-muted hover:text-foreground")}
              >
                {t === "market" ? "Market" : "Limit"}
              </button>
            ))}
          </div>
          {type === "market" && (
            <Popover
              open={slipOpen}
              onOpenChange={setSlipOpen}
              trigger={
                <button type="button" onClick={() => setSlipOpen((o) => !o)} className="min-h-10 rounded-md px-2 text-[12px] text-muted hover:text-foreground">
                  Slippage {slippageBps / 100}%
                </button>
              }
            >
              <div className="flex gap-1 p-1">
                {SLIPPAGE_PRESETS.map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => {
                      setSlippageBps(bps);
                      setSlipOpen(false);
                    }}
                    className={cn("h-9 rounded-md px-2.5 text-[12px] tabular-nums", bps === slippageBps ? "bg-white/10 text-white" : "text-muted hover:bg-white/[0.06]")}
                  >
                    {bps / 100}%
                  </button>
                ))}
              </div>
            </Popover>
          )}
        </div>

        {type === "limit" && (
          <div>
            <label htmlFor="perp-limit" className="mb-1.5 flex justify-between text-[12px] text-muted">
              <span>Limit price</span>
              <button type="button" onClick={() => setLimitPrice(mark.toFixed(decimals))} className="text-sky-400 hover:text-sky-300">
                Mark ${formatMarketPrice(mark, decimals)}
              </button>
            </label>
            <div className="flex h-11 items-center rounded-xl border border-border bg-white/[0.03] px-3 focus-within:border-accent">
              <input
                id="perp-limit"
                inputMode="decimal"
                autoComplete="off"
                placeholder={mark.toFixed(decimals)}
                value={limitPrice}
                onChange={(e) => DECIMAL.test(e.target.value) && setLimitPrice(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[15px] tabular-nums outline-none placeholder:text-white/30"
              />
              <span className="text-[13px] text-muted">USD</span>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex justify-between text-[12px] text-muted">
            <label htmlFor="perp-amount">{unit === "usdc" ? "Margin" : "Size"}</label>
            <span className="tabular-nums">
              Available {available === null ? "—" : formatUsd(available)}
              {increasing && available !== null && available < 1 && (
                <button type="button" onClick={onAddCollateral} className="ml-2 text-sky-400 hover:text-sky-300">
                  Add collateral
                </button>
              )}
            </span>
          </div>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-border bg-white/[0.03] pl-3 pr-1 focus-within:border-accent">
            <input
              id="perp-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(e) => DECIMAL.test(e.target.value) && setAmount(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tabular-nums outline-none placeholder:text-white/30"
            />
            <div role="radiogroup" aria-label="Amount unit" className="flex gap-0.5 rounded-lg bg-white/[0.06] p-0.5">
              {(["usdc", "base"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u}
                  onClick={() => switchUnit(u)}
                  className={cn("h-9 rounded-md px-2.5 text-[12px] font-medium", unit === u ? "bg-white/10 text-white" : "text-muted hover:text-foreground")}
                >
                  {u === "usdc" ? "USDC" : market.symbol}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] tabular-nums">
            <span className="text-muted">
              {base > 0
                ? unit === "usdc"
                  ? `≈ ${formatBaseSize(base, market.baseLotsDecimals)} ${market.symbol} · ${formatUsd(notional)}`
                  : `${formatUsd(notional)} · ${formatUsd(margin)} margin`
                : `Step ${lotStep(market.baseLotsDecimals)} ${market.symbol}`}
            </span>
            <span className="flex gap-0.5">
              {PERCENTS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercent(pct)}
                  disabled={available === null && !(reduceOnly && reducing)}
                  className="h-7 rounded-md px-1.5 font-medium text-sky-400 hover:bg-accent-soft disabled:text-white/30"
                >
                  {pct === 100 ? "Max" : `${pct}%`}
                </button>
              ))}
            </span>
          </div>
        </div>

        {!(reduceOnly && reducing) && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-muted">Leverage</span>
              <span className="flex items-center gap-1">
                <input
                  aria-label="Leverage"
                  inputMode="numeric"
                  value={leverage}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ""));
                    setLeverage(Math.min(market.maxLeverage, Math.max(1, n || 1)));
                  }}
                  className="h-7 w-10 rounded-md border border-border bg-white/[0.03] text-center text-[12px] tabular-nums focus:border-accent focus:outline-none"
                />
                <span className="text-muted">x</span>
              </span>
            </div>
            <Slider min={1} max={market.maxLeverage} value={lev} onChange={setLeverage} aria-label="Leverage slider" />
            <div className="mt-1 flex justify-between text-[11px] text-muted tabular-nums">
              <span>1x</span>
              <span>{Math.round(market.maxLeverage / 2)}x</span>
              <span>{market.maxLeverage}x max</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-5">
          <Toggle label="Reduce only" checked={reduceOnly} onChange={setReduceOnly} hint="Only shrink an open position; never open or flip one." />
          {type === "limit" && (
            <Toggle label="Post only" checked={postOnly} onChange={setPostOnly} hint="Rest on the book and pay the maker fee; fail instead of taking." />
          )}
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <Row label={type === "market" ? "Est. fill price" : "Order value"}>
            {type === "market" ? (fill ? `$${formatMarketPrice(fill.avgPrice, decimals)}` : "—") : base > 0 ? formatUsd(notional) : "—"}
          </Row>
          {type === "market" && (
            <Row label="Price impact" tone={impact !== null && Math.abs(impact) * 10_000 > slippageBps ? "danger" : undefined}>
              {impact === null ? "—" : `${(Math.abs(impact) * 100).toFixed(3)}%`}
            </Row>
          )}
          <Row label="Est. liquidation price">{liq ? `$${formatMarketPrice(liq, decimals)}` : "—"}</Row>
          <Row label="Account leverage" tone={accountLeverage !== null && accountLeverage > market.maxLeverage / 2 ? "warn" : undefined}>
            {accountLeverage === null ? "—" : formatLeverage(accountLeverage)}
          </Row>
          <Row label={takerFee ? "Fee (taker)" : "Fee (maker)"}>
            {base > 0 ? formatUsd(fee) : `${((takerFee ? market.takerFee : market.makerFee) * 100).toFixed(3)}%`}
          </Row>
        </div>

        <button
          type="button"
          disabled={!ready}
          onClick={() => setReviewing(true)}
          className={cn(
            "h-12 w-full rounded-xl text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/40",
            tone === "green" ? "bg-emerald-400 text-accent-foreground hover:bg-emerald-300" : "bg-red-400 text-white hover:bg-red-300",
          )}
        >
          {cta}
        </button>
        {error === "Insufficient margin" && (
          <button type="button" onClick={onAddCollateral} className="-mt-2 w-full text-center text-[12px] text-sky-400 hover:text-sky-300">
            Move idle vault USDC into Phoenix
          </button>
        )}
      </div>
      <ReviewDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={`${side === "long" ? "Long" : "Short"} ${market.symbol}-PERP`}
        rows={rows}
        notes={[
          type === "market"
            ? `Fills in full within ${slippageBps / 100}% of the mark, or fails without trading.`
            : postOnly
              ? "Rests on the book; fails rather than taking liquidity."
              : "Takes liquidity up to the limit, then rests.",
          "Phoenix rejects any order that would leave the account liquidatable.",
        ]}
        confirmLabel={`Place ${side}`}
        onConfirm={submit}
        pending={pending}
      />
    </Card>
  );
}
