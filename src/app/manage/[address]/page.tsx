"use client";

import Link from "next/link";
import { use, useState } from "react";
import { DangerZone } from "@/components/manage/danger-zone";
import { DlmmPanel } from "@/components/manage/dlmm-panel";
import { ManagerGuard } from "@/components/manage/guard";
import { JupiterPanel } from "@/components/manage/jupiter-panel";
import { OverviewTab } from "@/components/manage/overview-tab";
import { RequestsTab } from "@/components/manage/requests-tab";
import { SettingsTab } from "@/components/manage/settings-tab";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useStrategies, useVault } from "@/hooks/queries";

type Tab = "overview" | "settings" | "requests" | "strategies" | "danger";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
  { id: "requests", label: "Requests" },
  { id: "strategies", label: "Strategies" },
  { id: "danger", label: "Danger zone" },
];

export default function ManageVaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const vault = useVault(address);
  const strategies = useStrategies(address);
  const [tab, setTab] = useState<Tab>("overview");

  if (vault.error) {
    return (
      <Page title="Manage">
        <ErrorState message={vault.error.message} onRetry={() => void vault.refetch()} />
      </Page>
    );
  }
  const v = vault.data;
  if (!v) {
    return (
      <Page>
        <Skeleton className="h-96" />
      </Page>
    );
  }

  return (
    <Page
      title={
        <span className="flex items-center gap-3">
          {v.name} <StatusBadge status={v.status} />
        </span>
      }
      description={
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            Vault <Address value={v.address} />
          </span>
          <Link href={`/vault/${v.address}`} className="text-emerald-700 hover:underline">
            Public page →
          </Link>
        </span>
      }
    >
      <ManagerGuard vault={v}>
        {(owner) => (
          <div className="space-y-6">
            <div className="max-w-2xl">
              <Tabs tabs={TABS} value={tab} onChange={setTab} />
            </div>
            {tab === "overview" && <OverviewTab v={v} owner={owner} />}
            {tab === "settings" && <SettingsTab v={v} owner={owner} />}
            {tab === "requests" && <RequestsTab v={v} owner={owner} />}
            {tab === "strategies" &&
              (strategies.error ? (
                <ErrorState
                  message={strategies.error.message}
                  onRetry={() => void strategies.refetch()}
                />
              ) : !strategies.data ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="space-y-6">
                  <JupiterPanel
                    v={v}
                    owner={owner}
                    strategies={strategies.data.filter((s) => s.type === "jupiter")}
                  />
                  <DlmmPanel
                    v={v}
                    owner={owner}
                    strategies={strategies.data.filter((s) => s.type === "dlmm")}
                  />
                </div>
              ))}
            {tab === "danger" && <DangerZone v={v} owner={owner} />}
          </div>
        )}
      </ManagerGuard>
    </Page>
  );
}
