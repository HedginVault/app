import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tones = {
  neutral: "bg-white/[0.06] text-white/80",
  accent: "bg-accent-soft text-sky-400",
  warning: "bg-warning-soft text-amber-300",
  danger: "bg-danger-soft text-red-300",
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
