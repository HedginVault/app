"use client";

import { Page } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryStrip } from "@/components/vaults/summary-strip";
import { VaultCard } from "@/components/vaults/vault-card";
import { useConfig, useVaults } from "@/hooks/queries";
import { CLUSTER } from "@/lib/constants";

export default function Home() {
  const vaults = useVaults();
  const config = useConfig();
  return (
    <Page
      title="Vaults"
      description="Managed vaults with tokenized shares. Deposits and withdrawals settle at the next NAV update."
    >
      <div className="space-y-6">
        <SummaryStrip
          vaults={vaults.data}
          config={config.data}
          error={!!vaults.error || !!config.error}
        />
        {config.error && !vaults.error && (
          <ErrorState
            message={`Failed to load protocol config: ${config.error.message}`}
            onRetry={() => config.refetch()}
          />
        )}
        {vaults.error ? (
          <ErrorState
            message={`Failed to load vaults: ${vaults.error.message}`}
            onRetry={() => vaults.refetch()}
          />
        ) : !vaults.data ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : vaults.data.length === 0 ? (
          <EmptyState
            title="No vaults yet"
            description={`No vault accounts were found on ${CLUSTER}.`}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vaults.data.map((v) => (
              <VaultCard key={v.address} v={v} />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
