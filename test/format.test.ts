import { describe, expect, it } from "vitest";
import {
  displayFraction,
  formatBps,
  formatNav,
  formatPercent,
  formatRelative,
  formatTokenAmount,
  parseTokenAmount,
  rawToInput,
  shortAddress,
  toUiNumber,
  usdValue,
  formatUsd,
  formatPrice,
  formatShare,
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

describe("money formatting", () => {
  it("usdValue converts base units and propagates null prices", () => {
    expect(usdValue("2500000", 6, 2)).toBe(5);
    expect(usdValue(1n, 6, null)).toBeNull();
  });
  it("formatUsd", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(1_234_567, { compact: true })).toBe("$1.23M");
    expect(formatUsd(-12.3)).toBe("-$12.30");
  });
  it("formatPrice keeps significant digits for small prices", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(142.3456)).toBe("142.35");
    expect(formatPrice(0.000123456)).toBe("0.0001235");
  });
  it("formatShare", () => {
    expect(formatShare(null)).toBe("—");
    expect(formatShare(3333)).toBe("33.3%");
    expect(formatShare(4)).toBe("<0.1%");
  });
});

describe("amount display helpers", () => {
  it("displayFraction shrinks precision as amounts grow", () => {
    expect(displayFraction("1500000000", 6)).toBe(2); // 1,500
    expect(displayFraction("2500000", 6)).toBe(4); // 2.5
    expect(displayFraction("2500", 6)).toBe(6); // 0.0025
  });
  it("rawToInput writes a plain decimal string", () => {
    expect(rawToInput("1234500000", 6)).toBe("1234.5");
    expect(rawToInput(0n, 9)).toBe("0");
    expect(rawToInput("1", 9)).toBe("0.000000001");
  });
});
