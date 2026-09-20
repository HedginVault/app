/** Blue, cyan, violet, amber, pink, teal; slate is reserved for "Other". */
export const PALETTE = ["#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#94a3b8"] as const;

const MIN_WIDTH_PCT = 2;

export function shareBps(value: bigint | null, total: bigint): number | null {
  if (value === null || total <= 0n) return null;
  return Number((value * 10_000n) / total);
}

export interface SliceInput {
  key: string;
  label: string;
  value: bigint | null;
  usd: number | null;
  logo?: string | null;
}

export interface Slice extends SliceInput {
  shareBps: number | null;
  color: string;
}

const byValueDesc = (a: SliceInput, b: SliceInput) => {
  if (a.value === null) return b.value === null ? 0 : 1;
  if (b.value === null) return -1;
  return a.value === b.value ? 0 : a.value > b.value ? -1 : 1;
};

export function toSlices(items: SliceInput[], total: bigint, maxSlices = PALETTE.length - 1): Slice[] {
  const sorted = [...items].sort(byValueDesc);
  let kept = sorted;
  if (sorted.length > maxSlices) {
    kept = sorted.slice(0, maxSlices - 1);
    const rest = sorted.slice(maxSlices - 1);
    const known = rest.filter((r) => r.value !== null);
    const usdKnown = rest.every((r) => r.usd !== null);
    kept.push({
      key: "other",
      label: "Other",
      value: known.length ? known.reduce((a, r) => a + (r.value as bigint), 0n) : null,
      usd: usdKnown ? rest.reduce((a, r) => a + (r.usd as number), 0) : null,
    });
  }
  return kept.map((s, i) => ({
    ...s,
    shareBps: shareBps(s.value, total),
    color: s.key === "other" ? PALETTE[PALETTE.length - 1] : PALETTE[Math.min(i, PALETTE.length - 2)],
  }));
}

/**
 * Bar segment widths in percent, summing to 100. Slices below 2% are pinned at exactly 2%; the
 * remaining width is shared by the larger slices in proportion to their share.
 */
export function barWidths(slices: Slice[]): number[] {
  const raw = slices.map((s) => (s.shareBps && s.shareBps > 0 ? s.shareBps : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum === 0) return raw.map(() => 0);
  const small = raw.map((w) => w > 0 && (w / sum) * 100 < MIN_WIDTH_PCT);
  const pinned = small.filter(Boolean).length * MIN_WIDTH_PCT;
  const bigSum = raw.reduce((a, w, i) => (small[i] ? a : a + w), 0);
  const visible = raw.filter((w) => w > 0).length;
  return raw.map((w, i) => {
    if (w === 0) return 0;
    if (bigSum === 0) return 100 / visible;
    return small[i] ? MIN_WIDTH_PCT : (w / bigSum) * (100 - pinned);
  });
}
