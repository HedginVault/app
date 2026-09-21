import { describe, expect, it } from "vitest";
import { realizedPnlBaseUnits } from "@/lib/strategy-history";

describe("realizedPnlBaseUnits", () => {
  it("adds returned principal and retained fees, then subtracts contributed principal", () => {
    expect(realizedPnlBaseUnits("1000", "1080", "25")).toBe("105");
    expect(realizedPnlBaseUnits("1000", "900", "20")).toBe("-80");
  });

  it("keeps precision above JavaScript's safe integer range", () => {
    expect(
      realizedPnlBaseUnits(
        "18446744073709551615",
        "18446744073709551614",
        "2",
      ),
    ).toBe("1");
  });
});
