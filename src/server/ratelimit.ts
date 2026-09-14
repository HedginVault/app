import { ApiError } from "./errors";

/**
 * In-process per-IP token bucket. Not a security boundary — one bucket map per server instance, and
 * a proxy header is all that identifies a caller — but enough to stop a single client from burning
 * the RPC/Jupiter quota with a tight loop against the build and quote routes.
 */
const CAPACITY = 30;
const WINDOW_MS = 10_000;
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, { tokens: number; ts: number }>();

/** First hop of `x-forwarded-for`, which is what Vercel and most proxies set. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Consumes one token for `key`, refilling continuously at `capacity / windowMs`. Throws 429 when empty. */
export function rateLimit(key: string, capacity = CAPACITY, windowMs = WINDOW_MS): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, ts: now };
  bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.ts) * capacity) / windowMs);
  bucket.ts = now;
  buckets.delete(key); // re-insert so Map order doubles as LRU
  buckets.set(key, bucket);
  if (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value!);
  if (bucket.tokens < 1) throw new ApiError(429, "RateLimited", "Too many requests, slow down");
  bucket.tokens -= 1;
}

export const resetRateLimits = () => buckets.clear();
