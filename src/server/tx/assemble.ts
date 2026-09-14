import "server-only";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import type { BuiltTransaction } from "@/lib/types";
import { ApiError, decodeAnchorError } from "../errors";
import { getConnection } from "../program";

interface AssembleOptions {
  lookupTables?: AddressLookupTableAccount[];
  signers?: Keypair[];
  computeUnits?: number;
}

/** Builds a v0 transaction, simulates it, and returns it base64-encoded. Never signs for the payer. */
export async function assemble(
  payer: PublicKey,
  instructions: TransactionInstruction[],
  { lookupTables = [], signers = [], computeUnits = 1_400_000 }: AssembleOptions = {},
): Promise<BuiltTransaction> {
  const connection = getConnection();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }), ...instructions],
  }).compileToV0Message(lookupTables);
  const tx = new VersionedTransaction(message);
  if (signers.length) tx.sign(signers);

  const sim = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    const decoded = decodeAnchorError(logs);
    throw new ApiError(
      422,
      decoded?.code ?? "SimulationFailed",
      decoded?.message ?? `Simulation failed: ${JSON.stringify(sim.value.err)}`,
      logs,
    );
  }

  return {
    transaction: Buffer.from(tx.serialize()).toString("base64"),
    simulation: { unitsConsumed: sim.value.unitsConsumed ?? 0 },
  };
}
