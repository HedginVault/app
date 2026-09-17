"use client";

import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { PairLogo, TokenLogo } from "@/components/token/token-logo";
import { TokenAmount } from "@/components/token/token-amount";
import { formatRelative, formatShare, formatUsd, toUiNumber, usdValue } from "@/lib/format";
import type { PositionView, TokenInfo } from "@/lib/types";
import { BinChart } from "./bin-chart";
import { PriceRangeLine } from "./price-range-line";

const meteoraUrl = (lbPair: string) => `https://app.meteora.ag/dlmm/${lbPair}`;

function ValueBlock({ usd, shareBps }: { usd: number | null; shareBps: number | null }) {
  return (
    <div className="text-right">
      <div className="text-[15px] font-semibold tabular-nums">{formatUsd(usd)}</div>
      <div className="text-[12px] text-muted">{formatShare(shareBps)} of vault</div>
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
  const menu = actions && actions.length > 0 ? <Menu items={actions} /> : null;

  if (p.kind === "error") {
    return (
      <div className="flex items-center gap-3 px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            DLMM position
            <Badge tone="warning">Unreadable</Badge>
            <Address value={p.position} />
          </div>
          <div className="mt-0.5 text-[12px] text-muted">{p.reason}</div>
        </div>
        <div className="text-right text-[15px] font-semibold tabular-nums text-muted">—</div>
        {menu}
      </div>
    );
  }

  if (p.kind !== "lp") {
    return (
      <div className="flex items-center gap-3 px-6 py-4">
        <TokenLogo token={p.token} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {p.token.symbol}
            <Badge>{p.kind === "idle" ? "Idle in vault" : "Held via Jupiter"}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
            <TokenAmount raw={p.amount} token={p.token} />
            {p.kind === "swap" && p.lastActionTs > 0 && <span>Last action {formatRelative(p.lastActionTs)}</span>}
          </div>
        </div>
        <ValueBlock usd={p.usd} shareBps={p.shareBps} />
        {menu}
      </div>
    );
  }

  const { tokenX: x, tokenY: y, range } = p;
  const price = Number(range.activePrice);
  const bins = p.bins.map((b) => ({
    binId: b.binId,
    x: toUiNumber(b.amountX, x.decimals) * price,
    y: toUiNumber(b.amountY, y.decimals),
  }));
  const feesUsd =
    usdValue(p.feeX, x.decimals, x.priceUsd) === null || usdValue(p.feeY, y.decimals, y.priceUsd) === null
      ? null
      : usdValue(p.feeX, x.decimals, x.priceUsd)! + usdValue(p.feeY, y.decimals, y.priceUsd)!;

  return (
    <div className="space-y-4 px-6 py-4">
      <div className="flex items-center gap-3">
        <PairLogo x={x} y={y} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {x.symbol}-{y.symbol}
            <Badge>DLMM</Badge>
            <Badge tone={range.inRange ? "accent" : "warning"}>{range.inRange ? "In range" : "Out of range"}</Badge>
          </div>
          <a href={meteoraUrl(p.lbPair)} target="_blank" rel="noreferrer" className="text-[12px] text-emerald-400 hover:underline">
            View pool on Meteora ↗
          </a>
        </div>
        <ValueBlock usd={p.usd} shareBps={p.shareBps} />
        {menu}
      </div>

      <PriceRangeLine
        lower={Number(range.lowerPrice)}
        upper={Number(range.upperPrice)}
        active={price}
        inRange={range.inRange}
        quoteSymbol={y.symbol}
      />

      <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-[12px] text-muted">{x.symbol}</dt>
          <dd><TokenAmount raw={p.amountX} token={x} usd={usdValue(p.amountX, x.decimals, x.priceUsd)} /></dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">{y.symbol}</dt>
          <dd><TokenAmount raw={p.amountY} token={y} usd={usdValue(p.amountY, y.decimals, y.priceUsd)} /></dd>
        </div>
        <div>
          <dt
            className="cursor-help text-[12px] text-muted underline decoration-dotted underline-offset-2"
            title="Counted at 90% in NAV: the treasury takes 10% on claim"
          >
            Unclaimed fees
          </dt>
          <dd className="flex flex-col">
            <TokenAmount raw={p.feeX} token={x} />
            <TokenAmount raw={p.feeY} token={y} />
            <span className="text-[12px] text-muted">{formatUsd(feesUsd)}</span>
          </dd>
        </div>
      </dl>

      <BinChart bins={bins} activeBinId={range.activeBinId} xLabel={x.symbol} yLabel={y.symbol} height={72} />
      {depositToken.mint !== x.mint && depositToken.mint !== y.mint && (
        <p className="text-[12px] text-muted">Neither side is the vault&apos;s deposit token.</p>
      )}
    </div>
  );
}
