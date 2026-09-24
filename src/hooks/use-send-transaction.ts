"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { createElement, useRef, useState } from "react";
import { toast } from "sonner";
import { TxToast, type TxToastProps } from "@/components/ui/tx-toast";
import { api, ApiRequestError } from "@/lib/api";
import { executeSignedBatch, runSteps, StepsError, type StepProgress } from "@/lib/tx-steps";
import type { BuiltStep } from "@/lib/types";
import { useInvalidateVault } from "./queries";

export interface SendOptions {
  label: string;
  build: () => Promise<BuiltStep | BuiltStep[]>;
  vault?: string;
  onSuccess?: (signatures: string[]) => void;
  /** Per-transaction progress, for step lists in review dialogs. */
  onProgress?: (p: StepProgress) => void;
  /** Names each transaction in a multi-tx flow (e.g. ["Create position", "Add liquidity"]) so the toast names the step instead of "(step N)". */
  stepLabels?: string[];
}

const POLL_MS = 2_000;
/** Backstop only: a blockhash expires after ~60–90 s, which the status route reports as `expired`. */
const CONFIRM_TIMEOUT_MS = 120_000;

/**
 * Narrow wallet-rejection detection. A server-decoded program error is never a rejection, even when
 * its message happens to contain "cancel" (e.g. `RequestNotCancellable`).
 */
const isRejection = (e: unknown) => {
  if (e instanceof ApiRequestError) return false;
  if (!(e instanceof Error)) return false;
  if (e.name === "WalletSignTransactionError") return true;
  return /user rejected|user denied/i.test(e.message);
};

/** Browser-safe base64 <-> bytes; avoids depending on a Node `Buffer` global in the client bundle. */
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const encodeBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls the server until the signature is confirmed; throws on an on-chain failure or expiry. */
async function waitForConfirmation(signature: string, blockhash: string) {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    let result;
    try {
      result = await api.txStatus(signature, blockhash);
    } catch (e) {
      // A throttled or briefly unavailable status check says nothing about the transaction.
      if (e instanceof ApiRequestError && (e.status === 429 || e.status >= 500)) continue;
      throw e;
    }
    if (result.status === "confirmed") return;
    if (result.status === "failed") {
      throw new ApiRequestError(422, result.code, result.message, result.logs);
    }
    if (result.status === "expired") {
      throw new Error("Transaction expired before it was confirmed, try again");
    }
  }
  throw new Error(`Timed out waiting for confirmation of ${signature}`);
}

/** Build on the server, sign in the wallet, send and confirm through the server, then refresh the vault's queries. */
export function useSendTransaction() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const invalidate = useInvalidateVault();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const send = async ({ label, build, vault, onSuccess, onProgress, stepLabels }: SendOptions): Promise<string[] | null> => {
    if (!publicKey) {
      toast.error("Connect a wallet first");
      return null;
    }
    if (!signTransaction) {
      toast.error("This wallet does not support transaction signing");
      return null;
    }
    if (inFlight.current) {
      toast("A transaction is already in progress");
      return null;
    }
    const payer = publicKey.toBase58();
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const confirmed: string[] = [];
    const show = (p: Pick<TxToastProps, "title" | "subtitle" | "tone" | "errorText">) =>
      toast.custom(
        () =>
          createElement(TxToast, {
            ...p,
            signatures: p.tone === "loading" ? undefined : [...confirmed],
            onClose: () => toast.dismiss(id),
          }),
        { id, duration: p.tone === "loading" ? Infinity : p.tone === "error" ? 12_000 : 8_000 },
      );
    const progress = (subtitle: string) => show({ title: label, subtitle, tone: "loading" });
    inFlight.current = true;
    setPending(true);
    progress("Preparing transaction...");
    try {
      const signatures = await runSteps({
        first: build,
        buildNext: (next) => api.build(next.path, { ...next.body, payer }),
        onProgress,
        executeBatch: async (batch, startIndex, report) => {
          if (!signAllTransactions)
            throw new Error("This wallet does not support approving multiple transactions together");
          batch.forEach((_, offset) => report(startIndex + offset, "signing"));
          progress(`Please approve ${batch.length} transactions in your wallet`);
          const unsigned = batch.map((step) => VersionedTransaction.deserialize(decodeBase64(step.transaction)));
          const signed = await signAllTransactions(unsigned);
          if (signed.length !== batch.length)
            throw new Error("Wallet returned an incomplete signed transaction batch");

          return executeSignedBatch({
            signed,
            steps: batch,
            submit: async (transaction, offset) => {
              const index = startIndex + offset;
              const name = stepLabels?.[index] ?? `Transaction ${index + 1} of ${startIndex + signed.length}`;
              report(index, "sending");
              progress(`${name}: submitting transaction...`);
              return (await api.send(encodeBase64(transaction.serialize()))).signature;
            },
            confirm: async (transaction, signature, offset) => {
              report(startIndex + offset, "confirming");
              progress("Waiting for transactions to confirm...");
              await waitForConfirmation(signature, transaction.message.recentBlockhash);
            },
            onConfirmed: (signature) => { confirmed.push(signature); },
            onFailed: (offset) => report(startIndex + offset, "failed"),
          });
        },
        execute: async (b, index, report) => {
          const multi = (stepLabels?.length ?? 0) > 1 || index > 0 || !!b.next;
          const name = stepLabels?.[index] ?? (multi ? `Transaction ${index + 1}` : "");
          const at = (action: string) => (name ? `${name}: ${action}` : action);
          report("signing");
          progress(at("please approve in your wallet"));
          const signed = await signTransaction(VersionedTransaction.deserialize(decodeBase64(b.transaction)));
          report("sending");
          progress(at("submitting transaction..."));
          const { signature } = await api.send(encodeBase64(signed.serialize()));
          report("confirming");
          progress(at("waiting for confirmation..."));
          await waitForConfirmation(signature, signed.message.recentBlockhash);
          confirmed.push(signature);
          if (b.next) progress("Preparing next transaction...");
          return signature;
        },
      });
      if (signatures.length === 0) {
        toast.dismiss(id);
        toast.info(`${label}: nothing to do`);
        return [];
      }
      show({
        title: `${label} confirmed`,
        subtitle: signatures.length === 1 ? "Transaction confirmed" : `${signatures.length} transactions confirmed`,
        tone: "success",
      });
      invalidate(vault);
      onSuccess?.(signatures);
      return signatures;
    } catch (e) {
      const cause = e instanceof StepsError ? e.cause : e;
      const done = e instanceof StepsError ? e.signatures : [];
      // Earlier transactions may already be on-chain: refresh and hand them back.
      const partial = done.length > 0;
      if (partial) invalidate(vault);
      if (isRejection(cause)) {
        toast.dismiss(id);
        toast(partial ? `Transaction cancelled (${done.length} confirmed)` : "Transaction cancelled");
        return partial ? done : null;
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      const logs = cause instanceof ApiRequestError ? cause.logs : undefined;
      show({
        title: `${label} failed`,
        subtitle: partial ? `${done.length} confirmed before the failure` : undefined,
        tone: "error",
        errorText: [message, logs ? logs.slice(-6).join("\n") : ""].filter(Boolean).join("\n\n"),
      });
      return partial ? done : null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { send, pending };
}
