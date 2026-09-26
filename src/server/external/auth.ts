import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { pubkey } from "@/server/route";

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

export function authenticate(req: Request): Principal {
  const match = /^Bearer hv1_([a-zA-Z0-9_-]{1,48})_([a-zA-Z0-9_-]{32,128})$/.exec(req.headers.get("authorization") ?? "");
  if (!match) throw new ApiError(401, "Unauthorized", "Invalid API key");
  const key = configuredKeys().find((entry) => entry.id === match[1]);
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
