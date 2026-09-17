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
  <div className="rounded-card border border-dashed border-white/15 px-6 py-16 text-center">
    <h3 className="font-serif text-2xl">{title}</h3>
    {description && (
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
    )}
    {action && <div className="mt-6 flex justify-center">{action}</div>}
  </div>
);
