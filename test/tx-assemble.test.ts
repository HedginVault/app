import {
  ComputeBudgetInstruction,
  Keypair,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { assemble, refreshUnsignedBatch } from "@/server/tx/assemble";

const mocked = vi.hoisted(() => ({ connection: null as unknown }));
vi.mock("@/server/program", () => ({ getConnection: () => mocked.connection }));

describe("assemble", () => {
  it("adds a bounded priority fee and fetches the final blockhash after simulation", async () => {
    const order: string[] = [];
    const blockhash = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
    mocked.connection = {
      getRecentPrioritizationFees: vi.fn(async () => {
        order.push("fees");
        return [0, 2_000, 4_000, 50_000].map((prioritizationFee, slot) => ({ slot, prioritizationFee }));
      }),
      simulateTransaction: vi.fn(async () => {
        order.push("simulate");
        return { value: { err: null, unitsConsumed: 100_000 } };
      }),
      getLatestBlockhash: vi.fn(async () => {
        order.push("blockhash");
        return { blockhash, lastValidBlockHeight: 1 };
      }),
    };
    const payer = Keypair.generate().publicKey;
    const programId = Keypair.generate().publicKey;
    const built = await assemble(payer, [new TransactionInstruction({ programId, keys: [], data: Buffer.alloc(0) })]);
    const tx = VersionedTransaction.deserialize(Buffer.from(built.transaction, "base64"));
    const compiled = tx.message.compiledInstructions;

    expect(order).toEqual(["fees", "simulate", "blockhash"]);
    expect(tx.message.recentBlockhash).toBe(blockhash);
    expect(ComputeBudgetInstruction.decodeSetComputeUnitLimit({
      programId: tx.message.staticAccountKeys[compiled[0].programIdIndex],
      keys: [],
      data: Buffer.from(compiled[0].data),
    }).units).toBe(130_000);
    expect(ComputeBudgetInstruction.decodeSetComputeUnitPrice({
      programId: tx.message.staticAccountKeys[compiled[1].programIdIndex],
      keys: [],
      data: Buffer.from(compiled[1].data),
    }).microLamports).toBe(10_000n);
  });

  it("defers simulation for a transaction that depends on earlier batch state", async () => {
    const blockhash = new PublicKey(new Uint8Array(32).fill(8)).toBase58();
    const simulateTransaction = vi.fn();
    mocked.connection = {
      getRecentPrioritizationFees: vi.fn(async () => []),
      simulateTransaction,
      getLatestBlockhash: vi.fn(async () => ({ blockhash, lastValidBlockHeight: 1 })),
    };
    const built = await assemble(
      Keypair.generate().publicKey,
      [new TransactionInstruction({ programId: Keypair.generate().publicKey, keys: [], data: Buffer.alloc(0) })],
      { deferSimulation: true },
    );
    const tx = VersionedTransaction.deserialize(Buffer.from(built.transaction, "base64"));
    const limit = tx.message.compiledInstructions[0];

    expect(simulateTransaction).not.toHaveBeenCalled();
    expect(built.simulation).toEqual({ unitsConsumed: 0, deferred: true });
    expect(ComputeBudgetInstruction.decodeSetComputeUnitLimit({
      programId: tx.message.staticAccountKeys[limit.programIdIndex],
      keys: [],
      data: Buffer.from(limit.data),
    }).units).toBe(1_400_000);
  });
});


describe("refreshUnsignedBatch", () => {
  it("refreshes the entire batch after preparation without changing instructions or ordering flags", async () => {
    const oldHash = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
    const freshHash = new PublicKey(new Uint8Array(32).fill(8)).toBase58();
    const getLatestBlockhash = vi.fn(async () => ({ blockhash: oldHash }));
    mocked.connection = { getLatestBlockhash, getRecentPrioritizationFees: async () => [] };
    const instruction = new TransactionInstruction({ programId: Keypair.generate().publicKey, keys: [], data: Buffer.from([1, 2, 3]) });
    const a = await assemble(Keypair.generate().publicKey, [instruction], { deferSimulation: true });
    const b = await assemble(Keypair.generate().publicKey, [instruction], { deferSimulation: true });
    getLatestBlockhash.mockResolvedValue({ blockhash: freshHash });
    getLatestBlockhash.mockClear();
    const batch = [{ ...a, sendConcurrently: true }, b];
    const refreshed = await refreshUnsignedBatch(batch);
    expect(getLatestBlockhash).toHaveBeenCalledTimes(1);
    for (let index = 0; index < batch.length; index++) {
      const original = VersionedTransaction.deserialize(Buffer.from(batch[index].transaction, "base64"));
      const actual = VersionedTransaction.deserialize(Buffer.from(refreshed[index].transaction, "base64"));
      expect(actual.message.recentBlockhash).toBe(freshHash);
      expect(original.message.recentBlockhash).toBe(oldHash);
      expect(actual.message.compiledInstructions).toEqual(original.message.compiledInstructions);
      expect(actual.message.staticAccountKeys).toEqual(original.message.staticAccountKeys);
      expect(actual.signatures).toEqual(original.signatures);
      expect(refreshed[index].sendConcurrently).toBe(batch[index].sendConcurrently);
      expect(refreshed[index].simulation).toEqual(batch[index].simulation);
    }
  });

  it("refuses to invalidate an existing signature", async () => {
    const payer = Keypair.generate();
    mocked.connection = {
      getLatestBlockhash: async () => ({ blockhash: PublicKey.default.toBase58() }),
      getRecentPrioritizationFees: async () => [],
    };
    const built = await assemble(payer.publicKey, [], { signers: [payer], deferSimulation: true });
    await expect(refreshUnsignedBatch([built])).rejects.toThrow("already has signatures");
  });
});
