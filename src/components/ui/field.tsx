import type { ReactNode } from "react";

export const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
      {label}
    </span>
    {children}
    {error ? (
      <span className="mt-1 block text-[12px] text-danger">{error}</span>
    ) : hint ? (
      <span className="mt-1 block text-[12px] text-muted">{hint}</span>
    ) : null}
  </label>
);
