import { beforeEach, describe, expect, it, vi } from "vitest";

const { minimumBalance } = vi.hoisted(() => ({
  minimumBalance: vi.fn(async (size: number) => (size + 128) * 5_080),
}));
vi.mock("@/server/program", () => ({
  RPC_URL: "",
  getConnection: () => ({ getMinimumBalanceForRentExemption: minimumBalance }),
}));

describe("DLMM position rent quote", () => {
  beforeEach(() => minimumBalance.mockClear());

  it("quotes the base account at 70 bins and 112 extra bytes per additional bin", async () => {
    const { readPositionRent } = await import("@/server/position-rent");
    expect(await readPositionRent(69)).toEqual({ binCount: 69, lamports: "41899840" });
    expect(await readPositionRent(70)).toEqual({ binCount: 70, lamports: "41899840" });
    expect(await readPositionRent(71)).toEqual({ binCount: 71, lamports: String((8_120 + 112 + 128) * 5_080) });
    expect(await readPositionRent(1_400)).toEqual({ binCount: 1_400, lamports: String((8_120 + 112 * 1_330 + 128) * 5_080) });
    expect(minimumBalance.mock.calls.map(([size]) => size)).toEqual([8_120, 8_120, 8_232, 8_120 + 112 * 1_330]);
  });

  it("rejects invalid widths before requesting rent", async () => {
    const { readPositionRent } = await import("@/server/position-rent");
    expect(() => readPositionRent(0)).toThrow("bin count must be from 1 to 1400");
    expect(() => readPositionRent(1_401)).toThrow("bin count must be from 1 to 1400");
    expect(() => readPositionRent(70.5)).toThrow("bin count must be from 1 to 1400");
    expect(minimumBalance).not.toHaveBeenCalled();
  });

  it("returns a validation error for a width over 1,400 at the HTTP boundary", async () => {
    const { GET } = await import("@/app/api/dlmm/position-rent/route");
    const response = await GET(new Request("http://localhost/api/dlmm/position-rent?bins=1401"));
    expect(response.status).toBe(400);
    expect(minimumBalance).not.toHaveBeenCalled();
  });
});
