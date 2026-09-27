import "server-only";
import { Pool } from "pg";

let pool: Pool | undefined;
export const resetUsagePool = (): void => { pool = undefined; };

/** Error name and pg code only: messages can carry the database URL or credentials. */
function logFailure(e: unknown): void {
  const name = e instanceof Error ? e.name : "unknown";
  const code = typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : undefined;
  console.warn("[manager-api] usage_write_failed", name, code);
}

/**
 * Counts one request per (key, minute, action, outcome). Fire-and-forget on a write-only role: a slow or
 * failing usage DB must never delay or fail a bot request. Counts are operational, not a billing ledger.
 * ponytail: no retention job for `api_key_usage`; a scheduled delete of old minute buckets is the upgrade path.
 * ponytail: one upsert per request; batch in memory if a key ever runs near the 120/min limit at scale.
 */
export function recordUsage(keyId: string, action: string, outcome: string): void {
  try {
    const url = process.env.API_KEY_USAGE_DATABASE_URL?.trim();
    if (!url) return;
    if (!pool) {
      pool = new Pool({ connectionString: url, max: 2, statement_timeout: 2_000, query_timeout: 2_000, connectionTimeoutMillis: 2_000 });
      // An idle-client error (e.g. DB restart) would otherwise be an uncaught exception. Name only.
      pool.on("error", (e) => console.warn("[manager-api] usage idle client error", e.name));
    }
    void pool.query(
      `insert into api_key_usage (key_id, minute_bucket, action, outcome, count, last_used_at)
       values ($1, date_trunc('minute', now()), $2, $3, 1, now())
       on conflict (key_id, minute_bucket, action, outcome)
       do update set count = api_key_usage.count + 1, last_used_at = now()`,
      [keyId, action.slice(0, 80), outcome.slice(0, 64)],
    ).catch(logFailure);
  } catch (e) {
    logFailure(e);
  }
}
