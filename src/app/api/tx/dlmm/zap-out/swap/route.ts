import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { z } from "zod";
import { ApiError } from "@/server/errors";
import { getStrategyPda } from "@/server/pda";
import { getConnection, getProgram } from "@/server/program";
import { readConfig } from "@/server/readers/vaults";
import { handlePost } from "@/server/route";
import { decodeTokenAmount } from "@/server/rpc";
import { assemble } from "@/server/tx/assemble";
import { assertAuthority, loadVaultCtx, type VaultCtx } from "@/server/tx/context";
import { jupiterInitializeIx, jupiterSwapIx } from "@/server/tx/jupiter";
import { zapSwapNextStep } from "@/server/tx/next-steps";
import { dlmmZapOutSwapBody } from "@/server/tx/schemas";
import { fitsInTransaction } from "@/server/tx/size";
import { closeJupiterStrategyIx } from "@/server/tx/vault";
import { getTokenProgram } from "@/server/tokens";

type Body = z.infer<typeof dlmmZapOutSwapBody>;

/** Amount attributable to this zap, excluding tokens the vault already held. */
export const zapSwapAmount = (currentBalance: bigint, balanceBefore: bigint) => {
  if (currentBalance < balanceBefore) {
    throw new ApiError(
      409,
      "ZapBalanceChanged",
      "Vault token balance changed while the zap was in progress; the idle balance was not swapped",
    );
  }
  return currentBalance - balanceBefore;
};

/** Only a temporary Jupiter strategy created by this zap may be closed automatically. */
export const shouldCloseZapStrategy = (
  strategyExistsBeforeZapSwap: boolean,
  balanceBefore: bigint,
  closeWhenEmpty: boolean,
) => closeWhenEmpty || (!strategyExistsBeforeZapSwap && balanceBefore === 0n);

async function buildSwapOrCleanup(
  b: Body,
  ctx: VaultCtx,
  authority: PublicKey,
  sources: Body["sources"],
  slippageBps: number,
) {
  const [source, ...remainingSources] = sources;
  if (!source) throw new ApiError(400, "Validation", "sources must not be empty");
  const sourceMint = new PublicKey(source.mint);
  const balanceBefore = BigInt(source.balanceBefore);
  if (sourceMint.equals(ctx.depositMint))
    throw new ApiError(400, "Validation", "zap source mint must differ from the vault deposit mint");

  const program = getProgram();
  const connection = getConnection();
  const tokenProgram = await getTokenProgram(sourceMint);
  const sourceAta = getAssociatedTokenAddressSync(sourceMint, ctx.key, true, tokenProgram);
  const strategy = getStrategyPda(ctx.key, sourceMint);
  const [sourceInfo, strategyInfo] = await connection.getMultipleAccountsInfo([sourceAta, strategy]);
  const amount = zapSwapAmount(decodeTokenAmount(sourceInfo), balanceBefore);
  const strategyExists = strategyInfo !== null;
  const initIx = strategyExists ? null : await jupiterInitializeIx(program, ctx, authority, sourceMint);
  // A pre-existing strategy or token balance is unrelated to this zap and must remain open.
  const closeWhenEmpty = shouldCloseZapStrategy(strategyExists, balanceBefore, source.closeWhenEmpty === true);
  const closeIx = closeWhenEmpty
    ? await closeJupiterStrategyIx(program, ctx, authority, sourceMint, tokenProgram)
    : null;
  const afterCurrent = remainingSources.length
    ? zapSwapNextStep({ vault: b.vault, slippageBps }, remainingSources)
    : undefined;

  // A one-sided position can return zero of the non-deposit token. Initializing and immediately
  // closing the strategy lets the existing close ix also reclaim the now-unused vault ATA rent.
  if (amount === 0n) {
    if (!closeIx) {
      throw new ApiError(409, "ZapNothingToSwap", "The position returned no new tokens; the existing idle balance was preserved");
    }
    const cleanupIxs = initIx ? [initIx, closeIx] : [closeIx];
    return { ...(await assemble(authority, cleanupIxs)), next: afterCurrent };
  }

  const { ix: swapIx, lookupTables } = await jupiterSwapIx(
    program,
    ctx,
    authority,
    sourceMint,
    ctx.depositMint,
    new BN(amount.toString()),
    slippageBps,
  );
  const full = [...(initIx ? [initIx] : []), swapIx, ...(closeIx ? [closeIx] : [])];
  if (fitsInTransaction(authority, full, lookupTables))
    return { ...(await assemble(authority, full, { lookupTables })), next: afterCurrent };

  // Preserve the existing ix set and prefer the densest safe packet. A follow-up is built only
  // after confirmation, so it sees the exact post-swap zero balance and closes the strategy/ATA.
  if (initIx) {
    const initAndSwap = [initIx, swapIx];
    if (fitsInTransaction(authority, initAndSwap, lookupTables))
      return {
        ...(await assemble(authority, initAndSwap, { lookupTables })),
        next: closeIx
          ? zapSwapNextStep(
              { vault: b.vault, slippageBps },
              [{ ...source, closeWhenEmpty: true }, ...remainingSources],
            )
          : afterCurrent,
      };
    return {
      ...(await assemble(authority, [initIx])),
      next: zapSwapNextStep(
        { vault: b.vault, slippageBps },
        [{ ...source, closeWhenEmpty: true }, ...remainingSources],
      ),
    };
  }

  if (!fitsInTransaction(authority, [swapIx], lookupTables))
    throw new ApiError(422, "TransactionTooLarge", "Jupiter swap does not fit in a v0 transaction");
  return {
    ...(await assemble(authority, [swapIx], { lookupTables })),
    next: closeIx
      ? zapSwapNextStep(
          { vault: b.vault, slippageBps },
          [{ ...source, closeWhenEmpty: true }, ...remainingSources],
        )
      : afterCurrent,
  };
}

export const POST = handlePost(dlmmZapOutSwapBody, async (b) => {
  const authority = new PublicKey(b.payer);
  const ctx = await loadVaultCtx(b.vault);
  assertAuthority(ctx, authority);
  const unique = [...new Map(b.sources.map((source) => [source.mint, source])).values()];
  const config = await readConfig();
  return buildSwapOrCleanup(b, ctx, authority, unique, Math.min(b.slippageBps, config.maxSlippageBps));
});
