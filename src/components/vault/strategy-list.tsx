import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { formatRelative, formatTokenAmount } from "@/lib/format";
import type { StrategyView } from "@/lib/types";

export function StrategyList({ strategies }: { strategies: StrategyView[] }) {
  if (strategies.length === 0) return <p className="px-5 py-6 text-sm text-muted">No open strategies. All funds are idle in the vault.</p>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>Type</Th>
          <Th>Target</Th>
          <Th className="text-right">Holdings</Th>
          <Th className="text-right">Last action</Th>
        </tr>
      </thead>
      <tbody>
        {strategies.map((s) => (
          <tr key={s.address}>
            <Td className="text-muted">{s.id}</Td>
            <Td><Badge tone={s.type === "dlmm" ? "accent" : "neutral"}>{s.type === "dlmm" ? "Meteora DLMM" : "Jupiter"}</Badge></Td>
            <Td>
              {s.type === "jupiter" ? (
                <span className="flex items-center gap-2">{s.symbol} <Address value={s.targetMint} /></span>
              ) : (
                <span className="flex items-center gap-2">{s.tokenX.symbol}/{s.tokenY.symbol} <Address value={s.position} /> <span className="text-[12px] text-muted">bins {s.lowerBinId}…{s.upperBinId} (active {s.activeBinId})</span></span>
              )}
            </Td>
            <Td className="text-right">
              {s.type === "jupiter"
                ? `${formatTokenAmount(s.vaultBalance, s.decimals, { maxFraction: 4 })} ${s.symbol}`
                : `${formatTokenAmount(s.amountX, s.tokenX.decimals, { maxFraction: 4 })} ${s.tokenX.symbol} · ${formatTokenAmount(s.amountY, s.tokenY.decimals, { maxFraction: 2 })} ${s.tokenY.symbol}`}
            </Td>
            <Td className="text-right text-muted">{s.lastActionTs ? formatRelative(s.lastActionTs) : "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
