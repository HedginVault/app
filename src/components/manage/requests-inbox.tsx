"use client";

import { useState } from "react";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { useRequests } from "@/hooks/queries";
import { useSendTransaction, type SendOptions } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBps, formatRelative, formatTokenAmount } from "@/lib/format";
import type { BuiltTransaction, VaultDetail } from "@/lib/types";
import { outflowCap } from "@/lib/vault-logic";

type Kind = "deposit" | "withdrawal";

/** Request queue flattened into one list, ready first. Shared by the bell and the top bar. */
function useInbox(v: VaultDetail, owner: string) {
  const requests = useRequests(v.address);
  const { send, pending } = useSendTransaction();
  // Which button started the in-flight transaction, so only that one shows a spinner.
  const [active, setActive] = useState<string | null>(null);
  const q = requests.data;
  const t = (raw: string) => formatTokenAmount(raw, v.depositDecimals, { maxFraction: 2 });
  const items = q
    ? [
        ...q.deposits.map((r) => ({ kind: "deposit" as Kind, ...r, text: `Deposit ${t(r.amount)} ${v.depositSymbol}` })),
        ...q.withdrawals.map((r) => ({ kind: "withdrawal" as Kind, ...r, text: `Withdraw ${t(r.shares)} shares` })),
      ].sort((a, b) => Number(b.state === "resolvable") - Number(a.state === "resolvable") || a.createdTs - b.createdTs)
    : [];
  const ready = items.filter((r) => r.state === "resolvable").length;

  const run = (key: string, label: string, build: SendOptions["build"]) => {
    setActive(key);
    void send({ label, vault: v.address, build }).finally(() => setActive(null));
  };
  const resolveOne = (kind: Kind, user: string) =>
    run(`${kind}:${user}`, `Resolve ${kind}`, () =>
      api.build(`${kind}/resolve`, {
        payer: owner,
        vault: v.address,
        [kind === "deposit" ? "depositor" : "withdrawer"]: user,
      }),
    );
  const resolveAll = () =>
    run("batch", "Resolve all", () => api.build<BuiltTransaction[]>("resolve-batch", { payer: owner, vault: v.address }));
  const busy = (key: string) => pending && active === key;

  return { requests, items, ready, resolveOne, resolveAll, busy, pending, t };
}

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export function RequestsBell({ v, owner }: { v: VaultDetail; owner: string }) {
  const [open, setOpen] = useState(false);
  const { requests, items, ready, resolveOne, resolveAll, busy, t } = useInbox(v, owner);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[min(24rem,calc(100vw-2rem))] p-0"
      trigger={
        <button
          type="button"
          aria-label={`Requests${ready ? `, ${ready} ready` : ""}`}
          onClick={() => setOpen((o) => !o)}
          className="relative grid size-10 place-items-center rounded-full border border-border bg-white/[0.03] text-white/70 hover:text-white"
        >
          <BellIcon />
          {items.length > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-medium tabular-nums",
                ready > 0 ? "bg-amber-400 text-black" : "bg-white/15 text-white",
              )}
            >
              {items.length}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="text-sm font-medium">Requests</span>
        {ready > 0 && (
          <Button size="sm" loading={busy("batch")} onClick={resolveAll}>
            Resolve all ({ready})
          </Button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {requests.error ? (
          <p className="px-4 py-6 text-sm text-danger">{requests.error.message}</p>
        ) : !requests.data ? (
          <p className="px-4 py-6 text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">No requests. You&apos;re all caught up.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((r) => (
              <li key={`${r.kind}:${r.owner}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 text-sm">
                  <div className="tabular-nums">{r.text}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                    <Address value={r.owner} /> · {formatRelative(r.createdTs)}
                  </div>
                </div>
                {r.state === "resolvable" ? (
                  <Button size="sm" variant="secondary" loading={busy(`${r.kind}:${r.owner}`)} onClick={() => resolveOne(r.kind, r.owner)}>
                    Resolve
                  </Button>
                ) : (
                  <span className="shrink-0 text-[12px] text-muted" title="Requests become ready after a NAV update in a later epoch">
                    Waiting for NAV
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p
        className="border-t border-border px-4 py-2.5 text-[12px] text-muted"
        title={`Cap is ${formatBps(v.protocol.maxEpochOutflowBps)} of assets per epoch`}
      >
        Withdrawn this epoch {t(v.epochOutflow)} of {t(outflowCap(v).toString())} {v.depositSymbol}
      </p>
    </Popover>
  );
}

/** Only shows when something needs the manager: the keeper never resolves requests. */
export function RequestsBar({ v, owner }: { v: VaultDetail; owner: string }) {
  const { ready, resolveAll, busy } = useInbox(v, owner);
  if (ready === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-amber-400/30 bg-warning-soft px-5 py-3 text-sm text-amber-200">
      <span>
        {ready} request{ready === 1 ? " is" : "s are"} ready to resolve
      </span>
      <Button size="sm" loading={busy("batch")} onClick={resolveAll}>
        Resolve all
      </Button>
    </div>
  );
}
