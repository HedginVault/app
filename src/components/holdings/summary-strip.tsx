import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { formatNav, formatTokenAmount, formatUsd, usdValue } from "@/lib/format";
import type { HoldingsView, VaultDetail } from "@/lib/types";

export function SummaryStrip({ v, holdings: h }: { v: VaultDetail; holdings: HoldingsView | undefined }) {
  const t = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 2 })} ${v.depositSymbol}`;
  const idle = h?.positions[0];
  const deployedBps = idle?.shareBps == null ? null : 10_000 - idle.shareBps;
  const delta = h?.navDeltaBps;
  // A partial live value undercounts, so neither the NAV comparison nor the deployed share is meaningful.
  const partial = h?.partial ?? false;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Total assets (NAV)" value={t(v.totalAssets)} sub={formatUsd(usdValue(v.totalAssets, v.depositDecimals, v.depositPriceUsd))} />
      <Stat
        label="Live value"
        value={h ? formatUsd(h.totalUsd) : <Skeleton className="h-6 w-24" />}
        sub={
          partial ? (
            "Partial — some holdings unpriced or unreadable"
          ) : delta != null && Math.abs(delta) >= 10 ? (
            <span title="NAV is posted once per epoch; the live value is priced now">
              {delta > 0 ? "+" : ""}
              {(delta / 100).toFixed(1)}% vs NAV
            </span>
          ) : (
            "Priced now"
          )
        }
        tone={!partial && delta != null && delta <= -100 ? "warning" : undefined}
      />
      <Stat label="NAV per share" value={formatNav(v.navPerShare)} sub={`High-water mark ${formatNav(v.highWaterMark)}`} />
      <Stat
        label="Deployed"
        value={partial || deployedBps == null ? "—" : `${(deployedBps / 100).toFixed(1)}%`}
        sub={partial ? `Idle ${t(v.idleBalance)} · partial` : `Idle ${t(v.idleBalance)}`}
      />
    </div>
  );
}
