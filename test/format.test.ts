import { describe, expect, it } from "vitest";
import {
  formatBps,
  formatNav,
  formatPercent,
  formatRelative,
  formatTokenAmount,
  parseTokenAmount,
  shortAddress,
  toUiNumber,
} from "@/lib/format";

describe("formatTokenAmount", () => {
  it("applies decimals and trims trailing zeros", () => {
    expect(formatTokenAmount("1500000", 6)).toBe("1.5");
    expect(formatTokenAmount("1000000", 6)).toBe("1");
    expect(formatTokenAmount(0n, 6)).toBe("0");
  });
  it("groups thousands and caps fraction digits", () => {
    expect(formatTokenAmount("123456789123", 6)).toBe("123,456.789123");
    expect(formatTokenAmount("123456789123", 6, { maxFraction: 2 })).toBe("123,456.79");
  });
  it("uses compact notation above one million", () => {
    expect(formatTokenAmount("2500000000000", 6, { compact: true })).toBe("2.5M");
    expect(formatTokenAmount("2500000000", 6, { compact: true })).toBe("2,500");
  });
  it("keeps the magnitude when the rounded mantissa ends in zero", () => {
    expect(formatTokenAmount("100000000000000", 6, { compact: true })).toBe("100M");
    expect(formatTokenAmount("250000000000000", 6, { compact: true })).toBe("250M");
    expect(formatTokenAmount("1500000000000000", 6, { compact: true })).toBe("1.5B");
  });
});

describe("formatBps / formatPercent / formatNav", () => {
  it("formats basis points as percent", () => {
    expect(formatBps(1000)).toBe("10%");
    expect(formatBps(250)).toBe("2.5%");
    expect(formatBps(0)).toBe("0%");
  });
  it("formats percent values", () => {
    expect(formatPercent(12.3456)).toBe("12.35%");
  });
  it("formats nav with 1e9 precision to 4 places", () => {
    expect(formatNav("1000000000")).toBe("1.0000");
    expect(formatNav("1234567890")).toBe("1.2346");
  });
});

describe("shortAddress / formatRelative", () => {
  it("shortens addresses", () => {
    expect(shortAddress("DHjJJ4viFqUjzFHupehqxyEUrKb5Pdu95A29HFm8gdQD")).toBe("DHjJ…gdQD");
  });
  it("describes relative time", () => {
    const now = 1_700_000_000;
    expect(formatRelative(now - 30, now)).toBe("just now");
    expect(formatRelative(now - 90, now)).toBe("1m ago");
    expect(formatRelative(now - 7200, now)).toBe("2h ago");
    expect(formatRelative(now - 3 * 86400, now)).toBe("3d ago");
    expect(formatRelative(now + 3600, now)).toBe("in 1h");
  });
});

describe("parseTokenAmount / toUiNumber", () => {
  it("parses decimal input into raw units", () => {
    expect(parseTokenAmount("1.5", 6)).toBe(1_500_000n);
    expect(parseTokenAmount("0.0000001", 6)).toBe(null);
    expect(parseTokenAmount("abc", 6)).toBe(null);
    expect(parseTokenAmount("", 6)).toBe(null);
  });
  it("converts raw to ui number", () => {
    expect(toUiNumber("1500000", 6)).toBe(1.5);
  });
});
