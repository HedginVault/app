import "server-only";
import { Pool } from "pg";

export interface KeyRow {
  id: string; digest: string; manager: string; vaults: string[] | null; actions: string[];
  expiresAt: Date | null; revokedAt: Date | null;
}

let pool: Pool | undefined;

/** Prefer the dedicated least-privilege URL, with an explicit shared-DB fallback for simple deployments. */
function databaseUrl(): string | undefined {
  return process.env.API_KEYS_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
}

export const keyStoreConfigured = (): boolean => Boolean(databaseUrl());

/** Read-only role (SELECT on api_keys). Throws on any DB error; the caller must fail closed. */
export async function findKey(id: string): Promise<KeyRow | null> {
  const url = databaseUrl();
  if (!url) throw new Error("API_KEYS_DATABASE_URL or DATABASE_URL is not set");
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 3, statement_timeout: 3_000, query_timeout: 3_000, connectionTimeoutMillis: 3_000 });
    // An idle-client error (e.g. DB restart) would otherwise be an uncaught exception. Name only: messages can carry credentials.
    pool.on("error", (e) => console.warn("[key-store] idle client error", e.name));
  }
  const r = await pool.query(
    "select id, digest, manager, vaults, actions, expires_at, revoked_at from api_keys where id = $1", [id]);
  const x = r.rows[0];
  return x ? { id: x.id, digest: x.digest, manager: x.manager, vaults: x.vaults, actions: x.actions, expiresAt: x.expires_at, revokedAt: x.revoked_at } : null;
}
