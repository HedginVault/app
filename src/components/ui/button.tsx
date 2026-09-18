"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

const variants = {
  primary:
    "bg-accent text-accent-foreground hover:bg-emerald-300 disabled:bg-emerald-400/30 disabled:text-white/40",
  secondary:
    "bg-white/[0.04] text-foreground border border-border hover:bg-white/[0.08] disabled:text-white/40",
  ghost: "text-foreground hover:bg-white/[0.06] disabled:text-white/40",
  danger: "bg-danger text-white hover:bg-red-300 disabled:bg-red-400/30",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-11 px-5 text-sm",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
