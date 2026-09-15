import type { z } from "zod";
import type { NextStep } from "@/lib/types";
import type { dlmmOpenBody, jupiterSwapBody } from "./schemas";

/** The swap itself, after a transaction that only created the Jupiter strategy. `body` excludes `payer`. */
export const swapNextStep = (b: z.infer<typeof jupiterSwapBody>): NextStep => ({
  path: "jupiter/swap",
  body: {
    vault: b.vault,
    sourceMint: b.sourceMint,
    destinationMint: b.destinationMint,
    amount: b.amount,
    slippageBps: b.slippageBps,
  },
});

/** Adding liquidity to `position`, after a transaction that only created it. `body` excludes `payer`. */
export const addNextStep = (b: z.infer<typeof dlmmOpenBody>, position: string): NextStep => ({
  path: "dlmm/add",
  body: {
    vault: b.vault,
    position,
    amountX: b.amountX,
    amountY: b.amountY,
    shape: b.shape,
    maxActiveBinSlippage: b.maxActiveBinSlippage,
  },
});
