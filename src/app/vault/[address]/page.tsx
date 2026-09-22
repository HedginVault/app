"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { HistoryTab } from "@/components/holdings/history-tab";
import { EpochCountdown } from "@/components/holdings/epoch-countdown";
import { HoldingsSection } from "@/components/holdings/holdings-section";
import { SummaryStrip } from "@/components/holdings/summary-strip";
import { VaultDetails } from "@/components/holdings/vault-details";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { TokenLogo } from "@/components/token/token-logo";
import { HowItWorks } from "@/components/vault/how-it-works";
import { PositionPanel } from "@/components/vault/position-panel";
import { useHoldings, useVault } from "@/hooks/queries";
import type { HoldingsView, VaultDetail } from "@/lib/types";
import { publicVaultTab, type PublicVaultTab } from "@/lib/vault-tabs";

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
        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      </Page>
    );
  }

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-4">
          <TokenLogo token={{ symbol: v.depositSymbol, logo: v.depositLogo }} size="lg" />
          {v.name}
          <StatusBadge status={v.status} />
        </span>
      }
      description={
        <>
          Managed by {v.metadata?.managerName ?? "an unregistered manager"}
          {v.metadata?.strategy && <p className="mt-2 max-w-2xl text-white/50">{v.metadata.strategy}</p>}
        </>
      }
      aside={<PositionPanel v={v} />}
      action={<EpochCountdown navEpoch={v.navEpoch} />}
    >
      <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
        <VaultTabs v={v} holdings={holdings.data} />
      </Suspense>
    </Page>
  );
}

function VaultTabs({ v, holdings }: { v: VaultDetail; holdings: HoldingsView | undefined }) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = publicVaultTab(search.get("tab"));
  const go = (next: PublicVaultTab) => {
    const params = new URLSearchParams(search.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "history", label: "History" },
          ]}
          value={tab}
          onChange={go}
        />
      </div>

      {tab === "overview" ? (
        <>
          <SummaryStrip v={v} holdings={holdings} />
          <HoldingsSection address={v.address} />

          {/* ponytail: rarely-needed info folds away; native <details>, no JS */}
          <details className="group rounded-card border border-border bg-white/[0.02] open:border-sky-400/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
              <span className="font-serif text-2xl">More about this vault</span>
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-sky-400 transition group-open:rotate-45">+</span>
            </summary>
            <div className="space-y-8 px-6 pb-6">
              {v.metadata?.description && <p className="text-sm text-white/70">{v.metadata.description}</p>}
              <div>
                <h3 className="mb-4 text-sm font-medium text-muted">How deposits &amp; withdrawals work</h3>
                <HowItWorks />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted">Details</h3>
                <VaultDetails v={v} />
                <div className="flex flex-col gap-0.5 border-t border-border py-3 text-sm sm:flex-row sm:justify-between">
                  <span className="text-muted">Vault address</span>
                  <Address value={v.address} />
                </div>
                <div className="flex flex-col gap-0.5 border-t border-border py-3 text-sm sm:flex-row sm:justify-between">
                  <span className="text-muted">Share token</span>
                  <Address value={v.shareMint} />
                </div>
              </div>
            </div>
          </details>
        </>
      ) : (
        <HistoryTab address={v.address} depositSymbol={v.depositSymbol} />
      )}
    </div>
  );
}
