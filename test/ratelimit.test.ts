import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/server/errors";
import { clientIp, LIMITS, rateLimit, resetRateLimits } from "@/server/ratelimit";

describe("rateLimit", () => {
  const one = [{ capacity: 3, windowMs: 1000 }];

  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows a full bucket then rejects with 429 RateLimited", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", one);
    try {
      rateLimit("a", one);
      expect.unreachable("expected a 429");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(429);
      expect(err.code).toBe("RateLimited");
    }
  });

  it("refills continuously over the window", () => {
    for (let i = 0; i < 3; i++) rateLimit("b", one);
    expect(() => rateLimit("b", one)).toThrow();
    // A third of the window refills exactly one token.
    vi.advanceTimersByTime(334);
    expect(() => rateLimit("b", one)).not.toThrow();
    expect(() => rateLimit("b", one)).toThrow();
    // A full window refills the whole bucket, and never more than the capacity.
    vi.advanceTimersByTime(10_000);
    for (let i = 0; i < 3; i++) rateLimit("b", one);
    expect(() => rateLimit("b", one)).toThrow();
  });

  it("buckets are per key", () => {
    for (let i = 0; i < 3; i++) rateLimit("c", one);
    expect(() => rateLimit("c", one)).toThrow();
    expect(() => rateLimit("d", one)).not.toThrow();
  });
  it("rejects when any limit is empty and a rejected call consumes nothing", () => {
    const tiers = [
      { capacity: 3, windowMs: 1000 },
      { capacity: 5, windowMs: 10_000 },
    ];
    for (let i = 0; i < 3; i++) rateLimit("e", tiers);
    expect(() => rateLimit("e", tiers)).toThrow();
    // The short limit refills, the long one has 2 left (plus the sliver refilled meanwhile).
    vi.advanceTimersByTime(1000);
    rateLimit("e", tiers);
    rateLimit("e", tiers);
    expect(() => rateLimit("e", tiers)).toThrow();
    // Repeated rejections must not drain the short limit: it still holds 1 once the long one refills.
    for (let i = 0; i < 5; i++) expect(() => rateLimit("e", tiers)).toThrow();
    vi.advanceTimersByTime(2000);
    expect(() => rateLimit("e", tiers)).not.toThrow();
  });

  it("defaults to 30 per 10 s, 100 per minute and 300 per 15 minutes", () => {
    expect(LIMITS).toEqual([
      { capacity: 30, windowMs: 10_000 },
      { capacity: 100, windowMs: 60_000 },
      { capacity: 300, windowMs: 900_000 },
    ]);
    // 30 at once, then a paced client hits the per-minute ceiling: 100 accepted in the first minute.
    let accepted = 0;
    for (let s = 0; s < 60; s++) {
      for (let i = 0; i < 30; i++) {
        try {
          rateLimit("f");
          accepted++;
        } catch {
          break;
        }
      }
      vi.advanceTimersByTime(1000);
    }
    expect(accepted).toBeGreaterThanOrEqual(100);
    expect(accepted).toBeLessThan(200);
  });

  it("caps a client pacing under the burst limit at the 15-minute ceiling", () => {
    // One request per second never trips the 10 s limit, nor the minute limit early on.
    let accepted = 0;
    for (let s = 0; s < 15 * 60; s++) {
      try {
        rateLimit("g");
        accepted++;
      } catch {
        // limited
      }
      vi.advanceTimersByTime(1000);
    }
    // 300 up front plus the 15-minute refill of 300 over the window, never the 900 it asked for.
    expect(accepted).toBeLessThanOrEqual(600);
    expect(accepted).toBeGreaterThanOrEqual(300);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/api", { headers });

  it("prefers x-real-ip, which the ingress sets and a client cannot spoof", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4, 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("ignores a client-chosen first x-forwarded-for hop and takes the proxy-appended last one", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(req({ "x-forwarded-for": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("falls back to a constant", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
