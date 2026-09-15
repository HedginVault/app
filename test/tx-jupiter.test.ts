import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/errors";
import { getConfigPda, getStrategyPda } from "@/server/pda";
import { getProgram } from "@/server/program";
import type { VaultCtx } from "@/server/tx/context";
import { extractRemainingAccounts, jupiterInitializeIx } from "@/server/tx/jupiter";

// The swap route validates the mints against the vault before any Jupiter or strategy lookup; stub
// the two context calls so those checks run without RPC. The deposit mint matches `ctx` below.
vi.mock("@/server/tx/context", async () => {
  const { PublicKey } = await import("@solana/web3.js");
  return {
    loadVaultCtx: vi.fn(async () => ({ depositMint: new PublicKey(new Uint8Array(32).fill(2)) })),
    assertAuthority: vi.fn(),
  };
});

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const ctx = {
  key: pk(1),
  account: {} as VaultCtx["account"],
  depositMint: pk(2),
  tokenProgram: TOKEN_PROGRAM,
  shareMint: pk(3),
} satisfies VaultCtx;
const keys = (ix: { keys: { pubkey: PublicKey }[] }) => ix.keys.map((k) => k.pubkey.toBase58());

const ROUTE = [229, 23, 203, 151, 122, 227, 173, 42];
const SHARED_ACCOUNTS_ROUTE = [193, 32, 155, 51, 65, 214, 156, 129];

/** A Jupiter instruction with `n` distinct accounts and the given 8-byte discriminator. */
const fakeSwapIx = (discriminator: number[], n: number) =>
  new TransactionInstruction({
    programId: pk(200),
    keys: Array.from({ length: n }, (_, i) => ({ pubkey: pk(i + 1), isSigner: false, isWritable: false })),
    data: Buffer.from([...discriminator, 0, 0, 0, 0]),
  });

describe("jupiterInitializeIx", () => {
  it("derives the strategy PDA from (vault, targetMint) and passes the config PDA", async () => {
    const targetMint = pk(9);
    const ix = await jupiterInitializeIx(getProgram(), ctx, pk(5), targetMint);
    expect(keys(ix)).toEqual(
      expect.arrayContaining([
        getStrategyPda(ctx.key, targetMint).toBase58(),
        getConfigPda().toBase58(),
        ctx.key.toBase58(),
        targetMint.toBase58(),
      ]),
    );
  });
});

describe("POST /api/tx/jupiter/swap validation", () => {
  const post = async (sourceMint: PublicKey, destinationMint: PublicKey) => {
    const { POST } = await import("@/app/api/tx/jupiter/swap/route");
    return POST(
      new Request("http://x/api/tx/jupiter/swap", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `swap-${Math.random()}` },
        body: JSON.stringify({
          payer: pk(5).toBase58(),
          vault: pk(1).toBase58(),
          sourceMint: sourceMint.toBase58(),
          destinationMint: destinationMint.toBase58(),
          amount: "1000",
          slippageBps: 50,
        }),
      }),
    );
  };

  it("rejects a swap where neither side is the deposit mint", async () => {
    const res = await post(pk(8), pk(9));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "Validation", message: "one side of the swap must be the vault deposit mint" },
    });
  });

  it("rejects a swap from a mint into itself", async () => {
    const res = await post(ctx.depositMint, ctx.depositMint);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "Validation", message: "sourceMint and destinationMint must differ" },
    });
  });
});

describe("extractRemainingAccounts", () => {
  it("drops the first 9 accounts of a ROUTE instruction", () => {
    const ix = fakeSwapIx(ROUTE, 14);
    expect(extractRemainingAccounts(ix)).toEqual(ix.keys.slice(9));
  });

  it("reorders a SHARED_ACCOUNTS_ROUTE instruction to [1, 4, 5, ...13:]", () => {
    const ix = fakeSwapIx(SHARED_ACCOUNTS_ROUTE, 18);
    expect(extractRemainingAccounts(ix)).toEqual([ix.keys[1], ix.keys[4], ix.keys[5], ...ix.keys.slice(13)]);
  });

  it("rejects an unknown discriminator with a 502", () => {
    const ix = fakeSwapIx([1, 2, 3, 4, 5, 6, 7, 8], 14);
    expect(() => extractRemainingAccounts(ix)).toThrow(ApiError);
    try {
      extractRemainingAccounts(ix);
    } catch (e) {
      expect((e as ApiError).status).toBe(502);
      expect((e as ApiError).code).toBe("JupiterUnknownRoute");
    }
  });
});
