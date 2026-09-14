"use client";

import { use } from "react";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { HowItWorks } from "@/components/vault/how-it-works";
import { Metrics } from "@/components/vault/metrics";
import { PositionPanel } from "@/components/vault/position-panel";
import { StrategyList } from "@/components/vault/strategy-list";
import { useStrategies, useVault } from "@/hooks/queries";

export default function VaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const vault = useVault(address);
  const strategies = useStrategies(address);

  if (vault.error) {
    return (
      <Page title="Vault">
        <ErrorState message={vault.error.message} onRetry={() => vault.refetch()} />
      </Page>
    );
  }
  const v = vault.data;
  if (!v) {
    return (
      <Page>
        <Skeleton className="h-12 w-1/2" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      </Page>
    );
  }

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          {v.name}
          <StatusBadge status={v.status} />
          {v.metadata?.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Managed by {v.metadata?.managerName ?? "an unregistered manager"}</span>
          <span className="flex items-center gap-1">Vault <Address value={v.address} /></span>
          <span className="flex items-center gap-1">Shares <Address value={v.shareMint} /></span>
        </span>
      }
      aside={<PositionPanel v={v} />}
    >
      {v.metadata && (
        <Card>
          <CardHeader title="About" />
          <CardBody className="space-y-3 text-sm text-slate-700">
            <p>{v.metadata.description}</p>
            <p><span className="font-medium text-foreground">Strategy.</span> {v.metadata.strategy}</p>
          </CardBody>
        </Card>
      )}
      <Metrics v={v} />
      <Card>
        <CardHeader title="Strategies" description="Where the vault's capital is currently deployed" />
        {strategies.error ? <p className="px-5 py-4 text-sm text-danger">{strategies.error.message}</p> : !strategies.data ? <Skeleton className="m-5 h-16" /> : <StrategyList strategies={strategies.data} />}
      </Card>
      <Card>
        <CardHeader title="How requests work" />
        <HowItWorks />
      </Card>
    </Page>
  );
}
