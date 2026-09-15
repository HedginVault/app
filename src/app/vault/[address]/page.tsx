"use client";

import { use } from "react";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { TokenLogo } from "@/components/token/token-logo";
import { HoldingsSection } from "@/components/holdings/holdings-section";
import { SummaryStrip } from "@/components/holdings/summary-strip";
import { VaultDetails } from "@/components/holdings/vault-details";
import { HowItWorks } from "@/components/vault/how-it-works";
import { PositionPanel } from "@/components/vault/position-panel";
import { useHoldings, useVault } from "@/hooks/queries";

export default function VaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const vault = useVault(address);
  const holdings = useHoldings(address);

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
          <TokenLogo token={{ symbol: v.depositSymbol, logo: v.depositLogo }} size="lg" />
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
      <SummaryStrip v={v} holdings={holdings.data} />
      <HoldingsSection address={address} />
      <VaultDetails v={v} />
      <Card>
        <CardHeader title="How requests work" />
        <HowItWorks />
      </Card>
    </Page>
  );
}
