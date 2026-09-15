import { z } from "zod";
import { ApiError } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { handleGet } from "@/server/route";
import { searchTokens } from "@/server/search";

// Up to 200 characters: the token picker's default list is four comma-separated mints.
const query = z.string().trim().min(1).max(200);

export const GET = handleGet(async (_p, search, req) => {
  if (req) rateLimit(`search:${clientIp(req)}`);
  const q = query.safeParse(search.get("query") ?? "");
  if (!q.success) throw new ApiError(400, "Validation", "query must be 1-200 characters");
  return searchTokens(q.data);
});
