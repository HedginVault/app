import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export const Stat = ({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "accent" | "warning" | "danger";
}) => (
  <div className="rounded-[10px] border border-border bg-surface px-4 py-3">
    <div className="text-[12px] font-medium text-muted">{label}</div>
    <div
      className={cn(
        "mt-1 text-lg font-semibold tabular-nums tracking-tight",
        tone === "accent" && "text-emerald-700",
        tone === "warning" && "text-amber-700",
        tone === "danger" && "text-red-700",
      )}
    >
      {value}
    </div>
    {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
  </div>
);
