import { describe, expect, it, vi } from "vitest";
import { cached, clearCache, getCached, invalidateCached, setCached, withFresh } from "@/server/cache";

describe("cached", () => {
  it("returns the cached value within ttl and refreshes after", async () => {
    clearCache();
    let calls = 0;
    const fn = async () => ++calls;
    vi.useFakeTimers();
    expect(await cached("k", 1000, fn)).toBe(1);
    expect(await cached("k", 1000, fn)).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(await cached("k", 1000, fn)).toBe(2);
    vi.useRealTimers();
  });
  it("dedupes concurrent callers into one fetch", async () => {
    clearCache();
    let calls = 0;
    const fn = () => new Promise<number>((r) => setTimeout(() => r(++calls), 10));
    const [a, b] = await Promise.all([cached("c", 1000, fn), cached("c", 1000, fn)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
  });
  it("serves a stale value when refresh fails within the stale window, and never caches failures", async () => {
    clearCache();
    let fail = false;
    const fn = async () => {
      if (fail) throw new Error("rpc down");
      return "ok";
    };
    vi.useFakeTimers();
    expect(await cached("s", 1000, fn)).toBe("ok");
    fail = true;
    vi.advanceTimersByTime(1500);
    expect(await cached("s", 1000, fn)).toBe("ok");
    vi.advanceTimersByTime(60_000);
    await expect(cached("s", 1000, fn)).rejects.toThrow("rpc down");
    fail = false;
    expect(await cached("s", 1000, fn)).toBe("ok");
    vi.useRealTimers();
  });
  it("clears the inflight slot when fn throws synchronously", async () => {
    clearCache();
    const throws = (() => {
      throw new Error("sync boom");
    }) as unknown as () => Promise<number>;
    await expect(cached("x", 1000, throws)).rejects.toThrow("sync boom");
    expect(await cached("x", 1000, async () => 7)).toBe(7);
  });
  it("bypasses a fresh hit inside withFresh, exactly once, and still dedupes concurrent callers", async () => {
    clearCache();
    let calls = 0;
    const fn = () => new Promise<number>((r) => setTimeout(() => r(++calls), 5));
    expect(await cached("f", 60_000, fn)).toBe(1);
    expect(await cached("f", 60_000, fn)).toBe(1);

    const [a, b] = await withFresh(() => Promise.all([cached("f", 60_000, fn), cached("f", 60_000, fn)]));
    expect([a, b]).toEqual([2, 2]);
    expect(calls).toBe(2); // one refetch for both concurrent callers

    // The bypass is scoped to the withFresh call: the next plain read is served from the cache.
    expect(await cached("f", 60_000, fn)).toBe(2);
    expect(calls).toBe(2);
  });

  it("invalidateCached removes only the matching prefixes", () => {
    clearCache();
    setCached("vault:X", 1, 60_000);
    setCached("vault:X:strategies", 2, 60_000);
    setCached("vault:Y", 3, 60_000);
    setCached("config", 4, 60_000);
    invalidateCached(["vault:X"]);
    expect(getCached("vault:X")).toBeUndefined();
    expect(getCached("vault:X:strategies")).toBeUndefined();
    expect(getCached("vault:Y")).toBe(3);
    expect(getCached("config")).toBe(4);
  });

  it("exposes get/set for batch fetchers and evicts the oldest entry past the cap", () => {
    clearCache();
    setCached("a", 1, 1000);
    expect(getCached<number>("a")).toBe(1);
    for (let i = 0; i < 2100; i++) setCached(`k${i}`, i, 1000);
    expect(getCached("a")).toBeUndefined();
    expect(getCached("k2099")).toBe(2099);
  });
});
