import type { ReactNode } from "react";

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center">
    <h3 className="text-[15px] font-semibold">{title}</h3>
    {description && (
      <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
