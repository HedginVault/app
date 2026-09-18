import { AsyncLocalStorage } from "node:async_hooks";

interface Entry {
  value: unknown;
  expires: number;
}

const STALE_WINDOW_MS = 60_000;
const MAX_ENTRIES = 2000;
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Per-request "skip the fresh hit" flag. Route handlers run in the Node runtime, so the async
 * context survives every `await` inside one request without threading a parameter through every
 * reader.
 */
const freshScope = new AsyncLocalStorage<true>();

/** Runs `fn` with cache reads bypassed: `cached()` refetches once and stores the new value. */
export const withFresh = <T>(fn: () => T): T => freshScope.run(true, fn);

export function clearCache() {
  store.clear();
  inflight.clear();
}

/** Drops every memoized entry whose key starts with one of `prefixes`. */
export function invalidateCached(prefixes: string[]) {
  for (const key of store.keys()) if (prefixes.some((p) => key.startsWith(p))) store.delete(key);
}

export function getCached<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit || hit.expires <= Date.now()) return undefined;
  store.delete(key); // re-insert so Map order doubles as LRU
  store.set(key, hit);
  return hit.value as T;
}

export function setCached(key: string, value: unknown, ttlMs: number) {
  store.delete(key);
  store.set(key, { value, expires: Date.now() + ttlMs });
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
}

/**
 * Memoizes `fn` for `ttlMs` with per-key single-flight. On refresh failure serves the previous value
 * for up to 60 s. Inside `withFresh()` the memoized value is ignored (single-flight still applies,
 * so a burst of post-confirmation refetches is still one round of RPC).
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const fresh = freshScope.getStore() ? undefined : getCached<T>(key);
  if (fresh !== undefined) return fresh;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const stale = store.get(key);
  // `fn` runs in a later microtask so the inflight entry is registered before it can settle;
  // a synchronously-throwing `fn` would otherwise leave a rejected promise stuck in the map.
  const run = Promise.resolve()
    .then(fn)
    .then((value) => {
      setCached(key, value, ttlMs);
      return value;
    })
    .catch((e) => {
      if (stale && stale.expires + STALE_WINDOW_MS > Date.now()) return stale.value as T;
      throw e;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, run);
  return run;
}
