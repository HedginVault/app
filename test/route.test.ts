import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { resetRateLimits } from "@/server/ratelimit";
import { amountString, handleGet, handlePost, pubkey } from "@/server/route";

describe("handleGet", () => {
  it("returns json with no-store", async () => {
    const res = await handleGet(async () => ({ ok: true }))();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });
  it("maps ApiError to its status", async () => {
    const res = await handleGet(async () => {
      throw new ApiError(404, "NotFound", "missing");
    })();
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: { code: "NotFound", message: "missing" } });
  });
});

describe("handleGet cache bypass", () => {
  beforeEach(() => resetRateLimits());

  const handler = handleGet(async () => ({ ok: true }));
  const req = (fresh: boolean) =>
    new Request("http://x/api/vaults/v/strategies", {
      headers: { "x-forwarded-for": "9.9.9.9", ...(fresh ? { "cache-control": "no-cache" } : {}) },
    });

  it("rate limits the `no-cache` bypass, which costs full RPC every time", async () => {
    for (let i = 0; i < 30; i++) expect((await handler(req(true))).status).toBe(200);
    const res = await handler(req(true));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RateLimited");
  });

  it("leaves plain cached reads unlimited", async () => {
    for (let i = 0; i < 31; i++) expect((await handler(req(false))).status).toBe(200);
  });
});

describe("handlePost", () => {
  const schema = z.object({ payer: pubkey, amount: amountString });
  const handler = handlePost(schema, async (body) => ({ got: body.amount }));
  const req = (body: unknown) =>
    new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  it("validates and passes the body", async () => {
    const res = await handler(req({ payer: "DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD", amount: "12" }));
    expect(await res.json()).toEqual({ got: "12" });
  });
  it("rejects bad input with 400 Validation", async () => {
    const res = await handler(req({ payer: "nope", amount: "-1" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).error.code).toBe("Validation");
  });
  it("rejects an amount that overflows u64 with 400 rather than failing later in BN encoding", async () => {
    const res = await handler(req({ payer: "DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD", amount: "1".repeat(21) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({ code: "Validation", message: "amount: must fit in u64" });
  });
  it("accepts u64 max and rejects one more", async () => {
    const payer = "DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD";
    expect(await (await handler(req({ payer, amount: "18446744073709551615" }))).json()).toEqual({
      got: "18446744073709551615",
    });
    expect((await handler(req({ payer, amount: "18446744073709551616" }))).status).toBe(400);
  });
  it("rejects a non-numeric amount with 400, not a BigInt throw", async () => {
    const res = await handler(req({ payer: "DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD", amount: "abc" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("Validation");
  });
});
