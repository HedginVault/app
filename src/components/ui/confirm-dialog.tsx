"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Destructive-action confirmation. Replaces window.confirm so the prompt matches the app. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  confirmLabel = "Confirm",
  pending,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={pending}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[13px] text-muted">{children}</div>
    </Dialog>
  );
}
