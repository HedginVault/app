import { Stat } from "@/components/ui/stat";
import { formatBps, formatDate, formatNav, formatRelative, formatTokenAmount, toUiNumber } from "@/lib/format";
import type { VaultDetail } from "@/lib/types";
import { capHeadroom, epochOf, feeSchedule, nextEpochStart } from "@/lib/vault-logic";

/** Read outside the render scope: the metrics are a snapshot of the wall clock at paint. */
const nowSeconds = () => Date.now() / 1000;

/** An uncapped vault stores `u64::MAX` as its deposit cap. */
const UNCAPPED = 18446744073709551615n;

export function Metrics({ v }: { v: VaultDetail }) {
  const now = nowSeconds();
  const schedule = feeSchedule(v, now);
  const t = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 2 })} ${v.depositSymbol}`;
  const usd = (raw: string) =>
    v.depositPriceUsd === null ? "" : `≈ $${(toUiNumber(raw, v.depositDecimals) * v.depositPriceUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })} · `;
  const navEpoch = BigInt(v.navEpoch);
  // Requests become claimable at the next NAV update, which cannot land before the next clock
  // epoch starts — `navEpoch` alone is the epoch of the LAST update and is usually already past.
  const nextResolve = nextEpochStart(navEpoch > epochOf(now) ? navEpoch : epochOf(now));
  const uncapped = BigInt(v.depositCap) === UNCAPPED;
  const settled = v.lastNavTs > 0 && navEpoch > 0n;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="NAV per share" value={formatNav(v.navPerShare)} sub={`High-water mark ${formatNav(v.highWaterMark)}`} />
      <Stat label="Total assets" value={t(v.totalAssets)} sub={`${usd(v.totalAssets)}Idle liquidity ${t(v.idleBalance)}`} />
      <Stat label="Deposit cap" value={uncapped ? "Unlimited" : t(v.depositCap)} sub={uncapped ? "No deposit cap" : `${t(capHeadroom(v).toString())} remaining`} />
      <Stat label="Pending deposits" value={t(v.pendingDeposits)} sub="Settle at next NAV update" tone={BigInt(v.pendingDeposits) > 0n ? "warning" : undefined} />
      <Stat label="Pending withdrawals" value={`${formatTokenAmount(v.pendingWithdrawalShares, v.depositDecimals, { maxFraction: 2 })} shares`} sub={`Outflow this epoch ${t(v.epochOutflow)}`} />
      <Stat
        label="Fees"
        value={`${formatBps(v.performanceFeeBps)} perf · ${formatBps(v.managementFeeBps)} mgmt`}
        sub={schedule && !schedule.applied ? `Changes to ${formatBps(schedule.performanceFeeBps)} / ${formatBps(schedule.managementFeeBps)} on ${formatDate(schedule.effectiveTs)}` : "Performance above HWM · management annualized"}
        tone={schedule && !schedule.applied ? "warning" : undefined}
      />
      <Stat label="Minimum deposit" value={BigInt(v.minDeposit) === 0n ? "None" : t(v.minDeposit)} />
      <Stat label="Minimum withdrawal" value={BigInt(v.minWithdrawalShares) === 0n ? "None" : `${formatTokenAmount(v.minWithdrawalShares, v.depositDecimals, { maxFraction: 2 })} shares`} sub="Full balance always allowed" />
      <Stat label="Last NAV update" value={v.lastNavTs ? formatRelative(v.lastNavTs, now) : "Never"} sub={settled ? `Epoch ${v.navEpoch} · requests claimable after ${formatDate(nextResolve)}` : "Awaiting first update"} />
    </div>
  );
}
