import "server-only";
import { Pool } from "pg";
import type { NavHistoryPoint } from "@/lib/types";
import { ApiError } from "../errors";

interface NavHistoryRow {
  epoch: string;
  ts: string | null;
  total_assets: string;
  nav_per_share: string;
  high_water_mark: string;
  overridden: boolean;
}

let pool: Pool | undefined;

const db = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new ApiError(503, "HistoryUnavailable", "NAV history is not configured");
  pool ??= new Pool({ connectionString: databaseUrl, max: 5 });
  return pool;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2000;

/** Oldest-to-newest, so the caller can plot it directly. */
export async function readNavHistory(vault: string, limit = DEFAULT_LIMIT): Promise<NavHistoryPoint[]> {
  const bounded = Math.max(1, Math.min(limit, MAX_LIMIT));
  const result = await db().query<NavHistoryRow>(
    `select epoch, ts, total_assets, nav_per_share, high_water_mark, overridden
       from nav_history
      where vault_address = $1
      order by epoch desc
      limit $2`,
    [vault, bounded],
  );
  return result.rows
    .map((row) => ({
      epoch: Number(row.epoch),
      ts: row.ts === null ? null : Number(row.ts),
      totalAssets: row.total_assets,
      navPerShare: row.nav_per_share,
      highWaterMark: row.high_water_mark,
      overridden: row.overridden,
    }))
    .reverse();
}
