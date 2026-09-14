import type { ReactNode } from "react";

export const Page = ({
  title,
  description,
  children,
  aside,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) => (
  <main className="mx-auto w-full max-w-6xl px-6 py-8">
    {(title || description) && (
      <div className="mb-6">
        {title && (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        )}
        {description && (
          <div className="mt-1 text-sm text-muted">{description}</div>
        )}
      </div>
    )}
    {aside ? (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">{children}</div>
        <div className="lg:sticky lg:top-24 lg:self-start">{aside}</div>
      </div>
    ) : (
      children
    )}
  </main>
);
