import type { VaultMetadata } from "@/lib/types";

// Off-chain vault metadata keyed by vault address. The chain stores only the 32-byte name.
const REGISTRY: Record<string, VaultMetadata> = {
  DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD: {
    description:
      "USDC-denominated managed vault. Deposits are pooled and deployed by the manager into Solana DeFi positions; NAV is posted once per 24h epoch.",
    strategy: "Delta-neutral liquidity provision on Meteora DLMM with Jupiter for rebalancing.",
    managerName: "SolHedge",
    tags: ["USDC", "Market neutral", "Epoch settled"],
  },
};

export const getVaultMetadata = (address: string): VaultMetadata | null => REGISTRY[address] ?? null;
