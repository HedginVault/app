"use client";

import { useEffect, useState } from "react";
import { nextEpochStart } from "@/lib/vault-logic";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function EpochCountdown({ navEpoch }: { navEpoch: string }) {
  const target = nextEpochStart(BigInt(navEpoch));
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right">
      <div className="text-sm text-muted">Next NAV update</div>
      <div className="text-3xl font-medium tabular-nums">{formatCountdown(target - now)}</div>
    </div>
  );
}
