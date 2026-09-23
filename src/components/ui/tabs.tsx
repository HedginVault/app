"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "pill",
}: {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  /** `underline` is a full-width bar for many tabs; it scrolls sideways on narrow screens. */
  variant?: "pill" | "underline";
}) {
  const underline = variant === "underline";
  return (
    <div
      role="tablist"
      className={cn(
        "flex max-w-full overflow-x-auto",
        underline
          ? "gap-1 border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "gap-1 rounded-full border border-border bg-white/[0.03] p-1",
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "min-w-max text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-400",
            underline
              ? cn(
                  "-mb-px border-b-2 px-3 py-3 sm:px-4",
                  value === t.id ? "border-sky-400 text-white" : "border-transparent text-muted hover:text-foreground",
                )
              : cn(
                  "flex-1 rounded-full px-4 py-2",
                  value === t.id ? "bg-white/10 text-white" : "text-muted hover:text-foreground",
                ),
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
