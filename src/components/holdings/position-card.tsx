"use client";

import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { PairLogo, TokenLogo } from "@/components/token/token-logo";
import { TokenAmount } from "@/components/token/token-amount";
import { formatPercent, formatPrice, formatRelative, formatShare, formatUsd, usdValue } from "@/lib/format";
import type { PositionView, TokenInfo } from "@/lib/types";
import { BinChart } from "./bin-chart";
import { PriceRangeLine } from "./price-range-line";

const meteoraUrl = (lbPair: string) => `https://app.meteora.ag/dlmm/${lbPair}`;

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

      <PriceRangeLine
        lower={Number(range.lowerPrice)}
        upper={Number(range.upperPrice)}
        active={activePrice}
        inRange={range.inRange}
        quoteSymbol={y.symbol}
      />

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
        activeBinId={range.activeBinId}
        activePrice={activePrice}
        priceLabel={(binId) => `${formatPrice(binPrice(binId))} ${y.symbol}`}
      />

      {depositToken.mint !== x.mint && depositToken.mint !== y.mint && (
        <p className="text-[12px] text-muted">Neither side is the vault&apos;s deposit token.</p>
      )}
    </div>
  );
}
