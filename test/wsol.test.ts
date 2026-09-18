import { AccountLayout, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { type AccountInfo, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { SOL_RESERVE_LAMPORTS, spendableSol, wrapSolIxs } from "@/server/wsol";

const owner = Keypair.generate().publicKey;
const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner, false);

const account = (lamports: number, data = Buffer.alloc(0)): AccountInfo<Buffer> => ({
  lamports, data, owner: TOKEN_PROGRAM_ID, executable: false, rentEpoch: 0,
});
const tokenAccount = (amount: bigint) => {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode({
    mint: NATIVE_MINT, owner, amount, delegateOption: 0, delegate: PublicKey.default, state: 1,
    isNativeOption: 1, isNative: 2_039_280n, delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: PublicKey.default,
  }, data);
  return account(2_039_280 + Number(amount), data);
};

describe("wrapSolIxs", () => {
  it("is empty when the wSOL balance already covers the amount", () => {
    expect(wrapSolIxs(owner, 100n, 100n)).toEqual([]);
  });

  it("creates the ATA, transfers only the shortfall and syncs", () => {
    const [create, transfer, sync] = wrapSolIxs(owner, 1_000n, 400n);
    expect(create.keys[1].pubkey.equals(ata)).toBe(true);
    expect(transfer.programId.equals(SystemProgram.programId)).toBe(true);
    expect(transfer.keys[1].pubkey.equals(ata)).toBe(true);
    expect(transfer.data.readBigUInt64LE(4)).toBe(600n);
    expect(sync.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(sync.keys[0].pubkey.equals(ata)).toBe(true);
  });
});

describe("spendableSol", () => {
  it("adds wSOL to native SOL above the reserve", () => {
    const lamports = Number(SOL_RESERVE_LAMPORTS) + 5_000;
    expect(spendableSol(account(lamports), tokenAccount(700n))).toBe(5_700n);
  });

  it("never counts native SOL below the reserve", () => {
    expect(spendableSol(account(1_000), tokenAccount(700n))).toBe(700n);
    expect(spendableSol(null, null)).toBe(0n);
  });
});
