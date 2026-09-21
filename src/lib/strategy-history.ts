/** Exact per-mint cash-flow result. Inputs and output are signed base-unit decimal strings. */
export function realizedPnlBaseUnits(
  contributed: string,
  returned: string,
  feesRetained: string,
): string {
  return (BigInt(returned) + BigInt(feesRetained) - BigInt(contributed)).toString();
}
