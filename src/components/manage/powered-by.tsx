"use client";

import Image from "next/image";

export const JupiterIcon = () => (
  <Image src="/jupiter.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
);

export const MeteoraIcon = () => (
  <Image src="/meteora.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
);

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
