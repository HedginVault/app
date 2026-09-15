"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Popover({
  open,
  onOpenChange,
  trigger,
  align = "end",
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger}
      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-1.5 min-w-44 rounded-[10px] border border-border bg-surface p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
