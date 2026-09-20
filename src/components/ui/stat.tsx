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
  <div className="rounded-card border border-border bg-white/[0.03] px-5 py-4">
    <div className="text-[13px] text-muted">{label}</div>
    <div
      className={cn(
        "mt-1.5 truncate text-xl font-medium tabular-nums tracking-tight",
        tone === "accent" && "text-sky-400",
        tone === "warning" && "text-amber-300",
        tone === "danger" && "text-red-300",
      )}
    >
      {value}
    </div>
    {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
  </div>
);
