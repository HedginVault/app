"use client";

import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { PairLogo, TokenLogo } from "@/components/token/token-logo";
import { TokenAmount } from "@/components/token/token-amount";
import {
  displayFraction,
  formatPercent,
  formatPrice,
  formatRelative,
  formatShare,
  formatTokenAmount,
  formatUsd,
  usdValue,
} from "@/lib/format";
import type { PositionView, TokenInfo } from "@/lib/types";
import { PriceRangeLine } from "./price-range-line";

const meteoraUrl = (lbPair: string) => `https://app.meteora.ag/dlmm/${lbPair}`;

/**
 * Fixed column template so every LP row lines up under the next one — a flex row sized to each
 * row's own content (the previous approach) drifts out of alignment as soon as amounts differ.
 * Mobile falls back to a 2-column stack; `sm:` switches to the real table-like grid.
 */
const LP_GRID =
  "grid grid-cols-2 gap-x-4 gap-y-2 px-6 py-3 sm:grid-cols-[8rem_10rem_8rem_8rem_6rem_6rem_auto] sm:items-center sm:gap-x-5 sm:gap-y-0";
const LP_CELL_LABEL = "text-[11px] text-muted";

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
  const tone = positive ? "text-emerald-400" : "text-red-400";
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
            DLMM position
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
  const price = Number(range.activePrice);
  const feesUsd =
    usdValue(p.feeX, x.decimals, x.priceUsd) === null || usdValue(p.feeY, y.decimals, y.priceUsd) === null
      ? null
      : usdValue(p.feeX, x.decimals, x.priceUsd)! + usdValue(p.feeY, y.decimals, y.priceUsd)!;
  const amount = (raw: string, token: TokenInfo) =>
    `${formatTokenAmount(raw, token.decimals, { maxFraction: displayFraction(raw, token.decimals) })} ${token.symbol}`;

  return (
    <div className={LP_GRID}>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <PairLogo x={x} y={y} size="sm" />
        <span className="text-[13px] font-medium">{x.symbol}-{y.symbol}</span>
        <a
          href={meteoraUrl(p.lbPair)}
          target="_blank"
          rel="noreferrer"
          aria-label="View pool on Meteora"
          title="View pool on Meteora"
          className="text-muted hover:text-emerald-400"
        >
          ↗
        </a>
      </div>

      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className={LP_CELL_LABEL}>Price range</div>
        <div className="flex items-center gap-1.5 text-[13px] tabular-nums">
          {formatPrice(Number(range.lowerPrice))} – {formatPrice(Number(range.upperPrice))}
          {!range.inRange && (
            <span title="Out of range" className="text-amber-400">
              ⚠
            </span>
          )}
        </div>
        <PriceRangeLine lower={Number(range.lowerPrice)} upper={Number(range.upperPrice)} active={price} inRange={range.inRange} />
      </div>

      <div>
        <div className={LP_CELL_LABEL}>Your liquidity</div>
        <div className="text-[13px] leading-tight tabular-nums">
          <div>{amount(p.amountX, x)}</div>
          <div className="text-muted">{amount(p.amountY, y)}</div>
        </div>
      </div>

      <div>
        <div className={LP_CELL_LABEL}>Claimable fees</div>
        <div className="text-[13px] leading-tight tabular-nums">
          <div>{amount(p.feeX, x)}</div>
          <div className="text-muted">{amount(p.feeY, y)}</div>
          <div className="text-[11px] text-muted">{formatUsd(feesUsd)}</div>
        </div>
      </div>

      <div>
        <div className={LP_CELL_LABEL}>PNL</div>
        <PnlBlock usd={p.pnlUsd} pct={p.pnlPct} align="left" />
      </div>

      <div>
        <div className={LP_CELL_LABEL}>Value</div>
        <ValueBlock usd={p.usd} shareBps={p.shareBps} align="left" />
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1.5 sm:col-span-1">
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

      {depositToken.mint !== x.mint && depositToken.mint !== y.mint && (
        <p className="col-span-2 text-[12px] text-muted sm:col-span-full">Neither side is the vault&apos;s deposit token.</p>
      )}
    </div>
  );
}
