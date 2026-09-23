import {
  ComputeBudgetInstruction,
  Keypair,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { assemble } from "@/server/tx/assemble";

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
});
