import type { Program } from "@coral-xyz/anchor";
import { baseUnitsToBaseLotsWithMarketParams, priceUsdToTicksWithMarketParams } from "@ellipsis-labs/rise";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  PACKET_DATA_SIZE,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type AccountMeta,
} from "@solana/web3.js";
import BN from "bn.js";
import type { HedgeVault } from "@/idl/hedge_vault";
import type { BuiltTransaction } from "@/lib/types";
import { ApiError } from "../errors";
import { getConfigPda, getStrategyPda } from "../pda";
import {
  arenaAccounts,
  decodeMarkets,
  getPhoenixMarkets,
  getPhoenixSplineAddress,
  getPhoenixTraderAddress,
  parseGlobalConfig,
  PHOENIX_API_URL,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_PROGRAM_ID,
  phoenixTail,
  type PhoenixGlobalConfig,
  type PhoenixMarketMeta,
  USDC_MINT,
} from "../phoenix";
import { getConnection, TOKEN_PROGRAM_ID } from "../program";
import type { VaultCtx } from "./context";

type P = Program<HedgeVault>;

const MAX_POSITIONS = 128;

export interface PhoenixExchange extends PhoenixGlobalConfig {
  /** Both trader indexes, headers first, writable: the remaining accounts of every market or collateral CPI. */
  tail: AccountMeta[];
}

const unavailable = (message: string) => new ApiError(502, "PhoenixUnavailable", message);

/** 2 RPC: the global configuration, then both trader-index headers for the dynamic tail. */
export async function loadPhoenixExchange(): Promise<PhoenixExchange> {
  const connection = getConnection();
  const info = await connection.getAccountInfo(PHOENIX_GLOBAL_CONFIG);
  if (!info) throw unavailable("Phoenix global config not found");
  try {
    const config = parseGlobalConfig(info);
    const [gti, atb] = await connection.getMultipleAccountsInfo([config.globalTraderIndex, config.activeTraderBuffer]);
    if (!gti || !atb) throw unavailable("Phoenix trader index not found");
    return {
      ...config,
      tail: phoenixTail(
        arenaAccounts(config.globalTraderIndex, gti, "global_trader_index"),
        arenaAccounts(config.activeTraderBuffer, atb, "active_trader_buffer"),
      ),
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw unavailable(`Phoenix exchange accounts unreadable: ${(e as Error).message}`);
  }
}

/** A market's static parameters by symbol; an empty list means perp-api is down. */
export async function resolvePhoenixMarket(symbol: string): Promise<PhoenixMarketMeta> {
  const markets = await getPhoenixMarkets();
  if (markets.length === 0) throw unavailable("Phoenix markets unavailable");
  const market = markets.find((m) => m.symbol === symbol);
  if (!market) throw new ApiError(400, "Validation", `Unknown Phoenix market ${symbol}`);
  return market;
}

/** 1 RPC: the market's current mark in ticks, from the perp asset map the order CPI reads. */
export async function loadMarkTicks(ex: PhoenixExchange, assetId: number): Promise<bigint> {
  const info = await getConnection().getAccountInfo(ex.perpAssetMap);
  if (!info) throw unavailable("Phoenix perp asset map not found");
  let mark: bigint | undefined;
  try {
    mark = decodeMarkets(ex.perpAssetMap, info).get(BigInt(assetId))?.markTicks;
  } catch (e) {
    throw unavailable((e as Error).message);
  }
  if (!mark) throw new ApiError(422, "PhoenixNoMark", "Market has no mark price");
  return mark;
}

const vaultAta = (mint: PublicKey, vault: PublicKey) => getAssociatedTokenAddressSync(mint, vault, true, TOKEN_PROGRAM_ID);

/** Accounts every Phoenix strategy instruction shares. */
function common(ctx: VaultCtx, authority: PublicKey) {
  const traderAccount = getPhoenixTraderAddress(ctx.key);
  return { authority, config: getConfigPda(), vault: ctx.key, strategy: getStrategyPda(ctx.key, traderAccount), traderAccount };
}

/** Registers the vault's trader if it does not exist yet and records the strategy. No tail. */
export const phoenixInitializeIx = (program: P, ctx: VaultCtx, authority: PublicKey, ex: Pick<PhoenixExchange, "canonicalMint">) =>
  program.methods
    .phoenixInitializeStrategy()
    .accountsPartial({
      ...common(ctx, authority),
      canonicalMint: ex.canonicalMint,
      vaultCanonicalTokenAccount: vaultAta(ex.canonicalMint, ctx.key),
    })
    .instruction();

const collateralAccounts = (ctx: VaultCtx, authority: PublicKey, ex: PhoenixExchange) => ({
  ...common(ctx, authority),
  usdcMint: USDC_MINT,
  canonicalMint: ex.canonicalMint,
  vaultUsdcTokenAccount: vaultAta(USDC_MINT, ctx.key),
  vaultCanonicalTokenAccount: vaultAta(ex.canonicalMint, ctx.key),
  globalVault: ex.globalVault,
});

/** Wraps idle USDC through Ember and deposits it as trader collateral. */
export const phoenixDepositIx = (program: P, ctx: VaultCtx, authority: PublicKey, ex: PhoenixExchange, amount: BN) =>
  program.methods
    .phoenixDepositFunds(amount)
    .accountsPartial(collateralAccounts(ctx, authority, ex))
    .remainingAccounts(ex.tail)
    .instruction();

/** Withdraws collateral; Phoenix either pays it out now (unwrapped to USDC) or queues all of it. */
export const phoenixWithdrawIx = (program: P, ctx: VaultCtx, authority: PublicKey, ex: PhoenixExchange, amount: BN) =>
  program.methods
    .phoenixWithdrawFunds(amount)
    .accountsPartial({ ...collateralAccounts(ctx, authority, ex), perpAssetMap: ex.perpAssetMap, withdrawQueue: ex.withdrawQueue })
    .remainingAccounts(ex.tail)
    .instruction();

/** Unwraps canonical tokens a queued withdrawal delivered later into USDC. No trader, no tail. */
export function phoenixEmberWithdrawIx(program: P, ctx: VaultCtx, authority: PublicKey, ex: Pick<PhoenixExchange, "canonicalMint">) {
  const { config, vault, strategy } = common(ctx, authority);
  return program.methods
    .phoenixEmberWithdraw()
    .accountsPartial({
      authority,
      config,
      vault,
      strategy,
      usdcMint: USDC_MINT,
      canonicalMint: ex.canonicalMint,
      vaultUsdcTokenAccount: vaultAta(USDC_MINT, ctx.key),
      vaultCanonicalTokenAccount: vaultAta(ex.canonicalMint, ctx.key),
    })
    .instruction();
}

export interface PhoenixOrderInput {
  side: "long" | "short";
  type: "market" | "limit";
  /** Whole base units, decimal string. */
  size: string;
  /** Limit price in USD, decimal string; limit orders only. */
  price?: string;
  /** Worst accepted move from the mark; market orders only. */
  slippageBps?: number;
  postOnly?: boolean;
  reduceOnly: boolean;
}

type Empty = Record<string, never>;
const sideArg = (side: PhoenixOrderInput["side"]) => (side === "long" ? { bid: {} as Empty } : { ask: {} as Empty });

/**
 * Converts a ticket into program order parameters; pure. Sizes and prices go through the SDK's exact
 * decimal conversions (sizes floor to lots, prices floor to ticks). A market order is capped at the
 * mark ± `slippageBps`, rounded against the trader, and must fill in full (`min_base_lots_to_fill`).
 */
export function toOrderParams(
  o: PhoenixOrderInput,
  market: Pick<PhoenixMarketMeta, "tickSize" | "baseLotsDecimals">,
  markTicks: bigint,
  clientOrderId: bigint,
) {
  const numBaseLots = BigInt(baseUnitsToBaseLotsWithMarketParams(o.size, market));
  if (numBaseLots <= 0n) throw new ApiError(400, "Validation", "size: below one base lot");
  const shared = {
    side: sideArg(o.side),
    numBaseLots: new BN(numBaseLots.toString()),
    matchLimit: null,
    clientOrderId: new BN(clientOrderId.toString()),
    lastValidSlot: null,
    reduceOnly: o.reduceOnly,
    cancelExisting: false,
  };
  if (o.type === "limit") {
    if (!o.price) throw new ApiError(400, "Validation", "price: required for a limit order");
    const priceInTicks = BigInt(priceUsdToTicksWithMarketParams(o.price, market));
    if (priceInTicks <= 0n) throw new ApiError(400, "Validation", "price: below one tick");
    return {
      kind: "limit" as const,
      params: {
        ...shared,
        priceInTicks: new BN(priceInTicks.toString()),
        postOnly: o.postOnly ?? false,
        slide: false,
        selfTradeBehavior: { cancelProvide: {} as Empty },
      },
    };
  }
  const bps = BigInt(o.slippageBps ?? 0);
  const limit = o.side === "long" ? (markTicks * (10_000n + bps) + 9_999n) / 10_000n : (markTicks * (10_000n - bps)) / 10_000n;
  return {
    kind: "market" as const,
    params: {
      ...shared,
      priceInTicks: new BN((limit > 0n ? limit : 1n).toString()),
      numQuoteLots: null,
      minBaseLotsToFill: new BN(numBaseLots.toString()),
      minQuoteLotsToFill: new BN(0),
      selfTradeBehavior: { abort: {} as Empty },
    },
  };
}

const marketAccounts = (ctx: VaultCtx, authority: PublicKey, ex: PhoenixExchange, orderbook: PublicKey) => ({
  ...common(ctx, authority),
  perpAssetMap: ex.perpAssetMap,
  orderbook,
  splineCollection: getPhoenixSplineAddress(orderbook),
});

export function phoenixOrderIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  ex: PhoenixExchange,
  orderbook: PublicKey,
  order: ReturnType<typeof toOrderParams>,
) {
  const accounts = marketAccounts(ctx, authority, ex, orderbook);
  const method =
    order.kind === "market" ? program.methods.phoenixPlaceMarketOrder(order.params) : program.methods.phoenixPlaceLimitOrder(order.params);
  return method.accountsPartial(accounts).remainingAccounts(ex.tail).instruction();
}

export interface PhoenixCancelOrder {
  priceInTicks: string;
  orderSequenceNumber: string;
}

/** Cancels every resting order on the market, or the listed ones; Phoenix finds each order by price and sequence number. */
export function phoenixCancelIx(
  program: P,
  ctx: VaultCtx,
  authority: PublicKey,
  ex: PhoenixExchange,
  orderbook: PublicKey,
  orders: PhoenixCancelOrder[] | "all",
) {
  const mode =
    orders === "all"
      ? { all: {} as Empty }
      : {
          byId: {
            orders: orders.map((o) => ({
              // 0 is `None`: Phoenix locates the order itself.
              nodePointer: 0,
              priceInTicks: new BN(o.priceInTicks),
              orderSequenceNumber: new BN(o.orderSequenceNumber),
            })),
          },
        };
  return program.methods
    .phoenixCancelOrders(mode)
    .accountsPartial(marketAccounts(ctx, authority, ex, orderbook))
    .remainingAccounts(ex.tail)
    .instruction();
}

async function postPhoenix<T>(path: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PHOENIX_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw unavailable(`Phoenix API unreachable: ${(e as Error).message}`);
  }
  if (!res.ok) throw new ApiError(502, "PhoenixApi", `Phoenix ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

interface RegisterIxs {
  instructions: { programId: string; data: number[]; keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[] }[];
}

/**
 * Phoenix's onboarding transaction for the vault's trader (Path A): the API returns `OnboardTraderDelegated`
 * (plus `RegisterTrader` if the account does not exist yet), signed later by Phoenix's onboarder. The manager
 * signs only as fee payer. Not simulated: the onboarder's signature is still missing.
 */
export async function buildPhoenixOnboardTx(vault: PublicKey, payer: PublicKey): Promise<BuiltTransaction> {
  const built = await postPhoenix<RegisterIxs>("/v1/exchange/build-register-ixs", {
    traderAuthority: vault.toBase58(),
    txFeePayer: payer.toBase58(),
    maxPositions: MAX_POSITIONS,
  });
  const instructions = built.instructions.map((ix) => {
    const programId = new PublicKey(ix.programId);
    if (!programId.equals(PHOENIX_PROGRAM_ID)) throw new ApiError(502, "PhoenixApi", `Unexpected program ${ix.programId} in onboarding`);
    return new TransactionInstruction({
      programId,
      keys: ix.keys.map((k) => ({ pubkey: new PublicKey(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })),
      data: Buffer.from(ix.data),
    });
  });
  if (instructions.length === 0) throw new ApiError(502, "PhoenixApi", "Phoenix returned no onboarding instructions");
  const { blockhash } = await getConnection().getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions }).compileToV0Message());
  return { transaction: Buffer.from(tx.serialize()).toString("base64"), simulation: { unitsConsumed: 0, deferred: true } };
}

/**
 * Forwards the manager-signed onboarding transaction to Phoenix, which co-signs and sends it. Refuses
 * anything but a Phoenix-only transaction paid and signed by the manager, so this cannot relay other
 * transactions.
 */
export async function submitPhoenixOnboardTx(base64: string, vault: PublicKey, payer: PublicKey): Promise<{ signature: string }> {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > PACKET_DATA_SIZE) throw new ApiError(400, "Validation", "transaction: invalid size");
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(bytes);
  } catch {
    throw new ApiError(400, "Validation", "transaction: not a serialized transaction");
  }
  const { staticAccountKeys, compiledInstructions } = tx.message;
  if (!staticAccountKeys[0]?.equals(payer)) throw new ApiError(400, "Validation", "transaction: fee payer is not the connected wallet");
  if (tx.signatures[0].every((b) => b === 0)) throw new ApiError(400, "Validation", "transaction: missing fee payer signature");
  if (compiledInstructions.length === 0 || compiledInstructions.some((ix) => !staticAccountKeys[ix.programIdIndex]?.equals(PHOENIX_PROGRAM_ID)))
    throw new ApiError(400, "Validation", "transaction: must only invoke the Phoenix program");
  const sent = await postPhoenix<{ signature: string }>("/v1/exchange/send-register-ixs", {
    transaction: base64,
    traderAuthority: vault.toBase58(),
    txFeePayer: payer.toBase58(),
    maxPositions: MAX_POSITIONS,
    traderPdaIndex: 0,
    traderSubaccountIndex: 0,
  });
  return { signature: sent.signature };
}
