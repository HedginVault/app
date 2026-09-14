import { PublicKey, clusterApiUrl, type Cluster } from "@solana/web3.js";
import idl from "@/idl/hedge_vault.json";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as Cluster;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(CLUSTER);

export const HEDGE_VAULT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || idl.address,
);

export const MAX_BASIS_POINTS = 10_000;
export const NAV_PRECISION = 1_000_000_000;
