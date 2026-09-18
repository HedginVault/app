import { ApiError } from "@/server/errors";
import { readPosition } from "@/server/readers/position";
import { handleGet, pubkey } from "@/server/route";

export const GET = handleGet(({ address }, search) => {
  const owner = pubkey.safeParse(search.get("owner"));
  if (!owner.success) throw new ApiError(400, "Validation", "owner must be a public key");
  return readPosition(address, owner.data);
});
