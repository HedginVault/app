import { describe, expect, it } from "vitest";
import { impactPercent, impactSeverity, isOperational, minReceived, swapButtonState } from "@/lib/swap-logic";

const base = { operational: true, hasToken: true, amount: 10n, balance: 100n, quoteLoading: false, quoteError: null, quoteAgeMs: 1_000 };

describe("swapButtonState", () => {
  it("walks the states in priority order", () => {
    expect(swapButtonState({ ...base, operational: false })).toEqual({ label: "Vault not operational", disabled: true });
    expect(swapButtonState({ ...base, hasToken: false })).toEqual({ label: "Select a token", disabled: true });
    expect(swapButtonState({ ...base, amount: null })).toEqual({ label: "Enter an amount", disabled: true });
    expect(swapButtonState({ ...base, amount: 0n })).toEqual({ label: "Enter an amount", disabled: true });
    expect(swapButtonState({ ...base, amount: 101n })).toEqual({ label: "Insufficient vault balance", disabled: true });
    expect(swapButtonState({ ...base, quoteLoading: true })).toEqual({ label: "Fetching quote…", disabled: true });
    expect(swapButtonState({ ...base, quoteError: "no route" })).toEqual({ label: "No route found", disabled: true });
    expect(swapButtonState({ ...base, quoteAgeMs: 31_000 })).toEqual({ label: "Refreshing quote…", disabled: true });
    expect(swapButtonState({ ...base, quoteAgeMs: null })).toEqual({ label: "Fetching quote…", disabled: true });
    expect(swapButtonState(base)).toEqual({ label: "Review swap", disabled: false });
  });
});

describe("quote maths", () => {
  it("minReceived applies slippage rounding down", () => {
    expect(minReceived(10_000n, 50)).toBe(9_950n);
    expect(minReceived(999n, 100)).toBe(989n);
  });
  it("price impact is a fraction from Jupiter", () => {
    expect(impactPercent("0.00018")).toBeCloseTo(0.018, 9);
    expect(impactPercent("garbage")).toBe(0);
    expect(impactSeverity(0.5)).toBe("ok");
    expect(impactSeverity(1.2)).toBe("warn");
    expect(impactSeverity(7)).toBe("high");
  });
  it("isOperational needs both vault and protocol normal", () => {
    expect(isOperational({ status: "normal", protocol: { status: "normal" } })).toBe(true);
    expect(isOperational({ status: "reduceOnly", protocol: { status: "normal" } })).toBe(false);
    expect(isOperational({ status: "normal", protocol: { status: "paused" } })).toBe(false);
  });
});
