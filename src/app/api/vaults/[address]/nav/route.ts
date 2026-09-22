import { handleGet, pubkey } from "@/server/route";
import { ApiError } from "@/server/errors";
import { readNavHistory } from "@/server/readers/nav-history";

export const GET = handleGet(async ({ address }, search) => {
  if (!pubkey.safeParse(address).success) throw new ApiError(400, "Validation", "invalid vault address");
  const limitParam = search.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  if (limitParam !== null && (!Number.isInteger(limit) || (limit as number) < 1)) {
    throw new ApiError(400, "Validation", "limit must be a positive integer");
  }
  return readNavHistory(address, limit);
});
