"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import type { VaultDetail } from "@/lib/types";
import { closePreconditions } from "@/lib/vault-logic";

export function DangerZone({ v, owner }: { v: VaultDetail; owner: string }) {
  const { send, pending } = useSendTransaction();
  const unmet = closePreconditions(v);
  return (
    <Card className="border-red-200">
      <CardHeader
        title="Close vault"
        description="Closes the vault, share mint and escrows and returns rent to the authority. Irreversible."
      />
      <CardBody className="space-y-4">
        {unmet.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {unmet.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-700">All preconditions are met.</p>
        )}
        <Button
          variant="danger"
          disabled={unmet.length > 0}
          loading={pending}
          onClick={() => {
            if (window.confirm(`Close vault "${v.name}"? This cannot be undone.`))
              void send({
                label: "Close vault",
                vault: v.address,
                build: () => api.build("vault/close", { payer: owner, vault: v.address }),
              });
          }}
        >
          Close vault
        </Button>
      </CardBody>
    </Card>
  );
}
