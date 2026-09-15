"use client";

import { useId } from "react";

const JupiterIcon = () => {
  const g = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-4 shrink-0">
      <defs>
        <linearGradient id={g} x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B6E7" />
          <stop offset="1" stopColor="#C7F284" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="#141726" />
      <g fill="none" stroke={`url(#${g})`} strokeWidth="2.4" strokeLinecap="round">
        <path d="M7 21.5c4-1 9.5-4.5 13.5-11" />
        <path d="M8.5 25c5-1.5 11-6 15-13" />
        <path d="M6.5 17c3-.8 7-3.5 9.5-8" />
      </g>
    </svg>
  );
};

const MeteoraIcon = () => {
  const g = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-4 shrink-0">
      <defs>
        <linearGradient id={g} x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5501E" />
          <stop offset="1" stopColor="#FFB547" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="#1B1A2E" />
      <circle cx="19.5" cy="12.5" r="5" fill={`url(#${g})`} />
      <g stroke={`url(#${g})`} strokeWidth="2" strokeLinecap="round">
        <path d="M15 17 8 24" />
        <path d="M12.5 13.5 7 19" />
        <path d="M18.5 19.5 13 25" />
      </g>
    </svg>
  );
};

const PROTOCOLS = {
  jupiter: { name: "Jupiter", Icon: JupiterIcon },
  meteora: { name: "Meteora", Icon: MeteoraIcon },
} as const;

/** "Powered by <icon> Protocol" attribution for the integration behind a manager panel. */
export function PoweredBy({ protocol }: { protocol: keyof typeof PROTOCOLS }) {
  const { name, Icon } = PROTOCOLS[protocol];
  return (
    <p className="-mt-2 flex items-center justify-center gap-1.5 text-[12px] text-muted">
      Powered by
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        <Icon />
        {name}
      </span>
    </p>
  );
}
