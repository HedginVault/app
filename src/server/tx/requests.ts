import type { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import type { BuiltTransaction } from "@/lib/types";
import { getConfigPda, getDepositRequestPda, getWithdrawalRequestPda } from "../pda";
import { getProgram } from "../program";
import { fetchRequestQueue } from "../readers/position";
import { assemble } from "./assemble";
import { loadVaultCtx, type VaultCtx } from "./context";

type P = Program<HedgeVault>;

export const depositCreateIx = (program: P, ctx: VaultCtx, depositor: PublicKey, amount: BN) =>
  program.methods
    .depositRequestCreate(amount)
    .accounts({
      depositor,
      config: getConfigPda(),
      vault: ctx.key,
      depositMint: ctx.depositMint,
      shareMint: ctx.shareMint,
      depositMintTokenProgram: ctx.tokenProgram,
    })
    .instruction();

export const depositCancelIx = (program: P, ctx: VaultCtx, depositor: PublicKey) =>
  program.methods
    .depositRequestCancel()
    .accounts({
      depositor,
      vault: ctx.key,
      depositRequest: getDepositRequestPda(ctx.key, depositor),
      depositMint: ctx.depositMint,
      depositMintTokenProgram: ctx.tokenProgram,
    })
    .instruction();

export const depositResolveIx = (program: P, ctx: VaultCtx, resolver: PublicKey, depositor: PublicKey) =>
  program.methods
    .depositRequestResolve()
    .accounts({
      resolver,
      config: getConfigPda(),
      vault: ctx.key,
      depositor,
      depositRequest: getDepositRequestPda(ctx.key, depositor),
      depositMint: ctx.depositMint,
      shareMint: ctx.shareMint,
      depositMintTokenProgram: ctx.tokenProgram,
    })
    .instruction();

export const withdrawalCreateIx = (program: P, ctx: VaultCtx, withdrawer: PublicKey, shares: BN) =>
  program.methods
    .withdrawalRequestCreate(shares)
    .accounts({
      withdrawer,
      config: getConfigPda(),
      vault: ctx.key,
      depositMint: ctx.depositMint,
      shareMint: ctx.shareMint,
      depositMintTokenProgram: ctx.tokenProgram,
    })
    .instruction();

export const withdrawalCancelIx = (program: P, ctx: VaultCtx, withdrawer: PublicKey) =>
  program.methods
    .withdrawalRequestCancel()
    .accounts({
      withdrawer,
      vault: ctx.key,
      withdrawalRequest: getWithdrawalRequestPda(ctx.key, withdrawer),
      shareMint: ctx.shareMint,
    })
    .instruction();

export const withdrawalResolveIx = (program: P, ctx: VaultCtx, resolver: PublicKey, withdrawer: PublicKey) =>
  program.methods
    .withdrawalRequestResolve()
    .accounts({
      resolver,
      config: getConfigPda(),
      vault: ctx.key,
      withdrawer,
      withdrawalRequest: getWithdrawalRequestPda(ctx.key, withdrawer),
      depositMint: ctx.depositMint,
      shareMint: ctx.shareMint,
      depositMintTokenProgram: ctx.tokenProgram,
    })
    .instruction();

/**
 * Both resolve instructions carry 13 accounts. A homogeneous 6-instruction chunk serializes to
 * 1216 bytes in the worst case (a Token-2022 deposit mint, where `deposit_mint_token_program` and
 * the share mint's `share_token_program` are distinct keys), leaving 16 bytes under the 1232-byte
 * packet limit. Mixing deposit and withdrawal resolves in one chunk pulls in both the deposit
 * escrow and the share escrow, which costs another 32 bytes and overruns at 1248 — so chunks are
 * always homogeneous.
 */
const RESOLVES_PER_TX = 6;

/** Chunks each list separately at `size`, deposits first, so no chunk ever mixes the two kinds. */
export function chunkResolves<T>(deposits: T[], withdrawals: T[], size = RESOLVES_PER_TX): T[][] {
  const chunks: T[][] = [];
  for (const list of [deposits, withdrawals])
    for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
  return chunks;
}

/** Resolves every resolvable request in the vault, chunked into transactions paid by `payer`. */
export async function buildResolveBatch(address: string, payer: PublicKey): Promise<BuiltTransaction[]> {
  const program = getProgram();
  const ctx = await loadVaultCtx(address);
  // Uncached on purpose: a stale queue would rebuild resolves for requests already settled.
  const queue = await fetchRequestQueue(address);
  const [deposits, withdrawals] = await Promise.all([
    Promise.all(
      queue.deposits
        .filter((r) => r.state === "resolvable")
        .map((r) => depositResolveIx(program, ctx, payer, new PublicKey(r.owner))),
    ),
    Promise.all(
      queue.withdrawals
        .filter((r) => r.state === "resolvable")
        .map((r) => withdrawalResolveIx(program, ctx, payer, new PublicKey(r.owner))),
    ),
  ]);
  const built: BuiltTransaction[] = [];
  for (const chunk of chunkResolves(deposits, withdrawals)) built.push(await assemble(payer, chunk));
  return built;
}
