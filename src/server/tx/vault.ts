import type { Program } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { AccountMeta, PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import type { Status } from "@/lib/types";
import { ApiError } from "../errors";
import { getConfigPda, getManagerPda, getVaultPda } from "../pda";
import { DLMM_EVENT_AUTHORITY, DLMM_PROGRAM_ID } from "../program";
import { getTokenProgram } from "../tokens";
import type { VaultCtx } from "./context";

type P = Program<HedgeVault>;

type Empty = Record<string, never>;
type StatusArg = { normal: Empty } | { paused: Empty } | { reduceOnly: Empty };

export const encodeName = (name: string): number[] =>
  Array.from(Buffer.from(name.padEnd(32, "\0"), "utf8").subarray(0, 32));

export const toStatusArg = (s?: Status): StatusArg | null => (s ? ({ [s]: {} } as StatusArg) : null);

export interface VaultInitArgs {
  name: string;
  performanceFeeBps: number;
  managementFeeBps: number;
  depositCap: BN;
  minDeposit: BN;
  minWithdrawalShares: BN;
}

export const vaultInitializeIx = (
  program: P,
  authority: PublicKey,
  args: VaultInitArgs,
  depositMint: PublicKey,
  tokenProgram: PublicKey,
  nextVaultId: BN,
) =>
  program.methods
    .vaultInitialize({ ...args, name: encodeName(args.name) })
    .accountsPartial({
      authority,
      config: getConfigPda(),
      manager: getManagerPda(authority),
      // the IDL cannot express the next_vault_id seed, so the vault is passed explicitly
      vault: getVaultPda(nextVaultId),
      depositMint,
      depositMintTokenProgram: tokenProgram,
    })
    .instruction();

export interface VaultUpdateArgs {
  performanceFeeBps?: number;
  managementFeeBps?: number;
  depositCap?: BN;
  minDeposit?: BN;
  minWithdrawalShares?: BN;
  status?: Status;
  depositPaused?: boolean;
  withdrawalPaused?: boolean;
}

export const vaultUpdateIx = (program: P, ctx: VaultCtx, authority: PublicKey, a: VaultUpdateArgs) =>
  program.methods
    .vaultUpdate({
      performanceFeeBps: a.performanceFeeBps ?? null,
      managementFeeBps: a.managementFeeBps ?? null,
      depositCap: a.depositCap ?? null,
      minDeposit: a.minDeposit ?? null,
      minWithdrawalShares: a.minWithdrawalShares ?? null,
      status: toStatusArg(a.status),
      depositPaused: a.depositPaused ?? null,
      withdrawalPaused: a.withdrawalPaused ?? null,
    })
    .accounts({ authority, vault: ctx.key })
    .instruction();

export const claimManagerFeeIx = (program: P, ctx: VaultCtx, authority: PublicKey) =>
  program.methods
    .vaultClaimManagerFee()
    .accounts({ authority, vault: ctx.key, shareMint: ctx.shareMint })
    .instruction();

export const vaultCloseIx = (program: P, ctx: VaultCtx, authority: PublicKey) =>
  program.methods
    .vaultClose()
    .accounts({
      authority,
      vault: ctx.key,
      depositMint: ctx.depositMint,
      shareMint: ctx.shareMint,
      depositMintTokenProgram: ctx.tokenProgram,
    })
    .instruction();

const writable = (pubkey: PublicKey): AccountMeta => ({ pubkey, isWritable: true, isSigner: false });
const readonly = (pubkey: PublicKey): AccountMeta => ({ pubkey, isWritable: false, isSigner: false });

type StrategyType = { jupiterSwap: { targetMint: PublicKey } } | { meteoraDlmm: { position: PublicKey } };

/**
 * Closes a strategy; the remaining accounts depend on the strategy type
 * (mirrors tests/handler/vault_close_strategy.ts).
 */
export async function closeStrategyIx(program: P, ctx: VaultCtx, authority: PublicKey, strategy: PublicKey) {
  const account = await program.account.strategy.fetchNullable(strategy);
  if (!account) throw new ApiError(404, "NotFound", "Strategy not found");
  // Guard before deriving anything from the payload: a foreign strategy would otherwise build an
  // instruction against another vault's mint and only fail in simulation.
  if (!account.vault.equals(ctx.key))
    throw new ApiError(400, "Validation", "Strategy does not belong to this vault");
  const strategyType = account.strategyType as StrategyType;
  let remainingAccounts: AccountMeta[];
  if ("meteoraDlmm" in strategyType) {
    remainingAccounts = [
      writable(strategyType.meteoraDlmm.position),
      readonly(DLMM_PROGRAM_ID),
      readonly(DLMM_EVENT_AUTHORITY),
    ];
  } else {
    const mint = strategyType.jupiterSwap.targetMint;
    const tokenProgram = await getTokenProgram(mint);
    remainingAccounts = [
      writable(getAssociatedTokenAddressSync(mint, ctx.key, true, tokenProgram)),
      readonly(tokenProgram),
    ];
  }
  return program.methods
    .vaultCloseStrategy()
    .accounts({ authority, config: getConfigPda(), vault: ctx.key, strategy })
    .remainingAccounts(remainingAccounts)
    .instruction();
}
