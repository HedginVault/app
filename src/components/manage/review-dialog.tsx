"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import type { StepProgress } from "@/lib/tx-steps";

export interface ReviewRow {
  label: string;
  value: ReactNode;
  tone?: "warn" | "danger";
}

const STATE_LABEL: Record<StepProgress["state"], string> = {
  building: "Preparing",
  signing: "Approve in wallet",
  sending: "Sending",
  confirming: "Confirming",
  done: "Done",
  failed: "Failed",
};

export function ReviewDialog({
  open,
  onClose,
  title,
  rows,
  notes = [],
  steps = [],
  progress,
  confirmLabel,
  onConfirm,
  pending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: ReviewRow[];
  notes?: string[];
  steps?: { label: string }[];
  progress?: StepProgress | null;
  confirmLabel: string;
  onConfirm: () => void;
  pending: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={pending}>
            Back
          </Button>
          <Button className="flex-1" onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
      <dl className="space-y-2 text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className="text-muted">{r.label}</dt>
            <dd className={cn("text-right tabular-nums", r.tone === "warn" && "text-amber-300", r.tone === "danger" && "text-red-300")}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-[10px] bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {steps.length > 1 && (
        <ol className="mt-4 space-y-1.5 text-[13px]">
          {steps.map((s, i) => {
            const state = progress && progress.index === i ? progress.state : progress && progress.index > i ? "done" : null;
            return (
              <li key={s.label} className="flex items-center justify-between">
                <span>
                  {i + 1}. {s.label}
                </span>
                <span className={cn("text-[12px]", state === "failed" ? "text-danger" : state === "done" ? "text-emerald-400" : "text-muted")}>
                  {state ? STATE_LABEL[state] : "Waiting"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
