import "server-only";
import { decodePerpAssetMap, decodeTrader } from "@ellipsis-labs/rise";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { cached } from "./cache";

// Ported from hedgin_keeper/src/valuation/phoenix.ts; keep the two in step when either changes.

export const PHOENIX_PROGRAM_ID = new PublicKey("EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih");
export const PHOENIX_GLOBAL_CONFIG = new PublicKey("2zskx2iyCvb6Stg7RBZkt1f6MrF4dpYtMG3yMvKwqtUZ");

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
  perpAssetMap: PublicKey;
  globalTraderIndex: PublicKey;
  activeTraderBuffer: PublicKey;
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
    perpAssetMap: readKey(info.data, 360),
    globalTraderIndex: readKey(info.data, 392),
    activeTraderBuffer: readKey(info.data, 424),
  };
}

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

const PHOENIX_API_URL = "https://perp-api.phoenix.trade";
const MARKET_NAMES_TTL = 10 * 60_000;

async function fetchMarketNames(): Promise<Map<number, string>> {
  const res = await fetch(`${PHOENIX_API_URL}/v1/view/exchange/markets`, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { symbol: string; assetId: number }[];
  return new Map(rows.map((r) => [r.assetId, r.symbol]));
}

/** Symbols by asset id, for display only. A failure is not cached, and yields an empty map. */
export async function getPhoenixMarketNames(): Promise<Map<number, string>> {
  try {
    return await cached("phoenix:markets", MARKET_NAMES_TTL, fetchMarketNames);
  } catch (e) {
    console.warn(`[phoenix] market names unavailable: ${(e as Error).message}`);
    return new Map();
  }
}
