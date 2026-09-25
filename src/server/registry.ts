import type { VaultMetadata } from "@/lib/types";

// Off-chain vault metadata keyed by vault address. The chain stores only the 32-byte name.
const REGISTRY: Record<string, VaultMetadata> = {
  G2iSfoFcCBRUa1egLqGJPs5WibPZzafacebDU9qbhA3Y: {
    description:
      "USDC-denominated managed vault. Deposits are pooled and deployed by the manager into Solana DeFi positions; NAV is posted once per 4h epoch.",
    strategy: "Delta-neutral liquidity provision on Meteora DLMM with Jupiter for rebalancing.",
    managerName: "SolHedge",
    tags: ["USDC", "Market neutral", "Epoch settled"],
  },
};

export const getVaultMetadata = (address: string): VaultMetadata | null => REGISTRY[address] ?? null;
