"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useState } from "react";
import { CreateVaultDialog } from "@/components/manage/create-vault-dialog";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { TokenLogo } from "@/components/token/token-logo";
import { WalletButton } from "@/components/wallet-button";
import { useManager } from "@/hooks/queries";
import { formatNav, formatTokenAmount } from "@/lib/format";

export default function ManagePage() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const manager = useManager(wallet);
  const [creating, setCreating] = useState(false);
  const canCreate = !!wallet && !!manager.data?.isManager;

  const newVault = (
    <Button onClick={() => setCreating(true)}>
      <span aria-hidden="true" className="text-lg leading-none">+</span>
      New vault
    </Button>
  );

  return (
    <Page
      title={<>Your <span className="text-emerald-400">vaults</span></>}
      description="Pick a vault to trade, handle requests, or change settings."
      action={canCreate && manager.data!.vaults.length > 0 ? newVault : undefined}
    >
      {!wallet ? (
        <EmptyState
          title="Connect a wallet"
          description="Manager tools are available to the vault authority only."
          action={<WalletButton />}
        />
      ) : manager.error ? (
        <ErrorState message={manager.error.message} onRetry={() => manager.refetch()} />
      ) : !manager.data ? (
        <Skeleton className="h-40" />
      ) : manager.data.vaults.length === 0 ? (
        <EmptyState
          title={manager.data.isManager ? "Create your first vault" : "Not a manager yet"}
          description={
            manager.data.isManager
              ? "Set a name, deposit token, and fees. You can change fees later."
              : "This wallet is not on the manager whitelist. Ask the protocol admin to add it."
          }
          action={canCreate ? newVault : undefined}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {manager.data.vaults.map((v) => (
            <li key={v.address}>
              <Link
                href={`/manage/${v.address}`}
                className="group flex aspect-square flex-col rounded-card border border-border bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <TokenLogo token={{ symbol: v.depositSymbol, logo: v.depositLogo }} size="lg" />
                  <StatusBadge status={v.status} />
                </div>
                <h2 className="mt-5 line-clamp-2 font-serif text-3xl leading-tight">{v.name}</h2>

                <dl className="mt-auto grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted">Total assets</dt>
                    <dd className="mt-1 truncate text-xl font-medium tabular-nums">
                      {formatTokenAmount(v.totalAssets, v.depositDecimals, { maxFraction: 2 })}{" "}
                      <span className="text-sm text-muted">{v.depositSymbol}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Share price</dt>
                    <dd className="mt-1 text-xl font-medium tabular-nums">{formatNav(v.navPerShare)}</dd>
                  </div>
                </dl>

                <span className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm font-medium text-emerald-400">
                  Manage vault
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canCreate && <CreateVaultDialog owner={wallet} open={creating} onClose={() => setCreating(false)} />}
    </Page>
  );
}
