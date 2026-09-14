import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/server/errors";
import { clientIp, rateLimit, resetRateLimits } from "@/server/ratelimit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows a full bucket then rejects with 429 RateLimited", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000);
    try {
      rateLimit("a", 3, 1000);
      expect.unreachable("expected a 429");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(429);
      expect(err.code).toBe("RateLimited");
    }
  });

  it("refills continuously over the window", () => {
    for (let i = 0; i < 3; i++) rateLimit("b", 3, 1000);
    expect(() => rateLimit("b", 3, 1000)).toThrow();
    // A third of the window refills exactly one token.
    vi.advanceTimersByTime(334);
    expect(() => rateLimit("b", 3, 1000)).not.toThrow();
    expect(() => rateLimit("b", 3, 1000)).toThrow();
    // A full window refills the whole bucket, and never more than the capacity.
    vi.advanceTimersByTime(10_000);
    for (let i = 0; i < 3; i++) rateLimit("b", 3, 1000);
    expect(() => rateLimit("b", 3, 1000)).toThrow();
  });

  it("buckets are per key", () => {
    for (let i = 0; i < 3; i++) rateLimit("c", 3, 1000);
    expect(() => rateLimit("c", 3, 1000)).toThrow();
    expect(() => rateLimit("d", 3, 1000)).not.toThrow();
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/api", { headers });

  it("takes the first x-forwarded-for hop, then x-real-ip, then a constant", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(req({}))).toBe("unknown");
  });
});
