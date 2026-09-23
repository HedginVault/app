import type DLMM from "@meteora-ag/dlmm";
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { getConfigPda, getStrategyPda } from "@/server/pda";
import { getProgram } from "@/server/program";
import type { VaultCtx } from "@/server/tx/context";
import { binPrice, dlmmExtendPositionIx, dlmmInitializePositionIx, onChainUpper, rangeFromWidth } from "@/server/tx/dlmm";

// The initialize route reaches the range check before it touches the chain; stub the two calls that
// would otherwise need RPC.
vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: vi.fn(async () => ({})),
  assertAuthority: vi.fn(),
}));

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const ctx = {
  key: pk(1),
  account: {} as VaultCtx["account"],
  depositMint: pk(2),
  tokenProgram: TOKEN_PROGRAM,
  shareMint: pk(3),
} satisfies VaultCtx;

/** Only the two members `binPrice` touches; the decimal factor stands in for the SDK conversion. */
const fakePool = (binStep: number, decimalFactor = 1) =>
  ({
    lbPair: { binStep },
    fromPricePerLamport: (p: number) => String(p * decimalFactor),
  }) as unknown as DLMM;

describe("binPrice", () => {
  it("returns the identity price at bin 0 and compounds by the bin step", () => {
    const pool = fakePool(100);
    expect(binPrice(pool, 0)).toBe("1");
    expect(binPrice(pool, 1)).toBe("1.01");
    expect(Number(binPrice(pool, 2))).toBeCloseTo(1.0201, 12);
    expect(Number(binPrice(pool, -1))).toBeCloseTo(1 / 1.01, 12);
  });
  it("goes through the SDK decimal conversion", () => {
    // SOL (9) / USDC (6) → price per lamport is scaled by 10^3.
    expect(Number(binPrice(fakePool(20, 1_000), 1))).toBeCloseTo(1002, 9);
  });
});

describe("rangeFromWidth", () => {
  it("centers the range on the active bin", () => {
    expect(rangeFromWidth(100, 69)).toEqual({ lowerBinId: 66, upperBinId: 135 });
    expect(rangeFromWidth(0, 10)).toEqual({ lowerBinId: -5, upperBinId: 5 });
    expect(rangeFromWidth(-7, 1)).toEqual({ lowerBinId: -7, upperBinId: -6 });
  });
  it("always spans width bins above the lower bound", () => {
    for (const width of [1, 2, 33, 1400]) {
      const { lowerBinId, upperBinId } = rangeFromWidth(-1234, width);
      expect(upperBinId - lowerBinId).toBe(width);
    }
  });
});

describe("onChainUpper", () => {
  it("reports the last bin the position owns, not the exclusive bound", () => {
    // The program passes `upper - lower` to `initialize_position2` as a bin count, so the account
    // ends up storing `upper - 1`: a width of 69 owns bins 66..134, which is 69 bins.
    const { lowerBinId, upperBinId } = rangeFromWidth(100, 69);
    expect(onChainUpper(upperBinId)).toBe(134);
    expect(onChainUpper(upperBinId) - lowerBinId + 1).toBe(69);
  });
  it("handles the single-bin range", () => {
    const { lowerBinId, upperBinId } = rangeFromWidth(-7, 1);
    expect(onChainUpper(upperBinId)).toBe(lowerBinId);
  });
});

describe("dlmmInitializePositionIx", () => {
  it("names the generated position as a signer alongside the config and strategy PDAs", async () => {
    const lbPair = pk(9);
    const { ix, position } = await dlmmInitializePositionIx(getProgram(), ctx, pk(5), lbPair, -10, 59);
    const keys = ix.keys.map((k) => k.pubkey.toBase58());

    expect(keys).toEqual(
      expect.arrayContaining([
        getConfigPda().toBase58(),
        getStrategyPda(ctx.key, position.publicKey).toBase58(),
        ctx.key.toBase58(),
        lbPair.toBase58(),
      ]),
    );
    const positionMeta = ix.keys.find((k) => k.pubkey.equals(position.publicKey));
    expect(positionMeta).toMatchObject({ isSigner: true, isWritable: true });
    // i32 lower / i32 exclusive upper after the 8-byte discriminator: the instruction carries the
    // requested bound, while the route reports `onChainUpper` of it.
    expect(ix.data.length).toBe(16);
    expect(ix.data.readInt32LE(8)).toBe(-10);
    expect(ix.data.readInt32LE(12)).toBe(59);
    expect(onChainUpper(ix.data.readInt32LE(12))).toBe(58);
  });
});

describe("dlmmExtendPositionIx", () => {
  it("builds the vault-authorized Meteora resize instruction", async () => {
    const position = pk(8);
    const ix = await dlmmExtendPositionIx(getProgram(), ctx, pk(5), position, pk(9), 91);
    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual(expect.arrayContaining([
      ctx.key.toBase58(), position.toBase58(), getStrategyPda(ctx.key, position).toBase58(),
    ]));
    expect(ix.data.readUInt16LE(8)).toBe(91);
  });
});

describe("POST /api/tx/dlmm/initialize", () => {
  const PAYER = "DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD";
  const post = async (body: Record<string, unknown>) => {
    const { POST } = await import("@/app/api/tx/dlmm/initialize/route");
    return POST(
      new Request("http://x/api/tx/dlmm/initialize", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );
  };

  it("rejects an explicit range wider than a fresh position can hold", async () => {
    const res = await post({ payer: PAYER, vault: PAYER, lbPair: PAYER, lowerBinId: 0, upperBinId: 71 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "Validation", message: "range must span at most 70 bins" },
    });
  });

  it("rejects a width above the cap at the schema", async () => {
    const res = await post({ payer: PAYER, vault: PAYER, lbPair: PAYER, width: 71 });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("Validation");
  });
});

describe("POST /api/tx/dlmm/open validation", () => {
  const post = async (body: Record<string, unknown>) => {
    const { POST } = await import("@/app/api/tx/dlmm/open/route");
    return POST(
      new Request("http://x/api/tx/dlmm/open", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `open-${Math.random()}` },
        body: JSON.stringify({
          payer: pk(5).toBase58(), vault: pk(1).toBase58(), lbPair: pk(7).toBase58(),
          lowerBinId: 0, upperBinId: 10, amountX: "1", amountY: "0", shape: "spot", maxActiveBinSlippage: 5,
          ...body,
        }),
      }),
    );
  };

  it("rejects ranges wider than 1400 bins", async () => {
    const res = await post({ lowerBinId: 0, upperBinId: 1401 });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/1400 bins/);
  });

  it("rejects an empty or inverted range", async () => {
    expect((await post({ lowerBinId: 5, upperBinId: 5 })).status).toBe(400);
  });

  it("rejects zero amounts on both sides", async () => {
    const res = await post({ amountX: "0", amountY: "0" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/amount/);
  });
});
