"use client";

import Image from "next/image";
import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings } from "@/hooks/queries";
import type { VaultDetail } from "@/lib/types";
import { PoweredBy } from "./powered-by";
import { SwapCard } from "./swap-card";

/** The same vault-swap card as the Markets tab, floating over every manage tab so it isn't Markets-only. */
export function QuickSwap({ v, owner }: { v: VaultDetail; owner: string }) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useState<{ from?: string; to?: string; amount?: string }>({});
  const holdings = useHoldings(v.address);

  return (
    <div className="fixed bottom-4 left-4 z-40 w-80">
      {open && (
        <Card className="mb-2 bg-none bg-surface shadow-xl">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Quick swap</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {holdings.data ? (
              <SwapCard v={v} owner={owner} holdings={holdings.data} initial={params} onParamsChange={setParams} />
            ) : (
              <Skeleton className="h-64" />
            )}
            <PoweredBy protocol="jupiter" />
          </CardBody>
        </Card>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          open
            ? "flex size-11 items-center justify-center rounded-full border border-border bg-surface text-lg shadow-lg hover:bg-white/[0.06]"
            : "flex size-11 items-center justify-center hover:opacity-80"
        }
        aria-label={open ? "Close quick swap" : "Open quick swap"}
      >
        {open ? "✕" : <Image src="/jupiter.svg" alt="" width={44} height={44} />}
      </button>
    </div>
  );
}
