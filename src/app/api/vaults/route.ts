import { readVaults } from "@/server/readers/vaults";
import { handleGet } from "@/server/route";

export const GET = handleGet(() => readVaults());
