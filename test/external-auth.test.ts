import { createHash } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findKey: vi.fn(), configured: vi.fn() }));
vi.mock("@/server/external/key-store", () => ({ findKey: mocks.findKey, keyStoreConfigured: mocks.configured }));

import { authenticate, resetKeyCache } from "@/server/external/auth";

const manager = Keypair.generate().publicKey.toBase58();
const secret = "b".repeat(64);
const digest = createHash("sha256").update(secret).digest("hex");
const req = (id = "bot-1", s = secret) => new Request("https://x", { headers: { authorization: `Bearer hv1_${id}_${s}` } });
const row = (o = {}) => ({ id: "bot-1", digest, manager, vaults: null, actions: ["read"], expiresAt: null, revokedAt: null, ...o });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-26T00:00:00Z")); resetKeyCache(); mocks.findKey.mockReset(); mocks.configured.mockReturnValue(true); delete process.env.MANAGER_API_KEYS; });
afterEach(() => vi.useRealTimers());

describe("authenticate with the key store", () => {
  it("accepts an active DB key and maps null vaults to unscoped", async () => {
    mocks.findKey.mockResolvedValue(row());
    const p = await authenticate(req());
    expect(p).toMatchObject({ id: "bot-1", manager, actions: ["read"] });
    expect(p.vaults).toBeUndefined();
  });
  it("rejects wrong secret, revoked and expired keys with 401", async () => {
    mocks.findKey.mockResolvedValue(row());
    await expect(authenticate(req("bot-1", "c".repeat(64)))).rejects.toMatchObject({ status: 401 });
    resetKeyCache(); mocks.findKey.mockResolvedValue(row({ revokedAt: new Date() }));
    await expect(authenticate(req())).rejects.toMatchObject({ status: 401 });
    resetKeyCache(); mocks.findKey.mockResolvedValue(row({ expiresAt: new Date("2026-09-25T00:00:00Z") }));
    await expect(authenticate(req())).rejects.toMatchObject({ status: 401 });
  });
  it("returns 503 on DB error and never falls back to env", async () => {
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "bot-1", digest, manager, actions: ["read"] }]);
    mocks.findKey.mockRejectedValue(new Error("connection refused"));
    await expect(authenticate(req())).rejects.toMatchObject({ status: 503 });
  });
  it("a revoked DB row is not resurrected by an env record", async () => {
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "bot-1", digest, manager, actions: ["read"] }]);
    mocks.findKey.mockResolvedValue(row({ revokedAt: new Date() }));
    await expect(authenticate(req())).rejects.toMatchObject({ status: 401 });
  });
  it("falls back to env only for ids absent from the DB", async () => {
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "legacy", digest, manager, actions: ["read"] }]);
    mocks.findKey.mockResolvedValue(null);
    expect((await authenticate(req("legacy"))).id).toBe("legacy");
    await expect(authenticate(req("unknown"))).rejects.toMatchObject({ status: 401 });
  });
  it("caches lookups for 5 s so a revoke lands within seconds, then re-reads", async () => {
    mocks.findKey.mockResolvedValue(row());
    await authenticate(req()); await authenticate(req());
    expect(mocks.findKey).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_001);
    mocks.findKey.mockResolvedValue(row({ revokedAt: new Date() }));
    await expect(authenticate(req())).rejects.toMatchObject({ status: 401 });
    expect(mocks.findKey).toHaveBeenCalledTimes(2);
  });
  it("uses env only when the store is not configured", async () => {
    mocks.configured.mockReturnValue(false);
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "bot-1", digest, manager, actions: ["read"] }]);
    expect((await authenticate(req())).id).toBe("bot-1");
    expect(mocks.findKey).not.toHaveBeenCalled();
  });
  it.each([
    ["invalid manager", { manager: "not-a-key" }],
    ["empty actions", { actions: [] }],
    ["short digest", { digest: "abc" }],
    ["unknown-shape vaults", { vaults: [42] }],
  ])("fails closed with 503 on a malformed DB row (%s), ignoring env, logging only the id", async (_n, bad) => {
    process.env.MANAGER_API_KEYS = JSON.stringify([{ id: "bot-1", digest, manager, actions: ["read"] }]);
    mocks.findKey.mockResolvedValue(row(bad));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(authenticate(req())).rejects.toMatchObject({ status: 503 });
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("bot-1");
    expect(logged).not.toContain(digest);
    expect(logged).not.toContain(manager);
    warn.mockRestore();
  });
  it("logs a sanitized line when the lookup throws", async () => {
    const url = "postgres://user:hunter2@db.internal/keys";
    process.env.API_KEYS_DATABASE_URL = url;
    mocks.findKey.mockRejectedValue(Object.assign(new Error(`connect failed ${url}`), { code: "ECONNREFUSED" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(authenticate(req())).rejects.toMatchObject({ status: 503 });
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("[manager-api]");
    expect(logged).toContain("lookup_failed");
    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain("hunter2");
    expect(logged).not.toContain(digest);
    warn.mockRestore();
    delete process.env.API_KEYS_DATABASE_URL;
  });
});
