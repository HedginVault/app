"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { WalletButton } from "@/components/wallet-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { usePosition } from "@/hooks/queries";
import { formatTokenAmount } from "@/lib/format";
import type { VaultDetail } from "@/lib/types";
import { DepositForm } from "./deposit-form";
import { PendingRequest } from "./pending-request";
import { WithdrawForm } from "./withdraw-form";

export function PositionPanel({ v }: { v: VaultDetail }) {
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58();
  const position = usePosition(v.address, owner);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");

  return (
    <Card>
      <CardHeader title="Your position" description={owner ? undefined : "Connect a wallet to deposit or withdraw"} />
      <CardBody className="space-y-4">
        {!owner ? (
          <WalletButton />
        ) : position.error ? (
          <p className="text-sm text-danger">{position.error.message}</p>
        ) : !position.data ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12px] text-muted">Shares</div>
                <div className="text-lg font-semibold tabular-nums">{formatTokenAmount(position.data.shares, v.depositDecimals, { maxFraction: 4 })}</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">Value</div>
                <div className="text-lg font-semibold tabular-nums">{formatTokenAmount(position.data.valueAtNav, v.depositDecimals, { maxFraction: 2 })} {v.depositSymbol}</div>
              </div>
            </div>
            {position.data.depositRequest && <PendingRequest kind="deposit" request={position.data.depositRequest} v={v} owner={owner} />}
            {position.data.withdrawalRequest && <PendingRequest kind="withdrawal" request={position.data.withdrawalRequest} v={v} owner={owner} />}
            <Tabs tabs={[{ id: "deposit", label: "Deposit" }, { id: "withdraw", label: "Withdraw" }]} value={tab} onChange={setTab} />
            {tab === "deposit" ? <DepositForm v={v} position={position.data} owner={owner} /> : <WithdrawForm v={v} position={position.data} owner={owner} />}
          </>
        )}
      </CardBody>
    </Card>
  );
}
