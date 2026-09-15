import { Card, CardHeader } from "@/components/ui/card";
import { formatBps, formatDate, formatRelative, formatTokenAmount } from "@/lib/format";
import type { VaultDetail } from "@/lib/types";
import { capHeadroom, epochOf, feeSchedule, nextEpochStart } from "@/lib/vault-logic";

const nowSeconds = () => Date.now() / 1000;
/** An uncapped vault stores `u64::MAX` as its deposit cap. */
const UNCAPPED = 18446744073709551615n;

export function VaultDetails({ v }: { v: VaultDetail }) {
  const now = nowSeconds();
  const schedule = feeSchedule(v, now);
  const t = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 2 })} ${v.depositSymbol}`;
  const sh = (raw: string) => `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 2 })} shares`;
  const navEpoch = BigInt(v.navEpoch);
  const nextResolve = nextEpochStart(navEpoch > epochOf(now) ? navEpoch : epochOf(now));
  const uncapped = BigInt(v.depositCap) === UNCAPPED;
  const settled = v.lastNavTs > 0 && navEpoch > 0n;
  const rows: [string, string][] = [
    ["Deposit cap", uncapped ? "Unlimited" : `${t(v.depositCap)} (${t(capHeadroom(v).toString())} left)`],
    ["Pending deposits", `${t(v.pendingDeposits)} · settle at next NAV update`],
    ["Pending withdrawals", `${sh(v.pendingWithdrawalShares)} · outflow this epoch ${t(v.epochOutflow)}`],
    [
      "Fees",
      `${formatBps(v.performanceFeeBps)} performance · ${formatBps(v.managementFeeBps)} management` +
        (schedule && !schedule.applied
          ? ` (changing to ${formatBps(schedule.performanceFeeBps)} / ${formatBps(schedule.managementFeeBps)} on ${formatDate(schedule.effectiveTs)})`
          : ""),
    ],
    ["Minimum deposit", BigInt(v.minDeposit) === 0n ? "None" : t(v.minDeposit)],
    ["Minimum withdrawal", BigInt(v.minWithdrawalShares) === 0n ? "None" : `${sh(v.minWithdrawalShares)} (full balance always allowed)`],
    [
      "Last NAV update",
      v.lastNavTs
        ? `${formatRelative(v.lastNavTs, now)} · epoch ${v.navEpoch}${settled ? ` · requests claimable after ${formatDate(nextResolve)}` : ""}`
        : "Never",
    ],
  ];
  return (
    <Card>
      <CardHeader title="Vault details" />
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-5 py-2.5 text-[13px] sm:flex-row sm:justify-between sm:gap-6">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular-nums sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
