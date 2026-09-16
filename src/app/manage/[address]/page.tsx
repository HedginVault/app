"use client";

import Link from "next/link";
import { Suspense, use, useState } from "react";
import { DangerZone } from "@/components/manage/danger-zone";
import { ManagerGuard } from "@/components/manage/guard";
import { OverviewTab } from "@/components/manage/overview-tab";
import { RequestsTab } from "@/components/manage/requests-tab";
import { SettingsTab } from "@/components/manage/settings-tab";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useVault } from "@/hooks/queries";

type Tab = "overview" | "requests" | "settings" | "danger";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "requests", label: "Requests" },
  { id: "settings", label: "Settings" },
  { id: "danger", label: "Danger zone" },
];

export default function ManageVaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const vault = useVault(address);
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
        <span className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Address value={v.address} />
          <Link href={`/vault/${v.address}`} className="text-emerald-400 hover:underline">
            View public page →
          </Link>
        </span>
      }
    >
      <ManagerGuard vault={v}>
        {(owner) => (
          <div className="space-y-6">
            <div className="max-w-lg">
              <Tabs tabs={TABS} value={tab} onChange={setTab} />
            </div>
            <Suspense fallback={<Skeleton className="h-96" />}>
              {tab === "overview" && <OverviewTab v={v} owner={owner} />}
            </Suspense>
            {tab === "requests" && <RequestsTab v={v} owner={owner} />}
            {tab === "settings" && <SettingsTab v={v} owner={owner} />}
            {tab === "danger" && <DangerZone v={v} owner={owner} />}
          </div>
        )}
      </ManagerGuard>
    </Page>
  );
}
