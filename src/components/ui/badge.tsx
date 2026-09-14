import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  accent: "bg-accent-soft text-emerald-700",
  warning: "bg-warning-soft text-amber-700",
  danger: "bg-danger-soft text-red-700",
};

export const Badge = ({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium",
      tones[tone],
      className,
    )}
  >
    {children}
  </span>
);
