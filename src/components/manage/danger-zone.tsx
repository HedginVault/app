"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import type { VaultDetail } from "@/lib/types";
import { closePreconditions } from "@/lib/vault-logic";

/** Collapsed by default: closing is rare and irreversible. */
export function DangerZone({ v, owner }: { v: VaultDetail; owner: string }) {
  const { send, pending } = useSendTransaction();
  const unmet = closePreconditions(v);
  const [closing, setClosing] = useState(false);
  return (
    <details className="group rounded-[10px] border border-border">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted select-none hover:text-foreground">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
        Advanced: close vault
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        <p className="text-[13px] text-muted">
          Closes the vault, share mint and escrows and returns rent to the authority. Irreversible.
        </p>
        {unmet.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-white/80">
            {unmet.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/80">All preconditions are met.</p>
        )}
        <Button
          variant="danger"
          disabled={unmet.length > 0}
          loading={pending}
          onClick={() => setClosing(true)}
        >
          Close vault
        </Button>

        <ConfirmDialog
          open={closing}
          onClose={() => setClosing(false)}
          title={`Close vault "${v.name}"`}
          confirmLabel="Close vault"
          pending={pending}
          onConfirm={() =>
            void send({
              label: "Close vault",
              vault: v.address,
              build: () => api.build("vault/close", { payer: owner, vault: v.address }),
            })
          }
        >
          This closes the vault, share mint and escrows. It cannot be undone.
        </ConfirmDialog>
      </div>
    </details>
  );
}
