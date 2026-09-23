import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { shouldCloseZapStrategy, zapSwapAmount } from "@/app/api/tx/dlmm/zap-out/swap/route";
import { addNextStep, swapNextStep, zapSwapNextStep } from "@/server/tx/next-steps";
import { dlmmAddBody, dlmmOpenBody, dlmmZapOutSwapBody, jupiterSwapBody } from "@/server/tx/schemas";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n)).toBase58();
const payer = pk(5);

describe("swapNextStep", () => {
  const body = jupiterSwapBody.parse({
    payer, vault: pk(1), sourceMint: pk(2), destinationMint: pk(3), amount: "1000", slippageBps: 50,
  });

  it("targets jupiter/swap with a body the route accepts once the client adds the payer", () => {
    const step = swapNextStep(body);
    expect(step.path).toBe("jupiter/swap");
    expect(step.body).not.toHaveProperty("payer");
    const parsed = jupiterSwapBody.safeParse({ ...step.body, payer });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(body);
  });
});

describe("addNextStep", () => {
  const body = dlmmOpenBody.parse({
    payer, vault: pk(1), lbPair: pk(7), lowerBinId: -5, upperBinId: 30,
    amountX: "1", amountY: "250", shape: "curve", maxActiveBinSlippage: 10,
  });
  const position = pk(9);

  it("targets dlmm/add for the new position with a body the route accepts once the client adds the payer", () => {
    const step = addNextStep(body, position);
    expect(step.path).toBe("dlmm/add");
    expect(step.body).not.toHaveProperty("payer");
    const parsed = dlmmAddBody.safeParse({ ...step.body, payer });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      payer, vault: pk(1), position, amountX: "1", amountY: "250", shape: "curve", maxActiveBinSlippage: 10,
    });
  });
});

describe("zapSwapNextStep", () => {
  it("carries each pool mint's pre-zap balance without a payer", () => {
    const sources = [
      { mint: pk(2), balanceBefore: "10000" },
      { mint: pk(3), balanceBefore: "0" },
    ];
    const step = zapSwapNextStep({ vault: pk(1), slippageBps: 50 }, sources);
    expect(step).toEqual({
      path: "dlmm/zap-out/swap",
      body: { vault: pk(1), sources, slippageBps: 50 },
    });
    expect(step.body).not.toHaveProperty("payer");
    expect(dlmmZapOutSwapBody.safeParse({ ...step.body, payer }).success).toBe(true);
  });
});

describe("zapSwapAmount", () => {
  it("swaps only the tokens returned by the closing position", () => {
    expect(zapSwapAmount(13_000n, 10_000n)).toBe(3_000n);
  });

  it("stops instead of touching idle funds when the balance fell during the zap", () => {
    expect(() => zapSwapAmount(9_000n, 10_000n)).toThrowError(/idle balance was not swapped/);
  });
});

describe("shouldCloseZapStrategy", () => {
  it("does not close an unrelated strategy or an account holding preserved idle tokens", () => {
    expect(shouldCloseZapStrategy(true, 0n, false)).toBe(false);
    expect(shouldCloseZapStrategy(false, 10_000n, false)).toBe(false);
  });

  it("closes only a zero-baseline temporary strategy created by this zap", () => {
    expect(shouldCloseZapStrategy(false, 0n, false)).toBe(true);
    expect(shouldCloseZapStrategy(true, 0n, true)).toBe(true);
  });
});
