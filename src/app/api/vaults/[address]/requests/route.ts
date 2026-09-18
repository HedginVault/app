import { readRequestQueue } from "@/server/readers/position";
import { handleGet } from "@/server/route";

export const GET = handleGet(({ address }) => readRequestQueue(address));
