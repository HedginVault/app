import "server-only";
import { decodePerpAssetMap, decodeTrader } from "@ellipsis-labs/rise";
import { PublicKey, type AccountInfo, type AccountMeta } from "@solana/web3.js";
import { cached, setCached } from "./cache";
import type { PhoenixMarketCategory } from "@/lib/types";

// Ported from hedgin_keeper/src/valuation/phoenix.ts; keep the two in step when either changes.

export const PHOENIX_PROGRAM_ID = new PublicKey("EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih");
export const PHOENIX_GLOBAL_CONFIG = new PublicKey("2zskx2iyCvb6Stg7RBZkt1f6MrF4dpYtMG3yMvKwqtUZ");
/** Phoenix strategies only run on USDC vaults (`InvalidPhoenixDepositMint`). */
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// `sha256("account:<name>")[..8]`
const GLOBAL_CONFIG_DISCRIMINATOR = Buffer.from([37, 146, 212, 210, 47, 136, 111, 20]);
const TRADER_DISCRIMINATOR = Buffer.from([41, 97, 73, 105, 110, 214, 112, 9]);
const GLOBAL_CONFIG_LEN = 776;
/** An open position's mark must have been set within this many slots (~10 min) of the read. */
export const MAX_MARK_AGE_SLOTS = 1_500n;

/** A Phoenix account that cannot be valued; the message is the keeper's reason string. */
export class PhoenixReadError extends Error {}

export interface PhoenixGlobalConfig {
  canonicalMint: PublicKey;
  globalVault: PublicKey;
  perpAssetMap: PublicKey;
  globalTraderIndex: PublicKey;
  activeTraderBuffer: PublicKey;
  withdrawQueue: PublicKey;
}

export interface PhoenixPosition {
  assetId: bigint;
  baseLots: bigint;
  virtualQuoteLots: bigint;
  fundingSnapshot: bigint;
}

export interface PhoenixMarket {
  /** `oraclePrice.markPrice.price.ticks`, the mark Hawkeye uses. */
  markTicks: bigint;
  markSlot: bigint;
  tickSize: bigint;
  cumulativeFundingRate: bigint;
  /** Base lots per whole base unit, as a power of ten; may be negative. */
  baseLotDecimals: number;
}

export interface PhoenixTraderState {
  authority: PublicKey;
  pdaIndex: number;
  subaccountIndex: number;
  collateral: bigint;
  positions: PhoenixPosition[];
  nativeSolLamports: bigint;
  splineMarkets: number;
  /** A `phoenix_withdraw_funds` queued and not yet delivered; mirrors the program's `withdraw_queue_node == 0` check. */
  withdrawQueued: boolean;
}

const decodeError = (key: PublicKey) => new PhoenixReadError(`phoenix_decode:${key.toBase58()}`);
const isPhoenix = (info: AccountInfo<Buffer>, discriminator?: Buffer) =>
  info.owner.equals(PHOENIX_PROGRAM_ID) && (!discriminator || info.data.subarray(0, 8).equals(discriminator));
const readKey = (data: Buffer, offset: number) => new PublicKey(data.subarray(offset, offset + 32));

export function parseGlobalConfig(info: AccountInfo<Buffer>): PhoenixGlobalConfig {
  if (!isPhoenix(info, GLOBAL_CONFIG_DISCRIMINATOR) || info.data.length < GLOBAL_CONFIG_LEN) throw decodeError(PHOENIX_GLOBAL_CONFIG);
  return {
    canonicalMint: readKey(info.data, 296),
    globalVault: readKey(info.data, 328),
    perpAssetMap: readKey(info.data, 360),
    globalTraderIndex: readKey(info.data, 392),
    activeTraderBuffer: readKey(info.data, 424),
    withdrawQueue: readKey(info.data, 472),
  };
}

const findPhoenixPda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PHOENIX_PROGRAM_ID)[0];

/** The cross-margin trader `(0, 0)` the program registers for a vault. */
export const getPhoenixTraderAddress = (vault: PublicKey) =>
  findPhoenixPda([Buffer.from("trader"), vault.toBuffer(), Buffer.from([0, 0])]);

export const getPhoenixSplineAddress = (orderbook: PublicKey) => findPhoenixPda([Buffer.from("spline"), orderbook.toBuffer()]);

/** Capability bits an onboarded trader holds: place market, deposit, withdraw. Mirrors the program's readiness check. */
const TRADER_READY_FLAGS = (1 << 2) | (1 << 4) | (1 << 5);

export const isTraderReady = (info: AccountInfo<Buffer>) =>
  isPhoenix(info, TRADER_DISCRIMINATOR) && info.data.length >= 100 && (info.data.readUInt32LE(96) & TRADER_READY_FLAGS) === TRADER_READY_FLAGS;

export type PhoenixArenaSeed = "global_trader_index" | "active_trader_buffer";

/**
 * A trader index's header followed by its arenas `PDA([seed, [i]])`. The count, header included, is
 * `min(u16@52, u16@54)` of the header; the program validates the same list, so it is never hard-coded.
 */
export function arenaAccounts(header: PublicKey, info: AccountInfo<Buffer>, seed: PhoenixArenaSeed): PublicKey[] {
  if (!isPhoenix(info) || info.data.length < 56) throw decodeError(header);
  const count = Math.min(info.data.readUInt16LE(52), info.data.readUInt16LE(54));
  if (count < 1) throw decodeError(header);
  return [header, ...Array.from({ length: count - 1 }, (_, i) => findPhoenixPda([Buffer.from(seed), Buffer.from([i + 1])]))];
}

/** Remaining accounts of every Phoenix market or collateral CPI: both trader indexes, headers first, all writable. */
export const phoenixTail = (globalTraderIndex: PublicKey[], activeTraderBuffer: PublicKey[]): AccountMeta[] =>
  [...globalTraderIndex, ...activeTraderBuffer].map((pubkey) => ({ pubkey, isSigner: false, isWritable: true }));

export function decodeTraderState(key: PublicKey, info: AccountInfo<Buffer>): PhoenixTraderState {
  if (!isPhoenix(info, TRADER_DISCRIMINATOR)) throw decodeError(key);
  let t: ReturnType<typeof decodeTrader>;
  try {
    t = decodeTrader(info.data);
  } catch {
    throw decodeError(key);
  }
  return {
    authority: new PublicKey(t.authority),
    pdaIndex: t.traderPdaIndex,
    subaccountIndex: t.traderSubaccountIndex,
    collateral: BigInt(t.state.quoteLotCollateral),
    positions: t.positions.entries.map(({ key: assetId, value: p }) => ({
      assetId: BigInt(assetId),
      baseLots: BigInt(p.baseLotPosition),
      virtualQuoteLots: BigInt(p.virtualQuoteLotPosition),
      fundingSnapshot: BigInt(p.cumulativeFundingSnapshot),
    })),
    nativeSolLamports: BigInt(t.nativeSolCollateral),
    splineMarkets: t.numMarketsWithSplines,
    // rise decodes the raw u32 as `getOptionalNonZeroU32Decoder()`: 0 -> null, else the node index.
    withdrawQueued: t.withdrawQueueNode !== null,
  };
}

/** Markets by asset id. */
export function decodeMarkets(key: PublicKey, info: AccountInfo<Buffer>): Map<bigint, PhoenixMarket> {
  if (!isPhoenix(info)) throw decodeError(key);
  try {
    const map = decodePerpAssetMap(info.data);
    return new Map(
      map.metadata.entries.map(({ value: a }) => [
        BigInt(a.staticMarketParams.assetId),
        {
          markTicks: BigInt(a.oraclePrice.markPrice.price.ticks),
          markSlot: BigInt(a.oraclePrice.markPrice.price.slot),
          tickSize: BigInt(a.staticMarketParams.tickSize),
          cumulativeFundingRate: BigInt(a.fundingAccumulator.cumulativeFundingRate),
          baseLotDecimals: a.staticMarketParams.baseLotDecimals,
        },
      ]),
    );
  } catch {
    throw decodeError(key);
  }
}

/** The vault's cross-margin account `(0, 0)`, holding only what the program can put there. */
export function checkTrader(vault: PublicKey, key: PublicKey, t: PhoenixTraderState): void {
  if (!t.authority.equals(vault) || t.pdaIndex !== 0 || t.subaccountIndex !== 0) throw new PhoenixReadError(`phoenix_trader_mismatch:${key.toBase58()}`);
  if (t.nativeSolLamports > 0n) throw new PhoenixReadError(`phoenix_native_sol:${key.toBase58()}`);
  if (t.splineMarkets > 0) throw new PhoenixReadError(`phoenix_splines:${key.toBase58()}`);
}

/**
 * Hawkeye's effective collateral with full uPnL, in quote lots, clamped at 0:
 * collateral + Σ (virtual quote + base × mark × tick size − base × funding rate change since the snapshot).
 */
export function computeTraderEquity(collateral: bigint, positions: PhoenixPosition[], markets: Map<bigint, PhoenixMarket>, slot: bigint): bigint {
  let equity = collateral;
  for (const p of positions) {
    const m = markets.get(p.assetId);
    if (!m) throw new PhoenixReadError(`phoenix_asset_missing:${p.assetId}`);
    if (p.baseLots !== 0n && m.markTicks === 0n) throw new PhoenixReadError(`phoenix_zero_mark:${p.assetId}`);
    if (p.baseLots !== 0n && slot - m.markSlot > MAX_MARK_AGE_SLOTS) throw new PhoenixReadError(`phoenix_stale_mark:${p.assetId}`);
    equity += p.virtualQuoteLots + p.baseLots * m.markTicks * m.tickSize - p.baseLots * (m.cumulativeFundingRate - p.fundingSnapshot);
  }
  return equity > 0n ? equity : 0n;
}

/** One quote lot is one USDC atom. */
const QUOTE_DECIMALS = 6;
/** Fractional digits kept for the entry price, which is a ratio and need not terminate. */
const ENTRY_PRECISION = 12;
const pow10 = (n: number) => 10n ** BigInt(n);
const abs = (n: bigint) => (n < 0n ? -n : n);

/** `raw × 10^-decimals` as an exact decimal string, trailing zeros trimmed; `decimals` may be negative. */
export function scaleDecimal(raw: bigint, decimals: number): string {
  if (decimals <= 0) return (raw * pow10(-decimals)).toString();
  const digits = abs(raw).toString().padStart(decimals + 1, "0");
  const int = digits.slice(0, -decimals);
  const frac = digits.slice(-decimals).replace(/0+$/, "");
  return `${raw < 0n ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

export interface PhoenixPositionDetail {
  side: "long" | "short";
  /** Whole base units, decimal string, always positive. */
  size: string;
  /** USDC per base unit, decimal strings. */
  entryPrice: string;
  markPrice: string;
  /** USDC atoms. */
  notional: bigint;
  unrealizedPnl: bigint;
  accruedFunding: bigint;
}

/**
 * Display fields for one position; pure. uPnL + funding sum to the position's term in `computeTraderEquity`.
 * Price in USDC = quote lots per base lot × 10^baseLotDecimals / 10^6.
 */
export function describePosition(p: PhoenixPosition, m: PhoenixMarket): PhoenixPositionDetail {
  const markLots = m.markTicks * m.tickSize; // quote lots per base lot
  const priceDecimals = QUOTE_DECIMALS - m.baseLotDecimals;
  // entry = −virtualQuote / base quote lots per base lot, scaled like the mark
  const num = -p.virtualQuoteLots * pow10(Math.max(0, -priceDecimals) + ENTRY_PRECISION);
  const den = p.baseLots * pow10(Math.max(0, priceDecimals));
  return {
    side: p.baseLots < 0n ? "short" : "long",
    size: scaleDecimal(abs(p.baseLots), m.baseLotDecimals),
    entryPrice: p.baseLots === 0n ? "0" : scaleDecimal(num / den, ENTRY_PRECISION),
    markPrice: scaleDecimal(markLots, priceDecimals),
    notional: abs(p.baseLots) * markLots,
    unrealizedPnl: p.virtualQuoteLots + p.baseLots * markLots,
    accruedFunding: -p.baseLots * (m.cumulativeFundingRate - p.fundingSnapshot),
  };
}

export const PHOENIX_API_URL = "https://perp-api.phoenix.trade";
const MARKETS_TTL = 10 * 60_000;
/** How long a failed fetch's empty list is served before the next call retries the API. */
const MARKETS_FAILURE_TTL = 60_000;
const MARKETS_CACHE_KEY = "phoenix:markets";

export interface PhoenixMarketMeta {
  symbol: string;
  assetId: number;
  marketPubkey: string;
  tickSize: number;
  baseLotsDecimals: number;
  takerFee: number;
  makerFee: number;
  marketStatus: string;
  /** Tradable only from an isolated subaccount; the vault's cross-margin trader cannot open these. */
  isolatedOnly: boolean;
  name: string;
  category: PhoenixMarketCategory;
  logoUri: string | null;
  /** Brand color from Phoenix's market metadata, e.g. "#9945FF". */
  color: string | null;
  /** Leverage of the first (smallest) size tier; initial margin is 1 / maxLeverage of notional. */
  maxLeverage: number;
  /** Maintenance margin as a fraction of initial margin (Phoenix `riskFactors.maintenanceBps`). */
  maintenanceFactor: number;
}

interface RawMarket {
  symbol: string;
  assetId: number;
  marketPubkey: string;
  tickSize: number;
  baseLotsDecimals: number;
  takerFee: number;
  makerFee: number;
  marketStatus: string;
  isolatedOnly: boolean;
  metadata?: { name?: string; logoUri?: string | null; displayColor?: string | null; calendar?: { id?: string } | null } | null;
  leverageTiers?: { maxLeverage: number }[];
  riskFactors?: { maintenanceBps?: number };
}

/**
 * Asset class from the market's trading-hours calendar ("cme_commodities", "us_equities_extended");
 * crypto markets trade around the clock and carry none. Pure.
 */
export function marketCategory(calendarId: string | null | undefined): PhoenixMarketCategory {
  if (calendarId?.includes("commodit")) return "commodities";
  if (calendarId?.includes("equit")) return "equities";
  return "crypto";
}

async function fetchMarkets(): Promise<PhoenixMarketMeta[]> {
  const res = await fetch(`${PHOENIX_API_URL}/v1/view/exchange/markets`, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as RawMarket[];
  return rows.map((r) => ({
    symbol: r.symbol,
    assetId: r.assetId,
    marketPubkey: r.marketPubkey,
    tickSize: r.tickSize,
    baseLotsDecimals: r.baseLotsDecimals,
    takerFee: r.takerFee,
    makerFee: r.makerFee,
    marketStatus: r.marketStatus,
    isolatedOnly: r.isolatedOnly,
    name: r.metadata?.name ?? r.symbol,
    category: marketCategory(r.metadata?.calendar?.id),
    logoUri: r.metadata?.logoUri ?? null,
    color: r.metadata?.displayColor ?? null,
    maxLeverage: r.leverageTiers?.[0]?.maxLeverage ?? 1,
    maintenanceFactor: (r.riskFactors?.maintenanceBps ?? 5_000) / 10_000,
  }));
}

/**
 * Every Phoenix market's static parameters. A failure caches an empty list for a minute, so a hanging
 * or down perp-api adds its timeout to one read instead of every uncached one; build paths treat an
 * empty list as the API being unavailable.
 */
export async function getPhoenixMarkets(): Promise<PhoenixMarketMeta[]> {
  try {
    return await cached(MARKETS_CACHE_KEY, MARKETS_TTL, fetchMarkets);
  } catch (e) {
    console.warn(`[phoenix] markets unavailable: ${(e as Error).message}`);
    setCached(MARKETS_CACHE_KEY, [], MARKETS_FAILURE_TTL);
    return [];
  }
}

/** Symbols by asset id, for display only. */
export async function getPhoenixMarketNames(): Promise<Map<number, string>> {
  return new Map((await getPhoenixMarkets()).map((m) => [m.assetId, m.symbol]));
}
