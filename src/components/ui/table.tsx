import { cn } from "@/lib/cn";
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export const Table = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">{children}</table>
  </div>
);

export const Th = ({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide text-muted",
      className,
    )}
    {...rest}
  />
);

export const Td = ({
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn("border-t border-border px-4 py-3 tabular-nums", className)}
    {...rest}
  />
);
