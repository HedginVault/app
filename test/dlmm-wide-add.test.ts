import { PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const { add, fits } = vi.hoisted(() => ({
  add: vi.fn<(...args: unknown[]) => Promise<object[]>>(async () => [{}]),
  fits: vi.fn(() => true),
}));
vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: vi.fn(async () => ({ key: pk(1) })),
  assertAuthority: vi.fn(),
}));
vi.mock("@/server/program", () => ({
  RPC_URL: "",
  getProgram: () => ({ account: { positionV2: { fetch: async () => ({
    owner: pk(1), lbPair: pk(7), lowerBinId: 0, upperBinId: 99,
  }) } } }),
}));
vi.mock("@/server/dlmm-pool", () => ({
  getPool: vi.fn(async () => ({ lbPair: { activeId: 0 } })),
  getActiveBinIds: vi.fn(async () => new Map()),
}));
vi.mock("@/server/tx/dlmm", () => ({
  dlmmAddLiquidityForRangeIx: add,
  missingBinArrayIxs: vi.fn(async () => []),
}));
vi.mock("@/server/tx/assemble", () => ({
  assemble: vi.fn(async () => ({ transaction: "unsigned", simulation: { unitsConsumed: 1 } })),
}));
vi.mock("@/server/tx/size", () => ({ fitsInTransaction: fits }));

const body = {
  payer: pk(5).toBase58(), vault: pk(1).toBase58(), position: pk(8).toBase58(),
  targetUpperBinId: 99, cursorBinId: 0, activeBinId: 0,
  amountX: "100", amountY: "0", shape: "spot" as const, maxActiveBinSlippage: 10,
};

describe("wide position funding builder", () => {
  beforeEach(() => { add.mockClear(); fits.mockReset(); fits.mockReturnValue(true); });

  it("funds one chunk and carries the next cursor", async () => {
    const { buildWideAdd } = await import("@/server/tx/wide-add");
    const built = await buildWideAdd(body);
    expect(add.mock.calls[0]?.[5]).toBe(0);
    expect(add.mock.calls[0]?.[6]).toBe(25);
    expect(String(add.mock.calls[0]?.[7])).toBe("26");
    expect(built.next).toMatchObject({ path: "dlmm/add-range", body: { cursorBinId: 26 } });
  });

  it("reduces the bin chunk when the transaction packet is too large", async () => {
    fits.mockReturnValueOnce(false).mockReturnValue(true);
    const { buildWideAdd } = await import("@/server/tx/wide-add");
    const built = await buildWideAdd(body);
    expect(add.mock.calls.map((call) => call[6])).toEqual([25, 12]);
    expect(built.next).toMatchObject({ body: { cursorBinId: 13 } });
  });
});
