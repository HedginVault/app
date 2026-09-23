import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { selectPriorityFeeMicroLamports } from "@/server/tx/priority-fee";
import { fitsInTransaction, swapPlan } from "@/server/tx/size";

const payer = Keypair.generate().publicKey;
const ix = (bytes: number) => new TransactionInstruction({ programId: PublicKey.default, keys: [], data: Buffer.alloc(bytes) });

describe("fitsInTransaction", () => {
  it("accepts a small transaction and rejects one past the packet limit", () => {
    expect(fitsInTransaction(payer, [ix(100)])).toBe(true);
    expect(fitsInTransaction(payer, [ix(1300)])).toBe(false);
    expect(fitsInTransaction(payer, [ix(600), ix(600)])).toBe(false);
  });

  it("counts the signature, not just the message", () => {
    // 1008 bytes of instruction data is the largest payload that leaves room for the 65-byte
    // signature; a message up to 65 bytes longer still serializes on its own, so measuring the
    // whole transaction is what rejects it
    expect(fitsInTransaction(payer, [ix(1008)])).toBe(true);
    expect(fitsInTransaction(payer, [ix(1009)])).toBe(false);
  });
});

describe("swapPlan", () => {
  it("only initializes a missing strategy, splitting when both do not fit", () => {
    expect(swapPlan(true, false)).toBe("swap");
    expect(swapPlan(false, true)).toBe("initAndSwap");
    expect(swapPlan(false, false)).toBe("initThenSwap");
  });
});

describe("selectPriorityFeeMicroLamports", () => {
  it("uses a bounded upper-quartile recent fee", () => {
    expect(selectPriorityFeeMicroLamports([0, 500, 2_000, 4_000])).toBe(4_000);
    expect(selectPriorityFeeMicroLamports([50_000])).toBe(10_000);
    expect(selectPriorityFeeMicroLamports([])).toBe(1_000);
  });
});
