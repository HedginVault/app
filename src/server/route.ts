import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { withFresh } from "./cache";
import { ApiError, errorResponse } from "./errors";
import { clientIp, rateLimit } from "./ratelimit";

export const pubkey = z.string().refine(
  (s) => {
    try {
      new PublicKey(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: "invalid public key" },
);

const DIGITS = /^\d+$/;
const U64_MAX = 18446744073709551615n;

/**
 * u64 amounts. The upper bound matters: `new BN(huge).toArrayLike(..., 8)` throws while Anchor
 * encodes the instruction, which would surface as an opaque 500 instead of a 400. The refinement
 * re-tests `DIGITS` because zod still runs refinements after a failed string check and `BigInt`
 * throws on non-numeric input.
 */
export const amountString = z
  .string()
  .regex(DIGITS, "must be a non-negative integer string")
  .refine((s) => !DIGITS.test(s) || BigInt(s) <= U64_MAX, "must fit in u64");

/** Basis points, 0–10_000 inclusive; `.optional()` at the call site for patch-style bodies. */
export const bps = z.number().int().min(0).max(10_000);

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });

type Params = Record<string, string>;

/**
 * Wraps a GET handler: `fn(params, searchParams)` → JSON. Errors become `{ error }` responses.
 * A request carrying `cache-control: no-cache` bypasses the process cache for that request only —
 * the client sends it right after a confirmed transaction, when a memoized entry would be stale.
 * A bypass costs full RPC, so it is rate limited: without that, any anonymous caller could loop the
 * header and turn the cache — the RPC-quota ceiling — off. Cached GETs stay unlimited, and the
 * bypass bucket is keyed separately (`get:`) so it does not eat a wallet's transaction-build budget.
 */
export function handleGet<T>(fn: (params: Params, search: URLSearchParams, req?: Request) => Promise<T>) {
  return async (req?: Request, ctx?: { params: Promise<Params> }) => {
    try {
      const params = ctx ? await ctx.params : {};
      const search = req ? new URL(req.url).searchParams : new URLSearchParams();
      const run = () => fn(params, search, req);
      const bypass = req?.headers.get("cache-control")?.includes("no-cache") ?? false;
      if (bypass && req) rateLimit(`get:${clientIp(req)}`);
      return json(await (bypass ? withFresh(run) : run()));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/**
 * Wraps a POST handler: parses the body with `schema`, `fn(body, params)` → JSON. Every POST route is
 * a `/api/tx/**` builder that costs RPC (build + simulate), so each caller is rate limited.
 */
export function handlePost<S extends ZodType, T>(schema: S, fn: (body: z.infer<S>, params: Params) => Promise<T>) {
  return async (req: Request, ctx?: { params: Promise<Params> }) => {
    try {
      rateLimit(clientIp(req));
      const params = ctx ? await ctx.params : {};
      const raw = await req.json().catch(() => {
        throw new ApiError(400, "Validation", "body must be JSON");
      });
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new ApiError(400, "Validation", `${issue.path.join(".") || "body"}: ${issue.message}`);
      }
      return json(await fn(parsed.data, params));
    } catch (e) {
      return errorResponse(e);
    }
  };
}
