import { NextResponse } from "next/server";
import idl from "@/idl/hedge_vault.json";
import { RPC_URL } from "./program";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public logs?: string[],
  ) {
    super(message);
  }
}

const byCode = new Map(idl.errors.map((e) => [e.code, e]));
const byName = new Map(idl.errors.map((e) => [e.name, e]));

const ANCHOR_RE = /Error Code: (\w+)\. Error Number: (\d+)\. Error Message: (.*?)\.?$/;
const CUSTOM_RE = /custom program error: 0x([0-9a-f]+)/i;

export function decodeAnchorError(logs: string[]): { code: string; message: string } | null {
  for (const line of logs) {
    const m = ANCHOR_RE.exec(line);
    if (m) {
      const known = byName.get(m[1]);
      return { code: m[1], message: known?.msg ?? m[3] };
    }
  }
  for (const line of logs) {
    const m = CUSTOM_RE.exec(line);
    if (m) {
      const known = byCode.get(parseInt(m[1], 16));
      if (known) return { code: known.name, message: known.msg };
      return { code: `Custom0x${m[1]}`, message: `Program failed with custom error 0x${m[1]}` };
    }
  }
  return null;
}

/** Matches HTTP 429, JSON-RPC -32005 and the usual provider phrasing. */
export const isRateLimitError = (message: string) =>
  /\b429\b|-32005|max usage reached|too many requests|rate limit/i.test(message);

/**
 * Everything that means "the RPC endpoint did not answer usefully". web3.js in Node surfaces network
 * failures as `FetchError` / `TypeError` whose message embeds the full endpoint URL
 * (`request to https://…?api-key=… failed, reason: getaddrinfo ENOTFOUND …`), so these must never
 * reach a client verbatim.
 */
const RPC_FAILURE_RE =
  /fetch failed|request to |ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|TLS|certificate|failed to get|429|-32005|max usage reached|too many requests|rate limit|503/i;

const API_KEY_RE = /((?:api[-_]?key)=)[^&\s"']+/gi;

/**
 * Defence in depth for anything that leaves the server: strips the configured read endpoint and any
 * `api-key=`/`apikey=` query value out of a message. The endpoint is injectable so tests do not have
 * to reach into the environment.
 */
export function redact(message: string, rpcUrl: string = RPC_URL): string {
  const out = rpcUrl ? message.split(rpcUrl).join("<redacted>") : message;
  return out.replace(API_KEY_RE, "$1<redacted>");
}

export function errorFromUnknown(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const name = e instanceof Error ? e.name : "";
  const message = e instanceof Error ? e.message : String(e);
  if (name === "FetchError" || name === "TypeError" || RPC_FAILURE_RE.test(message)) {
    // A bare `TypeError` is also how undici reports a failed fetch, so it is classified as an RPC
    // outage; log it so a genuine programming bug behind one is still visible in the server logs.
    if (name === "TypeError") console.error("[api] rpc/type error:", e);
    return new ApiError(503, "RpcUnavailable", redact("RPC endpoint unavailable, try again shortly"));
  }
  // The raw message can embed the keyed RPC URL, a request body or a file path: log it, never ship it.
  console.error("[api] unhandled error:", e);
  return new ApiError(500, "Internal", "Internal error");
}

export function errorResponse(e: unknown) {
  const err = errorFromUnknown(e);
  return NextResponse.json(
    { error: { code: err.code, message: redact(err.message), ...(err.logs ? { logs: err.logs } : {}) } },
    { status: err.status, headers: { "cache-control": "no-store" } },
  );
}
