"use client";

import { Button } from "@/components/ui/button";
import { useRequests } from "@/hooks/queries";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import type { BuiltTransaction, VaultDetail } from "@/lib/types";

/** Only shows when requests are ready: the keeper never resolves them, so the manager must. */
export function RequestsBar({ v, owner, onReview }: { v: VaultDetail; owner: string; onReview: () => void }) {
  const requests = useRequests(v.address);
  const { send, pending } = useSendTransaction();
  const q = requests.data;
  const ready = q ? [...q.deposits, ...q.withdrawals].filter((r) => r.state === "resolvable").length : 0;
  if (ready === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-400/30 bg-warning-soft px-5 py-3 text-sm text-amber-200">
      <span>
        {ready} request{ready === 1 ? " is" : "s are"} ready to resolve
      </span>
      <span className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onReview}>
          Review
        </Button>
        <Button
          size="sm"
          loading={pending}
          onClick={() =>
            void send({
              label: "Resolve all",
              vault: v.address,
              build: () => api.build<BuiltTransaction[]>("resolve-batch", { payer: owner, vault: v.address }),
            })
          }
        >
          Resolve all
        </Button>
      </span>
    </div>
  );
}
