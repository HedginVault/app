import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { pubkey } from "@/server/route";
import { findKey, keyStoreConfigured, type KeyRow } from "./key-store";

const keyRecord = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  manager: pubkey,
  vaults: z.array(pubkey).optional(),
  actions: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
  revoked: z.boolean().optional(),
}).strict();

export type Principal = z.infer<typeof keyRecord>;

function configuredKeys(): Principal[] {
  try {
    const parsed = z.array(keyRecord).parse(JSON.parse(process.env.MANAGER_API_KEYS || "[]"));
    if (new Set(parsed.map((key) => key.id)).size !== parsed.length) throw new Error("duplicate key id");
    return parsed;
  } catch {
    throw new ApiError(503, "ApiUnavailable", "Manager API configuration is invalid");
  }
}

const CACHE_MS = 5_000;
const CACHE_MAX = 1_000;
const cache = new Map<string, { at: number; row: KeyRow | null }>();
export const resetKeyCache = (): void => cache.clear();

const warnKeyStore = (fields: Record<string, string | undefined>): void =>
  console.warn("[manager-api]", JSON.stringify({ component: "key-store", ...fields }));
const unavailable = (): ApiError => new ApiError(503, "ApiUnavailable", "Key store unavailable");

function principalFromRow(r: KeyRow): Principal | null {
  try {
    const parsed = keyRecord.safeParse({
      id: r.id, digest: r.digest, manager: r.manager, vaults: r.vaults ?? undefined, actions: r.actions,
      expiresAt: r.expiresAt?.toISOString(), revoked: r.revokedAt !== null,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function lookup(id: string): Promise<Principal | null> {
  if (keyStoreConfigured()) {
    let hit = cache.get(id);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      try {
        hit = { at: Date.now(), row: await findKey(id) };
      } catch (e) {
        // Fail closed: a DB outage must not let env records resurrect a key revoked in the DB.
        // Log only the error name and pg code, never the message (it can carry the connection URL).
        const code = typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : undefined;
        warnKeyStore({ outcome: "lookup_failed", err: e instanceof Error ? e.name : "unknown", code });
        throw unavailable();
      }
      if (cache.size >= CACHE_MAX) cache.clear();
      cache.set(id, hit);
    }
    if (hit.row) {
      const principal = principalFromRow(hit.row);
      if (!principal) {
        // A malformed row is a store fault, not a missing key: fail closed and never fall back to env.
        warnKeyStore({ outcome: "invalid_row", keyId: id });
        throw unavailable();
      }
      return principal;
    }
  }
  return configuredKeys().find((entry) => entry.id === id) ?? null;
}

export async function authenticate(req: Request): Promise<Principal> {
  const match = /^Bearer hv1_([a-zA-Z0-9_-]{1,48})_([a-zA-Z0-9_-]{32,128})$/.exec(req.headers.get("authorization") ?? "");
  if (!match) throw new ApiError(401, "Unauthorized", "Invalid API key");
  const key = await lookup(match[1]);
  const actual = createHash("sha256").update(match[2]).digest();
  const expected = Buffer.from(key?.digest ?? "0".repeat(64), "hex");
  if (!timingSafeEqual(actual, expected) || !key || key.revoked ||
    (key.expiresAt && Date.parse(key.expiresAt) <= Date.now()))
    throw new ApiError(401, "Unauthorized", "Invalid API key");
  return key;
}

export function assertAction(principal: Principal, action: string): void {
  if (!principal.actions.includes(action)) throw new ApiError(403, "Forbidden", "Action is not enabled for this key");
}
