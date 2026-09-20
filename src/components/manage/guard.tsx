"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { WalletButton } from "@/components/wallet-button";
import type { VaultDetail } from "@/lib/types";

/** Manager-only sections render through this guard; the children receive the verified authority. */
export function ManagerGuard({
  vault,
  children,
}: {
  vault: VaultDetail;
  children: (owner: string) => ReactNode;
}) {
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58();

  if (!owner) {
    return (
      <EmptyState
        title="Connect the manager wallet"
        description="This page is only available to the vault authority."
        action={<WalletButton />}
      />
    );
  }

  if (owner !== vault.authority) {
    return (
      <EmptyState
        title="Not authorized"
        description="The connected wallet is not the authority of this vault."
        action={
          <Link
            href={`/vault/${vault.address}`}
            className="text-sm font-medium text-sky-400 hover:underline"
          >
            View the public vault page →
          </Link>
        }
      />
    );
  }

  return <>{children(owner)}</>;
}
