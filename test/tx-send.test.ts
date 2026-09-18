import {
  Keypair,
  PublicKey,
  SendTransactionError,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorFromUnknown } from "@/server/errors";
import { PROGRAM_ID } from "@/server/program";
import { getTransactionStatus, parseSignedTransaction, sendSignedTransaction } from "@/server/tx/send";

const mocked = vi.hoisted(() => ({ connection: null as unknown }));
vi.mock("@/server/program", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/program")>()),
  getConnection: () => mocked.connection,
}));

const ANCHOR_LOG =
  "Program log: AnchorError occurred. Error Code: DepositBelowMinimum. Error Number: 6040. Error Message: Deposit is below the vault minimum.";
const BLOCKHASH = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
const payer = Keypair.generate();

const build = (programId: PublicKey, sign = true) => {
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: BLOCKHASH,
    instructions: [new TransactionInstruction({ programId, keys: [], data: Buffer.from([1]) })],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  if (sign) tx.sign([payer]);
  return Buffer.from(tx.serialize()).toString("base64");
};

const expectApiError = async (p: Promise<unknown> | (() => unknown), status: number, code: string) => {
  const err = await (typeof p === "function" ? Promise.resolve().then(p) : p).then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  expect((err as ApiError).code).toBe(code);
  return err as ApiError;
};

describe("parseSignedTransaction", () => {
  it("accepts a signed transaction that invokes the program", () => {
    expect(parseSignedTransaction(build(PROGRAM_ID)).message.recentBlockhash).toBe(BLOCKHASH);
  });
  it("rejects bytes that are not a transaction", async () => {
    await expectApiError(() => parseSignedTransaction(Buffer.from("nope").toString("base64")), 400, "Validation");
    await expectApiError(() => parseSignedTransaction(""), 400, "Validation");
  });
  it("refuses to relay a transaction that never touches the program", async () => {
    const err = await expectApiError(() => parseSignedTransaction(build(Keypair.generate().publicKey)), 400, "Validation");
    expect(err.message).toMatch(/hedge_vault/);
  });
  it("refuses an unsigned transaction", async () => {
    const err = await expectApiError(() => parseSignedTransaction(build(PROGRAM_ID, false)), 400, "Validation");
    expect(err.message).toMatch(/signature/);
  });
});

describe("sendSignedTransaction", () => {
  it("returns the signature from the server's connection", async () => {
    const sendRawTransaction = vi.fn(async () => "sig");
    mocked.connection = { sendRawTransaction };
    expect(await sendSignedTransaction(build(PROGRAM_ID))).toEqual({ signature: "sig" });
    expect(sendRawTransaction).toHaveBeenCalledOnce();
  });
  it("turns a preflight failure into a 422 with the decoded Anchor error", async () => {
    mocked.connection = {
      sendRawTransaction: async () => {
        throw new SendTransactionError({
          action: "simulate",
          signature: "",
          transactionMessage: "Transaction simulation failed: Error processing Instruction 1",
          logs: [ANCHOR_LOG],
        });
      },
    };
    const err = await expectApiError(sendSignedTransaction(build(PROGRAM_ID)), 422, "DepositBelowMinimum");
    expect(err.logs).toEqual([ANCHOR_LOG]);
  });
  it("leaves a provider rate limit as an outage, not a transaction error", async () => {
    mocked.connection = {
      sendRawTransaction: async () => {
        throw new SendTransactionError({ action: "simulate", signature: "", transactionMessage: "429 Too Many Requests" });
      },
    };
    const err = await sendSignedTransaction(build(PROGRAM_ID)).catch((e) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect(errorFromUnknown(err).status).toBe(503);
  });
});

describe("getTransactionStatus", () => {
  const connection = (statuses: unknown[], valid = true, logs: string[] = []) => {
    const queue = [...statuses];
    return {
      getSignatureStatuses: vi.fn(async () => ({ value: [queue.length > 1 ? queue.shift() : queue[0]] })),
      isBlockhashValid: vi.fn(async () => ({ value: valid })),
      getTransaction: vi.fn(async () => ({ meta: { logMessages: logs } })),
    };
  };

  beforeEach(() => {
    mocked.connection = null;
  });

  it("is pending while the signature is unknown and its blockhash can still land", async () => {
    mocked.connection = connection([null], true);
    expect(await getTransactionStatus("sig", BLOCKHASH)).toEqual({ status: "pending" });
  });
  it("is expired once the blockhash is invalid and the signature never appeared", async () => {
    mocked.connection = connection([null], false);
    expect(await getTransactionStatus("sig", BLOCKHASH)).toEqual({ status: "expired" });
  });
  it("re-checks after expiry, since it may have landed in the last valid block", async () => {
    mocked.connection = connection([null, { confirmationStatus: "confirmed", err: null }], false);
    expect(await getTransactionStatus("sig", BLOCKHASH)).toEqual({ status: "confirmed" });
  });
  it("does not report a processed result, which can still be dropped", async () => {
    mocked.connection = connection([{ confirmationStatus: "processed", err: { InstructionError: [1, {}] } }]);
    expect(await getTransactionStatus("sig", BLOCKHASH)).toEqual({ status: "pending" });
  });
  it("is confirmed at confirmed or finalized", async () => {
    mocked.connection = connection([{ confirmationStatus: "finalized", err: null }]);
    expect(await getTransactionStatus("sig", BLOCKHASH)).toEqual({ status: "confirmed" });
  });
  it("decodes an on-chain failure from the landed transaction's logs", async () => {
    mocked.connection = connection([{ confirmationStatus: "confirmed", err: { InstructionError: [1, {}] } }], true, [ANCHOR_LOG]);
    expect(await getTransactionStatus("sig", BLOCKHASH)).toEqual({
      status: "failed",
      code: "DepositBelowMinimum",
      message: "Deposit is below the vault minimum",
      logs: [ANCHOR_LOG],
    });
  });
});
