import { z } from "zod";
import { ApiError } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/ratelimit";
import { handleGet } from "@/server/route";
import { searchPools } from "@/server/search";

const query = z.string().trim().min(1).max(64);
const page = z.coerce.number().int().min(1).max(50).catch(1);

export const GET = handleGet(async (_p, search, req) => {
  if (req) rateLimit(`search:${clientIp(req)}`);
  const q = query.safeParse(search.get("query") ?? "");
  if (!q.success) throw new ApiError(400, "Validation", "query must be 1-64 characters");
  return searchPools(q.data, page.parse(search.get("page")));
});
