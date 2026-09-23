import { ApiError } from "@/server/errors";
import { handleGet } from "@/server/route";
import { readPositionRent } from "@/server/position-rent";

export const GET = handleGet(async (_params, search) => {
  const raw = search.get("bins");
  if (!raw || !/^\d+$/.test(raw)) throw new ApiError(400, "Validation", "bins must be a whole number");
  return readPositionRent(Number(raw));
});
