"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { CreateVaultForm } from "@/components/manage/create-vault-form";
import { Page } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { WalletButton } from "@/components/wallet-button";
import { useManager } from "@/hooks/queries";
import { formatNav, formatTokenAmount } from "@/lib/format";

export default function ManagePage() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const manager = useManager(wallet);

  return (
    <Page title="Manage" description="Vaults whose authority is the connected wallet.">
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
      ) : (
        <div className="space-y-6">
          {manager.data.vaults.length === 0 ? (
            <EmptyState
              title="No vaults managed by this wallet"
              description={
                manager.data.isManager
                  ? "Create your first vault below."
                  : "This wallet is not on the manager whitelist. Ask the protocol admin to add it."
              }
            />
          ) : (
            <div className="rounded-card border border-border bg-surface">
              <Table>
                <thead>
                  <tr>
                    <Th>Vault</Th>
                    <Th>Status</Th>
                    <Th className="text-right">NAV</Th>
                    <Th className="text-right">Total assets</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {manager.data.vaults.map((v) => (
                    <tr key={v.address}>
                      <Td className="font-medium">{v.name}</Td>
                      <Td>
                        <StatusBadge status={v.status} />
                      </Td>
                      <Td className="text-right">{formatNav(v.navPerShare)}</Td>
                      <Td className="text-right">
                        {formatTokenAmount(v.totalAssets, v.depositDecimals, { maxFraction: 2 })}{" "}
                        {v.depositSymbol}
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/manage/${v.address}`}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          Open →
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          {manager.data.isManager && <CreateVaultForm owner={wallet} />}
        </div>
      )}
    </Page>
  );
}
