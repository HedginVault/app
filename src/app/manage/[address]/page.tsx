"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, type ReactNode } from "react";
import { HistoryTab } from "@/components/holdings/history-tab";
import { BalanceTab } from "@/components/manage/balance-tab";
import { ManagerGuard } from "@/components/manage/guard";
import { MarketsTab } from "@/components/manage/markets-tab";
import { PerpsTab } from "@/components/manage/perps-tab";
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

const TABS = ["portfolio", "swap", "liquidity", "perps", "history", "requests", "settings"] as const;
type Tab = (typeof TABS)[number];

// 20x20 stroke paths, same style as the top bar icons.
const TAB_ICONS: Record<Tab, string> = {
  portfolio: "M10 3v7h7M17 10a7 7 0 1 1-7-7",
  swap: "M4 7h11l-3-3M16 13H5l3 3",
  liquidity: "M10 2.5s5 5.2 5 8.7a5 5 0 0 1-10 0c0-3.5 5-8.7 5-8.7z",
  perps: "M2 14l5-5 3 3 8-8M13 4h5v5",
  history: "M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 6v4l3 2",
  requests: "M3 11l2-7h10l2 7v5H3zM3 11h4l1 2h4l1-2h4",
  settings: "M3 6h8M15 6h2M3 14h2M9 14h8M13 4a2 2 0 1 0 0 4 2 2 0 1 0 0-4zM7 12a2 2 0 1 0 0 4 2 2 0 1 0 0-4z",
};

function TabLabel({ id, children }: { id: Tab; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={TAB_ICONS[id]} />
      </svg>
      {children}
    </span>
  );
}

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
  const rawTab = search.get("tab");
  // Old links: "balance" became Portfolio, "markets" split into Swap and Liquidity by its panel param.
  const raw = rawTab === "balance" ? "portfolio" : rawTab === "markets" ? (search.get("panel") === "lp" ? "liquidity" : "swap") : rawTab;
  // The tab lives in the URL next to the trade panel params, so reloads and shared links keep both.
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "portfolio";
  const go = (next: Tab, panel?: PanelState) => {
    const p = new URLSearchParams(search.toString());
    p.set("tab", next);
    router.replace(`${pathname}?${panel ? serializePanel(panel, p) : p.toString()}`, { scroll: false });
  };
  const open = requests.data ? requests.data.deposits.length + requests.data.withdrawals.length : 0;

  return (
    <div className="space-y-6">
      {tab !== "requests" && <RequestsBar v={v} owner={owner} onReview={() => go("requests")} />}
      <div>
        <Tabs
          variant="underline"
          tabs={[
            { id: "portfolio", label: <TabLabel id="portfolio">Portfolio</TabLabel> },
            { id: "swap", label: <TabLabel id="swap">Swap</TabLabel> },
            { id: "liquidity", label: <TabLabel id="liquidity">Liquidity</TabLabel> },
            {
              id: "perps",
              label: (
                <TabLabel id="perps">
                  Perps
                  <span className="rounded-full bg-white/10 px-1.5 text-[11px]">Soon</span>
                </TabLabel>
              ),
            },
            { id: "history", label: <TabLabel id="history">History</TabLabel> },
            {
              id: "requests",
              label: (
                <TabLabel id="requests">
                  Requests
                  {open > 0 && <span className="rounded-full bg-white/10 px-1.5 text-[11px] tabular-nums">{open}</span>}
                </TabLabel>
              ),
            },
            { id: "settings", label: <TabLabel id="settings">Settings</TabLabel> },
          ]}
          value={tab}
          // Fresh panel state when entering a trade tab, so a stale swap/pool param never leaks across.
          onChange={(t) => go(t, t === "swap" ? { panel: "swap" } : t === "liquidity" ? { panel: "lp" } : undefined)}
        />
      </div>
      {tab === "portfolio" && <BalanceTab v={v} owner={owner} />}
      {(tab === "swap" || tab === "liquidity") && (
        <MarketsTab key={tab} v={v} owner={owner} panel={tab === "swap" ? "swap" : "lp"} onSwitch={(s) => go(s.panel === "swap" ? "swap" : "liquidity", s)} />
      )}
      {tab === "perps" && <PerpsTab v={v} />}
      {tab === "history" && <HistoryTab address={v.address} />}
      {tab === "requests" && <RequestsTab v={v} owner={owner} />}
      {tab === "settings" && <SettingsTab v={v} owner={owner} />}
    </div>
  );
}
