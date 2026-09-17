"use client";

import { Button } from "./button";

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="rounded-card border border-red-400/30 bg-danger-soft px-5 py-4 text-sm text-red-200">
    <div className="flex items-center justify-between gap-4">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  </div>
);
