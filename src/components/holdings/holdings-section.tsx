"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import type { MenuItem } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings } from "@/hooks/queries";
import { positionKey } from "@/lib/holdings";
import type { PositionView } from "@/lib/types";
import { AllocationCard } from "./allocation-card";
import { PositionCard } from "./position-card";

export function HoldingsSection({
  address,
  actionsFor,
}: {
  address: string;
  actionsFor?: (p: PositionView) => MenuItem[] | undefined;
}) {
  const holdings = useHoldings(address);
  if (holdings.error)
    return <ErrorState message={`Holdings unavailable: ${holdings.error.message}`} onRetry={() => void holdings.refetch()} />;
  const h = holdings.data;
  if (!h)
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  return (
    <div className="space-y-6">
      <AllocationCard holdings={h} />
      <Card>
        <CardHeader title="Positions" description="Where the vault's capital sits right now" />
        <div className="divide-y divide-border">
          {h.positions.map((p) => (
            <PositionCard
              key={positionKey(p)}
              position={p}
              depositToken={h.depositToken}
              actions={actionsFor?.(p)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
