import "server-only";
import { buildHoldingsView } from "@/lib/holdings";
import type { HoldingsView } from "@/lib/types";
import { cached } from "../cache";
import { readStrategies } from "./strategies";
import { readVaultDetail } from "./vaults";

/** No reads of its own: the vault detail and strategy readers (both cached 15 s) plus their token caches. */
export const readHoldings = (vault: string) =>
  cached(`holdings:${vault}`, 15_000, async (): Promise<HoldingsView> => {
    const [detail, strategies] = await Promise.all([readVaultDetail(vault), readStrategies(vault)]);
    return buildHoldingsView(detail, strategies);
  });
