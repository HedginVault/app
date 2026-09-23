import { describe, expect, it } from "vitest";
import { publicVaultTab } from "@/lib/vault-tabs";

describe("publicVaultTab", () => {
  it("accepts known tabs and defaults unknown values to overview", () => {
    expect(publicVaultTab("history")).toBe("history");
    expect(publicVaultTab("overview")).toBe("overview");
    expect(publicVaultTab("settings")).toBe("overview");
    expect(publicVaultTab(null)).toBe("overview");
  });
});
