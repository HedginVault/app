import "server-only";
import type { Program } from "@coral-xyz/anchor";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import { getStrategyPda } from "../pda";
import { getConnection } from "../program";
import { getMultipleAccounts } from "../rpc";
import type { VaultCtx } from "./context";
import { jupiterInitializeIx } from "./jupiter";

type P = Program<HedgeVault>;
type Vault = Pick<VaultCtx, "key" | "depositMint">;

export interface PairMints {
  tokenXMint: PublicKey;
  tokenYMint: PublicKey;
}

/**
 * The keeper values a vault only from its strategy records, so the program refuses every DLMM action
 * unless each pair mint other than the deposit mint (the idle balance) has the vault's Jupiter
 * strategy. `null` is Anchor's `None` for the deposit mint side.
 */
export const pairStrategy = (vault: Vault, mint: PublicKey) =>
  mint.equals(vault.depositMint) ? null : getStrategyPda(vault.key, mint);

/** The `strategy_x` / `strategy_y` accounts of every DLMM instruction. */
export const pairStrategyAccounts = (vault: Vault, { tokenXMint, tokenYMint }: PairMints) => ({
  strategyX: pairStrategy(vault, tokenXMint),
  strategyY: pairStrategy(vault, tokenYMint),
});

/** The pair mints of an lb_pair, decoded with the program's own IDL (1 RPC). */
export async function readPairMints(program: P, lbPair: PublicKey): Promise<PairMints> {
  const { tokenXMint, tokenYMint } = await program.account.lbPair.fetch(lbPair);
  return { tokenXMint, tokenYMint };
}

/**
 * Jupiter strategy initializations for the pair mints that still lack one (1 RPC), to run before
 * the DLMM instruction. Positions opened before the program enforced pair strategies need these too.
 */
export async function pairStrategySetupIxs(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  { tokenXMint, tokenYMint }: PairMints,
): Promise<TransactionInstruction[]> {
  const mints = [tokenXMint, tokenYMint].filter(
    (mint, i, all) => !mint.equals(ctx.depositMint) && all.findIndex((m) => m.equals(mint)) === i,
  );
  if (!mints.length) return [];
  const infos = await getMultipleAccounts(getConnection(), mints.map((mint) => getStrategyPda(ctx.key, mint)));
  const missing = mints.filter((_, i) => !infos[i]);
  return Promise.all(missing.map((mint) => jupiterInitializeIx(program, ctx, authority, mint)));
}
