import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export const Card = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <section
    className={cn("rounded-card border border-border bg-surface", className)}
  >
    {children}
  </section>
);

export const CardHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
    <div>
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      )}
    </div>
    {action}
  </header>
);

export const CardBody = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => <div className={cn("px-5 py-4", className)}>{children}</div>;
