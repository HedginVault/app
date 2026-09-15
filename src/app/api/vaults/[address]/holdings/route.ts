import { readHoldings } from "@/server/readers/holdings";
import { handleGet } from "@/server/route";

export const GET = handleGet(({ address }) => readHoldings(address));
