import { ApiError } from "@/server/errors";
import { readManager } from "@/server/readers/manager";
import { handleGet, pubkey } from "@/server/route";

export const GET = handleGet(({ wallet }) => {
  const parsed = pubkey.safeParse(wallet);
  if (!parsed.success) throw new ApiError(400, "Validation", "wallet must be a public key");
  return readManager(parsed.data);
});
