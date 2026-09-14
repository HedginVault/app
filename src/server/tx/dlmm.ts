import "server-only";
import type { IdlTypes, Program } from "@coral-xyz/anchor";
import type DLMM from "@meteora-ag/dlmm";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import type { DlmmShape, PoolInfo } from "@/lib/types";
import { cached } from "../cache";
import {
  getActiveBinIds,
  getBinArrayAccountMetasCoverage,
  getPool,
  StrategyType,
  toStrategyParameters,
  type StrategyTypeValue,
} from "../dlmm-pool";
import { getConfigPda, getStrategyPda } from "../pda";
import { DLMM_EVENT_AUTHORITY, DLMM_PROGRAM_ID, MEMO_PROGRAM_ID, getProgram } from "../program";
import { getTokenInfos } from "../tokens";
import type { VaultCtx } from "./context";

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

/**
 * Accounts and remaining accounts shared by the liquidity and claim-fee builders (port of
 * `tests/handler/dlmm.ts`). The lbPair comes off the position account, so callers only name the
 * position. Costs 1 RPC for the position plus the pool hydration (cached 5 minutes).
 */
export async function getDlmmContext(vault: PublicKey, position: PublicKey, payer: PublicKey) {
  const program = getProgram();
  const positionAccount = await program.account.positionV2.fetch(position);
  const lbPair = positionAccount.lbPair;
  const dlmm = await getPool(lbPair);
  const { lowerBinId, upperBinId } = positionAccount;

  const vaultTokenX = getAssociatedTokenAddressSync(dlmm.tokenX.publicKey, vault, true, dlmm.tokenX.owner);
  const vaultTokenY = getAssociatedTokenAddressSync(dlmm.tokenY.publicKey, vault, true, dlmm.tokenY.owner);
  const createAtaIxs = [
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      vaultTokenX,
      vault,
      dlmm.tokenX.publicKey,
      dlmm.tokenX.owner,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      vaultTokenY,
      vault,
      dlmm.tokenY.publicKey,
      dlmm.tokenY.owner,
    ),
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

const SHAPES: Record<DlmmShape, StrategyTypeValue> = {
  spot: StrategyType.Spot,
  curve: StrategyType.Curve,
  bidAsk: StrategyType.BidAsk,
};

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
  const { dlmm, lowerBinId, upperBinId, accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } =
    await getDlmmContext(ctx.key, position, authority);
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
          maxBinId: upperBinId,
          strategyType: SHAPES[shape],
        }),
      },
      remainingAccountsInfo,
    })
    .accounts({ ...accounts, authority })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return [...createAtaIxs, ix];
}

export async function dlmmRemoveLiquidityIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  bpsToRemove: number,
) {
  const { accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } = await getDlmmContext(
    ctx.key,
    position,
    authority,
  );
  const ix = await program.methods
    .meteoraDlmmRemoveLiquidity({ bpsToRemove, remainingAccountsInfo })
    .accounts({ ...accounts, authority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return [...createAtaIxs, ix];
}

export async function dlmmClaimFeeIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  position: PublicKey,
  treasuryAuthority: PublicKey,
) {
  const { accounts, createAtaIxs, remainingAccountsInfo, remainingAccounts } = await getDlmmContext(
    ctx.key,
    position,
    authority,
  );
  const ix = await program.methods
    .meteoraDlmmClaimFee(remainingAccountsInfo)
    .accounts({ ...accounts, authority, treasuryAuthority, memoProgram: MEMO_PROGRAM_ID })
    .remainingAccounts(remainingAccounts)
    .instruction();
  return [...createAtaIxs, ix];
}
