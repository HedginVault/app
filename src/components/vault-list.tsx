"use client";

import { getMint } from "@solana/spl-token";
import { useEffect, useState } from "react";
import { useProgram } from "@/hooks/use-program";
import { CLUSTER, NAV_PRECISION } from "@/lib/constants";

type Row = {
  address: string;
  name: string;
  status: string;
  totalAssets: string;
  navPerShare: string;
};

const decodeName = (bytes: number[]) =>
  new TextDecoder().decode(Uint8Array.from(bytes)).replace(/\0+$/, "");

const formatUnits = (raw: string, decimals: number) =>
  (Number(raw) / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function VaultList() {
  const { program } = useProgram();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vaults = await program.account.vault.all();
        const decimals = new Map<string, number>();
        for (const { account } of vaults) {
          const mint = account.depositMint.toBase58();
          if (!decimals.has(mint)) {
            decimals.set(mint, (await getMint(program.provider.connection, account.depositMint)).decimals);
          }
        }
        if (cancelled) return;
        setRows(
          vaults.map(({ publicKey, account }) => ({
            address: publicKey.toBase58(),
            name: decodeName(account.name) || `Vault #${account.id.toString()}`,
            status: Object.keys(account.status)[0],
            totalAssets: formatUnits(
              account.totalAssets.toString(),
              decimals.get(account.depositMint.toBase58())!,
            ),
            navPerShare: (account.navPerShare.toNumber() / NAV_PRECISION).toFixed(4),
          })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [program]);

  if (error) return <p className="text-red-500">Failed to load vaults: {error}</p>;
  if (!rows) return <p className="text-foreground/60">Loading vaults…</p>;
  if (rows.length === 0)
    return <p className="text-foreground/60">No vaults found on {CLUSTER}.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full text-left text-sm">
        <thead className="text-foreground/60">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Total assets</th>
            <th className="px-4 py-3 text-right font-medium">NAV / share</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.address} className="border-t border-foreground/10">
              <td className="px-4 py-3">{r.name}</td>
              <td className="px-4 py-3 capitalize">{r.status}</td>
              <td className="px-4 py-3 text-right">{r.totalAssets}</td>
              <td className="px-4 py-3 text-right">{r.navPerShare}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
