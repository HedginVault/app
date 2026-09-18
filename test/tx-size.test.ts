import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { fitsInTransaction, swapPlan } from "@/server/tx/size";

const payer = Keypair.generate().publicKey;
const ix = (bytes: number) => new TransactionInstruction({ programId: PublicKey.default, keys: [], data: Buffer.alloc(bytes) });

describe("fitsInTransaction", () => {
  it("accepts a small transaction and rejects one past the packet limit", () => {
    expect(fitsInTransaction(payer, [ix(100)])).toBe(true);
    expect(fitsInTransaction(payer, [ix(1300)])).toBe(false);
    expect(fitsInTransaction(payer, [ix(600), ix(600)])).toBe(false);
  });
});

describe("swapPlan", () => {
  it("only initializes a missing strategy, splitting when both do not fit", () => {
    expect(swapPlan(true, false)).toBe("swap");
    expect(swapPlan(false, true)).toBe("initAndSwap");
    expect(swapPlan(false, false)).toBe("initThenSwap");
  });
});
