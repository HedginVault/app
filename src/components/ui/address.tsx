"use client";

import { toast } from "sonner";
import { explorerUrl } from "@/lib/constants";
import { shortAddress } from "@/lib/format";

export function Address({ value, chars = 4 }: { value: string; chars?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
      <a
        href={explorerUrl("address", value)}
        target="_blank"
        rel="noreferrer"
        className="text-white/80 underline-offset-2 hover:underline"
      >
        {shortAddress(value, chars)}
      </a>
      <button
        type="button"
        aria-label="Copy address"
        className="rounded p-0.5 text-white/40 hover:bg-white/[0.06] hover:text-white/80"
        onClick={() =>
          navigator.clipboard.writeText(value).then(() => toast("Address copied"))
        }
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>
    </span>
  );
}
