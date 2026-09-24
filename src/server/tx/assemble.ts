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
import { getPriorityFeeMicroLamports } from "./priority-fee";

interface AssembleOptions {
  lookupTables?: AddressLookupTableAccount[];
  signers?: Keypair[];
  computeUnits?: number;
  /**
   * Later transactions in one user-approved batch can depend on accounts created by the
   * first transaction. Standard RPC simulation cannot carry those account changes between calls,
   * so those later transactions are validated by the relay's preflight immediately before send.
   */
  deferSimulation?: boolean;
}

/** Builds a v0 transaction and returns it base64-encoded. Never signs for the payer. */
export async function assemble(
  payer: PublicKey,
  instructions: TransactionInstruction[],
  { lookupTables = [], signers = [], computeUnits = 1_400_000, deferSimulation = false }: AssembleOptions = {},
): Promise<BuiltTransaction> {
  const connection = getConnection();
  const writableAccounts = [
    ...new Map(
      [payer, ...instructions.flatMap((ix) => ix.keys.filter((key) => key.isWritable).map((key) => key.pubkey))].map(
        (key) => [key.toBase58(), key],
      ),
    ).values(),
  ].slice(0, 128);
  const priorityFeeMicroLamports = await getPriorityFeeMicroLamports(connection, writableAccounts);
  const budgetInstructions = (units: number) => [
    ComputeBudgetProgram.setComputeUnitLimit({ units }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeMicroLamports }),
  ];
  const compile = (blockhash: string, units: number) => new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [...budgetInstructions(units), ...instructions],
  }).compileToV0Message(lookupTables);

  let unitsConsumed = 0;
  let finalComputeUnits = computeUnits;
  if (!deferSimulation) {
    // Simulate before fetching the final blockhash. This gives wallet approval the full blockhash
    // lifetime and lets the paid CU limit reflect this transaction instead of the 1.4M ceiling.
    const simulationTx = new VersionedTransaction(compile(PublicKey.default.toBase58(), computeUnits));
    const sim = await connection.simulateTransaction(simulationTx, { sigVerify: false, replaceRecentBlockhash: true });
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
    unitsConsumed = sim.value.unitsConsumed ?? 0;
    const consumed = sim.value.unitsConsumed ?? computeUnits;
    finalComputeUnits = Math.min(computeUnits, Math.max(consumed, Math.ceil(consumed * 1.2) + 10_000));
  }
  // Fetch the blockhash after every advisory/provider call so wallet approval gets its full lifetime.
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(compile(blockhash, finalComputeUnits));
  if (signers.length) tx.sign(signers);

  return {
    transaction: Buffer.from(tx.serialize()).toString("base64"),
    simulation: { unitsConsumed, ...(deferSimulation ? { deferred: true } : {}) },
  };
}
