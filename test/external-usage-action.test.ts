import { describe, expect, it } from "vitest";
import { usageAction } from "@/server/external/usage-action";

describe("usageAction", () => {
  it.each([
    "vaults", "jupiter/quote", "dlmm/pools", "transactions/status", "transactions/send",
    "transactions/jupiter/swap", "transactions/dlmm/zap-out/swap", "transactions/strategy/close",
    "jupiter/swap", "dlmm/open",
  ])("keeps known route %s", (a) => expect(usageAction(a)).toBe(a));
  it("drops the vault address from vault read routes", () => {
    expect(usageAction("vaults/abc/holdings")).toBe("vaults/:vault/holdings");
    expect(usageAction("vaults/xyz/strategies")).toBe("vaults/:vault/strategies");
  });
  it("collapses everything else to unknown", () => {
    for (const a of ["invalid", "", "admin/x", "transactions/nope", "vaults/a/b/holdings", "vaults/a/other", "transactions/jupiter/swap/extra"])
      expect(usageAction(a)).toBe("unknown");
    const random = Array.from({ length: 200 }, (_, i) => `r${i}/${Math.random().toString(36).slice(2)}`);
    expect(new Set(random.map(usageAction))).toEqual(new Set(["unknown"]));
  });
});
