import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PACKET_DATA_SIZE,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Whether the instructions (plus the compute-budget instruction `assemble` prepends) serialize into
 * one packet. Pure: compiles against a placeholder blockhash. The serialized length is measured
 * rather than inferred from `serialize()` throwing: that RangeError ("encoding overruns
 * Uint8Array") only fires once the message alone passes the limit, which misses a transaction whose
 * message fits but whose signatures push it over.
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
    return new VersionedTransaction(message).serialize().length <= PACKET_DATA_SIZE;
  } catch (e) {
    if (e instanceof RangeError) return false;
    throw e;
  }
}

export type SwapPlan = "swap" | "initAndSwap" | "initThenSwap";

export const swapPlan = (strategyExists: boolean, combinedFits: boolean): SwapPlan =>
  strategyExists ? "swap" : combinedFits ? "initAndSwap" : "initThenSwap";
