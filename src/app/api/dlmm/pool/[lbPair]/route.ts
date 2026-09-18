import { ApiError } from "@/server/errors";
import { handleGet, pubkey } from "@/server/route";
import { readPoolInfo } from "@/server/tx/dlmm";

export const GET = handleGet(({ lbPair }) => {
  const parsed = pubkey.safeParse(lbPair);
  if (!parsed.success) throw new ApiError(400, "Validation", "lbPair must be a public key");
  return readPoolInfo(parsed.data);
});
