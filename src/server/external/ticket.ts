import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/errors";

const buildPayload = z.object({
  kind: z.literal("build"), keyId: z.string(), manager: z.string(), vault: z.string(),
  action: z.string(), cluster: z.string(), program: z.string(), messageHash: z.string(),
  blockhash: z.string(), expires: z.number().int(),
}).strict();
const receiptPayload = z.object({
  kind: z.literal("receipt"), keyId: z.string(), signature: z.string(),
  blockhash: z.string(), expires: z.number().int(),
}).strict();
export type BuildTicket = z.infer<typeof buildPayload>;
export type SendReceipt = z.infer<typeof receiptPayload>;

function secret(): Buffer {
  const value = process.env.MANAGER_API_TICKET_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new ApiError(503, "ApiUnavailable", "Manager API ticket configuration is invalid");
  return Buffer.from(value);
}

export function signTicket(payload: BuildTicket | SendReceipt): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyTicket<T extends "build" | "receipt">(token: string, kind: T): T extends "build" ? BuildTicket : SendReceipt {
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length > 4096 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1]))
    throw new ApiError(403, "InvalidTicket", "Invalid or expired ticket");
  const actual = Buffer.from(parts[1], "base64url");
  const expected = createHmac("sha256", secret()).update(parts[0]).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new ApiError(403, "InvalidTicket", "Invalid or expired ticket");
  try {
    const raw: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const parsed = (kind === "build" ? buildPayload : receiptPayload).parse(raw);
    if (parsed.expires <= Date.now()) throw new Error("expired");
    return parsed as T extends "build" ? BuildTicket : SendReceipt;
  } catch {
    throw new ApiError(403, "InvalidTicket", "Invalid or expired ticket");
  }
}
