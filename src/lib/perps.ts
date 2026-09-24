import { formatUsd, toUiNumber } from "./format";
import type { PerpPositionView } from "./types";

/** Phoenix amounts are USDC atoms: one quote lot each. */
export const USDC_DECIMALS = 6;

export const usdc = (raw: string | bigint) => toUiNumber(raw, USDC_DECIMALS);

export function perpTotals(p: Pick<PerpPositionView, "positions">) {
  return p.positions.reduce(
    (a, q) => ({
      unrealizedPnl: a.unrealizedPnl + BigInt(q.unrealizedPnl),
      accruedFunding: a.accruedFunding + BigInt(q.accruedFunding),
      notional: a.notional + BigInt(q.notional),
    }),
    { unrealizedPnl: 0n, accruedFunding: 0n, notional: 0n },
  );
}

export function formatSignedUsd(raw: string | bigint): string {
  const n = usdc(raw);
  return n > 0 ? `+${formatUsd(n)}` : formatUsd(n);
}

export const formatLeverage = (leverage: number | null) => (leverage === null ? "—" : `${leverage.toFixed(2)}x`);
