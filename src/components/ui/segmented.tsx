"use client";

import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { id: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex gap-0.5 rounded-[10px] bg-slate-100 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:text-slate-400",
            size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
            value === o.id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
