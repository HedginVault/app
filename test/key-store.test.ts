import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  query: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: class {
    constructor(options: unknown) { mocks.pool(options); }
    on(): void {}
    query(...args: unknown[]) { return mocks.query(...args); }
  },
}));

const loadKeyStore = async () => {
  vi.resetModules();
  return import("@/server/external/key-store");
};

beforeEach(() => {
  delete process.env.API_KEYS_DATABASE_URL;
  delete process.env.DATABASE_URL;
  mocks.pool.mockClear();
  mocks.query.mockReset();
  mocks.query.mockResolvedValue({ rows: [] });
});

afterEach(() => {
  delete process.env.API_KEYS_DATABASE_URL;
  delete process.env.DATABASE_URL;
});

describe("manager API key-store database configuration", () => {
  it("prefers the dedicated API key URL", async () => {
    process.env.API_KEYS_DATABASE_URL = "postgres://keys.example/keys";
    process.env.DATABASE_URL = "postgres://history.example/history";
    const { findKey } = await loadKeyStore();

    await expect(findKey("bot-1")).resolves.toBeNull();
    expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({
      connectionString: "postgres://keys.example/keys",
    }));
  });

  it("falls back to DATABASE_URL when the dedicated URL is absent", async () => {
    process.env.DATABASE_URL = "postgres://shared.example/hedgevault";
    const { findKey, keyStoreConfigured } = await loadKeyStore();

    expect(keyStoreConfigured()).toBe(true);
    await expect(findKey("bot-1")).resolves.toBeNull();
    expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({
      connectionString: "postgres://shared.example/hedgevault",
    }));
  });

  it("is not configured when neither URL is present", async () => {
    const { findKey, keyStoreConfigured } = await loadKeyStore();

    expect(keyStoreConfigured()).toBe(false);
    await expect(findKey("bot-1")).rejects.toThrow("API_KEYS_DATABASE_URL or DATABASE_URL is not set");
  });
});
