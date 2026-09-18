export const QUOTE_MAX_AGE_MS = 30_000;

export interface SwapButtonInput {
  operational: boolean;
  hasToken: boolean;
  amount: bigint | null;
  balance: bigint;
  quoteLoading: boolean;
  quoteError: string | null;
  quoteAgeMs: number | null;
}

export interface ActionButton {
  label: string;
  disabled: boolean;
}

const off = (label: string): ActionButton => ({ label, disabled: true });

export function swapButtonState(i: SwapButtonInput): ActionButton {
  if (!i.operational) return off("Vault not operational");
  if (!i.hasToken) return off("Select a token");
  if (i.amount === null || i.amount === 0n) return off("Enter an amount");
  if (i.amount > i.balance) return off("Insufficient vault balance");
  if (i.quoteError) return off("No route found");
  if (i.quoteLoading || i.quoteAgeMs === null) return off("Fetching quote…");
  if (i.quoteAgeMs > QUOTE_MAX_AGE_MS) return off("Refreshing quote…");
  return { label: "Review swap", disabled: false };
}

export const minReceived = (outAmount: bigint, slippageBps: number) =>
  (outAmount * BigInt(10_000 - slippageBps)) / 10_000n;

/** Jupiter reports price impact as a fraction ("0.00018" = 0.018 %). */
export function impactPercent(priceImpactPct: string): number {
  const n = Number(priceImpactPct);
  return Number.isFinite(n) ? n * 100 : 0;
}

export const impactSeverity = (percent: number): "ok" | "warn" | "high" =>
  percent > 5 ? "high" : percent > 1 ? "warn" : "ok";

/** Strategy instructions require `is_vault_operational` and `is_protocol_operational`: both `normal`. */
export const isOperational = (v: { status: string; protocol: { status: string } }) =>
  v.status === "normal" && v.protocol.status === "normal";
