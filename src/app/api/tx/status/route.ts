import { ApiError } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { handleGet, pubkey } from "@/server/route";
import { getTransactionStatus } from "@/server/tx/send";

const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

// Uncached and polled after every send, so it costs RPC each time: its own per-IP bucket, kept apart
// from the build/send budget.
export const GET = handleGet(async (_params, search, req) => {
  if (req) rateLimit(`status:${clientIp(req)}`);
  const signature = search.get("signature") ?? "";
  const blockhash = search.get("blockhash") ?? "";
  if (!SIGNATURE.test(signature)) throw new ApiError(400, "Validation", "signature: invalid");
  // A blockhash is 32 bytes of base58, the same shape as a public key.
  if (!pubkey.safeParse(blockhash).success) throw new ApiError(400, "Validation", "blockhash: invalid");
  return getTransactionStatus(signature, blockhash);
});
