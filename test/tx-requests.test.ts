import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfigPda, getDepositEscrowPda, getDepositRequestPda, getShareEscrowPda, getWithdrawalRequestPda } from "@/server/pda";
import { getProgram, PROGRAM_ID } from "@/server/program";
import { fitsInTransaction } from "@/server/tx/size";
import type { VaultCtx } from "@/server/tx/context";
import {
  buildResolveBatch,
  chunkResolves,
  depositCancelIx,
  depositCreateIx,
  depositResolveIx,
  withdrawalCancelIx,
  withdrawalCreateIx,
  withdrawalResolveIx,
} from "@/server/tx/requests";

// Holder rather than closed-over consts: `vi.mock` factories are hoisted above every import, so the
// fake context and queue are filled in `beforeAll`, once `PublicKey` and `ctx` actually exist.
const mocked = vi.hoisted(() => ({
  ctx: null as unknown,
  queue: { deposits: [] as unknown[], withdrawals: [] as unknown[] },
  assembleCalls: [] as TransactionInstruction[][],
  /** Request PDAs whose transactions fail simulation. */
  failing: new Set<string>(),
}));

vi.mock("@/server/tx/context", () => ({
  loadVaultCtx: async () => mocked.ctx,
  assertAuthority: () => {},
}));
vi.mock("@/server/readers/position", () => ({ fetchRequestQueue: async () => mocked.queue }));
vi.mock("@/server/tx/assemble", async () => {
  const { ApiError } = await import("@/server/errors");
  return {
    assemble: async (_payer: PublicKey, ixs: TransactionInstruction[]) => {
      mocked.assembleCalls.push(ixs);
      const referenced = ixs.flatMap((ix) => ix.keys.map((k) => k.pubkey.toBase58()));
      if (referenced.some((k) => mocked.failing.has(k))) {
        throw new ApiError(422, "SimulationFailed", "simulation failed");
      }
      return { transaction: "", simulation: { unitsConsumed: 0 } };
    },
  };
});

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const vault = pk(1);
const ctx = {
  key: vault,
  account: {} as VaultCtx["account"],
  depositMint: pk(2),
  tokenProgram: TOKEN_PROGRAM,
  shareMint: pk(3),
} satisfies VaultCtx;
const user = pk(4);
const keys = (ix: { keys: { pubkey: PublicKey }[] }) => ix.keys.map((k) => k.pubkey.toBase58());

describe("request instruction builders", () => {
  const program = getProgram();

  it("deposit create targets the program with the request and escrow PDAs", async () => {
    const ix = await depositCreateIx(program, ctx, user, new BN(5));
    expect(ix.programId.equals(PROGRAM_ID)).toBe(true);
    expect(keys(ix)).toEqual(expect.arrayContaining([
      user.toBase58(), getConfigPda().toBase58(), vault.toBase58(),
      getDepositRequestPda(vault, user).toBase58(), getDepositEscrowPda(vault).toBase58(),
    ]));
    expect(ix.keys[0].isSigner).toBe(true);
  });

  it("deposit cancel and resolve reference the depositor's request", async () => {
    const cancel = await depositCancelIx(program, ctx, user);
    expect(keys(cancel)).toContain(getDepositRequestPda(vault, user).toBase58());
    const resolve = await depositResolveIx(program, ctx, pk(9), user);
    expect(keys(resolve)).toContain(getDepositRequestPda(vault, user).toBase58());
    expect(keys(resolve)[0]).toBe(pk(9).toBase58());
  });

  it("withdrawal builders reference the share escrow", async () => {
    const create = await withdrawalCreateIx(program, ctx, user, new BN(7));
    expect(keys(create)).toContain(getShareEscrowPda(vault).toBase58());
    const cancel = await withdrawalCancelIx(program, ctx, user);
    expect(keys(cancel)).toContain(getWithdrawalRequestPda(vault, user).toBase58());
    const resolve = await withdrawalResolveIx(program, ctx, pk(9), user);
    expect(keys(resolve)).toContain(getWithdrawalRequestPda(vault, user).toBase58());
  });
});

describe("chunkResolves", () => {
  it("never mixes deposit and withdrawal resolves in one chunk", () => {
    expect(chunkResolves(["d1", "d2", "d3"], ["w1", "w2", "w3"])).toEqual([
      ["d1", "d2", "d3"],
      ["w1", "w2", "w3"],
    ]);
  });

  it("chunks each list at the transaction limit, deposits first", () => {
    expect(chunkResolves(["d1", "d2", "d3", "d4", "d5", "d6", "d7"], ["w1"])).toEqual([
      ["d1", "d2", "d3", "d4", "d5"],
      ["d6", "d7"],
      ["w1"],
    ]);
  });

  it("returns no chunks for an empty queue", () => {
    expect(chunkResolves([], [])).toEqual([]);
  });
});

const payer = pk(9);

describe("RESOLVES_PER_TX", () => {
  // Guards the constant itself: adding an account to a resolve instruction silently shrinks how many
  // fit, which is how a chunk of six came to overrun the packet.
  const resolves = async (n: number) => {
    const program = getProgram();
    const t22Ctx = { ...ctx, tokenProgram: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") };
    return Promise.all(Array.from({ length: n }, (_, i) => depositResolveIx(program, t22Ctx, payer, pk(20 + i))));
  };

  it("fits a full chunk into one packet, with a Token-2022 deposit mint", async () => {
    expect(fitsInTransaction(payer, await resolves(5))).toBe(true);
  });

  it("does not fit one more", async () => {
    expect(fitsInTransaction(payer, await resolves(6))).toBe(false);
  });
});

describe("buildResolveBatch", () => {
  const owner = (n: number) => pk(n).toBase58();
  const deposit = (n: number, state: "pending" | "resolvable") => ({ owner: owner(n), state });

  beforeAll(() => {
    mocked.ctx = ctx;
  });
  beforeEach(() => {
    mocked.assembleCalls.length = 0;
    mocked.failing.clear();
  });

  it("assembles one homogeneous chunk per request kind and skips pending requests", async () => {
    mocked.queue = {
      deposits: [deposit(11, "resolvable"), deposit(12, "pending"), deposit(13, "resolvable")],
      withdrawals: [deposit(14, "resolvable")],
    };

    const built = await buildResolveBatch(vault.toBase58(), payer);

    expect(built).toHaveLength(2);
    expect(mocked.assembleCalls.map((ixs) => ixs.length)).toEqual([2, 1]);
    const all = mocked.assembleCalls.flat().flatMap(keys);
    expect(all).toContain(getDepositRequestPda(vault, pk(11)).toBase58());
    expect(all).toContain(getDepositRequestPda(vault, pk(13)).toBase58());
    expect(all).toContain(getWithdrawalRequestPda(vault, pk(14)).toBase58());
    // The pending request is never built.
    expect(all).not.toContain(getDepositRequestPda(vault, pk(12)).toBase58());
  });

  it("retries a rejected chunk one request at a time and leaves out the bad one", async () => {
    mocked.queue = {
      deposits: [deposit(11, "resolvable"), deposit(12, "resolvable"), deposit(13, "resolvable")],
      withdrawals: [],
    };
    mocked.failing.add(getDepositRequestPda(vault, pk(12)).toBase58());

    const built = await buildResolveBatch(vault.toBase58(), payer);

    // the chunk of three, then one transaction per request
    expect(mocked.assembleCalls.map((ixs) => ixs.length)).toEqual([3, 1, 1, 1]);
    expect(built).toHaveLength(2);
  });

  it("builds nothing when every request is still pending", async () => {
    mocked.queue = { deposits: [deposit(11, "pending")], withdrawals: [deposit(14, "pending")] };

    expect(await buildResolveBatch(vault.toBase58(), payer)).toEqual([]);
    expect(mocked.assembleCalls).toHaveLength(0);
  });
});
