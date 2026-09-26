import "server-only";
import { Pool } from "pg";

export interface KeyRow {
  id: string; digest: string; manager: string; vaults: string[] | null; actions: string[];
  expiresAt: Date | null; revokedAt: Date | null;
}

let pool: Pool | undefined;
export const keyStoreConfigured = (): boolean => Boolean(process.env.API_KEYS_DATABASE_URL?.trim());

/** Read-only role (SELECT on api_keys). Throws on any DB error; the caller must fail closed. */
export async function findKey(id: string): Promise<KeyRow | null> {
  const url = process.env.API_KEYS_DATABASE_URL?.trim();
  if (!url) throw new Error("API_KEYS_DATABASE_URL is not set");
  pool ??= new Pool({ connectionString: url, max: 3, statement_timeout: 3_000, connectionTimeoutMillis: 3_000 });
  const r = await pool.query(
    "select id, digest, manager, vaults, actions, expires_at, revoked_at from api_keys where id = $1", [id]);
  const x = r.rows[0];
  return x ? { id: x.id, digest: x.digest, manager: x.manager, vaults: x.vaults, actions: x.actions, expiresAt: x.expires_at, revokedAt: x.revoked_at } : null;
}
