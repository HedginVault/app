"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { ReactNode } from "react";

const Chevron = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-4 text-slate-300">
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden className="size-3.5">
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Step({ n, title, body, footer }: { n: number; title: string; body: string; footer: ReactNode }) {
  return (
    <li className="flex flex-1 flex-col rounded-card border border-border bg-background/60 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-emerald-700">
          {n}
        </span>
        <h3 className="font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="mt-2 flex-1 text-[13px] text-slate-600">{body}</p>
      <div className="mt-3 text-[13px]">{footer}</div>
    </li>
  );
}

/** The dashboard's first-run guide: pick a vault, deposit, receive share tokens. */
export function GetStarted() {
  const { connected } = useWallet();
  return (
    <section aria-labelledby="get-started" className="rounded-card border border-border bg-surface p-5">
      <h2 id="get-started" className="text-[15px] font-semibold tracking-tight">
        How to get started
      </h2>
      <p className="mt-0.5 text-[13px] text-muted">Three steps from wallet to vault shares.</p>

      <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <Step
          n={1}
          title="Select a vault"
          body="Compare strategy, NAV, and fees, then open the vault that fits you."
          footer={
            <a
              href="#vaults"
              className="inline-flex min-h-10 items-center gap-1 rounded-md font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Browse vaults <span aria-hidden>↓</span>
            </a>
          }
        />
        <li aria-hidden className="hidden items-center sm:flex">
          <Chevron />
        </li>
        <Step
          n={2}
          title="Deposit"
          body="Request a deposit to the vault. It settles at the next epoch."
          footer={
            connected ? (
              <span className="inline-flex min-h-10 items-center gap-1.5 font-medium text-emerald-700">
                <Check /> Wallet connected
              </span>
            ) : (
              <span className="inline-flex min-h-10 items-center text-muted">Connect a wallet to deposit</span>
            )
          }
        />
        <li aria-hidden className="hidden items-center sm:flex">
          <Chevron />
        </li>
        <Step
          n={3}
          title="Receive share tokens"
          body="You will receive tokenized shares of your vault position."
          footer={<span className="inline-flex min-h-10 items-center text-muted">Claim from the vault page</span>}
        />
      </ol>
    </section>
  );
}
