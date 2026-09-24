import { PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/errors";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const { add, fits, assemble } = vi.hoisted(() => ({
  add: vi.fn<(...args: unknown[]) => Promise<object[]>>(async () => [{}]),
  fits: vi.fn(() => true),
  assemble: vi.fn(async (...args: [unknown, unknown[], { deferSimulation?: boolean }?]) => {
    void args;
    return { transaction: "unsigned", simulation: { unitsConsumed: 1 } };
  }),
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
vi.mock("@/server/tx/assemble", () => ({ assemble }));
vi.mock("@/server/tx/size", () => ({ fitsInTransaction: fits }));

const body = {
  payer: pk(5).toBase58(), vault: pk(1).toBase58(), position: pk(8).toBase58(),
  targetUpperBinId: 99, cursorBinId: 0, activeBinId: 0,
  amountX: "100", amountY: "0", shape: "spot" as const, maxActiveBinSlippage: 10,
};

describe("wide position funding builder", () => {
  beforeEach(() => {
    add.mockClear();
    fits.mockReset();
    fits.mockReturnValue(true);
    assemble.mockReset();
    assemble.mockResolvedValue({ transaction: "unsigned", simulation: { unitsConsumed: 1 } });
  });

  it("builds every funding chunk as one wallet-signable batch", async () => {
    const { buildWideAdd } = await import("@/server/tx/wide-add");
    const built = await buildWideAdd(body);
    expect(add.mock.calls[0]?.[5]).toBe(0);
    expect(add.mock.calls[0]?.[6]).toBe(90);
    expect(String(add.mock.calls[0]?.[7])).toBe("91");
    expect(add.mock.calls[1]?.[5]).toBe(91);
    expect(add.mock.calls[1]?.[6]).toBe(99);
    expect(String(add.mock.calls[1]?.[7])).toBe("9");
    expect(built).toHaveLength(2);
    expect(assemble.mock.calls[0]?.[2]).toMatchObject({ deferSimulation: false });
    expect(assemble.mock.calls[1]?.[2]).toMatchObject({ deferSimulation: true });
  });

  it("reduces the bin chunk when the transaction packet is too large", async () => {
    fits.mockReturnValueOnce(false).mockReturnValue(true);
    const { buildWideAdd } = await import("@/server/tx/wide-add");
    const built = await buildWideAdd(body);
    expect(add.mock.calls.map((call) => call[6])).toEqual([90, 69, 99]);
    expect(built).toHaveLength(2);
  });

  it("retries a compute-limited chunk at 70 bins", async () => {
    assemble.mockRejectedValueOnce(new ApiError(422, "SimulationFailed", "Simulation failed: ComputationalBudgetExceeded"));
    const { buildWideAdd } = await import("@/server/tx/wide-add");
    const built = await buildWideAdd(body);
    expect(add.mock.calls.map((call) => call[6])).toEqual([90, 69, 99]);
    expect(built).toHaveLength(2);
  });

  it("does not hide a liquidity program rejection by shrinking the chunk", async () => {
    assemble.mockRejectedValueOnce(new ApiError(422, "InvalidStrategyParameters", "invalid strategy"));
    const { buildWideAdd } = await import("@/server/tx/wide-add");
    await expect(buildWideAdd(body)).rejects.toMatchObject({ code: "InvalidStrategyParameters" });
    expect(add).toHaveBeenCalledTimes(1);
  });
});
