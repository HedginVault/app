import { PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/errors";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), zap: vi.fn(), split: vi.fn(), tables: vi.fn(), fits: vi.fn(), assemble: vi.fn(), authority: vi.fn(), close: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/server/program", () => ({
  RPC_URL: "", getProgram: () => ({ account: { positionV2: { fetch: mocks.fetch } } }),
}));
vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: async () => ({ key: pk(1) }), assertAuthority: mocks.authority,
}));
vi.mock("@/server/readers/vaults", () => ({
  readConfig: async () => ({ treasuryAuthority: pk(9).toBase58(), maxSlippageBps: 100 }),
}));
vi.mock("@/server/tx/dlmm", () => ({ dlmmZapOutIxs: mocks.zap, dlmmZapOutSplitIxs: mocks.split }));
vi.mock("@/server/tx/lookup-table", () => ({ getProtocolLookupTables: mocks.tables }));
vi.mock("@/server/tx/size", () => ({ fitsInTransaction: mocks.fits }));
vi.mock("@/server/tx/assemble", () => ({ assemble: mocks.assemble, refreshUnsignedBatch: mocks.refresh }));
vi.mock("@/server/pda", () => ({ getStrategyPda: () => pk(10) }));
vi.mock("@/server/tx/vault", () => ({ closeStrategyIx: mocks.close }));

const protocolTable = { key: pk(20) };
let requestId = 0;
const body = { payer: pk(5).toBase58(), vault: pk(1).toBase58(), position: pk(8).toBase58(), slippageBps: 200 };
async function post(extra = {}) {
  const { POST } = await import("@/app/api/tx/dlmm/zap-out/route");
  return POST(new Request("http://x/api/tx/dlmm/zap-out", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `zap-${requestId++}` },
    body: JSON.stringify({ ...body, ...extra }),
  }));
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetch.mockResolvedValue({ owner: pk(1), lowerBinId: -700, upperBinId: 699 });
  mocks.zap.mockResolvedValue({ ixs: [], lookupTables: [], initializesStrategy: false });
  mocks.refresh.mockImplementation(async (batch) => batch);
  mocks.close.mockResolvedValue({ close: true });
  mocks.fits.mockReturnValue(true);
  mocks.assemble.mockResolvedValue({ transaction: "unsigned", simulation: { unitsConsumed: 1 } });
  mocks.tables.mockResolvedValue([protocolTable]);
});

describe("wide zap out", () => {
  it("returns all 1400 bins and the final close in one signable batch without follow-ups", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toHaveLength(55);
    expect(result.every((step: { next?: unknown }) => step.next === undefined)).toBe(true);
    expect(result.slice(0, -1).every((step: { sendConcurrently?: boolean }) => step.sendConcurrently)).toBe(true);
    expect(result.at(-1).sendConcurrently).toBeUndefined();
    for (let index = 0; index < 54; index++) {
      const lowerBinId = -700 + index * 26;
      expect(mocks.zap.mock.calls[index]).toEqual([
        expect.anything(), expect.anything(), pk(5), pk(8), pk(9), 100,
        { lowerBinId, upperBinId: Math.min(lowerBinId + 25, 699) }, false,
      ]);
    }
    expect(mocks.assemble).toHaveBeenLastCalledWith(pk(5), [{ close: true }], { deferSimulation: true });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("creates the Jupiter strategy once and marks the setup transaction as a barrier", async () => {
    mocks.zap.mockResolvedValueOnce({ ixs: [], lookupTables: [], initializesStrategy: true });
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result[0].sendConcurrently).toBe(false);
    expect(result[1].sendConcurrently).toBe(true);
    expect(mocks.zap.mock.calls[0][7]).toBe(false);
    expect(mocks.zap.mock.calls.slice(1).every((call) => call[7] === true)).toBe(true);
    expect(mocks.assemble.mock.calls[0][2].deferSimulation).toBe(false);
    expect(mocks.assemble.mock.calls[1][2].deferSimulation).toBe(true);
  });

  it("resumes from a requested cursor and includes the final close in that batch", async () => {
    const response = await post({ cursorBinId: 674 });
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(2);
    expect(mocks.zap.mock.calls[0][6]).toEqual({ lowerBinId: 674, upperBinId: 699 });
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("starts at the actual lower bin when no cursor is provided", async () => {
    expect((await post()).status).toBe(200);
    expect(mocks.zap.mock.calls[0][6]).toEqual({ lowerBinId: -700, upperBinId: -675 });
  });

  it("keeps the compact atomic path at 70 bins", async () => {
    mocks.fetch.mockResolvedValue({ owner: pk(1), lowerBinId: -35, upperBinId: 34 });
    const response = await post();
    expect(response.status).toBe(200);
    expect((await response.json()).next).toBeUndefined();
    expect(mocks.zap.mock.calls[0]).toHaveLength(6);
  });

  it.each([-701, 700, 1.5])("rejects invalid cursor %s", async (cursorBinId) => {
    expect((await post({ cursorBinId })).status).toBe(400);
    expect(mocks.zap).not.toHaveBeenCalled();
  });

  it("rejects positions belonging to another vault", async () => {
    mocks.fetch.mockResolvedValue({ owner: pk(2), lowerBinId: 0, upperBinId: 99 });
    expect((await post()).status).toBe(403);
    expect(mocks.zap).not.toHaveBeenCalled();
  });

  it("rejects positions beyond 1400 bins", async () => {
    mocks.fetch.mockResolvedValue({ owner: pk(1), lowerBinId: 0, upperBinId: 1400 });
    expect((await post()).status).toBe(400);
    expect(mocks.zap).not.toHaveBeenCalled();
  });

  it("reduces the range when the packet is too large", async () => {
    mocks.fits.mockReturnValueOnce(false);
    const response = await post();
    expect(response.status).toBe(200);
    expect(mocks.zap.mock.calls[1][6]).toEqual({ lowerBinId: -700, upperBinId: -688 });
    expect(mocks.zap.mock.calls[2][6].lowerBinId).toBe(-687);
  });

  it("reduces the range on compute exhaustion", async () => {
    mocks.assemble.mockRejectedValueOnce(new ApiError(422, "SimulationFailed", "ComputationalBudgetExceeded"));
    expect((await post()).status).toBe(200);
    expect(mocks.zap.mock.calls[1][6]).toEqual({ lowerBinId: -700, upperBinId: -688 });
  });

  it("surfaces other simulation failures without advancing", async () => {
    mocks.assemble.mockRejectedValueOnce(new ApiError(422, "SlippageExceeded", "Slippage exceeded"));
    expect((await post()).status).toBe(422);
    expect(mocks.zap).toHaveBeenCalledTimes(1);
  });

  it("fails when even one bin cannot fit", async () => {
    mocks.fits.mockReturnValue(false);
    expect((await post()).status).toBe(422);
    expect(mocks.assemble).not.toHaveBeenCalled();
  });
});

describe("compact zap out", () => {
  const routeTable = { key: pk(21) };
  const step = (n: number, initializesStrategy = false) => ({ ixs: [n], lookupTables: [routeTable], initializesStrategy });
  beforeEach(() => mocks.fetch.mockResolvedValue({ owner: pk(1), lowerBinId: -35, upperBinId: 34 }));

  it("builds one atomic transaction with the route and protocol lookup tables", async () => {
    mocks.zap.mockResolvedValue({ ixs: [1], lookupTables: [routeTable], initializesStrategy: false });
    const response = await post();
    expect(response.status).toBe(200);
    expect(mocks.fits).toHaveBeenCalledWith(pk(5), [1], [routeTable, protocolTable]);
    expect(mocks.assemble).toHaveBeenCalledWith(pk(5), [1], { lookupTables: [routeTable, protocolTable] });
    expect(mocks.split).not.toHaveBeenCalled();
  });

  it("splits into three transactions approved together when the atomic one is too large", async () => {
    mocks.fits.mockReturnValueOnce(false);
    mocks.split.mockResolvedValue([step(1, true), step(2), { ixs: [3], lookupTables: [], initializesStrategy: false }]);
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toHaveLength(3);
    expect(result.every((built: { next?: unknown; sendConcurrently?: boolean }) => !built.next && !built.sendConcurrently)).toBe(true);
    expect(mocks.assemble.mock.calls.map((call) => [call[1], call[2].deferSimulation])).toEqual([
      [[1], false],
      [[2], true],
      [[3], true],
    ]);
    expect(mocks.assemble.mock.calls[2][2].lookupTables).toEqual([protocolTable]);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("simulates the claim step when the Jupiter strategy already exists", async () => {
    mocks.fits.mockReturnValueOnce(false);
    mocks.split.mockResolvedValue([step(1), step(2), step(3)]);
    expect((await post()).status).toBe(200);
    expect(mocks.assemble.mock.calls.map((call) => call[2].deferSimulation)).toEqual([false, false, true]);
  });

  it("fails when a split step still does not fit", async () => {
    mocks.fits.mockReturnValueOnce(false).mockReturnValueOnce(false);
    mocks.split.mockResolvedValue([step(1), step(2), step(3)]);
    const response = await post();
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("TransactionTooLarge");
    expect(mocks.assemble).not.toHaveBeenCalled();
  });
});
