/**
 * Port of the keeper's `computeValuation` for the live holdings view.
 * Same arithmetic; the one difference is that a missing price yields `value: null` instead of throwing.
 */
export type HoldingKind = "idle" | "jupiter" | "dlmm_x" | "dlmm_y" | "dlmm_fee_x" | "dlmm_fee_y";

export interface RawHolding {
  kind: HoldingKind;
  /** Strategy PDA, null for the idle balance. */
  strategy: string | null;
  mint: string;
  decimals: number;
  amount: bigint;
}

export interface ValuedHolding extends RawHolding {
  /** Deposit-mint base units, null when a needed price is unavailable. */
  value: bigint | null;
}

/** Pending DLMM fees count net of the 10 % treasury cut taken on claim. */
export const FEE_RETAINED_BPS = 9000n;
const MAX_BPS = 10_000n;
const PRICE_SCALE = 1_000_000_000;

const scalePrice = (price: number) => BigInt(Math.round(price * PRICE_SCALE));
const isFee = (kind: HoldingKind) => kind === "dlmm_fee_x" || kind === "dlmm_fee_y";
const usable = (p: number | undefined): p is number => p !== undefined && Number.isFinite(p) && p > 0;

export function valueHoldings({
  deposit,
  holdings,
  prices,
}: {
  deposit: { mint: string; decimals: number };
  holdings: RawHolding[];
  prices: Map<string, number>;
}) {
  const depositPrice = prices.get(deposit.mint);
  const unpriced = new Set<string>();
  let total = 0n;

  const out: ValuedHolding[] = holdings.map((h) => {
    let value: bigint | null;
    if (h.mint === deposit.mint) {
      value = h.amount;
    } else {
      const price = prices.get(h.mint);
      if (!usable(price) || !usable(depositPrice)) {
        unpriced.add(h.mint);
        value = null;
      } else {
        const num = h.amount * scalePrice(price) * 10n ** BigInt(deposit.decimals);
        const den = scalePrice(depositPrice) * 10n ** BigInt(h.decimals);
        value = num / den;
      }
    }
    if (value !== null && isFee(h.kind)) value = (value * FEE_RETAINED_BPS) / MAX_BPS;
    if (value !== null) total += value;
    return { ...h, value };
  });

  return { holdings: out, total, partial: unpriced.size > 0, unpriced: [...unpriced] };
}
