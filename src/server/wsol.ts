import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import { type AccountInfo, LAMPORTS_PER_SOL, type PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import { decodeTokenAmount } from "./rpc";

/**
 * Native SOL held back from a SOL vault's spendable balance: covers the wSOL ATA, the share ATA and
 * the deposit request rent on a first deposit, plus fees.
 */
export const SOL_RESERVE_LAMPORTS = BigInt(LAMPORTS_PER_SOL / 100);

export const isNativeMint = (mint: PublicKey) => mint.equals(NATIVE_MINT);

/** The owner's wSOL ATA (classic Token program — the native mint lives there). */
export const wsolAta = (owner: PublicKey) => getAssociatedTokenAddressSync(NATIVE_MINT, owner, false);

/** wSOL already in the ATA plus native SOL above the reserve. */
export function spendableSol(wallet: AccountInfo<Buffer> | null, ata: AccountInfo<Buffer> | null): bigint {
  const native = BigInt(wallet?.lamports ?? 0) - SOL_RESERVE_LAMPORTS;
  return decodeTokenAmount(ata) + (native > 0n ? native : 0n);
}

/**
 * Tops the owner's wSOL ATA up to `amount` from native SOL: idempotent ATA create, lamport
 * transfer, sync. Empty when the wrapped balance already covers it. The ATA is left open — deposit
 * cancel and withdrawal resolve pay back into it.
 */
export function wrapSolIxs(owner: PublicKey, amount: bigint, wrapped: bigint): TransactionInstruction[] {
  const shortfall = amount - wrapped;
  if (shortfall <= 0n) return [];
  const ata = wsolAta(owner);
  return [
    createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, NATIVE_MINT),
    SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports: shortfall }),
    createSyncNativeInstruction(ata),
  ];
}
