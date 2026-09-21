"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { BalanceTab } from "@/components/manage/balance-tab";
import { ManagerGuard } from "@/components/manage/guard";
import { MarketsTab } from "@/components/manage/markets-tab";
import { QuickSwap } from "@/components/manage/quick-swap";
import { RequestsBar } from "@/components/manage/requests-bar";
import { RequestsTab } from "@/components/manage/requests-tab";
import { SettingsTab } from "@/components/manage/settings-tab";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { useRequests, useVault } from "@/hooks/queries";
import { serializePanel, type PanelState } from "@/lib/panel-params";
import type { VaultDetail } from "@/lib/types";

const TABS = ["balance", "markets", "requests", "settings"] as const;
type Tab = (typeof TABS)[number];

export default function ManageVaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const vault = useVault(address);

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
      title={v.name}
      description={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge status={v.status} />
          <Address value={v.address} />
          <Link href={`/vault/${v.address}`} className="text-sky-400 hover:underline">
            Public page →
          </Link>
        </span>
      }
    >
      <ManagerGuard vault={v}>
        {(owner) => (
          // useSearchParams below needs a Suspense boundary.
          <Suspense fallback={<Skeleton className="h-96" />}>
            <ManageTabs v={v} owner={owner} />
            <QuickSwap v={v} owner={owner} />
          </Suspense>
        )}
      </ManagerGuard>
    </Page>
  );
}

function ManageTabs({ v, owner }: { v: VaultDetail; owner: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requests = useRequests(v.address);
  const raw = search.get("tab");
  // The tab lives in the URL next to the trade panel params, so reloads and shared links keep both.
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "balance";
  const go = (next: Tab, panel?: PanelState) => {
    const p = new URLSearchParams(search.toString());
    p.set("tab", next);
    router.replace(`${pathname}?${panel ? serializePanel(panel, p) : p.toString()}`, { scroll: false });
  };
  const open = requests.data ? requests.data.deposits.length + requests.data.withdrawals.length : 0;

  return (
    <div className="space-y-6">
      {tab !== "requests" && <RequestsBar v={v} owner={owner} onReview={() => go("requests")} />}
      <div className="max-w-xl">
        <Tabs
          tabs={[
            { id: "balance", label: "Balance" },
            { id: "markets", label: "Markets" },
            {
              id: "requests",
              label: (
                <span className="inline-flex items-center gap-2">
                  Requests
                  {open > 0 && <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums">{open}</span>}
                </span>
              ),
            },
            { id: "settings", label: "Settings" },
          ]}
          value={tab}
          onChange={(t) => go(t)}
        />
      </div>
      {tab === "balance" && <BalanceTab v={v} owner={owner} onTrade={(panel) => go("markets", panel)} />}
      {tab === "markets" && <MarketsTab v={v} owner={owner} />}
      {tab === "requests" && <RequestsTab v={v} owner={owner} />}
      {tab === "settings" && <SettingsTab v={v} owner={owner} />}
    </div>
  );
}
