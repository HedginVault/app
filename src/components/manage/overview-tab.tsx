"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatBps, formatNav, formatTokenAmount } from "@/lib/format";
import type { VaultDetail } from "@/lib/types";
import { outflowCap } from "@/lib/vault-logic";

export function OverviewTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const { send, pending } = useSendTransaction();
  const t = (raw: string, max = 2) =>
    `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: max })} ${v.depositSymbol}`;
  const sh = (raw: string) =>
    `${formatTokenAmount(raw, v.depositDecimals, { maxFraction: 4 })} shares`;
  const unclaimed = BigInt(v.unclaimedManagerFeeShares);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Idle liquidity"
          value={t(v.idleBalance)}
          sub="Available for strategies and withdrawals"
        />
        <Stat
          label="Total assets (last NAV)"
          value={t(v.totalAssets)}
          sub={`NAV ${formatNav(v.navPerShare)} · epoch ${v.navEpoch}`}
        />
        <Stat label="Share supply" value={sh(v.shareSupply)} />
        <Stat
          label="Pending deposits"
          value={t(v.pendingDeposits)}
          tone={BigInt(v.pendingDeposits) > 0n ? "warning" : undefined}
        />
        <Stat
          label="Pending withdrawals"
          value={sh(v.pendingWithdrawalShares)}
          tone={BigInt(v.pendingWithdrawalShares) > 0n ? "warning" : undefined}
        />
        <Stat
          label="Epoch outflow"
          value={t(v.epochOutflow)}
          sub={`Cap ${t(outflowCap(v).toString())} (${formatBps(v.protocol.maxEpochOutflowBps)})`}
        />
        <Stat label="Open strategies" value={v.openStrategyCount} />
        <Stat
          label="Platform fee shares"
          value={sh(v.unclaimedPlatformFeeShares)}
          sub="Claimed by the treasury"
        />
      </div>
      <Card>
        <CardHeader
          title="Manager fees"
          description="Fee shares accrue at each NAV update and are minted to your wallet on claim."
          action={
            <Button
              size="sm"
              disabled={unclaimed === 0n}
              loading={pending}
              onClick={() =>
                void send({
                  label: "Claim manager fee",
                  vault: v.address,
                  build: () => api.build("vault/claim-fee", { payer: owner, vault: v.address }),
                })
              }
            >
              Claim {formatTokenAmount(unclaimed, v.depositDecimals, { maxFraction: 4 })} shares
            </Button>
          }
        />
        <CardBody className="text-sm text-muted">
          Unclaimed shares count toward supply in NAV math, so claiming does not change NAV per
          share.
        </CardBody>
      </Card>
    </div>
  );
}
