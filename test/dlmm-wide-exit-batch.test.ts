import { PublicKey } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const { remove, claim, assemble } = vi.hoisted(() => ({
  remove: vi.fn(async (...args: [unknown, unknown, unknown, unknown, number, { lowerBinId: number; upperBinId: number }]) => {
    void args;
    return [{}];
  }),
  claim: vi.fn(async (...args: [unknown, unknown, unknown, unknown, unknown, { lowerBinId: number; upperBinId: number }]) => {
    void args;
    return [{}];
  }),
  assemble: vi.fn(async () => ({ transaction: "unsigned", simulation: { unitsConsumed: 1 } })),
}));

vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: vi.fn(async () => ({ key: pk(1) })),
  assertAuthority: vi.fn(),
}));
vi.mock("@/server/program", () => ({
  RPC_URL: "",
  getProgram: () => ({
    account: { positionV2: { fetch: async () => ({ owner: pk(1), lowerBinId: 0, upperBinId: 99 }) } },
  }),
}));
vi.mock("@/server/readers/vaults", () => ({ readConfig: vi.fn(async () => ({ treasuryAuthority: pk(9).toBase58() })) }));
vi.mock("@/server/tx/dlmm", () => ({
  dlmmRemoveLiquidityIx: remove,
  dlmmClaimFeeIx: claim,
}));
vi.mock("@/server/tx/assemble", () => ({ assemble }));
vi.mock("@/server/tx/size", () => ({ fitsInTransaction: vi.fn(() => true) }));

const body = {
  payer: pk(5).toBase58(),
  vault: pk(1).toBase58(),
  position: pk(8).toBase58(),
};

describe("wide position exit batches", () => {
  beforeEach(() => {
    remove.mockClear();
    claim.mockClear();
    assemble.mockClear();
  });

  it("returns every remove range in one prepared transaction batch", async () => {
    const { POST } = await import("@/app/api/tx/dlmm/remove/route");
    const response = await POST(new Request("http://x/api/tx/dlmm/remove", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "wide-remove-batch" },
      body: JSON.stringify({ ...body, bpsToRemove: 10_000 }),
    }));
    expect(response.status).toBe(200);
    const built = await response.json();
    expect(built).toHaveLength(4);
    expect(built.every((step: { sendConcurrently?: boolean }) => step.sendConcurrently)).toBe(true);
    expect(remove.mock.calls.map((call) => call[5])).toEqual([
      { lowerBinId: 0, upperBinId: 25 },
      { lowerBinId: 26, upperBinId: 51 },
      { lowerBinId: 52, upperBinId: 77 },
      { lowerBinId: 78, upperBinId: 99 },
    ]);
  });

  it("returns every fee-claim range in one prepared transaction batch", async () => {
    const { POST } = await import("@/app/api/tx/dlmm/claim-fee/route");
    const response = await POST(new Request("http://x/api/tx/dlmm/claim-fee", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "wide-claim-batch" },
      body: JSON.stringify(body),
    }));
    expect(response.status).toBe(200);
    const built = await response.json();
    expect(built).toHaveLength(4);
    expect(built.every((step: { sendConcurrently?: boolean }) => step.sendConcurrently)).toBe(true);
    expect(claim.mock.calls.map((call) => call[5])).toEqual([
      { lowerBinId: 0, upperBinId: 25 },
      { lowerBinId: 26, upperBinId: 51 },
      { lowerBinId: 52, upperBinId: 77 },
      { lowerBinId: 78, upperBinId: 99 },
    ]);
  });
});
