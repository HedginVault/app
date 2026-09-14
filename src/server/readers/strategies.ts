import "server-only";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import type { DlmmStrategyView, JupiterStrategyView, StrategyView } from "@/lib/types";
import { cached } from "../cache";
import { getActiveBinIds, getPools } from "../dlmm-pool";
import { getConnection, getProgram } from "../program";
import { decodeTokenAmount, getMultipleAccounts } from "../rpc";
import { getMintInfos, getTokenInfos } from "../tokens";
import { ts } from "./decode";
import { fetchVaultAccount } from "./vaults";

const TTL = 15_000;
// Strategy layout: 8 discriminator, then vault.
const VAULT_OFFSET = 8;

type Base = Pick<StrategyView, "address" | "id" | "createdTs" | "lastActionTs">;

type PositionAccount = Awaited<ReturnType<ReturnType<typeof getProgram>["account"]["positionV2"]["fetch"]>>;

/**
 * 1 RPC for the vault + 1 RPC for strategies + 1 batched read of Jupiter target ATAs
 * + 1 batched read of DLMM positions + 1 batched read of lbPair active ids
 * + one SDK `getPosition` per DLMM position (bin arrays).
 * Every uncached pool in the batch is hydrated by a single `DLMM.createMultiple` (~4 batched RPC
 * for the whole batch); warm pools cost nothing. Token metadata and prices come from their own
 * caches. A DLMM position account that has gone (closed, or never existed) is skipped with a
 * warning rather than failing the whole response.
 */
export const readStrategies = (vault: string) =>
  cached(`strategies:${vault}`, TTL, async (): Promise<StrategyView[]> => {
    const { key } = await fetchVaultAccount(vault);
    const program = getProgram();
    const rows = await program.account.strategy.all([
      { memcmp: { offset: VAULT_OFFSET, bytes: key.toBase58() } },
    ]);

    const jupiter = rows.filter((r) => "jupiterSwap" in r.account.strategyType);
    const dlmm = rows.filter((r) => "meteoraDlmm" in r.account.strategyType);
    const base = (r: (typeof rows)[number]): Base => ({
      address: r.publicKey.toBase58(),
      id: r.account.id,
      createdTs: ts(r.account.createdTs),
      lastActionTs: ts(r.account.lastActionTs),
    });

    const [jupiterViews, dlmmViews] = await Promise.all([
      jupiterViewsFor(
        key,
        jupiter.map((r) => ({
          base: base(r),
          targetMint: (r.account.strategyType as { jupiterSwap: { targetMint: PublicKey } }).jupiterSwap.targetMint,
        })),
      ),
      dlmmViewsFor(
        dlmm.map((r) => ({
          base: base(r),
          position: (r.account.strategyType as { meteoraDlmm: { position: PublicKey } }).meteoraDlmm.position,
        })),
      ),
    ]);
    return [...jupiterViews, ...dlmmViews].sort((a, b) => a.id - b.id);
  });

async function jupiterViewsFor(
  vault: PublicKey,
  items: { base: Base; targetMint: PublicKey }[],
): Promise<JupiterStrategyView[]> {
  if (items.length === 0) return [];
  const mints = items.map((i) => i.targetMint);
  // Sequential on purpose: `getTokenInfos` reuses the mint cache `getMintInfos` just filled, so a
  // cold cache reads each mint once instead of twice. A warm cache costs nothing either way.
  const mintInfos = await getMintInfos(mints);
  const tokens = await getTokenInfos(mints);
  const atas = items.map((i) =>
    getAssociatedTokenAddressSync(i.targetMint, vault, true, mintInfos.get(i.targetMint.toBase58())!.tokenProgram),
  );
  const infos = await getMultipleAccounts(getConnection(), atas);
  return items.map((i, idx) => {
    const token = tokens.get(i.targetMint.toBase58())!;
    return {
      ...i.base,
      type: "jupiter",
      targetMint: i.targetMint.toBase58(),
      symbol: token.symbol,
      decimals: token.decimals,
      logo: token.logo,
      priceUsd: token.priceUsd,
      vaultBalance: decodeTokenAmount(infos[idx]).toString(),
    };
  });
}

async function dlmmViewsFor(items: { base: Base; position: PublicKey }[]): Promise<DlmmStrategyView[]> {
  if (items.length === 0) return [];
  const program = getProgram();
  const positionInfos = await getMultipleAccounts(
    getConnection(),
    items.map((i) => i.position),
  );

  // A strategy whose position account is gone (closed out of band) is reported as absent rather
  // than taking the whole strategy list down.
  const live = items.flatMap((item, idx) => {
    const info = positionInfos[idx];
    if (!info) {
      console.warn(`[strategies] DLMM position ${item.position.toBase58()} not found, skipping`);
      return [];
    }
    return [{ ...item, account: program.coder.accounts.decode<PositionAccount>("positionV2", info.data) }];
  });
  if (live.length === 0) return [];

  // One `createMultiple` for every uncached pool in the batch, deduplicated by lbPair.
  const pools = await getPools(live.map((l) => l.account.lbPair));
  const hydrated = live.flatMap((l) => {
    const pool = pools.get(l.account.lbPair.toBase58());
    if (!pool) {
      console.warn(`[strategies] DLMM pool ${l.account.lbPair.toBase58()} unavailable, skipping`);
      return [];
    }
    return [{ ...l, pool }];
  });
  if (hydrated.length === 0) return [];
  const livePools = [...pools.values()];
  const [activeIds, tokens] = await Promise.all([
    getActiveBinIds(livePools),
    getTokenInfos(livePools.flatMap((p) => [p.tokenX.publicKey, p.tokenY.publicKey])),
  ]);

  return Promise.all(
    hydrated.map(async ({ base, position, account, pool }) => {
      const lbPair = account.lbPair.toBase58();
      const data = (await pool.getPosition(position)).positionData;
      return {
        ...base,
        type: "dlmm" as const,
        position: position.toBase58(),
        lbPair,
        tokenX: tokens.get(pool.tokenX.publicKey.toBase58())!,
        tokenY: tokens.get(pool.tokenY.publicKey.toBase58())!,
        lowerBinId: account.lowerBinId,
        upperBinId: account.upperBinId,
        activeBinId: activeIds.get(lbPair) ?? pool.lbPair.activeId,
        amountX: data.totalXAmountExcludeTransferFee.toString(),
        amountY: data.totalYAmountExcludeTransferFee.toString(),
        pendingFeeX: data.feeX.toString(),
        pendingFeeY: data.feeY.toString(),
      };
    }),
  );
}
