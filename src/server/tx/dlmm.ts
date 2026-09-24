import "server-only";
import type { IdlTypes, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import type { DlmmShape, PoolInfo } from "@/lib/types";
import { ApiError } from "../errors";
import { cached } from "../cache";
import {
  deriveBinArray,
  getActiveBinIds,
  getBinArrayAccountMetasCoverage,
  getBinArrayIndexesCoverage,
  getPool,
  StrategyType,
  toStrategyParameters,
  type DLMM,
  type StrategyTypeValue,
} from "../dlmm-pool";
import { getConfigPda, getStrategyPda } from "../pda";
import {
  DLMM_EVENT_AUTHORITY,
  DLMM_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  getConnection,
  getProgram,
} from "../program";
import { getMultipleAccounts } from "../rpc";
import { getTokenInfos } from "../tokens";
import type { VaultCtx } from "./context";
import { jupiterInitializeIx, jupiterTokenLedgerSwapIx } from "./jupiter";
import { closeStrategyIx } from "./vault";

type P = Program<HedgeVault>;

/** Price of one bin in token Y per token X, adjusted for decimals. */
export function binPrice(dlmm: DLMM, binId: number): string {
  const perLamport = Math.pow(1 + dlmm.lbPair.binStep / 10_000, binId);
  return dlmm.fromPricePerLamport(perLamport);
}

/**
 * Centers a `width`-bin range on the live active bin, matching the handler script: `floor(width / 2)`
 * bins sit below the active bin and the half-open range `[lower, lower + width)` is `width` bins wide.
 * The returned `upperBinId` is therefore exclusive; the last bin the position owns is `upper - 1`.
 */
export function rangeFromWidth(activeId: number, width: number) {
  const lowerBinId = activeId - Math.floor(width / 2);
  return { lowerBinId, upperBinId: lowerBinId + width };
}

/**
 * The exclusive upper bound turned into the bound the position account actually stores. The program
 * forwards `width = upper_bin_id - lower_bin_id` to the DLMM `initialize_position2` CPI, whose `width`
 * argument is a bin *count*, so the created position spans `[lower, upper - 1]` inclusive.
 */
export const onChainUpper = (upperBinId: number) => upperBinId - 1;

/**
 * Cached pool (5 min) + 1 RPC for the live active bin; token metadata from the token cache.
 * The key is normalized first, so two spellings of the same address share one cache entry and the
 * response always echoes the canonical base58 form.
 */
export const readPoolInfo = (address: string) => {
  const key = new PublicKey(address);
  const lbPair = key.toBase58();
  return cached(`poolinfo:${lbPair}`, 10_000, async (): Promise<PoolInfo> => {
    const dlmm = await getPool(key);
    const [tokens, activeIds] = await Promise.all([
      getTokenInfos([dlmm.tokenX.publicKey, dlmm.tokenY.publicKey]),
      getActiveBinIds([dlmm]),
    ]);
    const activeBinId = activeIds.get(lbPair) ?? dlmm.lbPair.activeId;
    return {
      lbPair,
      tokenX: tokens.get(dlmm.tokenX.publicKey.toBase58())!,
      tokenY: tokens.get(dlmm.tokenY.publicKey.toBase58())!,
      binStep: dlmm.lbPair.binStep,
      activeBinId,
      activePrice: binPrice(dlmm, activeBinId),
    };
  });
};

export type DlmmContext = ReturnType<typeof dlmmContextFor>;

/** Accounts and remaining accounts for a position over `[lowerBinId, upperBinId]` (inclusive) in `dlmm`. No I/O. */
export function dlmmContextFor(
  vault: PublicKey,
  position: PublicKey,
  payer: PublicKey,
  dlmm: DLMM,
  lowerBinId: number,
  upperBinId: number,
) {
  const lbPair = dlmm.pubkey;
  const vaultTokenX = getAssociatedTokenAddressSync(dlmm.tokenX.publicKey, vault, true, dlmm.tokenX.owner);
  const vaultTokenY = getAssociatedTokenAddressSync(dlmm.tokenY.publicKey, vault, true, dlmm.tokenY.owner);
  const createAtaIxs = [
    createAssociatedTokenAccountIdempotentInstruction(payer, vaultTokenX, vault, dlmm.tokenX.publicKey, dlmm.tokenX.owner),
    createAssociatedTokenAccountIdempotentInstruction(payer, vaultTokenY, vault, dlmm.tokenY.publicKey, dlmm.tokenY.owner),
  ];

  const transferHookX = dlmm.tokenX.transferHookAccountMetas;
  const transferHookY = dlmm.tokenY.transferHookAccountMetas;
  const remainingAccountsInfo: IdlTypes<HedgeVault>["remainingAccountsInfo"] = {
    slices: [
      { accountsType: { transferHookX: {} }, length: transferHookX.length },
      { accountsType: { transferHookY: {} }, length: transferHookY.length },
    ],
  };
  const remainingAccounts = [
    ...transferHookX,
    ...transferHookY,
    ...getBinArrayAccountMetasCoverage(new BN(lowerBinId), new BN(upperBinId), lbPair, DLMM_PROGRAM_ID),
  ];

  const accounts = {
    vault,
    position,
    lbPair,
    binArrayBitmapExtension: dlmm.binArrayBitmapExtension?.publicKey ?? null,
    reserveX: dlmm.lbPair.reserveX,
    reserveY: dlmm.lbPair.reserveY,
    tokenXMint: dlmm.tokenX.publicKey,
    tokenYMint: dlmm.tokenY.publicKey,
    tokenXProgram: dlmm.tokenX.owner,
    tokenYProgram: dlmm.tokenY.owner,
    config: getConfigPda(),
    strategy: getStrategyPda(vault, position),
    eventAuthority: DLMM_EVENT_AUTHORITY,
  };

  return { dlmm, lowerBinId, upperBinId, accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts };
}

/**
 * Context for an existing position (port of `tests/handler/dlmm.ts`): the lbPair and range come off
 * the position account. Costs 1 RPC for the position plus the pool hydration (cached 5 minutes).
 */
export async function getDlmmContext(
  vault: PublicKey,
  position: PublicKey,
  payer: PublicKey,
  range?: { lowerBinId: number; upperBinId: number },
) {
  const positionAccount = await getProgram().account.positionV2.fetch(position);
  if (range && (range.lowerBinId < positionAccount.lowerBinId || range.upperBinId > positionAccount.upperBinId || range.lowerBinId > range.upperBinId))
    throw new ApiError(400, "Validation", "bin range must be inside the position");
  const dlmm = await getPool(positionAccount.lbPair);
  return dlmmContextFor(
    vault, position, payer, dlmm,
    range?.lowerBinId ?? positionAccount.lowerBinId,
    range?.upperBinId ?? positionAccount.upperBinId,
  );
}

/** The position account is created by the DLMM program, so the caller must sign for the new keypair. */
export async function dlmmInitializePositionIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  lbPair: PublicKey,
  lowerBinId: number,
  upperBinId: number,
) {
  const position = Keypair.generate();
  const ix = await program.methods
    .meteoraDlmmInitializePosition(lowerBinId, upperBinId)
    .accounts({
      authority,
      config: getConfigPda(),
      vault: ctx.key,
      position: position.publicKey,
      lbPair,
      eventAuthority: DLMM_EVENT_AUTHORITY,
      // the idl carries no address constraint for this account, anchor cannot resolve it
      dlmmProgram: DLMM_PROGRAM_ID,
    })
    .instruction();
  return { ix, position };
}

/** Extend a vault-owned PositionV2 on its upper side by one Meteora-safe resize step. */
export async function dlmmExtendPositionIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  lbPair: PublicKey,
  binsToAdd: number,
) {
  return program.methods
    .meteoraDlmmExtendPosition(binsToAdd)
    .accounts({
      authority,
      config: getConfigPda(),
      vault: ctx.key,
      position,
      lbPair,
      eventAuthority: DLMM_EVENT_AUTHORITY,
    })
    .instruction();
}

const SHAPES: Record<DlmmShape, StrategyTypeValue> = {
  spot: StrategyType.Spot,
  curve: StrategyType.Curve,
  bidAsk: StrategyType.BidAsk,
};

/** Add liquidity over a known range, for a position that may not exist on-chain yet. */
export async function dlmmAddLiquidityForRangeIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  dlmm: DLMM,
  lowerBinId: number,
  upperBinIdInclusive: number,
  amountX: BN,
  amountY: BN,
  shape: DlmmShape,
  maxActiveBinSlippage: number,
): Promise<TransactionInstruction[]> {
  const c = dlmmContextFor(ctx.key, position, authority, dlmm, lowerBinId, upperBinIdInclusive);
  const activeId = (await getActiveBinIds([dlmm])).get(dlmm.pubkey.toBase58()) ?? dlmm.lbPair.activeId;
  const ix = await program.methods
    .meteoraDlmmAddLiquidity({
      liquidityParameter: {
        amountX,
        amountY,
        activeId,
        maxActiveBinSlippage,
        strategyParameters: toStrategyParameters({
          minBinId: lowerBinId,
          maxBinId: upperBinIdInclusive,
          strategyType: SHAPES[shape],
        }),
      },
      remainingAccountsInfo: c.remainingAccountsInfo,
    })
    .accounts({ ...c.accounts, authority })
    .remainingAccounts(c.remainingAccounts)
    .instruction();
  return [...c.createAtaIxs, ix];
}

export async function dlmmAddLiquidityIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  amountX: BN,
  amountY: BN,
  shape: DlmmShape,
  maxActiveBinSlippage: number,
) {
  const { dlmm, lowerBinId, upperBinId } = await getDlmmContext(ctx.key, position, authority);
  return dlmmAddLiquidityForRangeIx(
    program, ctx, authority, position, dlmm, lowerBinId, upperBinId, amountX, amountY, shape, maxActiveBinSlippage,
  );
}

/** Instructions creating any bin array the range needs that does not exist yet (1 batched RPC). */
export async function missingBinArrayIxs(
  dlmm: DLMM,
  lowerBinId: number,
  upperBinIdInclusive: number,
  funder: PublicKey,
): Promise<TransactionInstruction[]> {
  const indexes = getBinArrayIndexesCoverage(new BN(lowerBinId), new BN(upperBinIdInclusive));
  const keys = indexes.map((i) => deriveBinArray(dlmm.pubkey, i, DLMM_PROGRAM_ID)[0]);
  const infos = await getMultipleAccounts(getConnection(), keys);
  const missing = indexes.filter((_, i) => !infos[i]);
  if (!missing.length) return [];
  // The SDK prepends its own compute-budget instruction. `assemble` owns the final limit and price,
  // so carrying the SDK instruction forward would create duplicate compute-budget instructions.
  return (await dlmm.initializeBinArrays(missing, funder)).filter(
    (ix) => !ix.programId.equals(ComputeBudgetProgram.programId),
  );
}

export async function dlmmRemoveLiquidityIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  bpsToRemove: number,
  range?: { lowerBinId: number; upperBinId: number },
) {
  const { accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } = await getDlmmContext(
    ctx.key,
    position,
    authority,
    range,
  );
  const method = range
    ? program.methods.meteoraDlmmRemoveLiquidityRange(
        { bpsToRemove, remainingAccountsInfo }, range.lowerBinId, range.upperBinId,
      )
    : program.methods.meteoraDlmmRemoveLiquidity({ bpsToRemove, remainingAccountsInfo });
  const ix = await method
    .accounts({ ...accounts, authority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return [...createAtaIxs, ix];
}

/**
 * Removes all liquidity, claims fees, and closes the position, bundled into one transaction from
 * the existing remove/claim/close-strategy instructions. Only use this for compact positions;
 * wide positions must remove and claim in ranges before closing.
 */
async function buildDlmmClosePosition(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  treasuryAuthority: PublicKey,
) {
  const { dlmm, accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } = await getDlmmContext(
    ctx.key,
    position,
    authority,
  );
  const removeIx = await program.methods
    .meteoraDlmmRemoveLiquidity({ bpsToRemove: 10_000, remainingAccountsInfo })
    .accounts({ ...accounts, authority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  const claimIx = await program.methods
    .meteoraDlmmClaimFee(remainingAccountsInfo)
    .accounts({ ...accounts, authority, treasuryAuthority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  const closeIx = await closeStrategyIx(program, ctx, authority, accounts.strategy);
  return {
    ixs: [...createAtaIxs, removeIx, claimIx, closeIx],
    tokenMints: [dlmm.tokenX.publicKey, dlmm.tokenY.publicKey],
  };
}

export async function dlmmClosePositionIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  treasuryAuthority: PublicKey,
) {
  return (await buildDlmmClosePosition(program, ctx, authority, position, treasuryAuthority)).ixs;
}

const TREASURY_CLAIM_FEE_BPS = new BN(1_000);
const BPS = new BN(10_000);

/**
 * Quote input for the position liquidity plus the 90% of unclaimed fees retained by the vault.
 * Jupiter's token ledger determines the executed amount later from the actual balance increase.
 */
export function zapOutEstimatedAmount(positionAmount: BN, pendingFee: BN) {
  const retainedFee = pendingFee.sub(pendingFee.mul(TREASURY_CLAIM_FEE_BPS).div(BPS));
  return positionAmount.add(retainedFee);
}

/**
 * Uses only existing Hedge Vault instructions: remove, claim/treasury transfer, Jupiter swap, and
 * close. Jupiter's top-level token-ledger instruction snapshots the vault source ATA before remove
 * and claim, so the swap consumes only tokens produced inside this transaction, not idle funds.
 */
export async function dlmmZapOutIxs(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  treasuryAuthority: PublicKey,
  slippageBps: number,
) {
  const { dlmm, accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } = await getDlmmContext(
    ctx.key,
    position,
    authority,
  );
  const depositIsX = dlmm.tokenX.publicKey.equals(ctx.depositMint);
  const depositIsY = dlmm.tokenY.publicKey.equals(ctx.depositMint);
  if (!depositIsX && !depositIsY)
    throw new ApiError(400, "Validation", "atomic zap out requires the vault deposit mint to be one side of the DLMM pair");

  const removeIx = await program.methods
    .meteoraDlmmRemoveLiquidity({ bpsToRemove: 10_000, remainingAccountsInfo })
    .accounts({ ...accounts, authority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  const claimIx = await program.methods
    .meteoraDlmmClaimFee(remainingAccountsInfo)
    .accounts({ ...accounts, authority, treasuryAuthority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();

  const positionData = (await dlmm.getPosition(position)).positionData;
  const swapXToY = depositIsY;
  const sourceMint = swapXToY ? dlmm.tokenX.publicKey : dlmm.tokenY.publicKey;
  const positionAmount = swapXToY
    ? positionData.totalXAmountExcludeTransferFee
    : positionData.totalYAmountExcludeTransferFee;
  const pendingFee = swapXToY ? positionData.feeXExcludeTransferFee : positionData.feeYExcludeTransferFee;
  const estimatedAmount = zapOutEstimatedAmount(positionAmount, pendingFee);

  const swapIxs: TransactionInstruction[] = [];
  let lookupTables: AddressLookupTableAccount[] = [];
  if (!estimatedAmount.isZero()) {
    const jupiterStrategy = getStrategyPda(ctx.key, sourceMint);
    const strategyExists = (await getConnection().getAccountInfo(jupiterStrategy)) !== null;
    if (!strategyExists) swapIxs.push(await jupiterInitializeIx(program, ctx, authority, sourceMint));
    const swap = await jupiterTokenLedgerSwapIx(
      program,
      ctx,
      authority,
      sourceMint,
      ctx.depositMint,
      estimatedAmount,
      slippageBps,
    );
    // Snapshot before remove/claim; execute the swap after those instructions increase the ATA.
    swapIxs.push(swap.tokenLedgerInstruction, removeIx, claimIx, swap.ix);
    lookupTables = swap.lookupTables;
  } else {
    swapIxs.push(removeIx, claimIx);
  }

  const closeIx = await closeStrategyIx(program, ctx, authority, accounts.strategy);
  return { ixs: [...createAtaIxs, ...swapIxs, closeIx], lookupTables };
}

export async function dlmmClaimFeeIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  treasuryAuthority: PublicKey,
  range?: { lowerBinId: number; upperBinId: number },
) {
  const { accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } = await getDlmmContext(
    ctx.key,
    position,
    authority,
    range,
  );
  const method = range
    ? program.methods.meteoraDlmmClaimFeeRange(remainingAccountsInfo, range.lowerBinId, range.upperBinId)
    : program.methods.meteoraDlmmClaimFee(remainingAccountsInfo);
  const ix = await method
    .accounts({ ...accounts, authority, treasuryAuthority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return [...createAtaIxs, ix];
}
