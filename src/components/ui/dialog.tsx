"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Native modal dialog: focus trap, Escape and backdrop close come from the platform. */
export function Dialog({
  open,
  onClose,
  title,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-slate-900/40",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="border-t border-border px-5 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
