import { EPOCH_DURATION, MAX_BPS, NAV_PRECISION } from "./constants";
import type { RequestState, UserPosition, VaultDetail } from "./types";

const big = (v: string | bigint) => (typeof v === "bigint" ? v : BigInt(v));

export const epochOf = (ts: number) => BigInt(Math.floor(ts / EPOCH_DURATION));
export const nextEpochStart = (navEpoch: bigint) => Number(navEpoch + 1n) * EPOCH_DURATION;

export const requestState = (navEpoch: bigint, requestEpoch: bigint): RequestState =>
  navEpoch > requestEpoch ? "resolvable" : "pending";

export const isDepositCancellable = (state: RequestState, navPerShare: bigint) =>
  state === "pending" || navPerShare === 0n;

export function capHeadroom(d: VaultDetail): bigint {
  const used = big(d.totalAssets) + big(d.pendingDeposits);
  const cap = big(d.depositCap);
  return cap > used ? cap - used : 0n;
}

export const estimateShares = (amount: bigint, navPerShare: bigint) =>
  navPerShare === 0n ? 0n : (amount * NAV_PRECISION) / navPerShare;

export const estimatePayout = (shares: bigint, navPerShare: bigint) =>
  (shares * navPerShare) / NAV_PRECISION;

/**
 * The epoch outflow cap: the maximum total that may leave the vault in one epoch.
 * This is the cap itself, not the remaining headroom — subtract `epochOutflow` for that.
 */
export const outflowCap = (d: VaultDetail) =>
  ((big(d.totalAssets) + big(d.epochOutflow)) * BigInt(d.protocol.maxEpochOutflowBps)) / BigInt(MAX_BPS);

const statusLabel: Record<VaultDetail["status"], string> = {
  normal: "normal",
  paused: "paused",
  reduceOnly: "reduce-only",
};

/**
 * The program requires an existing request to belong to the CURRENT clock epoch (it accumulates
 * into it); a request from any earlier epoch must be claimed or cancelled first, even while the
 * NAV update that would make it claimable is still pending.
 */
const staleRequest = (
  request: { epoch: string; state: RequestState } | null,
  kind: "deposit" | "withdrawal",
  now: number,
): string | null => {
  if (!request || big(request.epoch) === epochOf(now)) return null;
  return request.state === "resolvable"
    ? `Claim your previous ${kind} before requesting a new one`
    : `Your previous ${kind} is from an earlier epoch; wait for the NAV update to claim it, or cancel it first`;
};

export function validateDeposit(
  d: VaultDetail,
  amount: bigint,
  p: UserPosition,
  now: number = Date.now() / 1000,
): string | null {
  if (d.protocol.status !== "normal") return `Protocol is ${statusLabel[d.protocol.status]}, deposits are closed`;
  if (d.status !== "normal") return `Vault is ${statusLabel[d.status]}, deposits are closed`;
  if (big(d.navPerShare) === 0n) return "Vault NAV is zero, deposits are closed";
  const stale = staleRequest(p.depositRequest, "deposit", now);
  if (stale) return stale;
  if (amount <= 0n) return "Enter an amount";
  if (amount < big(d.minDeposit)) return "Below the vault minimum deposit";
  if (amount > capHeadroom(d)) return "Exceeds the remaining deposit cap";
  if (amount > big(p.depositTokenBalance)) return "Insufficient wallet balance";
  return null;
}

export function validateWithdrawal(
  d: VaultDetail,
  shares: bigint,
  p: UserPosition,
  now: number = Date.now() / 1000,
): string | null {
  if (d.protocol.status === "paused") return "Protocol is paused, withdrawals are closed";
  if (d.status === "paused") return "Vault is paused, withdrawals are closed";
  const stale = staleRequest(p.withdrawalRequest, "withdrawal", now);
  if (stale) return stale;
  if (shares <= 0n) return "Enter an amount";
  const balance = big(p.shares);
  if (shares > balance) return "Exceeds your share balance";
  if (shares < big(d.minWithdrawalShares) && shares !== balance)
    return "Below the vault minimum withdrawal (full balance is always allowed)";
  return null;
}

export interface FeeSchedule {
  performanceFeeBps: number;
  managementFeeBps: number;
  effectiveTs: number;
  applied: boolean;
}

export function feeSchedule(d: VaultDetail, now: number): FeeSchedule | null {
  if (!d.feeEffectiveTs) return null;
  return {
    performanceFeeBps: d.pendingPerformanceFeeBps,
    managementFeeBps: d.pendingManagementFeeBps,
    effectiveTs: d.feeEffectiveTs,
    applied: now >= d.feeEffectiveTs,
  };
}

export function closePreconditions(d: VaultDetail): string[] {
  const unmet: string[] = [];
  if (big(d.shareSupply) !== 0n) unmet.push("Share supply must be zero");
  if (big(d.pendingDeposits) !== 0n) unmet.push("Pending deposits must be resolved");
  if (big(d.pendingWithdrawalShares) !== 0n) unmet.push("Pending withdrawals must be resolved");
  if (big(d.unclaimedManagerFeeShares) !== 0n || big(d.unclaimedPlatformFeeShares) !== 0n)
    unmet.push("Unclaimed fee shares must be claimed");
  if (d.openStrategyCount !== 0) unmet.push("All strategies must be closed");
  if (big(d.totalAssets) !== 0n) unmet.push("Total assets must be zero (post a final NAV of 0)");
  // `vault_close` closes the vault token account by CPI, which fails on a non-zero balance.
  if (big(d.idleBalance) !== 0n) unmet.push("Idle token balance must be zero");
  return unmet;
}
