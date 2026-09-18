"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatRelative, formatTokenAmount } from "@/lib/format";
import type { DepositRequestView, VaultDetail, WithdrawalRequestView } from "@/lib/types";

type Props = { v: VaultDetail; owner: string } & (
  | { kind: "deposit"; request: DepositRequestView }
  | { kind: "withdrawal"; request: WithdrawalRequestView }
);

export function PendingRequest(props: Props) {
  const { v, owner, kind, request } = props;
  const { send, pending } = useSendTransaction();
  const amount =
    props.kind === "deposit"
      ? `${formatTokenAmount(props.request.amount, v.depositDecimals)} ${v.depositSymbol}`
      : `${formatTokenAmount(props.request.shares, v.depositDecimals)} shares`;
  const ready = request.state === "resolvable";
  const claimLabel = kind === "deposit" ? "Claim shares" : `Claim ${v.depositSymbol}`;

  return (
    <div className="rounded-[10px] border border-border bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium capitalize">{kind} request</span>
        <Badge tone={ready ? "accent" : "warning"}>{ready ? "Ready to claim" : "Pending NAV update"}</Badge>
      </div>
      <div className="mt-1 text-sm tabular-nums">{amount}</div>
      <div className="text-[12px] text-muted">Requested {formatRelative(request.createdTs)} · epoch {request.epoch}</div>
      <div className="mt-3 flex gap-2">
        {ready && (
          <Button
            size="sm"
            loading={pending}
            onClick={() =>
              send({
                label: claimLabel,
                vault: v.address,
                build: () => api.build(`${kind}/resolve`, { payer: owner, vault: v.address, [kind === "deposit" ? "depositor" : "withdrawer"]: owner }),
              })
            }
          >
            {claimLabel}
          </Button>
        )}
        {request.cancellable && (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() => send({ label: `Cancel ${kind}`, vault: v.address, build: () => api.build(`${kind}/cancel`, { payer: owner, vault: v.address }) })}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
