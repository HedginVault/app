import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export const Input = ({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "h-11 w-full rounded-xl border border-border bg-white/[0.03] px-3 text-sm tabular-nums placeholder:text-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-white/[0.03]",
      className,
    )}
    {...rest}
  />
);
