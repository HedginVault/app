import { z } from "zod";
import { amountString, pubkey } from "@/server/route";

/** Request bodies shared by a route and the `next` steps other routes hand back for it. */

const shape = z.enum(["spot", "curve", "bidAsk"]);
const maxActiveBinSlippage = z.number().int().min(0).max(1000);

export const jupiterSwapBody = z.object({
  payer: pubkey,
  vault: pubkey,
  sourceMint: pubkey,
  destinationMint: pubkey,
  amount: amountString,
  slippageBps: z.number().int().min(1).max(10_000),
});

export const dlmmAddBody = z.object({
  payer: pubkey,
  vault: pubkey,
  position: pubkey,
  amountX: amountString,
  amountY: amountString,
  shape,
  maxActiveBinSlippage,
});

export const dlmmOpenBody = z.object({
  payer: pubkey,
  vault: pubkey,
  lbPair: pubkey,
  lowerBinId: z.number().int(),
  upperBinId: z.number().int(),
  amountX: amountString,
  amountY: amountString,
  shape,
  maxActiveBinSlippage,
});

export const dlmmZapOutBody = z.object({
  payer: pubkey,
  vault: pubkey,
  position: pubkey,
  slippageBps: z.number().int().min(1).max(10_000),
});

export const dlmmZapOutSwapBody = z.object({
  payer: pubkey,
  vault: pubkey,
  sources: z
    .array(
      z.object({
        mint: pubkey,
        balanceBefore: amountString,
        closeWhenEmpty: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(2),
  slippageBps: z.number().int().min(1).max(10_000),
});
