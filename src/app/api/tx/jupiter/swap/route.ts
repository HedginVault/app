import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { ApiError } from "@/server/errors";
import { getStrategyPda } from "@/server/pda";
import { getConnection, getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost } from "@/server/route";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx } from "@/server/tx/context";
import { jupiterInitializeIx, jupiterSwapIx } from "@/server/tx/jupiter";
import { swapNextStep } from "@/server/tx/next-steps";
import { jupiterSwapBody } from "@/server/tx/schemas";
import { fitsInTransaction, swapPlan } from "@/server/tx/size";

export const POST = handlePost(jupiterSwapBody, async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const source = new PublicKey(b.sourceMint);
  const destination = new PublicKey(b.destinationMint);
  if (source.equals(destination))
    throw new ApiError(400, "Validation", "sourceMint and destinationMint must differ");
  if (source.equals(ctx.depositMint) === destination.equals(ctx.depositMint))
    throw new ApiError(400, "Validation", "one side of the swap must be the vault deposit mint");

  const config = await readConfig();
  const slippage = Math.min(b.slippageBps, config.maxSlippageBps);
  const targetMint = source.equals(ctx.depositMint) ? destination : source;
  const program = getProgram();

  // The strategy PDA must exist before `jupiter_swap`; the first swap into a token creates it.
  const exists = (await getConnection().getAccountInfo(getStrategyPda(ctx.key, targetMint))) !== null;
  const { ix, lookupTables } = await jupiterSwapIx(program, ctx, authority, source, destination, new BN(b.amount), slippage);
  const init = exists ? null : await jupiterInitializeIx(program, ctx, authority, targetMint);

  switch (swapPlan(exists, init !== null && fitsInTransaction(authority, [init, ix], lookupTables))) {
    case "swap":
      return { ...(await assemble(authority, [ix], { lookupTables })), initializesStrategy: false };
    case "initAndSwap":
      return { ...(await assemble(authority, [init!, ix], { lookupTables })), initializesStrategy: true };
    case "initThenSwap":
      return { ...(await assemble(authority, [init!])), initializesStrategy: true, next: swapNextStep(b) };
  }
});
