"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type TokenLike = { symbol: string; logo: string | null };

const SIZES = {
  xs: "size-4 text-[7px]",
  sm: "size-5 text-[8px]",
  md: "size-7 text-[10px]",
  lg: "size-9 text-[12px]",
} as const;

/** Token image with an initials fallback for a missing or broken logo. */
export function TokenLogo({
  token,
  size = "md",
  className,
}: {
  token: TokenLike;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = token.logo && failed !== token.logo ? token.logo : null;
  const box = cn("inline-flex shrink-0 items-center justify-center rounded-full", SIZES[size], className);
  if (src)
    return (
      // Remote logos come from arbitrary hosts; next/image would need every host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={token.symbol} className={cn(box, "bg-white/[0.06] object-cover")} onError={() => setFailed(src)} />
    );
  return (
    <span aria-label={token.symbol} className={cn(box, "bg-white/10 font-semibold uppercase text-white/60")}>
      {token.symbol.replace(/[^a-z0-9]/gi, "").slice(0, 2) || "?"}
    </span>
  );
}

export function PairLogo({ x, y, size = "md" }: { x: TokenLike; y: TokenLike; size?: keyof typeof SIZES }) {
  return (
    <span className="inline-flex shrink-0 items-center">
      <TokenLogo token={x} size={size} className="ring-2 ring-surface" />
      <TokenLogo token={y} size={size} className="-ml-2 ring-2 ring-surface" />
    </span>
  );
}
