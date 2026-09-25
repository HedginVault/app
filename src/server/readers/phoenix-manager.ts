import "server-only";
import { priceUsdToTicksWithMarketParams } from "@ellipsis-labs/rise";
import type { PublicKey } from "@solana/web3.js";
import type { PhoenixAccountView, PhoenixManagerView, PhoenixMarketView, PhoenixOpenOrderView } from "@/lib/types";
import { cached } from "../cache";
import { ApiError } from "../errors";
import { getStrategyPda } from "../pda";
import {
  decodeMarkets,
  getPhoenixMarkets,
  getPhoenixTraderAddress,
  isTraderReady,
  parseGlobalConfig,
  PHOENIX_API_URL,
  PHOENIX_GLOBAL_CONFIG,
  scaleDecimal,
  type PhoenixMarket,
  type PhoenixMarketMeta,
  USDC_MINT,
} from "../phoenix";
import { getConnection } from "../program";
import { fetchVaultAccount } from "./vaults";

const TTL = 10_000;

interface ApiAmount { value: number; ui: string }
interface ApiLimitOrder {
  price: ApiAmount;
  side: "bid" | "ask";
  orderSequenceNumber: string;
  tradeSizeRemaining: ApiAmount;
  isReduceOnly: boolean;
  isStopLoss?: boolean;
  isConditionalOrder?: boolean;
}
/** The fields of perp-api's `TraderView` this card reads. */
export interface ApiTraderView {
  collateralBalance: ApiAmount;
  effectiveCollateral: ApiAmount;
  initialMargin: ApiAmount;
  maintenanceMargin: ApiAmount;
  withdrawableQuoteCollateral: ApiAmount;
  riskState: string;
  positions: { symbol: string; liquidationPrice: ApiAmount | null }[];
  limitOrders: Record<string, ApiLimitOrder[]>;
}

/** Margin summary; pure. */
export const toAccountView = (t: ApiTraderView): PhoenixAccountView => ({
  collateral: String(t.collateralBalance.value),
  equity: String(t.effectiveCollateral.value),
  initialMargin: String(t.initialMargin.value),
  maintenanceMargin: String(t.maintenanceMargin.value),
  withdrawable: String(t.withdrawableQuoteCollateral.value),
  riskState: t.riskState,
  liquidationPrices: Object.fromEntries(
    t.positions.filter((p) => p.liquidationPrice && Number(p.liquidationPrice.ui) > 0).map((p) => [p.symbol, p.liquidationPrice!.ui]),
  ),
});

/** Tradable markets with their live mark; pure. Isolated-only and inactive markets are left out. */
export function toMarketViews(metas: PhoenixMarketMeta[], marks: Map<bigint, PhoenixMarket>): PhoenixMarketView[] {
  return metas
    .filter((m) => m.marketStatus === "active" && !m.isolatedOnly)
    .map((m) => {
      const mark = marks.get(BigInt(m.assetId));
      return {
        symbol: m.symbol,
        name: m.name,
        category: m.category,
        logoUri: m.logoUri,
        color: m.color,
        maxLeverage: m.maxLeverage,
        maintenanceFactor: m.maintenanceFactor,
        // quote lots per base lot = ticks × tick size; USD = that × 10^(baseLotDecimals − 6)
        markPrice: mark ? scaleDecimal(mark.markTicks * mark.tickSize, 6 - mark.baseLotDecimals) : "0",
        tickSize: m.tickSize,
        baseLotsDecimals: m.baseLotsDecimals,
        takerFee: m.takerFee,
        makerFee: m.makerFee,
      };
    })
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/**
 * Resting limit orders with the tick price a by-id cancel needs; pure. Stop-loss and conditional
 * orders are left out: the program's cancel instruction does not reach them.
 */
export function toOpenOrders(trader: ApiTraderView, metas: PhoenixMarketMeta[]): PhoenixOpenOrderView[] {
  const bySymbol = new Map(metas.map((m) => [m.symbol, m]));
  return Object.entries(trader.limitOrders ?? {}).flatMap(([symbol, orders]) => {
    const meta = bySymbol.get(symbol);
    if (!meta) return [];
    return orders
      .filter((o) => !o.isStopLoss && !o.isConditionalOrder)
      .map((o) => ({
        symbol,
        side: o.side === "bid" ? ("long" as const) : ("short" as const),
        price: o.price.ui,
        size: o.tradeSizeRemaining.ui,
        priceInTicks: priceUsdToTicksWithMarketParams(o.price.ui, meta).toString(),
        orderSequenceNumber: o.orderSequenceNumber,
        reduceOnly: o.isReduceOnly,
      }));
  });
}

async function fetchTraderView(trader: PublicKey): Promise<ApiTraderView | null> {
  try {
    const res = await fetch(`${PHOENIX_API_URL}/v1/view/trader/${trader.toBase58()}`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ApiTraderView;
  } catch (e) {
    console.warn(`[phoenix] trader view unavailable: ${(e as Error).message}`);
    return null;
  }
}

/** 3 RPC plus perp-api: strategy and onboarding status, tradable markets, open orders and withdrawable collateral. */
export const readPhoenixManager = (address: string) =>
  cached(`phoenix-manager:${address}`, TTL, async (): Promise<PhoenixManagerView> => {
    const { key: vault, account } = await fetchVaultAccount(address);
    const trader = getPhoenixTraderAddress(vault);
    const connection = getConnection();
    const [configInfo, metas] = await Promise.all([connection.getAccountInfo(PHOENIX_GLOBAL_CONFIG), getPhoenixMarkets()]);
    if (!configInfo) throw new ApiError(502, "PhoenixUnavailable", "Phoenix global config not found");
    const { perpAssetMap } = parseGlobalConfig(configInfo);
    const [strategyInfo, traderInfo, mapInfo] = await connection.getMultipleAccountsInfo([
      getStrategyPda(vault, trader),
      trader,
      perpAssetMap,
    ]);
    const status = !strategyInfo ? "none" : traderInfo && isTraderReady(traderInfo) ? "ready" : "registered";
    const view = status === "ready" ? await fetchTraderView(trader) : null;
    return {
      status,
      usdcVault: account.depositMint.equals(USDC_MINT),
      traderAccount: trader.toBase58(),
      markets: toMarketViews(metas, mapInfo ? decodeMarkets(perpAssetMap, mapInfo) : new Map()),
      openOrders: status !== "ready" ? [] : view ? toOpenOrders(view, metas) : null,
      withdrawable: status !== "ready" ? "0" : view ? String(view.withdrawableQuoteCollateral.value) : null,
      account: view ? toAccountView(view) : null,
    };
  });
