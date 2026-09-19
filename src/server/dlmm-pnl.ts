import "server-only";
import { cached } from "./cache";

const METEORA_HOST = process.env.METEORA_DLMM_API_HOST?.trim() || "https://dlmm.datapi.meteora.ag";
const TTL_MS = 30_000;

interface PnlPosition {
  positionAddress: string;
  pnlUsd: string;
  pnlPctChange: string;
}

interface PnlResponse {
  positions: PnlPosition[];
}

export interface PositionPnl {
  usd: number;
  pct: number;
}

/** Meteora's per-pool PnL endpoint, filtered to one position. A lookup miss or network error yields `null` rather than failing the whole holdings view. */
export const getPositionPnl = (pool: string, owner: string, position: string) =>
  cached(`dlmmpnl:${pool}:${owner}`, TTL_MS, async (): Promise<PositionPnl | null> => {
    let res: Response;
    try {
      res = await fetch(
        `${METEORA_HOST}/positions/${pool}/pnl?user=${owner}&status=open&page_size=100`,
      );
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const body = (await res.json()) as PnlResponse;
    const match = body.positions?.find((p) => p.positionAddress === position);
    if (!match) return null;
    const usd = Number(match.pnlUsd);
    const pct = Number(match.pnlPctChange);
    return Number.isFinite(usd) && Number.isFinite(pct) ? { usd, pct } : null;
  });
