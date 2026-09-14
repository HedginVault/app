import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export const Input = ({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-sm tabular-nums placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-slate-50",
      className,
    )}
    {...rest}
  />
);
