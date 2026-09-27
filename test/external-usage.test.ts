import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), on: vi.fn(), opts: [] as unknown[] }));
vi.mock("pg", () => ({
  Pool: class {
    constructor(opts: unknown) { mocks.opts.push(opts); }
    query = mocks.query;
    on = mocks.on;
  },
}));

import { recordUsage, resetUsagePool } from "@/server/external/usage";

const DB_URL = "postgres://user:s3cret@db.internal/x";

beforeEach(() => {
  mocks.query.mockReset(); mocks.on.mockReset(); mocks.opts.length = 0; resetUsagePool();
  delete process.env.API_KEY_USAGE_DATABASE_URL;
});
afterEach(() => { vi.restoreAllMocks(); });

describe("recordUsage", () => {
  it("does nothing when unconfigured", () => {
    recordUsage("bot-1", "vaults", "ok");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("upserts one counter row with bounded strings", () => {
    process.env.API_KEY_USAGE_DATABASE_URL = "postgres://local/x";
    mocks.query.mockResolvedValue({});
    recordUsage("bot-1", "vaults", "ok");
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toMatch(/on conflict .* do update set count = api_key_usage\.count \+ 1/is);
    expect(params).toEqual(["bot-1", "vaults", "ok"]);
  });
  it("never throws or rejects when the write fails", async () => {
    process.env.API_KEY_USAGE_DATABASE_URL = "postgres://local/x";
    mocks.query.mockRejectedValue(new Error("db down"));
    expect(() => recordUsage("bot-1", "vaults", "ok")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // an unhandled rejection would fail the run
  });
  it("truncates over-long action/outcome values", () => {
    process.env.API_KEY_USAGE_DATABASE_URL = "postgres://local/x";
    mocks.query.mockResolvedValue({});
    recordUsage("bot-1", "a".repeat(500), "o".repeat(500));
    expect(mocks.query.mock.calls[0][1][1]).toHaveLength(80);
    expect(mocks.query.mock.calls[0][1][2]).toHaveLength(64);
  });
  it("registers a pool error listener that logs the error name only, with 2s timeouts", () => {
    process.env.API_KEY_USAGE_DATABASE_URL = DB_URL;
    mocks.query.mockResolvedValue({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    recordUsage("bot-1", "vaults", "ok");
    expect(mocks.opts[0]).toMatchObject({ connectionTimeoutMillis: 2_000, statement_timeout: 2_000, query_timeout: 2_000 });
    expect(mocks.on).toHaveBeenCalledWith("error", expect.any(Function));
    const listener = mocks.on.mock.calls[0][1] as (e: Error) => void;
    listener(Object.assign(new Error(`connect failed ${DB_URL}`), { name: "PgError" }));
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("PgError");
    expect(logged).not.toContain("s3cret");
    expect(logged).not.toContain(DB_URL);
  });
  it("does not throw when pool.query throws synchronously", () => {
    process.env.API_KEY_USAGE_DATABASE_URL = DB_URL;
    mocks.query.mockImplementation(() => { throw new Error(`boom ${DB_URL}`); });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => recordUsage("bot-1", "vaults", "ok")).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("s3cret");
  });
  it("logs one sanitized line (name and pg code) on failure, never the URL or key", async () => {
    process.env.API_KEY_USAGE_DATABASE_URL = DB_URL;
    mocks.query.mockRejectedValue(Object.assign(new Error(`fail at ${DB_URL} key=bot-1`), { name: "DatabaseError", code: "42P01" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    recordUsage("bot-1", "vaults", "ok");
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("DatabaseError");
    expect(logged).toContain("42P01");
    expect(logged).not.toContain("s3cret");
    expect(logged).not.toContain("db.internal");
    expect(logged).not.toContain("bot-1");
  });
});
