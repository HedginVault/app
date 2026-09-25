"use client";

import { VaultCard } from "@/components/vaults/vault-card";
import { useVaults } from "@/hooks/queries";
import { CLUSTER } from "@/lib/constants";

export default function VaultsPage() {
  const vaults = useVaults();
  return (
    // Pulls the page under the TopBar's flow space (72px phone, 92px sm+), same as the landing hero
    <main className="relative -mt-[72px] flex-1 sm:-mt-[92px] overflow-hidden bg-[linear-gradient(180deg,#0d1a2b_0%,#080c14_40%)] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -top-40 h-[32rem] w-[48rem] -translate-x-1/2 rounded-full bg-sky-400/10 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-40 pb-24">
        <h1 className="font-serif text-5xl tracking-tight md:text-6xl">
          Pick a <span className="text-sky-400">vault</span>
        </h1>
        <p className="mt-4 max-w-xl text-white/60 md:text-lg">
          Choose one, deposit, and get a share token back. Its value is posted
          on-chain every day.
        </p>

        <div className="mt-12">
          {vaults.error ? (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-400/30 bg-red-400/[0.06] px-6 py-4 text-sm text-red-200">
              <span>Couldn&apos;t load vaults: {vaults.error.message}</span>
              <button
                onClick={() => vaults.refetch()}
                className="rounded-lg bg-white/10 px-4 py-2 font-medium text-white hover:bg-white/15"
              >
                Retry
              </button>
            </div>
          ) : !vaults.data ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-60 animate-pulse rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          ) : vaults.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
              <h2 className="font-serif text-2xl">No vaults yet</h2>
              <p className="mt-2 text-white/50">No vaults found on {CLUSTER}.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {vaults.data.map((v) => (
                <VaultCard key={v.address} v={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
