import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfigPda, getStrategyPda } from "@/server/pda";
import {
  getPhoenixSplineAddress,
  getPhoenixTraderAddress,
  PHOENIX_GLOBAL_CONFIG,
  PHOENIX_PROGRAM_ID,
  USDC_MINT,
} from "@/server/phoenix";
import { getConnection, getProgram, TOKEN_PROGRAM_ID } from "@/server/program";
import { toAccountView, toMarketViews, toOpenOrders } from "@/server/readers/phoenix-manager";
import type { VaultCtx } from "@/server/tx/context";
import {
  loadPhoenixExchange,
  phoenixCancelIx,
  phoenixDepositIx,
  phoenixEmberWithdrawIx,
  phoenixInitializeIx,
  phoenixOrderIx,
  phoenixWithdrawIx,
  submitPhoenixOnboardTx,
  toOrderParams,
  type PhoenixExchange,
} from "@/server/tx/phoenix";

const pk = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const ctx = {
  key: pk(1),
  account: {} as VaultCtx["account"],
  depositMint: USDC_MINT,
  tokenProgram: TOKEN_PROGRAM_ID,
  shareMint: pk(3),
} satisfies VaultCtx;
const authority = pk(5);
const trader = getPhoenixTraderAddress(ctx.key);
const strategy = getStrategyPda(ctx.key, trader);
const ata = (mint: PublicKey) => getAssociatedTokenAddressSync(mint, ctx.key, true, TOKEN_PROGRAM_ID);
const find = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PHOENIX_PROGRAM_ID)[0];

const HAWKEYE = new PublicKey("RiSeVw3ZjNfsaXPRb4mgaqYaEEt41pNNJoDvVh7pgQj");
const LOG_AUTHORITY = new PublicKey("GdxfTLSsdSY37G6fZoYtdGDSfgFnbT2EmRpuePZxWShS");
const EMBER_STATE = new PublicKey("6ur7v6AXNpnHeEb6xuk7PyezvZ1i5GrgYyWZkNCpzbRz");
const EMBER_VAULT = new PublicKey("FKcEb4TdPDTRuMnQDpSEPQBcrm15S73xiUD6Qf8ZLUkq");
const EMBER_PROGRAM = new PublicKey("EMBERpYNE6ehWmXymZZS2skiFmCa9V5dp14e1iduM5qy");

const ex: PhoenixExchange = {
  canonicalMint: pk(20),
  globalVault: pk(21),
  perpAssetMap: pk(22),
  globalTraderIndex: pk(23),
  activeTraderBuffer: pk(24),
  withdrawQueue: pk(25),
  tail: [pk(23), pk(26), pk(24)].map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })),
};
const orderbook = pk(30);

const keys = (ix: { keys: { pubkey: PublicKey }[] }) => ix.keys.map((k) => k.pubkey.toBase58());
const b58 = (...ks: PublicKey[]) => ks.map((k) => k.toBase58());
const tail = b58(pk(23), pk(26), pk(24));

afterEach(() => vi.restoreAllMocks());

describe("loadPhoenixExchange", () => {
  const info = (data: Buffer) => ({ data, owner: PHOENIX_PROGRAM_ID, lamports: 1, executable: false });
  const globalConfig = () => {
    const data = Buffer.alloc(776);
    Buffer.from([37, 146, 212, 210, 47, 136, 111, 20]).copy(data);
    [ex.canonicalMint, ex.globalVault, ex.perpAssetMap, ex.globalTraderIndex, ex.activeTraderBuffer, ex.withdrawQueue].forEach((k, i) =>
      k.toBuffer().copy(data, [296, 328, 360, 392, 424, 472][i]),
    );
    return info(data);
  };
  const header = (a: number, b: number) => {
    const data = Buffer.alloc(64);
    data.writeUInt16LE(a, 52);
    data.writeUInt16LE(b, 54);
    return info(data);
  };

  it("reads the exchange accounts and builds the tail from each header's arena count", async () => {
    vi.spyOn(getConnection(), "getAccountInfo").mockResolvedValue(globalConfig());
    // GTI: min(3, 4) = header + 2 arenas; ATB: min(2, 1) = header only
    vi.spyOn(getConnection(), "getMultipleAccountsInfo").mockResolvedValue([header(3, 4), header(2, 1)]);
    const loaded = await loadPhoenixExchange();
    expect(loaded).toMatchObject({ canonicalMint: ex.canonicalMint, globalVault: ex.globalVault, withdrawQueue: ex.withdrawQueue });
    expect(loaded.tail.map((m) => m.pubkey.toBase58())).toEqual(
      b58(
        ex.globalTraderIndex,
        find([Buffer.from("global_trader_index"), Buffer.from([1])]),
        find([Buffer.from("global_trader_index"), Buffer.from([2])]),
        ex.activeTraderBuffer,
      ),
    );
    expect(loaded.tail.every((m) => m.isWritable && !m.isSigner)).toBe(true);
  });

  it("fails with 502 when the global config or a header is missing", async () => {
    vi.spyOn(getConnection(), "getAccountInfo").mockResolvedValue(null);
    await expect(loadPhoenixExchange()).rejects.toMatchObject({ status: 502 });

    vi.spyOn(getConnection(), "getAccountInfo").mockResolvedValue(globalConfig());
    vi.spyOn(getConnection(), "getMultipleAccountsInfo").mockResolvedValue([header(1, 1), null]);
    await expect(loadPhoenixExchange()).rejects.toMatchObject({ status: 502 });
  });

  it("fails with 502 on a header with no entries", async () => {
    vi.spyOn(getConnection(), "getAccountInfo").mockResolvedValue(globalConfig());
    vi.spyOn(getConnection(), "getMultipleAccountsInfo").mockResolvedValue([header(0, 3), header(1, 1)]);
    await expect(loadPhoenixExchange()).rejects.toMatchObject({ status: 502 });
  });
});

describe("Phoenix builders pass the accounts the IDL orders", () => {
  const program = getProgram();

  it("initialize", async () => {
    const ix = await phoenixInitializeIx(program, ctx, authority, ex);
    expect(keys(ix)).toEqual([
      ...b58(authority, getConfigPda(), ctx.key, strategy, trader, ex.canonicalMint, ata(ex.canonicalMint)),
      ...b58(PHOENIX_GLOBAL_CONFIG, LOG_AUTHORITY, PHOENIX_PROGRAM_ID, TOKEN_PROGRAM_ID),
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      SystemProgram.programId.toBase58(),
    ]);
  });

  const collateral = [
    ...b58(authority, getConfigPda(), ctx.key, strategy, USDC_MINT, ex.canonicalMint, ata(USDC_MINT), ata(ex.canonicalMint), trader),
  ];

  it("deposit, with the tail last", async () => {
    const ix = await phoenixDepositIx(program, ctx, authority, ex, new BN(1_000_000));
    expect(keys(ix)).toEqual([
      ...collateral,
      ...b58(EMBER_STATE, EMBER_VAULT, ex.globalVault, PHOENIX_GLOBAL_CONFIG, LOG_AUTHORITY, PHOENIX_PROGRAM_ID, EMBER_PROGRAM, TOKEN_PROGRAM_ID),
      ...tail,
    ]);
  });

  it("withdraw adds the perp asset map and withdraw queue", async () => {
    const ix = await phoenixWithdrawIx(program, ctx, authority, ex, new BN(1_000_000));
    expect(keys(ix)).toEqual([
      ...collateral,
      ...b58(ex.perpAssetMap, ex.withdrawQueue, EMBER_STATE, EMBER_VAULT, ex.globalVault),
      ...b58(PHOENIX_GLOBAL_CONFIG, LOG_AUTHORITY, PHOENIX_PROGRAM_ID, EMBER_PROGRAM, TOKEN_PROGRAM_ID),
      ...tail,
    ]);
  });

  it("sweep has no trader and no tail", async () => {
    const ix = await phoenixEmberWithdrawIx(program, ctx, authority, ex);
    expect(keys(ix)).toEqual(
      b58(authority, getConfigPda(), ctx.key, strategy, USDC_MINT, ex.canonicalMint, ata(USDC_MINT), ata(ex.canonicalMint),
        EMBER_STATE, EMBER_VAULT, PHOENIX_GLOBAL_CONFIG, EMBER_PROGRAM, TOKEN_PROGRAM_ID),
    );
  });

  const market = [...b58(authority, getConfigPda(), ctx.key, strategy, trader, ex.perpAssetMap, orderbook, getPhoenixSplineAddress(orderbook))];

  it.each(["market", "limit"] as const)("%s order uses the market's spline and Hawkeye", async (type) => {
    const order = toOrderParams({ side: "long", type, size: "1", price: "100", slippageBps: 50, reduceOnly: false }, { tickSize: 100, baseLotsDecimals: 2 }, 100n, 1n);
    const ix = await phoenixOrderIx(program, ctx, authority, ex, orderbook, order);
    expect(keys(ix)).toEqual([...market, ...b58(PHOENIX_GLOBAL_CONFIG, LOG_AUTHORITY, PHOENIX_PROGRAM_ID, HAWKEYE), ...tail]);
  });

  it("cancel drops Hawkeye and encodes by-id orders", async () => {
    const all = await phoenixCancelIx(program, ctx, authority, ex, orderbook, "all");
    expect(keys(all)).toEqual([...market, ...b58(PHOENIX_GLOBAL_CONFIG, LOG_AUTHORITY, PHOENIX_PROGRAM_ID), ...tail]);
    const byId = await phoenixCancelIx(program, ctx, authority, ex, orderbook, [{ priceInTicks: "123", orderSequenceNumber: "18446744073709355813" }]);
    const decoded = (program.coder.instruction as BorshInstructionCoder).decode(byId.data) as unknown as { data: { mode: { byId: { orders: { nodePointer: number; priceInTicks: BN; orderSequenceNumber: BN }[] } } } };
    const [o] = decoded.data.mode.byId.orders;
    expect([o.nodePointer, o.priceInTicks.toString(), o.orderSequenceNumber.toString()]).toEqual([0, "123", "18446744073709355813"]);
  });
});

describe("toOrderParams", () => {
  // SOL: tick size 100, 2 base lot decimals, so $1 is 1e6 / (100 × 10^2) = 100 ticks and 1 SOL is 100 lots
  const sol = { tickSize: 100, baseLotsDecimals: 2 };

  it("converts size to lots and a limit price to ticks", () => {
    const o = toOrderParams({ side: "short", type: "limit", size: "1.5", price: "150.25", postOnly: true, reduceOnly: false }, sol, 0n, 7n);
    expect(o.kind).toBe("limit");
    if (o.kind !== "limit") return;
    expect(o.params.numBaseLots.toString()).toBe("150");
    expect(o.params.priceInTicks.toString()).toBe("15025");
    expect(o.params).toMatchObject({ side: { ask: {} }, postOnly: true, slide: false, selfTradeBehavior: { cancelProvide: {} } });
    expect(o.params.clientOrderId.toString()).toBe("7");
  });

  it("caps a market order at mark ± slippage, rounded against the trader, and requires a full fill", () => {
    const long = toOrderParams({ side: "long", type: "market", size: "2", slippageBps: 50, reduceOnly: false }, sol, 15_001n, 1n);
    const short = toOrderParams({ side: "short", type: "market", size: "2", slippageBps: 50, reduceOnly: true }, sol, 15_001n, 1n);
    if (long.kind !== "market" || short.kind !== "market") throw new Error("expected market orders");
    // 15001 × 1.005 = 15076.005 → ceil 15077; 15001 × 0.995 = 14925.995 → floor 14925
    expect(long.params.priceInTicks.toString()).toBe("15077");
    expect(short.params.priceInTicks.toString()).toBe("14925");
    expect(long.params.minBaseLotsToFill.toString()).toBe("200");
    expect(short.params).toMatchObject({ side: { ask: {} }, reduceOnly: true, selfTradeBehavior: { abort: {} }, numQuoteLots: null });
  });

  it("rejects a size under one lot and a limit price under one tick", () => {
    expect(() => toOrderParams({ side: "long", type: "market", size: "0.001", slippageBps: 50, reduceOnly: false }, sol, 100n, 1n)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(() => toOrderParams({ side: "long", type: "limit", size: "1", price: "0.001", reduceOnly: false }, sol, 0n, 1n)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});

describe("submitPhoenixOnboardTx", () => {
  const vault = pk(1);
  const payer = Keypair.generate();
  const onboardIx = new TransactionInstruction({ programId: PHOENIX_PROGRAM_ID, keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }], data: Buffer.from([1]) });
  const tx = (ixs = [onboardIx], feePayer = payer, sign = true) => {
    const t = new VersionedTransaction(
      new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: PublicKey.default.toBase58(), instructions: ixs }).compileToV0Message(),
    );
    if (sign) t.sign([feePayer]);
    return Buffer.from(t.serialize()).toString("base64");
  };

  it("forwards a manager-signed Phoenix-only transaction", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ signature: "sig" })));
    await expect(submitPhoenixOnboardTx(tx(), vault, payer.publicKey)).resolves.toEqual({ signature: "sig" });
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(body).toMatchObject({ traderAuthority: vault.toBase58(), txFeePayer: payer.publicKey.toBase58(), traderPdaIndex: 0 });
  });

  it.each([
    ["another fee payer", () => tx([onboardIx], Keypair.generate())],
    ["an unsigned transaction", () => tx([onboardIx], payer, false)],
    ["a non-Phoenix instruction", () => tx([SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: pk(9), lamports: 1 })])],
    ["garbage", () => "AAAA"],
  ])("rejects %s with 400", async (_, make) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(submitPhoenixOnboardTx(make(), vault, payer.publicKey)).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a Phoenix API rejection as 502", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("trader not eligible", { status: 400 }));
    await expect(submitPhoenixOnboardTx(tx(), vault, payer.publicKey)).rejects.toMatchObject({ status: 502 });
  });
});

const amount = (value: number, ui = String(value)) => ({ value, ui });
const traderView = {
  collateralBalance: amount(100), effectiveCollateral: amount(90), initialMargin: amount(20), maintenanceMargin: amount(10),
  withdrawableQuoteCollateral: amount(60), riskState: "healthy", positions: [], limitOrders: {},
};

describe("manager view helpers", () => {
  it("summarises the margin account with liquidation prices by market", () => {
    const view = toAccountView({ ...traderView, positions: [{ symbol: "SOL", liquidationPrice: amount(94_200, "94.200") }, { symbol: "BTC", liquidationPrice: null }] });
    expect(view).toEqual({
      collateral: "100", equity: "90", initialMargin: "20", maintenanceMargin: "10", withdrawable: "60", riskState: "healthy",
      liquidationPrices: { SOL: "94.200" },
    });
  });

  const meta = (symbol: string, assetId: number, extra = {}) => ({
    symbol, assetId, marketPubkey: pk(assetId + 40).toBase58(), tickSize: 100, baseLotsDecimals: 2,
    takerFee: 0.00035, makerFee: 0.00005, marketStatus: "active", isolatedOnly: false,
    name: symbol, logoUri: null, color: null, maxLeverage: 25, maintenanceFactor: 0.5, ...extra,
  });

  it("lists active cross-margin markets with their mark in USD", () => {
    const marks = new Map([[0n, { markTicks: 15_025n, markSlot: 1n, tickSize: 100n, cumulativeFundingRate: 0n, baseLotDecimals: 2 }]]);
    const views = toMarketViews([meta("SOL", 0), meta("BTC", 1), meta("LLY", 2, { isolatedOnly: true }), meta("OLD", 3, { marketStatus: "delisted" })], marks);
    expect(views.map((v) => [v.symbol, v.markPrice])).toEqual([["BTC", "0"], ["SOL", "150.25"]]);
  });

  it("keeps resting limit orders with their tick price and drops stop-losses", () => {
    const order = (extra = {}) => ({
      price: { value: 1_502_500, ui: "150.2500" }, side: "bid" as const, orderSequenceNumber: "42",
      tradeSizeRemaining: { value: 50, ui: "0.50" }, isReduceOnly: false, ...extra,
    });
    const orders = toOpenOrders(
      { ...traderView, limitOrders: { SOL: [order(), order({ isStopLoss: true })], BTC: [] } },
      [meta("SOL", 0), meta("BTC", 1)],
    );
    expect(orders).toEqual([
      { symbol: "SOL", side: "long", price: "150.2500", size: "0.50", priceInTicks: "15025", orderSequenceNumber: "42", reduceOnly: false },
    ]);
  });
});
