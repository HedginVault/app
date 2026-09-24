"use client";

import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { PairLogo, TokenLogo } from "@/components/token/token-logo";
import { TokenAmount } from "@/components/token/token-amount";
import { formatPercent, formatPrice, formatRelative, formatShare, formatUsd, usdValue } from "@/lib/format";
import { formatLeverage, formatSignedPercent, formatSignedUsd, perpTotals, signTone, usdc } from "@/lib/perps";
import type { PhoenixPerpPositionView, PositionView, TokenInfo } from "@/lib/types";
import { PhoenixIcon } from "@/components/manage/powered-by";
import { BinChart } from "./bin-chart";

const meteoraUrl = (lbPair: string) => `https://app.meteora.ag/dlmm/${lbPair}`;

const LP_CELL_LABEL = "text-[11px] text-muted";

/** Price move from entry in the position's favour, as a fraction; null without an entry. */
const perpMove = (q: PhoenixPerpPositionView) => {
  const entry = Number(q.entryPrice);
  return entry > 0 ? ((q.side === "long" ? 1 : -1) * (Number(q.markPrice) - entry)) / entry : null;
};

/** Glyph shown on the compact icon buttons in the actions column, keyed by `MenuItem.label`. */
const actionIcon: Record<string, string> = {
  "Add liquidity": "+",
  "Remove liquidity": "−",
  "Claim fees": "$",
  "Close position": "✕",
};

function ValueBlock({
  usd,
  shareBps,
  align = "right",
}: {
  usd: number | null;
  shareBps: number | null;
  align?: "left" | "right";
}) {
  const alignClass = align === "left" ? "text-left" : "text-right";
  return (
    <div className={alignClass}>
      <div className="text-[15px] font-semibold tabular-nums">{formatUsd(usd)}</div>
      <div className="text-[12px] text-muted">{formatShare(shareBps)} of vault</div>
    </div>
  );
}

function PnlBlock({ usd, pct, align = "right" }: { usd: number | null; pct: number | null; align?: "left" | "right" }) {
  const alignClass = align === "left" ? "text-left" : "text-right";
  if (usd === null || pct === null) return <div className={`${alignClass} text-[12px] text-muted`}>—</div>;
  const positive = usd >= 0;
  const tone = positive ? "text-sky-400" : "text-red-400";
  const sign = positive ? "+" : "-";
  return (
    <div className={`${alignClass} text-[13px] font-medium tabular-nums ${tone}`}>
      {sign}
      {formatUsd(Math.abs(usd))}
      <span className="ml-1 text-[12px]">
        ({sign}
        {formatPercent(Math.abs(pct))})
      </span>
    </div>
  );
}

export function PositionCard({
  position: p,
  depositToken,
  actions,
}: {
  position: PositionView;
  depositToken: TokenInfo;
  actions?: MenuItem[];
}) {
  const primaryActions = (actions ?? []).filter((a) => a.primary);
  const menuActions = (actions ?? []).filter((a) => !a.primary);
  const menu = menuActions.length > 0 ? <Menu items={menuActions} /> : null;

  if (p.kind === "error") {
    return (
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {p.protocol === "phoenix" ? "Phoenix account" : "DLMM position"}
            <Badge tone="warning">Unreadable</Badge>
            <Address value={p.position} />
          </div>
          <div className="mt-0.5 text-[12px] text-muted">{p.reason}</div>
        </div>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <div className="text-right text-[15px] font-semibold tabular-nums text-muted">—</div>
          {menu}
        </div>
      </div>
    );
  }

  if (p.kind === "perp") {
    const totals = perpTotals(p);
    return (
      <div className="space-y-4 px-6 py-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
            <PhoenixIcon className="h-5" />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Phoenix Perps</span>
              <Badge>Cross margin</Badge>
              {p.positions.length > 0 && (
                <Badge tone="accent">
                  {p.positions.length} open {p.positions.length === 1 ? "position" : "positions"}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
              <Address value={p.traderAccount} />
              {p.lastActionTs > 0 && <span>Last action {formatRelative(p.lastActionTs)}</span>}
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
            <ValueBlock usd={p.usd} shareBps={p.shareBps} />
            {menu}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
          <div>
            <div className={LP_CELL_LABEL}>Collateral</div>
            <div className="text-[13px] font-medium tabular-nums">{formatUsd(usdc(p.collateral))}</div>
          </div>
          <div>
            <div className={LP_CELL_LABEL}>Unrealized PnL</div>
            <div className={cn("text-[13px] font-medium tabular-nums", signTone(totals.unrealizedPnl))}>{formatSignedUsd(totals.unrealizedPnl)}</div>
          </div>
          <div>
            <div className={LP_CELL_LABEL}>Leverage</div>
            <div className="text-[13px] font-medium tabular-nums">{formatLeverage(p.leverage)}</div>
          </div>
          <div>
            <div className={LP_CELL_LABEL}>Accrued funding</div>
            <div className={cn("text-[13px] font-medium tabular-nums", signTone(totals.accruedFunding))}>{formatSignedUsd(totals.accruedFunding)}</div>
          </div>
        </div>

        {p.positions.length === 0 ? (
          <p className="rounded-lg bg-white/[0.03] px-3 py-2.5 text-[12px] text-muted">No open positions. Collateral is idle in the account.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Table from sm up; stacked cards on phones. */}
            <table className="hidden w-full text-[13px] tabular-nums sm:table">
              <thead className="bg-white/[0.02] text-[11px] text-muted">
                <tr className="text-right [&>th:first-child]:text-left">
                  <th scope="col" className="px-3 py-2 font-normal">Market</th>
                  <th scope="col" className="px-3 py-2 font-normal">Size</th>
                  <th scope="col" className="px-3 py-2 font-normal">Entry</th>
                  <th scope="col" className="px-3 py-2 font-normal">Mark</th>
                  <th scope="col" className="px-3 py-2 font-normal">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.positions.map((q) => {
                  const move = perpMove(q);
                  return (
                    <tr key={q.assetId} className="text-right [&>td:first-child]:text-left">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <TokenLogo token={{ symbol: q.symbol, logo: q.logo }} size="sm" />
                          <span className="font-medium">{q.symbol}</span>
                          <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div>
                          {q.size} <span className="text-muted">{q.symbol}</span>
                        </div>
                        <div className="text-[11px] text-muted">{formatUsd(usdc(q.notional))}</div>
                      </td>
                      <td className="px-3 py-2.5">${formatPrice(Number(q.entryPrice))}</td>
                      <td className="px-3 py-2.5">${formatPrice(Number(q.markPrice))}</td>
                      <td className={cn("px-3 py-2.5", signTone(q.unrealizedPnl))}>
                        <div>{formatSignedUsd(q.unrealizedPnl)}</div>
                        {move !== null && <div className="text-[11px] opacity-80">{formatSignedPercent(move)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="divide-y divide-border sm:hidden">
              {p.positions.map((q) => {
                const move = perpMove(q);
                return (
                  <li key={q.assetId} className="space-y-2 p-3 text-[13px] tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <TokenLogo token={{ symbol: q.symbol, logo: q.logo }} size="sm" />
                        <span className="font-medium">{q.symbol}</span>
                        <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                      </span>
                      <span className={signTone(q.unrealizedPnl)}>
                        {formatSignedUsd(q.unrealizedPnl)}
                        {move !== null && <span className="ml-1 text-[11px] opacity-80">{formatSignedPercent(move)}</span>}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <dt className="text-[11px] text-muted">Size</dt>
                        <dd>
                          {q.size} {q.symbol}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted">Entry</dt>
                        <dd>${formatPrice(Number(q.entryPrice))}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted">Mark</dt>
                        <dd>${formatPrice(Number(q.markPrice))}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {BigInt(p.canonicalBalance) > 0n && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-amber-300">
            {formatUsd(usdc(p.canonicalBalance))} returned from Phoenix, awaiting unwrap.
          </p>
        )}
      </div>
    );
  }

  if (p.kind !== "lp") {
    return (
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <TokenLogo token={p.token} size="lg" />
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex items-center gap-2 text-sm font-medium">
            {p.token.symbol}
            <Badge>{p.kind === "idle" ? "Idle in vault" : "Held via Jupiter"}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
            <TokenAmount raw={p.amount} token={p.token} />
            {p.kind === "swap" && p.lastActionTs > 0 && <span>Last action {formatRelative(p.lastActionTs)}</span>}
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <ValueBlock usd={p.usd} shareBps={p.shareBps} />
          {menu}
        </div>
      </div>
    );
  }

  const { tokenX: x, tokenY: y, range } = p;
  const activePrice = Number(range.activePrice);
  const usdX = usdValue(p.amountX, x.decimals, x.priceUsd);
  const usdY = usdValue(p.amountY, y.decimals, y.priceUsd);
  const feeUsdX = usdValue(p.feeX, x.decimals, x.priceUsd);
  const feeUsdY = usdValue(p.feeY, y.decimals, y.priceUsd);
  const feesUsd = feeUsdX === null || feeUsdY === null ? null : feeUsdX + feeUsdY;
  /** Bin prices step geometrically from the active bin by `binStep` bps. */
  const binPrice = (binId: number) => activePrice * (1 + range.binStep / 10_000) ** (binId - range.activeBinId);

  return (
    <div className="space-y-4 px-6 py-5">
      <div className="flex flex-wrap items-start gap-3">
        <PairLogo x={x} y={y} size="lg" />
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {x.symbol}-{y.symbol}
            </span>
            <Badge>DLMM</Badge>
            <Badge tone={range.inRange ? "accent" : "warning"}>{range.inRange ? "In range" : "Out of range"}</Badge>
          </div>
          <a
            href={meteoraUrl(p.lbPair)}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-block text-[12px] text-muted hover:text-sky-400"
          >
            View pool on Meteora ↗
          </a>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <ValueBlock usd={p.usd} shareBps={p.shareBps} />
          <div className="flex items-center gap-1.5">
            {primaryActions.map((a) => (
              <button
                key={a.label}
                type="button"
                aria-label={a.label}
                title={a.disabled ? a.reason : a.label}
                disabled={a.disabled}
                onClick={a.onSelect}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  a.label === "Close position"
                    ? "bg-danger-soft text-red-300 hover:bg-red-400/30"
                    : "bg-white/[0.06] text-foreground hover:bg-white/[0.12]",
                )}
              >
                {actionIcon[a.label] ?? "•"}
              </button>
            ))}
            {menu}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        <div>
          <div className={LP_CELL_LABEL}>{x.symbol}</div>
          <TokenAmount raw={p.amountX} token={x} usd={usdX} />
        </div>
        <div>
          <div className={LP_CELL_LABEL}>{y.symbol}</div>
          <TokenAmount raw={p.amountY} token={y} usd={usdY} />
        </div>
        <div>
          <div className={LP_CELL_LABEL}>Unclaimed fees</div>
          <div className="leading-tight">
            <TokenAmount raw={p.feeX} token={x} />
            <br />
            <TokenAmount raw={p.feeY} token={y} />
            <div className="text-[12px] tabular-nums text-muted">{formatUsd(feesUsd)}</div>
          </div>
        </div>
        <div>
          <div className={LP_CELL_LABEL}>PNL</div>
          <PnlBlock usd={p.pnlUsd} pct={p.pnlPct} align="left" />
        </div>
      </div>

      <BinChart
        bins={p.bins}
        tokenX={x}
        tokenY={y}
        range={range}
        priceLabel={(binId) => `${formatPrice(binPrice(binId))} ${y.symbol}`}
      />

      {depositToken.mint !== x.mint && depositToken.mint !== y.mint && (
        <p className="text-[12px] text-muted">Neither side is the vault&apos;s deposit token.</p>
      )}
    </div>
  );
}
