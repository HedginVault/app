import type { ReactNode } from "react";

export const Page = ({
  title,
  description,
  children,
  aside,
  action,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  action?: ReactNode;
}) => (
  <main className="mx-auto w-full max-w-6xl px-6 pt-10 pb-24">
    {(title || description) && (
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          {title && (
            <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{title}</h1>
          )}
          {description && (
            <div className="mt-3 text-white/60">{description}</div>
          )}
        </div>
        {action}
      </div>
    )}
    {aside ? (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">{children}</div>
        <div className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">{aside}</div>
      </div>
    ) : (
      children
    )}
  </main>
);
