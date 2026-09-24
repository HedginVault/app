import type { Cluster } from "@solana/web3.js";
import idl from "@/idl/hedge_vault.json";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "mainnet-beta") as Cluster;
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || idl.address;

export const MAX_BPS = 10_000;
export const NAV_PRECISION = 1_000_000_000n;
export const EPOCH_DURATION = 14_400;
export const FEE_INCREASE_DELAY = 604_800;
export const DEFAULT_MAX_SLIPPAGE_BPS = 300;
/** Meteora PositionV2 starts at 70 bins and can be extended to 1,400. */
export const DLMM_INITIAL_POSITION_WIDTH = 70;
export const DLMM_MAX_POSITION_WIDTH = 1_400;
export const DLMM_MAX_RESIZE_LENGTH = 91;

export const explorerUrl = (kind: "address" | "tx", value: string) => {
  const suffix = CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`;
  return `https://solscan.io/${kind === "address" ? "account" : "tx"}/${value}${suffix}`;
};
