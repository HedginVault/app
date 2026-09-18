import { readStrategies } from "@/server/readers/strategies";
import { handleGet } from "@/server/route";

export const GET = handleGet(({ address }) => readStrategies(address));
