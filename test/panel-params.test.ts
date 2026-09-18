import { describe, expect, it } from "vitest";
import { parsePanel, serializePanel } from "@/lib/panel-params";

const p = (s: string) => new URLSearchParams(s);

describe("parsePanel", () => {
  it("defaults to the swap panel", () => {
    expect(parsePanel(p(""))).toEqual({ panel: "swap" });
    expect(parsePanel(p("panel=bogus"))).toEqual({ panel: "swap" });
  });
  it("reads swap, new-LP and manage-LP states", () => {
    expect(parsePanel(p("panel=swap&from=A&to=B&amount=1.5"))).toEqual({ panel: "swap", from: "A", to: "B", amount: "1.5" });
    expect(parsePanel(p("panel=lp&pool=P"))).toEqual({ panel: "lp", pool: "P" });
    expect(parsePanel(p("panel=lp&position=X&mode=remove"))).toEqual({ panel: "lp", position: "X", mode: "remove" });
    expect(parsePanel(p("panel=lp&position=X&mode=nope"))).toEqual({ panel: "lp", position: "X", mode: "add" });
  });
});

describe("serializePanel", () => {
  it("round-trips and drops empty fields", () => {
    const s = { panel: "swap" as const, from: "A", to: "B" };
    expect(parsePanel(p(serializePanel(s)))).toEqual(s);
    expect(serializePanel({ panel: "lp" })).toBe("panel=lp");
  });
  it("keeps unrelated params and replaces stale panel params", () => {
    const out = p(serializePanel({ panel: "lp", position: "X", mode: "claim" }, p("tab=overview&from=A&amount=3")));
    expect(out.get("tab")).toBe("overview");
    expect(out.get("from")).toBeNull();
    expect(out.get("amount")).toBeNull();
    expect(out.get("mode")).toBe("claim");
  });
});
