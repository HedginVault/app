import { PublicKey } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/server/cache";
import { getProtocolLookupTables } from "@/server/tx/lookup-table";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const mocks = vi.hoisted(() => ({ getTable: vi.fn() }));
vi.mock("@/server/program", () => ({ RPC_URL: "", getConnection: () => ({ getAddressLookupTable: mocks.getTable }) }));

beforeEach(() => {
  vi.resetAllMocks();
  clearCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("protocol lookup table", () => {
  it("is empty when unconfigured, without an RPC call", async () => {
    vi.stubEnv("PROTOCOL_LOOKUP_TABLE", "");
    expect(await getProtocolLookupTables()).toEqual([]);
    expect(mocks.getTable).not.toHaveBeenCalled();
  });

  it("returns the configured active table", async () => {
    vi.stubEnv("PROTOCOL_LOOKUP_TABLE", pk(7).toBase58());
    const table = { key: pk(7), isActive: () => true };
    mocks.getTable.mockResolvedValue({ value: table });
    expect(await getProtocolLookupTables()).toEqual([table]);
    expect(mocks.getTable).toHaveBeenCalledWith(pk(7));
  });

  it.each([null, { key: pk(7), isActive: () => false }])("skips a missing or deactivated table", async (value) => {
    vi.stubEnv("PROTOCOL_LOOKUP_TABLE", pk(7).toBase58());
    mocks.getTable.mockResolvedValue({ value });
    expect(await getProtocolLookupTables()).toEqual([]);
  });
});
