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

/** Confirmed follow-up transactions for an extended DLMM position. */
export const dlmmWideStepBody = z.object({
  payer: pubkey,
  vault: pubkey,
  position: pubkey,
  targetUpperBinId: z.number().int(),
  amountX: amountString,
  amountY: amountString,
  shape,
  maxActiveBinSlippage,
  activeBinId: z.number().int(),
});

export const dlmmWideAddBody = dlmmWideStepBody.extend({ cursorBinId: z.number().int() });

export const dlmmZapOutBody = z.object({
  payer: pubkey,
  vault: pubkey,
  position: pubkey,
  cursorBinId: z.number().int().optional(),
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

const phoenixSymbol = z.string().min(1).max(32);
/** A non-negative decimal with up to 12 fractional digits, like "0.5" or "150.25". */
const decimalString = z.string().regex(/^\d{1,15}(\.\d{1,12})?$/, "must be a decimal number");

export const phoenixVaultBody = z.object({ payer: pubkey, vault: pubkey });

export const phoenixAmountBody = phoenixVaultBody.extend({ amount: amountString });

export const phoenixOrderBody = phoenixVaultBody.extend({
  symbol: phoenixSymbol,
  side: z.enum(["long", "short"]),
  size: decimalString,
  reduceOnly: z.boolean(),
  order: z.discriminatedUnion("type", [
    z.object({ type: z.literal("market"), slippageBps: z.number().int().min(1).max(2_000) }),
    z.object({ type: z.literal("limit"), price: decimalString, postOnly: z.boolean() }),
  ]),
});

const u64String = z.string().regex(/^\d{1,20}$/).refine((s) => BigInt(s) < 2n ** 64n, "must fit in u64");

export const phoenixCancelBody = phoenixVaultBody.extend({
  symbol: phoenixSymbol,
  orders: z.union([
    z.literal("all"),
    // 20 bytes per id: 20 keeps a by-id cancel inside one transaction (the program allows 100).
    z.array(z.object({ priceInTicks: u64String, orderSequenceNumber: u64String })).min(1).max(20),
  ]),
});

export const phoenixOnboardSubmitBody = phoenixVaultBody.extend({ transaction: z.string().min(1).max(4096) });
