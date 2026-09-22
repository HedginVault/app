import { handleGet, pubkey } from "@/server/route";
import { ApiError } from "@/server/errors";
import { readStrategyHistory } from "@/server/readers/strategy-history";

export const GET = handleGet(async ({ address }) => {
  if (!pubkey.safeParse(address).success) throw new ApiError(400, "Validation", "invalid vault address");
  return readStrategyHistory(address);
});
