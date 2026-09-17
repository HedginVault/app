import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import { formatNav, formatTokenAmount, formatUsd } from "@/lib/format";
import type { HoldingsView, VaultDetail } from "@/lib/types";

export function SummaryStrip({
  v,
  holdings: h,
  children,
}: {
  v: VaultDetail;
  holdings: HoldingsView | undefined;
  /** Extra stats appended after the shared ones (e.g. manager fees). */
  children?: ReactNode;
}) {
  const t = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 2 })} ${v.depositSymbol}`;
  const idle = h?.positions[0];
  const deployedBps = idle?.shareBps == null ? null : 10_000 - idle.shareBps;
  const delta = h?.navDeltaBps;
  // A partial live value undercounts, so neither the NAV comparison nor the deployed share is meaningful.
  const partial = h?.partial ?? false;
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", children ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
      <Stat
        label="Vault value"
        value={h ? formatUsd(h.totalUsd) : <Skeleton className="h-6 w-24" />}
        sub={
          <span title="Live value is priced now; NAV is posted once per epoch">
            {partial
              ? "Partial — some holdings unpriced"
              : `NAV ${t(v.totalAssets)}${delta != null && Math.abs(delta) >= 10 ? ` · ${delta > 0 ? "+" : ""}${(delta / 100).toFixed(1)}% live` : ""}`}
          </span>
        }
        tone={!partial && delta != null && delta <= -100 ? "warning" : undefined}
      />
      <Stat label="Share price" value={formatNav(v.navPerShare)} sub={`High-water mark ${formatNav(v.highWaterMark)}`} />
      <Stat
        label="Deployed"
        value={partial || deployedBps == null ? "—" : `${(deployedBps / 100).toFixed(1)}%`}
        sub={`${t(v.idleBalance)} idle`}
      />
      {children}
    </div>
  );
}
