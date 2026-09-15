"use client";

import { useState } from "react";
import { TokenAmount } from "@/components/token/token-amount";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { useRequests } from "@/hooks/queries";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { api } from "@/lib/api";
import { formatRelative, formatTokenAmount, usdValue } from "@/lib/format";
import type { BuiltTransaction, RequestState, VaultDetail } from "@/lib/types";

const StateBadge = ({ state }: { state: RequestState }) => (
  <Badge tone={state === "resolvable" ? "accent" : "warning"}>
    {state === "resolvable" ? "Ready" : "Pending"}
  </Badge>
);

export function RequestsTab({ v, owner }: { v: VaultDetail; owner: string }) {
  const requests = useRequests(v.address);
  const { send, pending } = useSendTransaction();
  // Which button started the in-flight transaction, so only that one shows a spinner.
  const [active, setActive] = useState<string | null>(null);
  const q = requests.data;
  const ready = q
    ? q.deposits.filter((r) => r.state === "resolvable").length +
      q.withdrawals.filter((r) => r.state === "resolvable").length
    : 0;

  const rowKey = (kind: "deposit" | "withdrawal", user: string) => `${kind}:${user}`;

  const resolveOne = (kind: "deposit" | "withdrawal", user: string) => {
    setActive(rowKey(kind, user));
    void send({
      label: `Resolve ${kind}`,
      vault: v.address,
      build: () =>
        api.build(`${kind}/resolve`, {
          payer: owner,
          vault: v.address,
          [kind === "deposit" ? "depositor" : "withdrawer"]: user,
        }),
    }).finally(() => setActive(null));
  };

  const resolveAll = () => {
    setActive("batch");
    void send({
      label: "Resolve all",
      vault: v.address,
      build: () =>
        api.build<BuiltTransaction[]>("resolve-batch", { payer: owner, vault: v.address }),
    }).finally(() => setActive(null));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {ready} request{ready === 1 ? "" : "s"} ready to resolve. Requests become ready after a
          NAV update in a later epoch.
        </p>
        <Button disabled={ready === 0} loading={pending && active === "batch"} onClick={resolveAll}>
          Resolve all ready
        </Button>
      </div>
      {requests.error ? (
        <p className="text-sm text-danger">{requests.error.message}</p>
      ) : !q ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <Card>
            <CardHeader title={`Deposits (${q.deposits.length})`} />
            {q.deposits.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No pending deposits.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Depositor</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Epoch</Th>
                    <Th>Age</Th>
                    <Th>State</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {q.deposits.map((r) => (
                    <tr key={r.owner}>
                      <Td>
                        <Address value={r.owner} />
                      </Td>
                      <Td className="text-right">
                        <TokenAmount
                          raw={r.amount}
                          token={{ symbol: v.depositSymbol, decimals: v.depositDecimals }}
                          usd={usdValue(r.amount, v.depositDecimals, v.depositPriceUsd)}
                          align="right"
                        />
                      </Td>
                      <Td>{r.epoch}</Td>
                      <Td className="text-muted">{formatRelative(r.createdTs)}</Td>
                      <Td>
                        <StateBadge state={r.state} />
                      </Td>
                      <Td className="text-right">
                        {r.state === "resolvable" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={pending && active === rowKey("deposit", r.owner)}
                            onClick={() => resolveOne("deposit", r.owner)}
                          >
                            Resolve
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHeader title={`Withdrawals (${q.withdrawals.length})`} />
            {q.withdrawals.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No pending withdrawals.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Withdrawer</Th>
                    <Th className="text-right">Shares</Th>
                    <Th>Epoch</Th>
                    <Th>Age</Th>
                    <Th>State</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {q.withdrawals.map((r) => (
                    <tr key={r.owner}>
                      <Td>
                        <Address value={r.owner} />
                      </Td>
                      <Td className="text-right">
                        {formatTokenAmount(r.shares, v.depositDecimals)}
                      </Td>
                      <Td>{r.epoch}</Td>
                      <Td className="text-muted">{formatRelative(r.createdTs)}</Td>
                      <Td>
                        <StateBadge state={r.state} />
                      </Td>
                      <Td className="text-right">
                        {r.state === "resolvable" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={pending && active === rowKey("withdrawal", r.owner)}
                            onClick={() => resolveOne("withdrawal", r.owner)}
                          >
                            Resolve
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
