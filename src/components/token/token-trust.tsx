import { cn } from "@/lib/cn";
import type { OrganicScoreLabel } from "@/lib/types";

/** Check mark shown next to a token verified by Jupiter (or Meteora for pool tokens). */
export const VerifiedMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" role="img" aria-label="Verified" className={cn("size-3.5 shrink-0 text-emerald-600", className)}>
    <title>Verified</title>
    <circle cx="8" cy="8" r="8" fill="currentColor" />
    <path d="M4.75 8.25 7 10.5l4.25-4.75" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SCORE_TONES: Record<OrganicScoreLabel, string> = {
  high: "bg-accent-soft text-emerald-700",
  medium: "bg-warning-soft text-amber-700",
  low: "bg-danger-soft text-red-700",
};

/** Jupiter organic score (0–100), tinted by Jupiter's own high/medium/low label. */
export const TokenScore = ({ score, label }: { score: number; label: OrganicScoreLabel | null }) => (
  <span
    title="Jupiter organic score"
    className={cn(
      "inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-medium tabular-nums",
      label ? SCORE_TONES[label] : "bg-slate-100 text-slate-700",
    )}
  >
    {Math.round(score)}
  </span>
);
