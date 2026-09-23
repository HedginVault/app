"use client";

import { PairLogo } from "@/components/token/token-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatPrice, formatUsd } from "@/lib/format";
import type { PanelState } from "@/lib/panel-params";
import type { HoldingsView, LpPositionView } from "@/lib/types";

/** The vault's open DLMM positions; picking one opens the add / remove / claim panel for it. */
export function OpenPositions({
  holdings,
  state,
  onSelect,
}: {
  holdings: HoldingsView;
  state: PanelState;
  onSelect: (s: PanelState) => void;
}) {
  const positions = holdings.positions.filter((p): p is LpPositionView => p.kind === "lp");
  if (positions.length === 0) return null;
  const selected = state.panel === "lp" && "position" in state ? state.position : undefined;

  return (
    <Card className="min-w-0">
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Open positions <span className="text-muted tabular-nums">({positions.length})</span></h2>
          {selected && (
            <Button size="sm" variant="secondary" onClick={() => onSelect({ panel: "lp" })}>
              New position
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {positions.map((p) => (
            <li key={p.position}>
              <button
                type="button"
                aria-pressed={p.position === selected}
                onClick={() => onSelect({ panel: "lp", position: p.position, mode: "add" })}
                className={cn(
                  "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-white/[0.06]",
                  p.position === selected ? "border-sky-400/60 bg-white/[0.06]" : "border-border bg-white/[0.03]",
                )}
              >
                <PairLogo x={p.tokenX} y={p.tokenY} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{p.tokenX.symbol}-{p.tokenY.symbol}</span>
                  <span className="block truncate text-[12px] tabular-nums text-muted">
                    {formatPrice(Number(p.range.lowerPrice))} – {formatPrice(Number(p.range.upperPrice))} {p.tokenY.symbol}
                  </span>
                </span>
                <Badge tone={p.range.inRange ? "accent" : "warning"}>{p.range.inRange ? "In range" : "Out of range"}</Badge>
                <span className="text-[13px] font-medium tabular-nums">{formatUsd(p.usd)}</span>
                <span className="text-[12px] text-sky-400">{p.position === selected ? "Managing" : "Add / manage →"}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
