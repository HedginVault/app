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
    className={cn("rounded-card border border-border bg-gradient-to-b from-white/[0.05] to-white/[0.02]", className)}
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
  <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
    <div>
      <h2 className="font-serif text-2xl leading-tight">{title}</h2>
      {description && (
        <p className="mt-1 text-[13px] text-muted">{description}</p>
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
}) => <div className={cn("px-6 py-5", className)}>{children}</div>;
