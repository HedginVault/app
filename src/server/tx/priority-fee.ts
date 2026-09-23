import type { Connection, PublicKey } from "@solana/web3.js";

const MIN_MICRO_LAMPORTS = 1_000;
const MAX_MICRO_LAMPORTS = 10_000;

/** Bounded upper-quartile fee: enough to compete without allowing an RPC response to overspend. */
export function selectPriorityFeeMicroLamports(samples: number[]): number {
  const sorted = samples.filter((fee) => Number.isSafeInteger(fee) && fee >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) return MIN_MICRO_LAMPORTS;
  const upperQuartile = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  return Math.max(MIN_MICRO_LAMPORTS, Math.min(MAX_MICRO_LAMPORTS, upperQuartile));
}

/** RPC fee sampling is advisory; an unavailable fee endpoint falls back to the bounded minimum. */
export async function getPriorityFeeMicroLamports(
  connection: Connection,
  writableAccounts: PublicKey[],
): Promise<number> {
  try {
    const samples = await connection.getRecentPrioritizationFees({ lockedWritableAccounts: writableAccounts });
    return selectPriorityFeeMicroLamports(samples.map(({ prioritizationFee }) => prioritizationFee));
  } catch {
    return MIN_MICRO_LAMPORTS;
  }
}
