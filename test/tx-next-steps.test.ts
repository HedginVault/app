import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { addNextStep, swapNextStep } from "@/server/tx/next-steps";
import { dlmmAddBody, dlmmOpenBody, jupiterSwapBody } from "@/server/tx/schemas";

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
