import type { Cluster } from "@solana/web3.js";
import idl from "@/idl/hedge_vault.json";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "mainnet-beta") as Cluster;
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID || idl.address;

export const MAX_BPS = 10_000;
export const NAV_PRECISION = 1_000_000_000n;
export const EPOCH_DURATION = 86_400;
export const FEE_INCREASE_DELAY = 604_800;
export const DEFAULT_MAX_SLIPPAGE_BPS = 300;
/**
 * The program CPIs `initialize_position2(lower, width)` with no extend, and the DLMM program caps a
 * fresh position at `DEFAULT_BIN_PER_POSITION` = 70 bins. (1400 is the extended-position limit,
 * which this program never reaches.)
 */
export const DLMM_MAX_POSITION_WIDTH = 70;

export const explorerUrl = (kind: "address" | "tx", value: string) => {
  const suffix = CLUSTER === "mainnet-beta" ? "" : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/${kind}/${value}${suffix}`;
};
