import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Whether the instructions (plus the compute-budget instruction `assemble` prepends) serialize into
 * one packet. Pure: compiles against a placeholder blockhash. web3.js signals an oversized
 * transaction with a RangeError ("encoding overruns Uint8Array").
 */
export function fitsInTransaction(
  payer: PublicKey,
  instructions: TransactionInstruction[],
  lookupTables: AddressLookupTableAccount[] = [],
): boolean {
  try {
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: PublicKey.default.toBase58(),
      instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ...instructions],
    }).compileToV0Message(lookupTables);
    new VersionedTransaction(message).serialize();
    return true;
  } catch (e) {
    if (e instanceof RangeError) return false;
    throw e;
  }
}

export type SwapPlan = "swap" | "initAndSwap" | "initThenSwap";

export const swapPlan = (strategyExists: boolean, combinedFits: boolean): SwapPlan =>
  strategyExists ? "swap" : combinedFits ? "initAndSwap" : "initThenSwap";
