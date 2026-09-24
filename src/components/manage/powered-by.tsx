"use client";

import Image from "next/image";

export const JupiterIcon = () => (
  <Image src="/jupiter.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
);

export const MeteoraIcon = () => (
  <Image src="/meteora.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
);

/** The Phoenix mark is taller than wide (128×155), so it keeps its ratio at the 16px icon height. */
export const PhoenixIcon = ({ className = "h-4" }: { className?: string }) => (
  <Image src="/phoenix.svg" alt="" width={13} height={16} className={`${className} w-auto shrink-0`} />
);

/** "<icon> Phoenix" in bold, for labelling Phoenix-backed sections. */
export const PhoenixMark = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 font-semibold text-foreground ${className}`}>
    <PhoenixIcon />
    Phoenix
  </span>
);

const PROTOCOLS = {
  jupiter: { name: "Jupiter", Icon: JupiterIcon },
  meteora: { name: "Meteora", Icon: MeteoraIcon },
  phoenix: { name: "Phoenix", Icon: PhoenixIcon },
} as const;

/** "Powered by <icon> Protocol" attribution for the integration behind a manager panel. */
export function PoweredBy({ protocol }: { protocol: keyof typeof PROTOCOLS }) {
  const { name, Icon } = PROTOCOLS[protocol];
  return (
    <p className="-mt-2 flex items-center justify-center gap-1.5 text-[12px] text-muted">
      Powered by
      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
        <Icon />
        {name}
      </span>
    </p>
  );
}
