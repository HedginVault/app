"use client";

import { explorerUrl } from "@/lib/constants";
import { shortAddress } from "@/lib/format";

export interface TxToastProps {
  title: string;
  subtitle?: string;
  tone: "loading" | "success" | "error";
  /** Confirmed transaction signatures, listed only once the run has finished. */
  signatures?: string[];
  /** Long-form failure text (message + program logs). */
  errorText?: string;
  onClose: () => void;
}

function StatusIcon({ tone }: { tone: TxToastProps["tone"] }) {
  if (tone === "loading")
    return <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />;
  if (tone === "success")
    return (
      <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="m5.5 8.2 1.8 1.8 3.2-3.6" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-danger" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="m6 6 4 4m0-4-4 4" />
    </svg>
  );
}

export function TxToast({ title, subtitle, tone, signatures = [], errorText, onClose }: TxToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="w-[356px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-4 text-foreground shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1">
          <StatusIcon tone={tone} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-snug">{title}</div>
          {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>

      {signatures.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {signatures.map((sig) => (
            <li key={sig} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-mono text-muted">{shortAddress(sig, 8)}</span>
              <a
                href={explorerUrl("tx", sig)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sky-400 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                View<span className="sr-only"> transaction {shortAddress(sig, 4)} on explorer</span> ↗
              </a>
            </li>
          ))}
        </ul>
      )}

      {errorText && (
        <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-[10px] bg-danger-soft px-3 py-2 text-[12px] text-red-200">
          {errorText}
        </pre>
      )}
    </div>
  );
}
