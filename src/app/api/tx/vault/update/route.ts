import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { z } from "zod";
import { getProgram } from "@/server/program";
import { amountString, bps, handlePost, pubkey } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { vaultUpdateIx } from "@/server/tx/vault";

const feeBps = bps.optional();

export const POST = handlePost(
  z.object({
    payer: pubkey,
    vault: pubkey,
    performanceFeeBps: feeBps,
    managementFeeBps: feeBps,
    depositCap: amountString.optional(),
    minDeposit: amountString.optional(),
    minWithdrawalShares: amountString.optional(),
    status: z.enum(["normal", "paused", "reduceOnly"]).optional(),
  })
    // An all-undefined body would assemble a signable instruction that changes nothing.
    .refine(
      (b) =>
        [
          b.performanceFeeBps,
          b.managementFeeBps,
          b.depositCap,
          b.minDeposit,
          b.minWithdrawalShares,
          b.status,
        ].some((v) => v !== undefined),
      "no fields to update",
    ),
  async (b) => {
    const payer = new PublicKey(b.payer);
    const ctx = await loadVaultCtx(b.vault);
    assertAuthority(ctx, payer);
    const ix = await vaultUpdateIx(getProgram(), ctx, payer, {
      performanceFeeBps: b.performanceFeeBps,
      managementFeeBps: b.managementFeeBps,
      depositCap: b.depositCap === undefined ? undefined : new BN(b.depositCap),
      minDeposit: b.minDeposit === undefined ? undefined : new BN(b.minDeposit),
      minWithdrawalShares: b.minWithdrawalShares === undefined ? undefined : new BN(b.minWithdrawalShares),
      status: b.status,
    });
    return assemble(payer, [ix]);
  },
);
