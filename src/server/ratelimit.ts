import { ApiError } from "./errors";

/**
 * In-process per-IP token buckets. Not a security boundary on its own — one bucket map per server
 * instance — but enough to stop a single client from burning the RPC/Jupiter quota with a tight loop
 * against the build and quote routes.
 */
export interface Limit {
  capacity: number;
  windowMs: number;
}

/**
 * Every key must stay under all three at once: a short burst, a sustained minute, and a long-run
 * ceiling, so a client pacing itself just under the burst rate still runs dry within minutes.
 */
export const LIMITS: readonly Limit[] = [
  { capacity: 30, windowMs: 10_000 },
  { capacity: 100, windowMs: 60_000 },
  { capacity: 300, windowMs: 15 * 60_000 },
];
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, { tokens: number[]; ts: number }>();

/**
 * The caller's address as the nearest proxy saw it. ingress-nginx sets `x-real-ip` to the TCP peer
 * and overwrites any client-sent value. `x-forwarded-for` is only a fallback, and only its last hop:
 * nginx appends the peer to whatever the client sent, so the first hop is client-controlled and
 * keying on it lets a caller mint a fresh bucket per request.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)!.trim() || "unknown";
  return "unknown";
}

/**
 * Consumes one token from every limit for `key`, each refilling continuously at `capacity / windowMs`.
 * Throws 429 when any limit is empty; a rejected request consumes nothing.
 */
export function rateLimit(key: string, limits: readonly Limit[] = LIMITS): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: limits.map((l) => l.capacity), ts: now };
  bucket.tokens = limits.map((l, i) => Math.min(l.capacity, bucket.tokens[i] + ((now - bucket.ts) * l.capacity) / l.windowMs));
  bucket.ts = now;
  buckets.delete(key); // re-insert so Map order doubles as LRU
  buckets.set(key, bucket);
  if (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value!);
  if (bucket.tokens.some((t) => t < 1)) throw new ApiError(429, "RateLimited", "Too many requests, slow down");
  bucket.tokens = bucket.tokens.map((t) => t - 1);
}

export const resetRateLimits = () => buckets.clear();
