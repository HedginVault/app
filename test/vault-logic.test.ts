import { describe, expect, it } from "vitest";
import type { UserPosition, VaultDetail } from "@/lib/types";
import {
  capHeadroom,
  closePreconditions,
  epochOf,
  estimatePayout,
  estimateShares,
  feeSchedule,
  isDepositCancellable,
  nextEpochStart,
  outflowCap,
  requestState,
  validateDeposit,
  validateWithdrawal,
} from "@/lib/vault-logic";

const detail: VaultDetail = {
  address: "V", id: "0", name: "USDC Vault", status: "normal",
  depositMint: "M", depositSymbol: "USDC", depositDecimals: 6, depositLogo: null, depositPriceUsd: 1,
  totalAssets: "1000000000", navPerShare: "1100000000", depositCap: "2000000000",
  performanceFeeBps: 1000, managementFeeBps: 200, lastNavTs: 1_700_000_000, metadata: null,
  authority: "A", shareMint: "S", shareSupply: "900000000", idleBalance: "500000000",
  pendingDeposits: "100000000", pendingWithdrawalShares: "0",
  unclaimedManagerFeeShares: "0", unclaimedPlatformFeeShares: "0", epochOutflow: "0",
  highWaterMark: "1100000000", navEpoch: "19675", minDeposit: "10000000", minWithdrawalShares: "1000000",
  pendingPerformanceFeeBps: 0, pendingManagementFeeBps: 0, feeEffectiveTs: 0, openStrategyCount: 0,
  protocol: { status: "normal", maxEpochOutflowBps: 2000, maxSlippageBps: 300 },
};

const emptyPosition: UserPosition = {
  shares: "0", valueAtNav: "0", depositTokenBalance: "50000000",
  depositRequest: null, withdrawalRequest: null,
};

// 10 seconds into epoch 19675, matching the fixture's `navEpoch`.
const now = 19675 * 86400 + 10;

describe("epochs", () => {
  it("derives epoch and next epoch start", () => {
    expect(epochOf(1_700_000_000)).toBe(19675n);
    expect(nextEpochStart(19675n)).toBe(19676 * 86400);
  });
  it("classifies request state", () => {
    expect(requestState(19675n, 19675n)).toBe("pending");
    expect(requestState(19676n, 19675n)).toBe("resolvable");
  });
  it("allows cancelling resolvable deposits only when nav is zero", () => {
    expect(isDepositCancellable("pending", 1n)).toBe(true);
    expect(isDepositCancellable("resolvable", 1n)).toBe(false);
    expect(isDepositCancellable("resolvable", 0n)).toBe(true);
  });
});

describe("math", () => {
  it("computes cap headroom", () => {
    expect(capHeadroom(detail)).toBe(900000000n);
    expect(capHeadroom({ ...detail, depositCap: "1000000000" })).toBe(0n);
  });
  it("estimates shares and payout", () => {
    expect(estimateShares(1100000000n, 1100000000n)).toBe(1000000000n);
    expect(estimatePayout(1000000000n, 1100000000n)).toBe(1100000000n);
  });
  it("computes the epoch outflow cap", () => {
    expect(outflowCap(detail)).toBe(200000000n);
  });
});

describe("validateDeposit", () => {
  it("accepts a valid amount", () => {
    expect(validateDeposit(detail, 20000000n, emptyPosition)).toBeNull();
  });
  it("rejects below minimum, over cap, over balance", () => {
    expect(validateDeposit(detail, 5000000n, emptyPosition)).toMatch(/minimum/i);
    expect(validateDeposit(detail, 950000000n, emptyPosition)).toMatch(/cap/i);
    expect(validateDeposit(detail, 60000000n, emptyPosition)).toMatch(/balance/i);
  });
  it("rejects when vault or protocol is not normal, or nav is zero", () => {
    expect(validateDeposit({ ...detail, status: "paused" }, 20000000n, emptyPosition)).toMatch(/paused/i);
    expect(validateDeposit({ ...detail, protocol: { ...detail.protocol, status: "reduceOnly" } }, 20000000n, emptyPosition)).toMatch(/protocol/i);
    expect(validateDeposit({ ...detail, navPerShare: "0" }, 20000000n, emptyPosition)).toMatch(/nav/i);
  });
  it("rejects when an older-epoch request is unresolved", () => {
    const pos: UserPosition = {
      ...emptyPosition,
      depositRequest: { owner: "U", amount: "1", epoch: "19674", createdTs: 0, state: "resolvable", cancellable: false },
    };
    expect(validateDeposit(detail, 20000000n, pos, now)).toMatch(/claim/i);
  });
  it("allows topping up a request made in the current epoch", () => {
    const pos: UserPosition = {
      ...emptyPosition,
      depositRequest: { owner: "U", amount: "1", epoch: "19675", createdTs: 0, state: "pending", cancellable: true },
    };
    expect(validateDeposit(detail, 20000000n, pos, now)).toBeNull();
  });
  it("rejects an earlier-epoch request that the lagging NAV has not made claimable", () => {
    const pos: UserPosition = {
      ...emptyPosition,
      depositRequest: { owner: "U", amount: "1", epoch: "19674", createdTs: 0, state: "pending", cancellable: true },
    };
    expect(validateDeposit(detail, 20000000n, pos, now)).toMatch(/earlier epoch/i);
  });
});

describe("validateWithdrawal", () => {
  const holder: UserPosition = { ...emptyPosition, shares: "5000000" };
  it("accepts full balance below minimum and partial above minimum", () => {
    expect(validateWithdrawal({ ...detail, minWithdrawalShares: "9000000" }, 5000000n, holder)).toBeNull();
    expect(validateWithdrawal(detail, 2000000n, holder)).toBeNull();
  });
  it("rejects partial below minimum, over balance, paused", () => {
    expect(validateWithdrawal(detail, 500000n, holder)).toMatch(/minimum/i);
    expect(validateWithdrawal(detail, 6000000n, holder)).toMatch(/balance/i);
    expect(validateWithdrawal({ ...detail, status: "paused" }, 2000000n, holder)).toMatch(/paused/i);
  });
  it("allows reduce-only", () => {
    expect(validateWithdrawal({ ...detail, status: "reduceOnly" }, 2000000n, holder)).toBeNull();
  });
  it("allows topping up a request made in the current epoch", () => {
    const pos: UserPosition = {
      ...holder,
      withdrawalRequest: { owner: "U", shares: "1", epoch: "19675", createdTs: 0, state: "pending", cancellable: true },
    };
    expect(validateWithdrawal(detail, 2000000n, pos, now)).toBeNull();
  });
  it("rejects an earlier-epoch request that the lagging NAV has not made claimable", () => {
    const pos: UserPosition = {
      ...holder,
      withdrawalRequest: { owner: "U", shares: "1", epoch: "19674", createdTs: 0, state: "pending", cancellable: true },
    };
    expect(validateWithdrawal(detail, 2000000n, pos, now)).toMatch(/earlier epoch/i);
  });
  it("rejects an earlier-epoch request that is already claimable", () => {
    const pos: UserPosition = {
      ...holder,
      withdrawalRequest: { owner: "U", shares: "1", epoch: "19674", createdTs: 0, state: "resolvable", cancellable: false },
    };
    expect(validateWithdrawal(detail, 2000000n, pos, now)).toMatch(/claim/i);
  });
});

describe("feeSchedule / closePreconditions", () => {
  it("reports a scheduled fee change", () => {
    const s = feeSchedule({ ...detail, pendingPerformanceFeeBps: 1500, pendingManagementFeeBps: 200, feeEffectiveTs: 1_700_600_000 }, 1_700_000_000);
    expect(s).toEqual({ performanceFeeBps: 1500, managementFeeBps: 200, effectiveTs: 1_700_600_000, applied: false });
    expect(feeSchedule(detail, 1_700_000_000)).toBeNull();
  });
  it("lists unmet close preconditions", () => {
    expect(closePreconditions(detail)).toEqual([
      "Share supply must be zero",
      "Pending deposits must be resolved",
      "Total assets must be zero (post a final NAV of 0)",
      "Idle token balance must be zero",
    ]);
    expect(
      closePreconditions({ ...detail, shareSupply: "0", pendingDeposits: "0", totalAssets: "0", idleBalance: "0" }),
    ).toEqual([]);
  });
});
