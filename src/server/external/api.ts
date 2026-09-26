import "server-only";
import { createHash, verify as verifySignature } from "node:crypto";
import bs58 from "bs58";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { z } from "zod";
import { ApiError, isRateLimitError } from "@/server/errors";
import { CLUSTER, PROGRAM_ID } from "@/server/program";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { readHoldings } from "@/server/readers/holdings";
import { readManager } from "@/server/readers/manager";
import { readStrategies } from "@/server/readers/strategies";
import { amountString, pubkey } from "@/server/route";
import { getTransactionStatus, sendSignedTransaction } from "@/server/tx/send";
import { loadVaultCtx } from "@/server/tx/context";
import { authenticate, assertAction, type Principal } from "./auth";
import { signTicket, verifyTicket } from "./ticket";

const BUILD_ACTIONS = [
  "jupiter/swap", "dlmm/open", "dlmm/add", "dlmm/add-range", "dlmm/extend",
  "dlmm/remove", "dlmm/claim-fee", "dlmm/zap-out", "dlmm/zap-out/swap", "strategy/close",
] as const;
type BuildAction = typeof BUILD_ACTIONS[number];
const MAX_BODY = 16_384;
const MAX_TX_BYTES = 1232;
const KEY_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function audit(principal: Principal, action: string, outcome: string, vault?: string, signature?: string): void {
  console.info("[manager-api]", JSON.stringify({ keyId: principal.id, manager: principal.manager, action, outcome, vault, signature }));
}

function failure(error: unknown): Response {
  const e = externalError(error);
  // External responses never include provider logs or unexpected error details.
  return Response.json({ error: { code: e.code, message: e.status >= 500 ? "Service temporarily unavailable" :
    e.status === 422 ? "Transaction rejected during simulation or preflight" : e.message } },
    { status: e.status, headers: { "cache-control": "no-store" } });
}

function externalError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "FetchError" || name === "TypeError" ||
    /fetch failed|request to |ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|failed to get|503/i.test(message) ||
    isRateLimitError(message)) return new ApiError(503, "RpcUnavailable", "Provider unavailable");
  return new ApiError(500, "Internal", "Internal error");
}

export async function externalRoute(req: Request, path: string[], method: "GET" | "POST"): Promise<Response> {
  let principal: Principal | undefined;
  const rawAction = path.join("/");
  const action = rawAction.length <= 80 && /^[a-z0-9/.-]+$/.test(rawAction) ? rawAction : "invalid";
  try {
    rateLimit(`external:ip:${clientIp(req)}`, [{ capacity: 60, windowMs: 60_000 }]);
    principal = authenticate(req);
    rateLimit(`external:key:${principal.id}`, [{ capacity: 120, windowMs: 60_000 }]);
    const data = method === "GET" ? await read(principal, action, req) : await write(principal, action, req);
    audit(principal, action, "ok", "vault" in data && typeof data.vault === "string" ? data.vault : undefined);
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (principal) audit(principal, action, error instanceof ApiError ? error.code : "error");
    else console.info("[manager-api]", JSON.stringify({ action, outcome: "auth_or_rate_rejected" }));
    return failure(error);
  }
}

async function scopedVault(principal: Principal, vault: string): Promise<void> {
  if (!pubkey.safeParse(vault).success) throw new ApiError(400, "Validation", "vault must be a public key");
  if (principal.vaults && !principal.vaults.includes(vault)) throw new ApiError(403, "Forbidden", "Vault is outside key scope");
  const ctx = await loadVaultCtx(vault);
  if (!ctx.account.authority.equals(new PublicKey(principal.manager)))
    throw new ApiError(403, "Forbidden", "Manager is not the current vault authority");
}

async function read(principal: Principal, action: string, req: Request): Promise<Record<string, unknown>> {
  if (req.url.length > 4096) throw new ApiError(400, "Validation", "Query is too long");
  const url = new URL(req.url);
  if (action === "vaults") {
    assertAction(principal, "read");
    const manager = await readManager(principal.manager);
    return { vaults: manager.vaults.filter((vault) => !principal.vaults || principal.vaults.includes(vault.address)) };
  }
  const match = /^vaults\/([^/]+)\/(holdings|strategies)$/.exec(action);
  if (match) {
    assertAction(principal, "read");
    await scopedVault(principal, match[1]);
    return { vault: match[1], data: match[2] === "holdings" ? await readHoldings(match[1]) : await readStrategies(match[1]) };
  }
  if (action === "jupiter/quote" || action === "dlmm/pools") {
    assertAction(principal, "read");
    const vault = url.searchParams.get("vault") ?? "";
    if (action === "jupiter/quote") {
      for (const field of ["inputMint", "outputMint"]) {
        if (!pubkey.safeParse(url.searchParams.get(field)).success)
          throw new ApiError(400, "Validation", `${field} must be a public key`);
      }
      if (!amountString.safeParse(url.searchParams.get("amount")).success)
        throw new ApiError(400, "Validation", "amount must be a base-unit string");
      const slippage = Number(url.searchParams.get("slippageBps"));
      if (!Number.isInteger(slippage) || slippage < 1 || slippage > 10_000)
        throw new ApiError(400, "Validation", "slippageBps must be between 1 and 10000");
    } else {
      const query = url.searchParams.get("query") ?? "";
      const page = url.searchParams.get("page");
      if (query.trim().length < 1 || query.length > 64 ||
        (page !== null && (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 50)))
        throw new ApiError(400, "Validation", "Invalid pool search query or page");
    }
    await scopedVault(principal, vault);
    const route = action === "jupiter/quote"
      ? (await import("@/app/api/jupiter/quote/route")).GET
      : (await import("@/app/api/dlmm/pools/search/route")).GET;
    const response = await route(req);
    if (!response.ok) throw await routeError(response);
    return { vault, data: await response.json() };
  }
  if (action === "transactions/status") {
    assertAction(principal, "send");
    const receipt = verifyTicket(url.searchParams.get("receipt") ?? "", "receipt");
    if (receipt.keyId !== principal.id) throw new ApiError(403, "Forbidden", "Receipt belongs to another key");
    const result = await getTransactionStatus(receipt.signature, receipt.blockhash);
    return result.status === "failed" ? { status: "failed", code: result.code, message: result.message } : result;
  }
  throw new ApiError(404, "NotFound", "Unknown manager API route");
}

async function body(req: Request): Promise<Record<string, unknown>> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY) throw new ApiError(413, "BodyTooLarge", "Request body is too large");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Validation", "Body must be a JSON object");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw new ApiError(413, "BodyTooLarge", "Request body is too large");
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body");
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Validation", "Body must be a JSON object");
  }
}

async function write(principal: Principal, action: string, req: Request): Promise<Record<string, unknown>> {
  const input = await body(req);
  if (action === "transactions/send") return send(principal, input);
  const buildAction = action.startsWith("transactions/") ? action.slice("transactions/".length) : "";
  if (!BUILD_ACTIONS.includes(buildAction as BuildAction)) throw new ApiError(404, "NotFound", "Unknown manager API route");
  assertAction(principal, buildAction);
  if ("payer" in input) throw new ApiError(400, "Validation", "payer is set by the API key");
  const vaultValue = z.string().safeParse(input.vault);
  if (!vaultValue.success) throw new ApiError(400, "Validation", "vault is required");
  const vault = vaultValue.data;
  await scopedVault(principal, vault);
  const built = await invokeBuilder(buildAction as BuildAction, { ...input, payer: principal.manager }, req);
  const decorate = (value: unknown): unknown => {
    if (!value || typeof value !== "object" || !("transaction" in value) || typeof value.transaction !== "string")
      throw new ApiError(500, "BuildFailed", "Builder returned an invalid transaction");
    const tx = decodeTransaction(value.transaction);
    if (!tx.message.staticAccountKeys[0]?.equals(new PublicKey(principal.manager)))
      throw new ApiError(500, "BuildFailed", "Builder returned a wrong payer");
    const ticket = signTicket({ kind: "build", keyId: principal.id, manager: principal.manager, vault,
      action: buildAction, cluster: CLUSTER, program: PROGRAM_ID.toBase58(), messageHash: hashMessage(tx),
      blockhash: tx.message.recentBlockhash, expires: Date.now() + 90_000 });
    return { ...value, ticket, blockhash: tx.message.recentBlockhash };
  };
  return { vault, result: Array.isArray(built) ? built.map(decorate) : decorate(built) };
}

async function invokeBuilder(action: BuildAction, input: Record<string, unknown>, req: Request): Promise<unknown> {
  const route = {
    "jupiter/swap": () => import("@/app/api/tx/jupiter/swap/route"),
    "dlmm/open": () => import("@/app/api/tx/dlmm/open/route"),
    "dlmm/add": () => import("@/app/api/tx/dlmm/add/route"),
    "dlmm/add-range": () => import("@/app/api/tx/dlmm/add-range/route"),
    "dlmm/extend": () => import("@/app/api/tx/dlmm/extend/route"),
    "dlmm/remove": () => import("@/app/api/tx/dlmm/remove/route"),
    "dlmm/claim-fee": () => import("@/app/api/tx/dlmm/claim-fee/route"),
    "dlmm/zap-out": () => import("@/app/api/tx/dlmm/zap-out/route"),
    "dlmm/zap-out/swap": () => import("@/app/api/tx/dlmm/zap-out/swap/route"),
    "strategy/close": () => import("@/app/api/tx/strategy/close/route"),
  }[action];
  const handler = (await route()).POST;
  const internal = new Request(req.url, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": clientIp(req) }, body: JSON.stringify(input) });
  const response = await handler(internal);
  if (!response.ok) throw await routeError(response);
  return response.json();
}

async function routeError(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null);
  const parsed = z.object({ error: z.object({ code: z.string(), message: z.string() }) }).safeParse(payload);
  return new ApiError(response.status, parsed.success ? parsed.data.error.code : "RequestFailed",
    response.status >= 500 ? "Service temporarily unavailable" : parsed.success ? parsed.data.error.message : "Request failed");
}

function decodeTransaction(base64: string): VersionedTransaction {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_TX_BYTES || bytes.toString("base64") !== base64)
    throw new ApiError(400, "Validation", "Invalid transaction bytes");
  try { return VersionedTransaction.deserialize(bytes); }
  catch { throw new ApiError(400, "Validation", "Invalid transaction bytes"); }
}

function hashMessage(tx: VersionedTransaction): string {
  return createHash("sha256").update(tx.message.serialize()).digest("hex");
}

async function send(principal: Principal, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertAction(principal, "send");
  const parsed = z.object({ transaction: z.string().max(3000), ticket: z.string().max(5000) }).strict().safeParse(input);
  if (!parsed.success) throw new ApiError(400, "Validation", "transaction and ticket are required");
  const ticket = verifyTicket(parsed.data.ticket, "build");
  if (ticket.keyId !== principal.id || ticket.manager !== principal.manager || ticket.cluster !== CLUSTER ||
    ticket.program !== PROGRAM_ID.toBase58() || !principal.actions.includes(ticket.action))
    throw new ApiError(403, "Forbidden", "Ticket does not match this key or cluster");
  await scopedVault(principal, ticket.vault);
  const tx = decodeTransaction(parsed.data.transaction);
  if (hashMessage(tx) !== ticket.messageHash || tx.message.recentBlockhash !== ticket.blockhash ||
    !tx.message.staticAccountKeys[0]?.equals(new PublicKey(principal.manager)))
    throw new ApiError(403, "InvalidTransaction", "Signed transaction differs from the issued build");
  const signature = tx.signatures[0];
  const key = Buffer.concat([KEY_PREFIX, new PublicKey(principal.manager).toBuffer()]);
  if (!signature || !verifySignature(null, Buffer.from(tx.message.serialize()), { key, format: "der", type: "spki" }, signature))
    throw new ApiError(403, "InvalidSignature", "Manager signature is missing or invalid");
  const encodedSignature = bs58.encode(signature);
  const receipt = signTicket({ kind: "receipt", keyId: principal.id, signature: encodedSignature,
    blockhash: ticket.blockhash, expires: Date.now() + 86_400_000 });
  try {
    const sent = await sendSignedTransaction(parsed.data.transaction);
    if (sent.signature !== encodedSignature)
      throw new ApiError(503, "RpcUnavailable", "RPC returned a different transaction signature");
    audit(principal, ticket.action, "submitted", ticket.vault, encodedSignature);
    return { signature: encodedSignature, receipt, status: "pending" };
  } catch (error) {
    const e = externalError(error);
    if (e.status === 503) {
      audit(principal, ticket.action, "ambiguous", ticket.vault, encodedSignature);
      return { signature: encodedSignature, receipt, status: "unknown" };
    }
    throw e;
  }
}
