import "server-only";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import type { PhoenixStrategyView, UnreadableStrategyView } from "@/lib/types";
import {
  checkTrader, computeTraderEquity, decodeMarkets, decodeTraderState, describePosition, getPhoenixMarketNames,
  parseGlobalConfig, PHOENIX_GLOBAL_CONFIG, PhoenixReadError, type PhoenixMarket, type PhoenixTraderState,
} from "../phoenix";
import { getConnection, TOKEN_PROGRAM_ID } from "../program";
import { decodeTokenAmount } from "../rpc";

type Base = Pick<PhoenixStrategyView, "address" | "id" | "createdTs" | "lastActionTs">;

export interface PhoenixViewInput {
  base: Base;
  vault: PublicKey;
  trader: PublicKey;
  canonicalMint: PublicKey;
  canonicalBalance: bigint;
  /** Decoded trader, or the decode failure. */
  state: PhoenixTraderState | Error;
  /** Decoded perp asset map, or the decode failure. */
  markets: Map<bigint, PhoenixMarket> | Error;
  /** Slot the accounts were read at, for the mark-age check. */
  slot: bigint;
  names: Map<number, string>;
}

const reasonOf = (e: unknown) => (e instanceof Error && e.message ? e.message : "Phoenix read failed");

const unreadable = (base: Base, trader: PublicKey, reason: string): UnreadableStrategyView => ({
  ...base,
  type: "unreadable",
  protocol: "phoenix",
  position: trader.toBase58(),
  reason,
});

/** Pure: value and describe one trader account, or report why it cannot be read. */
export function toPhoenixView(i: PhoenixViewInput): PhoenixStrategyView | UnreadableStrategyView {
  try {
    if (i.state instanceof Error) throw i.state;
    if (i.markets instanceof Error) throw i.markets;
    const markets = i.markets;
    checkTrader(i.vault, i.trader, i.state);
    const equity = computeTraderEquity(i.state.collateral, i.state.positions, markets, i.slot);
    const positions = i.state.positions
      .filter((p) => p.baseLots !== 0n)
      .map((p) => {
        // computeTraderEquity already proved the market exists
        const d = describePosition(p, markets.get(p.assetId)!);
        const assetId = Number(p.assetId);
        return {
          assetId,
          symbol: i.names.get(assetId) ?? `Asset #${assetId}`,
          side: d.side,
          size: d.size,
          entryPrice: d.entryPrice,
          markPrice: d.markPrice,
          notional: d.notional.toString(),
          unrealizedPnl: d.unrealizedPnl.toString(),
          accruedFunding: d.accruedFunding.toString(),
        };
      });
    const notional = positions.reduce((a, p) => a + BigInt(p.notional), 0n);
    return {
      ...i.base,
      type: "phoenix",
      traderAccount: i.trader.toBase58(),
      canonicalMint: i.canonicalMint.toBase58(),
      collateral: i.state.collateral.toString(),
      equity: equity.toString(),
      canonicalBalance: i.canonicalBalance.toString(),
      leverage: equity > 0n ? Number(notional) / Number(equity) : null,
      positions,
    };
  } catch (e) {
    return unreadable(i.base, i.trader, reasonOf(e));
  }
}

/**
 * 1 RPC for the global config + 1 same-slot `getMultipleAccountsInfoAndContext` for the perp asset map,
 * the vault's canonical ATA and every trader. Market names come from their own 10-minute cache.
 * A failure before the per-trader step makes every Phoenix strategy unreadable; nothing here throws.
 */
export async function phoenixViewsFor(
  vault: PublicKey,
  items: { base: Base; trader: PublicKey }[],
): Promise<(PhoenixStrategyView | UnreadableStrategyView)[]> {
  if (items.length === 0) return [];
  const connection = getConnection();
  try {
    const [configInfo, names] = await Promise.all([connection.getAccountInfo(PHOENIX_GLOBAL_CONFIG), getPhoenixMarketNames()]);
    if (!configInfo) throw new PhoenixReadError(`account_missing:${PHOENIX_GLOBAL_CONFIG.toBase58()}`);
    const config = parseGlobalConfig(configInfo);
    // the program creates the canonical ATA with SPL Token
    const canonicalAta = getAssociatedTokenAddressSync(config.canonicalMint, vault, true, TOKEN_PROGRAM_ID);
    const { context, value } = await connection.getMultipleAccountsInfoAndContext([
      config.perpAssetMap,
      canonicalAta,
      ...items.map((i) => i.trader),
    ]);
    const [mapInfo, ataInfo, ...traderInfos] = value;
    const decodeOr = <T>(fn: () => T): T | Error => {
      try {
        return fn();
      } catch (e) {
        return e as Error;
      }
    };
    const markets = mapInfo
      ? decodeOr(() => decodeMarkets(config.perpAssetMap, mapInfo))
      : new PhoenixReadError(`account_missing:${config.perpAssetMap.toBase58()}`);
    return items.map((item, idx) => {
      const info = traderInfos[idx];
      const view = toPhoenixView({
        ...item,
        vault,
        canonicalMint: config.canonicalMint,
        canonicalBalance: decodeTokenAmount(ataInfo),
        state: info ? decodeOr(() => decodeTraderState(item.trader, info)) : new PhoenixReadError(`account_missing:${item.trader.toBase58()}`),
        markets,
        slot: BigInt(context.slot),
        names,
      });
      if (view.type === "unreadable") console.warn(`[strategies] Phoenix trader ${item.trader.toBase58()} unreadable: ${view.reason}`);
      return view;
    });
  } catch (e) {
    console.warn(`[strategies] Phoenix accounts unavailable: ${reasonOf(e)}`);
    return items.map((i) => unreadable(i.base, i.trader, reasonOf(e)));
  }
}
