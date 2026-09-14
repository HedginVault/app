"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiRequestError } from "@/lib/api";
import { explorerUrl } from "@/lib/constants";
import type { BuiltTransaction } from "@/lib/types";
import { useInvalidateVault } from "./queries";

export interface SendOptions {
  label: string;
  build: () => Promise<BuiltTransaction | BuiltTransaction[]>;
  vault?: string;
  onSuccess?: (signatures: string[]) => void;
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
  const { publicKey, signTransaction } = useWallet();
  const invalidate = useInvalidateVault();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const send = async ({
    label,
    build,
    vault,
    onSuccess,
  }: SendOptions): Promise<string[] | null> => {
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
    const signatures: string[] = [];
    let total = 0;
    const id = toast.loading(`${label}: preparing`);
    inFlight.current = true;
    setPending(true);
    try {
      const built = await build();
      const list = Array.isArray(built) ? built : [built];
      total = list.length;
      if (total === 0) {
        toast.info(`${label}: nothing to do`, { id });
        return [];
      }
      for (const [i, b] of list.entries()) {
        const step = total > 1 ? ` (${i + 1}/${total})` : "";
        toast.loading(`${label}${step}: approve in wallet`, { id });
        const signed = await signTransaction(VersionedTransaction.deserialize(decodeBase64(b.transaction)));
        toast.loading(`${label}${step}: sending`, { id });
        const { signature } = await api.send(encodeBase64(signed.serialize()));
        toast.loading(`${label}${step}: confirming`, { id, description: signature });
        await waitForConfirmation(signature, signed.message.recentBlockhash);
        signatures.push(signature);
      }
      toast.success(`${label}: confirmed`, {
        id,
        description: signatures.length === 1 ? signatures[0] : `${signatures.length} transactions`,
        action: {
          label: "Explorer",
          onClick: () =>
            window.open(explorerUrl("tx", signatures[signatures.length - 1]), "_blank"),
        },
      });
      invalidate(vault);
      onSuccess?.(signatures);
      return signatures;
    } catch (e) {
      // Earlier transactions in a batch may already be on-chain: refresh and hand them back.
      const partial = signatures.length > 0;
      if (partial) invalidate(vault);
      if (isRejection(e)) {
        toast.dismiss(id);
        toast(
          partial
            ? `Transaction cancelled (${signatures.length}/${total} confirmed)`
            : "Transaction cancelled",
        );
        return partial ? signatures : null;
      }
      const message = e instanceof Error ? e.message : String(e);
      const logs = e instanceof ApiRequestError ? e.logs : undefined;
      const progress = partial ? `${signatures.length}/${total} confirmed before the failure` : "";
      const description = [progress, message, logs ? logs.slice(-6).join("\n") : ""]
        .filter(Boolean)
        .join("\n\n");
      toast.error(`${label}: failed`, { id, description, duration: 12_000 });
      return partial ? signatures : null;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { send, pending };
}
