import { PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const account = {
  owner: pk(1),
  lbPair: pk(7),
  lowerBinId: 0,
  upperBinId: 69,
};
const { resize } = vi.hoisted(() => ({ resize: vi.fn(async () => ({})) }));
vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: vi.fn(async () => ({ key: pk(1) })),
  assertAuthority: vi.fn(),
}));
vi.mock("@/server/program", () => ({
  RPC_URL: "",
  getProgram: () => ({ account: { positionV2: { fetch: async () => account } } }),
}));
vi.mock("@/server/tx/dlmm", () => ({ dlmmExtendPositionIx: resize }));
vi.mock("@/server/tx/assemble", () => ({
  assemble: vi.fn(async () => ({ transaction: "unsigned", simulation: { unitsConsumed: 1 } })),
}));

const post = async (targetUpperBinId: number) => {
  const { POST } = await import("@/app/api/tx/dlmm/extend/route");
  return POST(new Request("http://x/api/tx/dlmm/extend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `resize-${targetUpperBinId}` },
    body: JSON.stringify({
      payer: pk(5).toBase58(), vault: pk(1).toBase58(), position: pk(8).toBase58(),
      targetUpperBinId, amountX: "1", amountY: "0", shape: "spot", maxActiveBinSlippage: 10, activeBinId: 0,
    }),
  }));
};

describe("wide position extension route", () => {
  it("extends by at most 91 bins and continues only after confirmation", async () => {
    const response = await post(1399);
    expect(response.status).toBe(200);
    expect(resize).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), pk(8), pk(7), 91);
    expect((await response.json()).next).toMatchObject({ path: "dlmm/extend", body: { targetUpperBinId: 1399 } });
  });

  it("hands off to chunked funding at the final extension", async () => {
    const response = await post(160);
    expect((await response.json()).next).toMatchObject({
      path: "dlmm/add-range",
      body: { cursorBinId: 0, targetUpperBinId: 160 },
    });
  });

  it("rejects a requested width over 1400 before building a transaction", async () => {
    resize.mockClear();
    const response = await post(1400);
    expect(response.status).toBe(400);
    expect(resize).not.toHaveBeenCalled();
  });
});
