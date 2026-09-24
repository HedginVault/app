import { readPhoenixManager } from "@/server/readers/phoenix-manager";
import { handleGet } from "@/server/route";

export const GET = handleGet(({ address }) => readPhoenixManager(address));
