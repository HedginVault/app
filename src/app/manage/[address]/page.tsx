"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { Suspense, use, useState } from "react";
import { ManagerGuard } from "@/components/manage/guard";
import { OverviewTab } from "@/components/manage/overview-tab";
import { RequestsBar, RequestsBell } from "@/components/manage/requests-inbox";
import { SettingsDialog } from "@/components/manage/settings-dialog";
import { Page } from "@/components/shell/page";
import { Address } from "@/components/ui/address";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useVault } from "@/hooks/queries";

const GearIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function ManageVaultPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const vault = useVault(address);
  const { publicKey } = useWallet();
  const [settings, setSettings] = useState(false);

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

  // Header controls mirror ManagerGuard: only the authority sees them.
  const isManager = publicKey?.toBase58() === v.authority;

  return (
    <Page
      title={v.name}
      description={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge status={v.status} />
          <Address value={v.address} />
          <Link href={`/vault/${v.address}`} className="text-emerald-400 hover:underline">
            Public page →
          </Link>
        </span>
      }
      action={
        isManager && (
          <div className="flex items-center gap-2">
            <RequestsBell v={v} owner={v.authority} />
            <button
              type="button"
              onClick={() => setSettings(true)}
              className="flex h-10 items-center gap-2 rounded-full border border-border bg-white/[0.03] px-4 text-sm text-white/70 hover:text-white"
            >
              <GearIcon /> Settings
            </button>
          </div>
        )
      }
    >
      <ManagerGuard vault={v}>
        {(owner) => (
          <div className="space-y-6">
            <RequestsBar v={v} owner={owner} />
            <Suspense fallback={<Skeleton className="h-96" />}>
              <OverviewTab v={v} owner={owner} />
            </Suspense>
            <SettingsDialog v={v} owner={owner} open={settings} onClose={() => setSettings(false)} />
          </div>
        )}
      </ManagerGuard>
    </Page>
  );
}
