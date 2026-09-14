"use client";

import { Stat } from "@/components/ui/stat";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toUiNumber } from "@/lib/format";
import type { ConfigView, VaultSummary } from "@/lib/types";

export function SummaryStrip({
  vaults,
  config,
  error,
}: {
  vaults?: VaultSummary[];
  config?: ConfigView;
  error?: boolean;
}) {
  if (error) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {["Total value locked", "Vaults", "Protocol"].map((label) => (
          <Stat key={label} label={label} value="—" sub="Unavailable" />
        ))}
      </div>
    );
  }
  if (!vaults || !config) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }
  const priced = vaults.filter((v) => v.depositPriceUsd !== null);
  const tvl = priced.reduce(
    (acc, v) => acc + toUiNumber(v.totalAssets, v.depositDecimals) * v.depositPriceUsd!,
    0,
  );
  const unpriced = vaults.length - priced.length;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat
        label="Total value locked"
        value={`$${tvl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
        sub={
          unpriced
            ? `${unpriced} vault${unpriced > 1 ? "s" : ""} without a price feed excluded`
            : "Priced via Jupiter"
        }
      />
      <Stat
        label="Vaults"
        value={vaults.length}
        sub={`${vaults.filter((v) => v.status === "normal").length} accepting deposits`}
      />
      <Stat
        label="Protocol"
        value={<StatusBadge status={config.status} />}
        sub="NAV posted once per 24h epoch"
      />
    </div>
  );
}
