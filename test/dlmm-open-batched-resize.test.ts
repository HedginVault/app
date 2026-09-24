import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const { resize, assemble, fits } = vi.hoisted(() => ({
  resize: vi.fn(async (...args: [unknown, unknown, unknown, unknown, unknown, number]) => {
    void args;
    return { kind: "resize" };
  }),
  assemble: vi.fn(async (...args: [unknown, unknown[], { deferSimulation?: boolean }?]) => {
    void args;
    return { transaction: "unsigned", simulation: { unitsConsumed: 1 } };
  }),
  fits: vi.fn((_payer, instructions: unknown[]) => instructions.length <= 3),
}));

vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: vi.fn(async () => ({ key: pk(1) })),
  assertAuthority: vi.fn(),
}));
vi.mock("@/server/program", () => ({ RPC_URL: "", getProgram: () => ({}) }));
vi.mock("@/server/dlmm-pool", () => ({
  getPool: vi.fn(async () => ({ lbPair: { activeId: 0 } })),
  getActiveBinIds: vi.fn(async () => new Map()),
}));
vi.mock("@/server/tx/dlmm", () => ({
  dlmmInitializePositionIx: vi.fn(async () => ({ ix: { kind: "init" }, position: Keypair.generate() })),
  dlmmExtendPositionIx: resize,
  dlmmAddLiquidityForRangeIx: vi.fn(async () => [{ kind: "add" }]),
  missingBinArrayIxs: vi.fn(async () => []),
  onChainUpper: (exclusive: number) => exclusive - 1,
}));
vi.mock("@/server/tx/assemble", () => ({ assemble }));
vi.mock("@/server/tx/size", () => ({ fitsInTransaction: fits }));

const post = async (upperBinId: number) => {
  const { POST } = await import("@/app/api/tx/dlmm/open/route");
  return POST(new Request("http://x/api/tx/dlmm/open", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `batched-${upperBinId}` },
    body: JSON.stringify({
      payer: pk(5).toBase58(), vault: pk(1).toBase58(), lbPair: pk(7).toBase58(),
      lowerBinId: 0, upperBinId, amountX: "1", amountY: "1", shape: "spot", maxActiveBinSlippage: 10,
    }),
  }));
};

describe("wide position creation", () => {
  it("puts initialization and fitting resize steps in one transaction", async () => {
    const response = await post(200);
    expect(response.status).toBe(200);
    expect(resize).toHaveBeenCalledTimes(2);
    expect(resize.mock.calls.map((call) => call[5])).toEqual([91, 39]);
    expect(assemble.mock.calls[0]?.[1]).toHaveLength(3);
    const built = await response.json();
    expect(built).toHaveLength(3);
    expect(built[0]).toMatchObject({ lowerBinId: 0, upperBinId: 199 });
    expect(assemble.mock.calls.slice(1).every((call) => call[2]?.deferSimulation === true)).toBe(true);
  });

  it("prepares overflow resize and funding transactions before wallet approval", async () => {
    resize.mockClear();
    assemble.mockClear();
    const response = await post(300);
    expect(response.status).toBe(200);
    expect(resize).toHaveBeenCalledTimes(3);
    expect(assemble.mock.calls[0]?.[1]).toHaveLength(3);
    expect(assemble.mock.calls[1]?.[1]).toHaveLength(1);
    const built = await response.json();
    expect(built).toHaveLength(4);
    expect(built[0]).toMatchObject({ lowerBinId: 0, upperBinId: 299 });
  });
});
