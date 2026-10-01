import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStrategyPda } from "@/server/pda";
import type { VaultCtx } from "@/server/tx/context";
import { pairStrategyAccounts, pairStrategySetupIxs } from "@/server/tx/pair-strategy";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const mocks = vi.hoisted(() => ({ accounts: vi.fn(), init: vi.fn() }));
vi.mock("@/server/program", async (importOriginal) => ({ ...(await importOriginal<object>()), getConnection: () => ({}) }));
vi.mock("@/server/rpc", () => ({ getMultipleAccounts: mocks.accounts }));
vi.mock("@/server/tx/jupiter", () => ({ jupiterInitializeIx: mocks.init }));

const ctx = { key: pk(1), depositMint: pk(2) } as VaultCtx;
const program = {} as Parameters<typeof pairStrategySetupIxs>[0];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.init.mockImplementation(async (_p, _c, _a, mint: PublicKey) =>
    new TransactionInstruction({ programId: mint, keys: [], data: Buffer.alloc(0) }));
});

describe("pairStrategyAccounts", () => {
  it("passes None for the deposit mint and the Jupiter strategy PDA otherwise", () => {
    expect(pairStrategyAccounts(ctx, { tokenXMint: pk(3), tokenYMint: pk(2) })).toEqual({
      strategyX: getStrategyPda(pk(1), pk(3)),
      strategyY: null,
    });
  });
});

describe("pairStrategySetupIxs", () => {
  it("initializes only the non-deposit pair mints that lack a strategy", async () => {
    mocks.accounts.mockResolvedValue([null, {}]);
    const ixs = await pairStrategySetupIxs(program, ctx, pk(5), { tokenXMint: pk(3), tokenYMint: pk(4) });
    expect(mocks.accounts.mock.calls[0][1]).toEqual([getStrategyPda(pk(1), pk(3)), getStrategyPda(pk(1), pk(4))]);
    expect(ixs.map((ix) => ix.programId)).toEqual([pk(3)]);
  });

  it("needs no RPC when the pair is the deposit mint on one side and it is tracked on the other", async () => {
    mocks.accounts.mockResolvedValue([{}]);
    expect(await pairStrategySetupIxs(program, ctx, pk(5), { tokenXMint: pk(2), tokenYMint: pk(3) })).toEqual([]);
    expect(mocks.accounts.mock.calls[0][1]).toEqual([getStrategyPda(pk(1), pk(3))]);
  });

  it("skips the read entirely when only the deposit mint is involved", async () => {
    expect(await pairStrategySetupIxs(program, ctx, pk(5), { tokenXMint: pk(2), tokenYMint: pk(2) })).toEqual([]);
    expect(mocks.accounts).not.toHaveBeenCalled();
  });
});
