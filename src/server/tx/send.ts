import "server-only";
import { SendTransactionError, VersionedTransaction } from "@solana/web3.js";
import type { SentTransaction, TransactionStatus } from "@/lib/types";
import { ApiError, decodeAnchorError, isRateLimitError } from "../errors";
import { getConnection, PROGRAM_ID } from "../program";

/** The Solana packet limit; anything larger cannot be a transaction the cluster would accept. */
const MAX_TX_BYTES = 1232;

/**
 * Decodes a wallet-signed transaction and refuses anything this app did not plausibly build: the
 * relay spends the server's keyed RPC, so it only forwards transactions that invoke the hedge_vault
 * program and carry a fee-payer signature. Program ids always sit in the static keys (never in a
 * lookup table), and a wallet that appends its own instructions still passes.
 */
export function parseSignedTransaction(base64: string): VersionedTransaction {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_TX_BYTES) {
    throw new ApiError(400, "Validation", "transaction: invalid size");
  }
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(bytes);
  } catch {
    throw new ApiError(400, "Validation", "transaction: not a serialized transaction");
  }
  const { staticAccountKeys, compiledInstructions } = tx.message;
  if (!compiledInstructions.some((ix) => staticAccountKeys[ix.programIdIndex]?.equals(PROGRAM_ID))) {
    throw new ApiError(400, "Validation", "transaction: must invoke the hedge_vault program");
  }
  if (!tx.signatures[0] || tx.signatures[0].every((b) => b === 0)) {
    throw new ApiError(400, "Validation", "transaction: missing fee payer signature");
  }
  return tx;
}

/** 1 RPC: submits with preflight. A preflight failure becomes a `422` with the decoded Anchor error. */
export async function sendSignedTransaction(base64: string): Promise<SentTransaction> {
  const tx = parseSignedTransaction(base64);
  try {
    const signature = await getConnection().sendRawTransaction(tx.serialize(), {
      preflightCommitment: "confirmed",
    });
    return { signature };
  } catch (e) {
    // web3.js raises SendTransactionError for every JSON-RPC error, including provider rate limits;
    // those stay outages (503 via errorFromUnknown), everything else is the transaction's fault.
    if (e instanceof SendTransactionError && !isRateLimitError(e.message)) {
      const logs = e.logs ?? [];
      const decoded = decodeAnchorError(logs);
      throw new ApiError(422, decoded?.code ?? "SendFailed", decoded?.message ?? e.transactionError.message, logs);
    }
    throw e;
  }
}

/**
 * 1–3 RPC: the signature status; when it is unknown, whether its blockhash can still land (and one
 * re-check, since it may have landed in the last valid block); on failure, the logs to decode.
 * Only `confirmed` or better counts — a processed result can still be dropped with its fork.
 */
export async function getTransactionStatus(signature: string, blockhash: string): Promise<TransactionStatus> {
  const connection = getConnection();
  const lookup = async (searchTransactionHistory = false) =>
    (await connection.getSignatureStatuses([signature], { searchTransactionHistory })).value[0];

  let status = await lookup();
  if (!status) {
    const { value: valid } = await connection.isBlockhashValid(blockhash, { commitment: "confirmed" });
    if (valid) return { status: "pending" };
    // The recent-status cache may no longer contain the signature by the time its blockhash
    // expires. Search confirmed ledger history before classifying the outcome as never landed.
    status = await lookup(true);
    if (!status) return { status: "expired" };
  }
  if (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized") {
    return { status: "pending" };
  }
  if (!status.err) return { status: "confirmed" };

  const landed = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const logs = landed?.meta?.logMessages ?? [];
  const decoded = decodeAnchorError(logs);
  return {
    status: "failed",
    code: decoded?.code ?? "TransactionFailed",
    message: decoded?.message ?? `Transaction failed on-chain: ${JSON.stringify(status.err)}`,
    logs,
  };
}
