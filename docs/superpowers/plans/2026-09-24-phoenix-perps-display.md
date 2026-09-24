# Phoenix Perps Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read each vault's Phoenix cross-margin trader account server-side and show its equity, collateral, leverage and per-position detail in the Portfolio and the manage page's Perps tab, valued exactly like the keeper.

**Architecture:** A new `src/server/phoenix.ts` patch-ports the keeper's decoder (`hedgin_keeper/src/valuation/phoenix.ts`) and adds pure display math. `src/server/readers/phoenix.ts` turns `phoenixPerp` strategy rows into `PhoenixStrategyView`s (or `unreadable` ones) from one same-slot account read. `lib/holdings.ts` books two keeper-identical holdings per strategy and emits a new `kind: "perp"` position, which the position card and a new Perps tab render.

**Tech Stack:** Next.js (app router), TypeScript, Anchor 0.x client, `@solana/web3.js`, `@solana/spl-token`, `@ellipsis-labs/rise@0.5.28`, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-24-phoenix-perps-display-design.md`

## Global Constraints

- `@ellipsis-labs/rise` pinned to exactly `0.5.28` (the keeper's version).
- Equity arithmetic must match the keeper's `computeTraderEquity` exactly: `max(0, collateral + Σ (virtualQuoteLots + baseLots × markTicks × tickSize − baseLots × (cumulativeFundingRate − fundingSnapshot)))`.
- `MAX_MARK_AGE_SLOTS = 1_500n`; a stale or zero mark under an open position is an error, not a value.
- One quote lot = one USDC atom (6 decimals). USDC price = `ticks × tickSize × 10^baseLotDecimals / 10^6`; `baseLotDecimals` may be negative.
- Phoenix holdings (`phoenix_equity`, `phoenix_canonical`) use the vault's deposit mint and decimals, as the keeper does. Phoenix strategies only exist in USDC vaults (enforced on-chain).
- Market names come from `GET https://perp-api.phoenix.trade/v1/view/exchange/markets` (`[{ symbol, assetId, ... }]`); failure falls back to `Asset #<id>` and never blocks a view.
- Reason strings reuse the keeper's: `phoenix_decode:<key>`, `phoenix_trader_mismatch:<key>`, `phoenix_native_sol:<key>`, `phoenix_splines:<key>`, `phoenix_asset_missing:<id>`, `phoenix_stale_mark:<id>`, `phoenix_zero_mark:<id>`, `account_missing:<key>`.
- No trading controls. The only new write-path change is `closeStrategyIx` for `phoenixPerp`, plus its "Close strategy" menu item.
- The app is synced from other repos by patch, never by copying whole directories. Porting individual functions from the keeper is fine; copying the keeper's `phoenix-mainnet.json` test data file is fine.
- Don't touch the uncommitted changes already in the working tree (`k8s/ingress.yaml`, `src/app/api/tx/send/route.ts`, `src/server/route.ts`, `test/route.test.ts`). Stage files by explicit path only.

## Review Focus

1. **Short positions and negative `baseLotDecimals`.** A short in a market like PUMP (`baseLotDecimals = -2`) should show a positive size, "short", and correct prices, not a negative size or a price off by 10^4. Pinned in Task 2 (`scaleDecimal` negative decimals, short-position test).
2. **Stale mark under an open position.** When Phoenix stops pricing a market, the row should become an unreadable Phoenix card with `phoenix_stale_mark:<id>`, not a silently wrong equity. Pinned in Task 3 (`toPhoenixView` stale test).
3. **Canonical-mint ATA counted twice.** Tokens in the vault's canonical-mint ATA from a queued withdrawal must count once (as `phoenix_canonical`), not also as an unmanaged idle token. Pinned in Task 4.
4. **Empty Phoenix account hidden with no way to close it.** A Phoenix account with no positions and zero equity should still be listed with an enabled "Close strategy" action. Pinned in Task 4 (`isEmptyPosition` perp test) and Task 5 (close instruction).
5. **Phoenix market API down.** Positions should still render with `Asset #<id>` names, and the failure must not be cached for 10 minutes. Pinned in Task 2 (`getPhoenixMarketNames` failure test).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/server/phoenix.ts` (new) | Phoenix constants, keeper-ported decoders and equity, pure `describePosition` / `scaleDecimal`, cached market-name fetch |
| `src/server/readers/phoenix.ts` (new) | `toPhoenixView` (pure) and `phoenixViewsFor` (one same-slot RPC read) |
| `src/server/readers/strategies.ts` | Route `phoenixPerp` rows to `phoenixViewsFor`; tag DLMM unreadables with `protocol: "dlmm"` |
| `src/server/readers/strategy-history.ts` | Accept `"phoenix"` strategy type |
| `src/lib/types.ts` | `PhoenixPerpPositionView`, `PhoenixStrategyView`, `PerpPositionView`, `protocol` on unreadable/error, history type |
| `src/lib/valuation.ts` | Two new `HoldingKind`s |
| `src/lib/holdings.ts` | Phoenix holdings, canonical dedupe, `perp` rows, sort, `isEmptyPosition` |
| `src/lib/perps.ts` (new) | `perpTotals` for the Perps tab summary (pure) |
| `src/server/tx/vault.ts` | `closeStrategyIx` Phoenix branch; 400 on unknown type |
| `src/components/holdings/position-card.tsx` | `perp` branch; protocol-aware unreadable card |
| `src/components/holdings/allocation-card.tsx` | Label and icon for `perp` |
| `src/components/manage/balance-tab.tsx` | "Close strategy" menu item for `perp` |
| `src/components/manage/perps-tab.tsx` (new) | Perps tab: summary strip + positions table |
| `src/app/manage/[address]/page.tsx` | Replace placeholder with `PerpsTab` |
| `test/phoenix.test.ts` (new), `test/phoenix-fixture.ts` (new), `test/data/phoenix-mainnet.json` (copied) | Decoder, equity parity, display math, market names |
| `test/phoenix-reader.test.ts` (new) | `toPhoenixView` |
| `test/holdings.test.ts`, `test/tx-vault.test.ts`, `test/perps.test.ts` (new) | Holdings, close instruction, totals |

Commands used throughout (run from `/root/solana/solhedge/hedge_vault_app`):
- Single test file: `npx vitest run test/<file>.test.ts`
- Typecheck: `npx tsc --noEmit`
- Lint: `npx eslint <paths>`

---

### Task 1: Phoenix decoder port and keeper parity

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/server/phoenix.ts`
- Create: `test/phoenix-fixture.ts`
- Copy: `../hedgin_keeper/test/data/phoenix-mainnet.json` → `test/data/phoenix-mainnet.json`
- Test: `test/phoenix.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (from `@/server/phoenix`):
  - `PHOENIX_PROGRAM_ID: PublicKey`, `PHOENIX_GLOBAL_CONFIG: PublicKey`, `MAX_MARK_AGE_SLOTS: bigint`
  - `class PhoenixReadError extends Error` (message is the reason string)
  - `interface PhoenixGlobalConfig { canonicalMint; perpAssetMap; globalTraderIndex; activeTraderBuffer: PublicKey }`
  - `interface PhoenixPosition { assetId: bigint; baseLots: bigint; virtualQuoteLots: bigint; fundingSnapshot: bigint }`
  - `interface PhoenixMarket { markTicks: bigint; markSlot: bigint; tickSize: bigint; cumulativeFundingRate: bigint; baseLotDecimals: number }`
  - `interface PhoenixTraderState { authority: PublicKey; pdaIndex: number; subaccountIndex: number; collateral: bigint; positions: PhoenixPosition[]; nativeSolLamports: bigint; splineMarkets: number }`
  - `parseGlobalConfig(info: AccountInfo<Buffer>): PhoenixGlobalConfig`
  - `decodeTraderState(key: PublicKey, info: AccountInfo<Buffer>): PhoenixTraderState`
  - `decodeMarkets(key: PublicKey, info: AccountInfo<Buffer>): Map<bigint, PhoenixMarket>`
  - `checkTrader(vault: PublicKey, key: PublicKey, t: PhoenixTraderState): void`
  - `computeTraderEquity(collateral: bigint, positions: PhoenixPosition[], markets: Map<bigint, PhoenixMarket>, slot: bigint): bigint`

- [ ] **Step 1: Add the dependency and test data**

```bash
cd /root/solana/solhedge/hedge_vault_app
npm install --save-exact @ellipsis-labs/rise@0.5.28
mkdir -p test/data
cp ../hedgin_keeper/test/data/phoenix-mainnet.json test/data/phoenix-mainnet.json
```

If the repo uses yarn (`yarn.lock` present, no `package-lock.json`), use `yarn add --exact @ellipsis-labs/rise@0.5.28` instead. Check with `ls *.lock package-lock.json`.

- [ ] **Step 2: Write the fixture loader**

Create `test/phoenix-fixture.ts`:

```ts
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

interface Packed { owner: string; data: string }

export const accountInfo = (data: Buffer, owner: PublicKey): AccountInfo<Buffer> => ({ data, owner, lamports: 1, executable: false });
const unpack = (p: Packed) => accountInfo(gunzipSync(Buffer.from(p.data, "base64")), new PublicKey(p.owner));

/** Hawkeye ViewMargin's answer; equity = max(0, collateral + unrealizedPnl + unsettledFunding). */
export interface HawkeyeMargin { collateral: bigint; unrealizedPnl: bigint; unsettledFunding: bigint }
export const hawkeyeEquity = (m: HawkeyeMargin) => {
  const e = m.collateral + m.unrealizedPnl + m.unsettledFunding;
  return e > 0n ? e : 0n;
};

/** Mainnet traders with the accounts Hawkeye ViewMargin saw and its answer (ported from hedgin_keeper). */
export function loadPhoenixFixture() {
  const raw = JSON.parse(readFileSync(new URL("./data/phoenix-mainnet.json", import.meta.url), "utf8"));
  return raw.traders.map((t: any) => ({
    trader: new PublicKey(t.trader),
    slot: t.slot as number,
    hawkeye: {
      collateral: BigInt(t.hawkeye.collateral),
      unrealizedPnl: BigInt(t.hawkeye.unrealizedPnl),
      unsettledFunding: BigInt(t.hawkeye.unsettledFunding),
    } as HawkeyeMargin,
    accounts: { trader: unpack(t.accounts.trader), perpAssetMap: unpack(t.accounts.perpAssetMap), globalConfig: unpack(t.accounts.globalConfig) },
  })) as {
    trader: PublicKey;
    slot: number;
    hawkeye: HawkeyeMargin;
    accounts: { trader: AccountInfo<Buffer>; perpAssetMap: AccountInfo<Buffer>; globalConfig: AccountInfo<Buffer> };
  }[];
}
```

Check that `hawkeyeEquity` matches `hedgin_keeper/src/valuation/hawkeye.ts`. If the keeper's version differs, copy the keeper's.

- [ ] **Step 3: Write the failing tests**

Create `test/phoenix.test.ts` (ported from `hedgin_keeper/test/phoenix.test.ts` and `hawkeye.test.ts`; `market()` gains `baseLotDecimals`):

```ts
import { PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkTrader, computeTraderEquity, decodeMarkets, decodeTraderState, MAX_MARK_AGE_SLOTS, parseGlobalConfig,
  PHOENIX_PROGRAM_ID, type PhoenixMarket, type PhoenixPosition, type PhoenixTraderState,
} from "@/server/phoenix";
import { accountInfo, hawkeyeEquity, loadPhoenixFixture } from "./phoenix-fixture";

const SLOT = 10_000n;
export const market = (markTicks: bigint, tickSize = 10n, cumulativeFundingRate = 0n, markSlot = SLOT, baseLotDecimals = 0): PhoenixMarket =>
  ({ markTicks, markSlot, tickSize, cumulativeFundingRate, baseLotDecimals });
export const position = (assetId: bigint, baseLots: bigint, virtualQuoteLots: bigint, fundingSnapshot = 0n): PhoenixPosition =>
  ({ assetId, baseLots, virtualQuoteLots, fundingSnapshot });

describe("computeTraderEquity", () => {
  it("is the collateral of a flat account", () => {
    expect(computeTraderEquity(1_000n, [], new Map(), SLOT)).toBe(1_000n);
  });

  it("adds uPnL at mark: long in profit, short in loss", () => {
    const markets = new Map([[0n, market(110n)], [1n, market(110n)]]);
    expect(computeTraderEquity(10_000n, [position(0n, 3n, -3_000n), position(1n, -2n, 2_000n)], markets, SLOT)).toBe(10_100n);
  });

  it("adds unsettled funding with Hawkeye's sign", () => {
    const markets = new Map([[0n, market(100n, 10n, 150n)], [1n, market(100n, 10n, 150n)]]);
    const positions = [position(0n, 3n, -3_000n, 100n), position(1n, -2n, 2_000n, 100n)];
    expect(computeTraderEquity(10_000n, positions, markets, SLOT)).toBe(10_000n - 150n + 100n);
  });

  it("clamps negative equity to zero", () => {
    expect(computeTraderEquity(100n, [position(0n, 1n, -1_000n)], new Map([[0n, market(10n)]]), SLOT)).toBe(0n);
  });

  it("ignores the mark of an entry without a position", () => {
    expect(computeTraderEquity(500n, [position(0n, 0n, 0n)], new Map([[0n, market(0n)]]), SLOT)).toBe(500n);
  });

  it("aborts on an asset missing from the map", () => {
    expect(() => computeTraderEquity(1n, [position(7n, 1n, 0n)], new Map(), SLOT)).toThrow("phoenix_asset_missing:7");
  });

  it("aborts on a mark older than the bound under an open position", () => {
    const stale = new Map([[0n, market(100n, 10n, 0n, SLOT - MAX_MARK_AGE_SLOTS - 1n)]]);
    expect(() => computeTraderEquity(1n, [position(0n, 1n, 0n)], stale, SLOT)).toThrow("phoenix_stale_mark:0");
  });

  it("accepts a mark at the bound, and any mark without a position", () => {
    const edge = new Map([[0n, market(100n, 10n, 0n, SLOT - MAX_MARK_AGE_SLOTS)]]);
    expect(computeTraderEquity(0n, [position(0n, 1n, -900n)], edge, SLOT)).toBe(100n);
    const stale = new Map([[0n, market(100n, 10n, 0n, 0n)]]);
    expect(computeTraderEquity(5n, [position(0n, 0n, 0n)], stale, SLOT)).toBe(5n);
  });

  it("aborts on a zero mark under an open position", () => {
    expect(() => computeTraderEquity(1n, [position(0n, 1n, 0n)], new Map([[0n, market(0n)]]), SLOT)).toThrow("phoenix_zero_mark:0");
  });
});

describe("checkTrader", () => {
  const vault = PublicKey.unique();
  const key = PublicKey.unique();
  const ok: PhoenixTraderState = { authority: vault, pdaIndex: 0, subaccountIndex: 0, collateral: 0n, positions: [], nativeSolLamports: 0n, splineMarkets: 0 };

  it("accepts the vault's cross-margin account", () => {
    expect(() => checkTrader(vault, key, ok)).not.toThrow();
  });

  it.each([
    ["another authority", { authority: PublicKey.unique() }, `phoenix_trader_mismatch:${key.toBase58()}`],
    ["a subaccount", { subaccountIndex: 1 }, `phoenix_trader_mismatch:${key.toBase58()}`],
    ["another pda index", { pdaIndex: 1 }, `phoenix_trader_mismatch:${key.toBase58()}`],
    ["native SOL collateral", { nativeSolLamports: 1n }, `phoenix_native_sol:${key.toBase58()}`],
    ["spline markets", { splineMarkets: 1 }, `phoenix_splines:${key.toBase58()}`],
  ])("rejects %s", (_, change, reason) => {
    expect(() => checkTrader(vault, key, { ...ok, ...change })).toThrow(reason);
  });
});

describe("parseGlobalConfig", () => {
  const keys = [PublicKey.unique(), PublicKey.unique(), PublicKey.unique(), PublicKey.unique()];
  const data = Buffer.alloc(776);
  Buffer.from([37, 146, 212, 210, 47, 136, 111, 20]).copy(data);
  [296, 360, 392, 424].forEach((offset, i) => keys[i].toBuffer().copy(data, offset));

  it("reads the exchange accounts", () => {
    expect(parseGlobalConfig(accountInfo(data, PHOENIX_PROGRAM_ID))).toEqual({
      canonicalMint: keys[0], perpAssetMap: keys[1], globalTraderIndex: keys[2], activeTraderBuffer: keys[3],
    });
  });

  it("rejects a foreign owner or discriminator", () => {
    expect(() => parseGlobalConfig(accountInfo(data, PublicKey.unique()))).toThrow("phoenix_decode:");
    expect(() => parseGlobalConfig(accountInfo(Buffer.alloc(776), PHOENIX_PROGRAM_ID))).toThrow("phoenix_decode:");
  });
});

describe("decodeMarkets", () => {
  it("decodes the SDK's mainnet perp asset map, including lot decimals", () => {
    const fx = JSON.parse(readFileSync("node_modules/@ellipsis-labs/rise/test-fixtures/sdk-account-fixtures.json", "utf8")).accounts[0];
    const markets = decodeMarkets(PublicKey.unique(), accountInfo(Buffer.from(fx.dataBase64, "base64"), PHOENIX_PROGRAM_ID));
    expect(markets.size).toBe(44);
    for (const m of markets.values()) expect(m.tickSize).toBeGreaterThan(0n);
    // asset 0 is SOL: tick size 100, 2 base lot decimals
    expect(markets.get(0n)).toMatchObject({ tickSize: 100n, baseLotDecimals: 2 });
  });

  it("rejects bytes it cannot decode", () => {
    const key = PublicKey.unique();
    expect(() => decodeMarkets(key, accountInfo(Buffer.alloc(16), PHOENIX_PROGRAM_ID))).toThrow(`phoenix_decode:${key.toBase58()}`);
  });
});

describe("mainnet fixture", () => {
  const fixture = loadPhoenixFixture();

  it.each(fixture.map((f) => [f.trader.toBase58(), f] as const))("equity equals Hawkeye for %s", (_, f) => {
    const { perpAssetMap } = parseGlobalConfig(f.accounts.globalConfig);
    const t = decodeTraderState(f.trader, f.accounts.trader);
    const markets = decodeMarkets(perpAssetMap, f.accounts.perpAssetMap);
    expect(t.collateral).toBe(f.hawkeye.collateral);
    expect(computeTraderEquity(t.collateral, t.positions, markets, BigInt(f.slot))).toBe(hawkeyeEquity(f.hawkeye));
  });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `npx vitest run test/phoenix.test.ts`
Expected: FAIL with `Failed to resolve import "@/server/phoenix"`.

- [ ] **Step 5: Implement `src/server/phoenix.ts`**

```ts
import "server-only";
import { decodePerpAssetMap, decodeTrader } from "@ellipsis-labs/rise";
import { PublicKey, type AccountInfo } from "@solana/web3.js";

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
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npx vitest run test/phoenix.test.ts`
Expected: PASS, including one "equity equals Hawkeye" case per fixture trader.

- [ ] **Step 7: Typecheck, then commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json yarn.lock src/server/phoenix.ts test/phoenix.test.ts test/phoenix-fixture.ts test/data/phoenix-mainnet.json 2>/dev/null
git commit -m "feat(phoenix): port trader decoder and equity from keeper"
```

(`git add` skips whichever lockfile doesn't exist; check `git status --short` to confirm only these files are staged.)

---

### Task 2: Position display math and market names

**Files:**
- Modify: `src/server/phoenix.ts` (append)
- Test: `test/phoenix.test.ts` (append)

**Interfaces:**
- Consumes: `PhoenixPosition`, `PhoenixMarket` from Task 1.
- Produces (from `@/server/phoenix`):
  - `scaleDecimal(raw: bigint, decimals: number): string`: exact `raw × 10^-decimals`; `decimals` may be negative.
  - `interface PhoenixPositionDetail { side: "long" | "short"; size: string; entryPrice: string; markPrice: string; notional: bigint; unrealizedPnl: bigint; accruedFunding: bigint }`: prices are USDC decimal strings; the bigints are USDC atoms.
  - `describePosition(p: PhoenixPosition, m: PhoenixMarket): PhoenixPositionDetail`
  - `getPhoenixMarketNames(): Promise<Map<number, string>>`

- [ ] **Step 1: Write the failing tests**

Append to `test/phoenix.test.ts` (merge `describePosition`, `getPhoenixMarketNames` and `scaleDecimal` into the existing `@/server/phoenix` import; add `afterEach, beforeEach, vi` to the vitest import; add `import { clearCache } from "@/server/cache";`):

```ts
describe("scaleDecimal", () => {
  it.each([
    [123n, 2, "1.23"],
    [5n, 4, "0.0005"],
    [-1500n, 3, "-1.5"],
    [100n, 2, "1"],
    [5n, -2, "500"],
    [0n, 6, "0"],
  ])("%s × 10^-%s = %s", (raw, decimals, out) => {
    expect(scaleDecimal(raw, decimals)).toBe(out);
  });
});

describe("describePosition", () => {
  // Values from a real mainnet SOL long: tick size 100, 2 base lot decimals.
  const sol = market(11_684n, 100n, 27_329n, SLOT, 2);
  it("describes a long", () => {
    expect(describePosition(position(0n, 3n, -3_421_500n, 24_203n), sol)).toEqual({
      side: "long",
      size: "0.03",
      entryPrice: "114.05",
      markPrice: "116.84",
      notional: 3_505_200n,
      unrealizedPnl: 83_700n,
      accruedFunding: -9_378n,
    });
  });

  // Values from a real mainnet BTC short: tick size 100, 4 base lot decimals.
  it("describes a short with a positive size", () => {
    const btc = market(85_428n, 100n, -127_914n, SLOT, 4);
    expect(describePosition(position(1n, -1n, 8_102_800n, -122_482n), btc)).toEqual({
      side: "short",
      size: "0.0001",
      entryPrice: "81028",
      markPrice: "85428",
      notional: 8_542_800n,
      unrealizedPnl: -440_000n,
      accruedFunding: -5_432n,
    });
  });

  it("scales markets with negative base lot decimals", () => {
    // PUMP-like: 1 base lot = 100 tokens
    const pump = market(41_880n, 10n, 0n, SLOT, -2); // 41_880 ticks × 10 = 418_800 quote lots per base lot
    const d = describePosition(position(26n, -1n, 439_730n), pump);
    expect(d).toMatchObject({ side: "short", size: "100", markPrice: "0.004188", entryPrice: "0.0043973" });
  });

  it("agrees with computeTraderEquity", () => {
    const p = position(0n, 3n, -3_421_500n, 24_203n);
    const d = describePosition(p, sol);
    expect(computeTraderEquity(1_000_000n, [p], new Map([[0n, sol]]), SLOT)).toBe(1_000_000n + d.unrealizedPnl + d.accruedFunding);
  });
});

describe("getPhoenixMarketNames", () => {
  beforeEach(clearCache);
  afterEach(() => vi.restoreAllMocks());

  it("maps asset ids to symbols", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ symbol: "SOL", assetId: 0 }, { symbol: "BTC", assetId: 1 }])));
    expect(await getPhoenixMarketNames()).toEqual(new Map([[0, "SOL"], [1, "BTC"]]));
  });

  it("returns an empty map on failure and retries on the next call", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("down", { status: 503 }));
    expect(await getPhoenixMarketNames()).toEqual(new Map());
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([{ symbol: "SOL", assetId: 0 }])));
    expect(await getPhoenixMarketNames()).toEqual(new Map([[0, "SOL"]]));
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run test/phoenix.test.ts`
Expected: FAIL with `describePosition is not a function` (and the same for `scaleDecimal` and `getPhoenixMarketNames`).

- [ ] **Step 3: Implement**

Add `import { cached } from "./cache";` at the top of `src/server/phoenix.ts`, then append:

```ts
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
```

Check the entry precision against the tests. SOL: `priceDecimals = 4`, so `num = 3_421_500 × 10^12` and `den = 3 × 10^4`, giving `114.05 × 10^12` → `"114.05"`. PUMP: `priceDecimals = 8`, so `num = −439_730 × 10^12` and `den = −1 × 10^8`, giving `4_397_300_000` → `"0.0043973"`; mark `418_800` at 8 decimals → `"0.004188"`.

Before relying on "a failure is not cached", read `cached()` in `src/server/cache.ts:52`. It should not store a rejected promise. If it does, the second assertion in the failure test fails; in that case fetch outside `cached` and use `setCached` / `getCached` only on success.

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run test/phoenix.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/phoenix.ts test/phoenix.test.ts
git commit -m "feat(phoenix): position display math and market names"
```

---

### Task 3: Phoenix strategy views in the strategies reader

**Files:**
- Modify: `src/lib/types.ts:115-164` (strategy views) and `:333` (history type)
- Create: `src/server/readers/phoenix.ts`
- Modify: `src/server/readers/strategies.ts`
- Modify: `src/server/readers/strategy-history.ts:12`
- Test: `test/phoenix-reader.test.ts`

**Interfaces:**
- Consumes: everything in `@/server/phoenix` from Tasks 1–2.
- Produces:
  - In `@/lib/types`:
    ```ts
    export interface PhoenixPerpPositionView {
      assetId: number; symbol: string; side: "long" | "short"; size: string;
      entryPrice: string; markPrice: string;
      notional: string; unrealizedPnl: string; accruedFunding: string; // USDC atoms, signed
    }
    export interface PhoenixStrategyView extends StrategyBase {
      type: "phoenix"; traderAccount: string; canonicalMint: string;
      collateral: string; equity: string; canonicalBalance: string; // USDC atoms
      leverage: number | null; positions: PhoenixPerpPositionView[];
    }
    export type StrategyProtocol = "dlmm" | "phoenix";
    // UnreadableStrategyView gains `protocol: StrategyProtocol`
    // StrategyView = Jupiter | Dlmm | Phoenix | Unreadable
    // StrategyHistoryItem.type: "jupiter" | "dlmm" | "phoenix" | null
    ```
  - In `@/server/readers/phoenix`:
    - `toPhoenixView(input: PhoenixViewInput): PhoenixStrategyView | UnreadableStrategyView` (pure)
    - `phoenixViewsFor(vault: PublicKey, items: { base: Base; trader: PublicKey }[]): Promise<(PhoenixStrategyView | UnreadableStrategyView)[]>`

- [ ] **Step 1: Extend the types**

In `src/lib/types.ts`, after `DlmmStrategyView`, add:

```ts
/** One open Phoenix perp position. Prices are USDC decimal strings; amounts are USDC atoms. */
export interface PhoenixPerpPositionView {
  assetId: number;
  /** Market symbol, or `Asset #<id>` when Phoenix's market list is unavailable. */
  symbol: string;
  side: "long" | "short";
  /** Whole base units, always positive. */
  size: string;
  entryPrice: string;
  markPrice: string;
  notional: string;
  unrealizedPnl: string;
  accruedFunding: string;
}

/** The vault's Phoenix cross-margin account. Amounts are USDC atoms (one quote lot each). */
export interface PhoenixStrategyView extends StrategyBase {
  type: "phoenix";
  traderAccount: string;
  canonicalMint: string;
  collateral: string;
  /** Collateral + uPnL + unsettled funding, clamped at 0; what the keeper books into NAV. */
  equity: string;
  /** Canonical-mint tokens a queued withdrawal delivered to the vault, not yet unwrapped. */
  canonicalBalance: string;
  /** Total notional / equity; null when equity is 0. */
  leverage: number | null;
  positions: PhoenixPerpPositionView[];
}

export type StrategyProtocol = "dlmm" | "phoenix";
```

Change `UnreadableStrategyView` and `StrategyView`:

```ts
/** A strategy whose protocol account could not be read; reported instead of dropped. */
export interface UnreadableStrategyView extends StrategyBase {
  type: "unreadable";
  protocol: StrategyProtocol;
  /** The protocol account: DLMM position or Phoenix trader. */
  position: string;
  reason: string;
}

export type StrategyView = JupiterStrategyView | DlmmStrategyView | PhoenixStrategyView | UnreadableStrategyView;
```

Change `StrategyHistoryItem.type` (line ~333) to `type: "jupiter" | "dlmm" | "phoenix" | null;`, and in `src/server/readers/strategy-history.ts:12` change `strategy_type: "jupiter" | "dlmm" | null;` to `strategy_type: "jupiter" | "dlmm" | "phoenix" | null;`.

In `src/server/readers/strategies.ts`, the `unreadable` helper inside `dlmmViewsFor` gains `protocol: "dlmm",`.

In `test/holdings.test.ts:76`, add `protocol: "dlmm",` to the `broken` fixture. (Its `toEqual` on the error row gets updated in Task 4.)

- [ ] **Step 2: Write the failing reader tests**

Create `test/phoenix-reader.test.ts`:

```ts
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import type { PhoenixMarket, PhoenixTraderState } from "@/server/phoenix";
import { toPhoenixView } from "@/server/readers/phoenix";

const SLOT = 10_000n;
const vault = PublicKey.unique();
const trader = PublicKey.unique();
const canonicalMint = PublicKey.unique();
const base = { address: "strat-px", id: 3, createdTs: 1, lastActionTs: 5 };
const sol: PhoenixMarket = { markTicks: 11_684n, markSlot: SLOT, tickSize: 100n, cumulativeFundingRate: 27_329n, baseLotDecimals: 2 };
const state = (over: Partial<PhoenixTraderState> = {}): PhoenixTraderState => ({
  authority: vault, pdaIndex: 0, subaccountIndex: 0, collateral: 10_000_000n,
  positions: [{ assetId: 0n, baseLots: 3n, virtualQuoteLots: -3_421_500n, fundingSnapshot: 24_203n }],
  nativeSolLamports: 0n, splineMarkets: 0, ...over,
});
const input = (over: Partial<Parameters<typeof toPhoenixView>[0]> = {}) => ({
  base, vault, trader, canonicalMint, canonicalBalance: 0n,
  state: state() as PhoenixTraderState | Error,
  markets: new Map([[0n, sol]]) as Map<bigint, PhoenixMarket> | Error,
  slot: SLOT, names: new Map([[0, "SOL"]]), ...over,
});

describe("toPhoenixView", () => {
  it("values the account and describes each open position", () => {
    const v = toPhoenixView(input({ canonicalBalance: 42n }));
    expect(v).toEqual({
      ...base,
      type: "phoenix",
      traderAccount: trader.toBase58(),
      canonicalMint: canonicalMint.toBase58(),
      collateral: "10000000",
      equity: String(10_000_000n + 83_700n - 9_378n),
      canonicalBalance: "42",
      leverage: 3_505_200 / Number(10_000_000n + 83_700n - 9_378n),
      positions: [{
        assetId: 0, symbol: "SOL", side: "long", size: "0.03", entryPrice: "114.05", markPrice: "116.84",
        notional: "3505200", unrealizedPnl: "83700", accruedFunding: "-9378",
      }],
    });
  });

  it("skips zero-size entries and falls back to an asset label", () => {
    const flat = state({ positions: [{ assetId: 0n, baseLots: 0n, virtualQuoteLots: 0n, fundingSnapshot: 0n }] });
    expect(toPhoenixView(input({ state: flat })).positions).toEqual([]);
    const v = toPhoenixView(input({ names: new Map() }));
    expect(v.type === "phoenix" && v.positions[0].symbol).toBe("Asset #0");
  });

  it("has no leverage at zero equity", () => {
    const v = toPhoenixView(input({ state: state({ collateral: 0n, positions: [] }) }));
    expect(v).toMatchObject({ type: "phoenix", equity: "0", leverage: null, positions: [] });
  });

  it.each([
    ["a stale mark", input({ markets: new Map([[0n, { ...sol, markSlot: 0n }]]) }), "phoenix_stale_mark:0"],
    ["another authority", input({ state: state({ authority: PublicKey.unique() }) }), `phoenix_trader_mismatch:${trader.toBase58()}`],
    ["an undecodable trader", input({ state: new Error(`phoenix_decode:${trader.toBase58()}`) }), `phoenix_decode:${trader.toBase58()}`],
    ["an undecodable asset map", input({ markets: new Error("phoenix_decode:map") }), "phoenix_decode:map"],
  ])("reports %s as an unreadable Phoenix strategy", (_, i, reason) => {
    expect(toPhoenixView(i)).toEqual({ ...base, type: "unreadable", protocol: "phoenix", position: trader.toBase58(), reason });
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npx vitest run test/phoenix-reader.test.ts`
Expected: FAIL with `Failed to resolve import "@/server/readers/phoenix"`.

- [ ] **Step 4: Implement `src/server/readers/phoenix.ts`**

```ts
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
```

Note: the canonical ATA is per vault, not per strategy. With more than one Phoenix strategy, each view reports the same balance. The program allows only the `(0, 0)` trader per vault, so there is one strategy in practice; Task 4 books it once.

- [ ] **Step 5: Wire it into `readStrategies`**

In `src/server/readers/strategies.ts`:
- Import: `import { phoenixViewsFor } from "./phoenix";`
- After the `dlmm` filter: `const phoenix = rows.filter((r) => "phoenixPerp" in r.account.strategyType);`
- Replace the `Promise.all` and return with:

```ts
    const [jupiterViews, dlmmViews, phoenixViews] = await Promise.all([
      jupiterViewsFor(
        key,
        jupiter.map((r) => ({
          base: base(r),
          targetMint: (r.account.strategyType as { jupiterSwap: { targetMint: PublicKey } }).jupiterSwap.targetMint,
        })),
      ),
      dlmmViewsFor(
        key,
        dlmm.map((r) => ({
          base: base(r),
          position: (r.account.strategyType as { meteoraDlmm: { position: PublicKey } }).meteoraDlmm.position,
        })),
      ),
      phoenixViewsFor(
        key,
        phoenix.map((r) => ({
          base: base(r),
          trader: (r.account.strategyType as { phoenixPerp: { traderAccount: PublicKey } }).phoenixPerp.traderAccount,
        })),
      ),
    ]);
    return [...jupiterViews, ...dlmmViews, ...phoenixViews].sort((a, b) => a.id - b.id);
```

- Add `+ 2 RPC for Phoenix (global config, then asset map + canonical ATA + traders at one slot)` to the doc comment's cost list.

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npx vitest run test/phoenix-reader.test.ts test/phoenix.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `src/lib/holdings.ts`, and only where it narrows `StrategyView` (for example, the LP branch now also receives `PhoenixStrategyView`). Task 4 fixes those. Any error in another file must be fixed now.

To keep this commit green, add a temporary early exit at the top of the `strategies.map` callback in `buildHoldingsView`, which Task 4 replaces:

```ts
    if (s.type === "phoenix") throw new Error("phoenix holdings: implemented in the next commit");
```

Also exclude phoenix from the `for` loop: `else if (s.type === "dlmm")` already does this. Re-run `npx tsc --noEmit` → no errors, then `npx vitest run` → all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/server/readers/phoenix.ts src/server/readers/strategies.ts src/server/readers/strategy-history.ts src/lib/holdings.ts test/phoenix-reader.test.ts test/holdings.test.ts
git commit -m "feat(phoenix): read vault trader accounts into strategy views"
```

---

### Task 4: Holdings and valuation

**Files:**
- Modify: `src/lib/types.ts` (`ErrorPositionView`, new `PerpPositionView`, `PositionView`)
- Modify: `src/lib/valuation.ts:5`
- Modify: `src/lib/holdings.ts`
- Test: `test/holdings.test.ts`

**Interfaces:**
- Consumes: `PhoenixStrategyView`, `PhoenixPerpPositionView`, `StrategyProtocol`, and `UnreadableStrategyView.protocol` from Task 3.
- Produces (in `@/lib/types`):
  ```ts
  export interface PerpPositionView extends Money {
    kind: "perp"; strategy: string; traderAccount: string;
    equity: string; collateral: string; canonicalBalance: string; // USDC atoms
    leverage: number | null; positions: PhoenixPerpPositionView[];
    lastActionTs: number; closable: boolean;
  }
  // ErrorPositionView gains `protocol: StrategyProtocol`
  // PositionView = Idle | Swap | Lp | Perp | Error
  ```

- [ ] **Step 1: Write the failing tests**

In `test/holdings.test.ts`, add `PhoenixStrategyView` to the type import, then add a fixture after `dlmm`:

```ts
const CANONICAL = "Canon1ca1Mint11111111111111111111111111111";

const phoenix = (over: Partial<PhoenixStrategyView> = {}): PhoenixStrategyView => ({
  type: "phoenix", address: "strat-px", id: 2, createdTs: 1, lastActionTs: 6,
  traderAccount: "trader", canonicalMint: CANONICAL,
  collateral: "300000000", equity: "320000000", canonicalBalance: "5000000", // 300, 320, 5 USDC
  leverage: 1.5,
  positions: [{
    assetId: 0, symbol: "SOL", side: "long", size: "2", entryPrice: "100", markPrice: "110",
    notional: "220000000", unrealizedPnl: "20000000", accruedFunding: "0",
  }],
  ...over,
});
```

Update the existing unreadable test's expected error row to include `protocol: "dlmm"`:

```ts
    expect(h.positions.at(-1)).toEqual({
      kind: "error", strategy: "strat-bad", protocol: "dlmm", position: "pos-bad", reason: "Position read failed",
      value: null, usd: null, shareBps: null, lastActionTs: 4,
    });
```

Add a new `describe`:

```ts
describe("buildHoldingsView with Phoenix", () => {
  it("books equity and the canonical balance at 1:1 in USDC, like the keeper", () => {
    const h = buildHoldingsView(vault(), [phoenix()]);
    // 1000 idle + 320 equity + 5 canonical
    expect(h.totalValue).toBe("1325000000");
    expect(h.partial).toBe(false);
    const perp = h.positions.find((p) => p.kind === "perp")!;
    expect(perp).toMatchObject({
      kind: "perp", strategy: "strat-px", traderAccount: "trader", value: "325000000",
      equity: "320000000", collateral: "300000000", canonicalBalance: "5000000", leverage: 1.5, closable: false,
    });
    expect(h.tokens.map((t) => [t.token.symbol, t.amount])).toEqual([["USDC", "1325000000"]]);
  });

  it("does not count the canonical-mint ATA again as an unmanaged holding", () => {
    const canonical = { mint: CANONICAL, symbol: "eUSDC", decimals: 6, logo: null, priceUsd: 1 };
    const h = buildHoldingsView(vault({ unmanagedHoldings: [{ token: canonical, amount: "5000000" }] }), [phoenix()]);
    expect(h.totalValue).toBe("1325000000");
    expect(h.positions.filter((p) => p.kind === "idle")).toHaveLength(1);
  });

  it("sorts perp after LP and before unreadable rows", () => {
    const broken: UnreadableStrategyView = {
      type: "unreadable", protocol: "phoenix", address: "strat-bad", id: 9, createdTs: 1, lastActionTs: 4,
      position: "trader-bad", reason: "phoenix_stale_mark:0",
    };
    const h = buildHoldingsView(vault(), [broken, phoenix(), dlmm(100), jupiter(100)]);
    expect(h.positions.map((p) => p.kind)).toEqual(["idle", "swap", "lp", "perp", "error"]);
    expect(h.positions.at(-1)).toMatchObject({ kind: "error", protocol: "phoenix", position: "trader-bad" });
  });

  it("marks an empty account closable and keeps it visible", () => {
    const h = buildHoldingsView(vault(), [phoenix({ equity: "0", collateral: "0", canonicalBalance: "0", leverage: null, positions: [] })]);
    const perp = h.positions.find((p) => p.kind === "perp")!;
    expect(perp).toMatchObject({ closable: true, value: "0" });
    expect(isEmptyPosition(perp)).toBe(false);
  });

  it("is not closable while the canonical balance awaits unwrap", () => {
    const h = buildHoldingsView(vault(), [phoenix({ equity: "0", collateral: "0", positions: [] })]);
    expect(h.positions.find((p) => p.kind === "perp")).toMatchObject({ closable: false });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run test/holdings.test.ts`
Expected: FAIL. The new Phoenix tests hit the temporary `throw` from Task 3, and the updated unreadable test fails because `protocol` is missing from the error row.

- [ ] **Step 3: Extend the types**

In `src/lib/types.ts`, before `ErrorPositionView`:

```ts
/** The vault's Phoenix cross-margin account. Amounts are USDC atoms. */
export interface PerpPositionView extends Money {
  kind: "perp";
  strategy: string;
  traderAccount: string;
  equity: string;
  collateral: string;
  canonicalBalance: string;
  leverage: number | null;
  positions: PhoenixPerpPositionView[];
  lastActionTs: number;
  /** No open positions, no equity and nothing awaiting unwrap: the strategy can be closed. */
  closable: boolean;
}
```

In `ErrorPositionView`, add `protocol: StrategyProtocol;` after `strategy`. Change the union:

```ts
export type PositionView = IdlePositionView | SwapPositionView | LpPositionView | PerpPositionView | ErrorPositionView;
```

- [ ] **Step 4: Add the holding kinds**

In `src/lib/valuation.ts:5`:

```ts
export type HoldingKind = "idle" | "jupiter" | "dlmm_x" | "dlmm_y" | "dlmm_fee_x" | "dlmm_fee_y" | "phoenix_equity" | "phoenix_canonical";
```

- [ ] **Step 5: Implement holdings**

In `src/lib/holdings.ts`:

a) Canonical dedupe. Replace the `strategyMints` line with:

```ts
  // Jupiter target mints and Phoenix canonical mints are held in the vault's own token accounts, so
  // they also show up in `unmanagedHoldings` (a raw scan of every token account the vault owns). Drop
  // them there so the same on-chain balance is not reported as both idle and strategy holdings.
  const strategyMints = new Set(
    strategies.flatMap((s) => (s.type === "jupiter" ? [s.targetMint] : s.type === "phoenix" ? [s.canonicalMint] : [])),
  );
```

b) Raw holdings. In the `for (const s of strategies)` loop, add after the `dlmm` branch:

```ts
    } else if (s.type === "phoenix") {
      // Both are USDC at 1:1 (the canonical token is Ember-wrapped USDC), booked in the deposit mint as
      // the keeper does; Phoenix strategies only exist in USDC vaults. The canonical ATA is per vault,
      // so a second Phoenix strategy must not count it again.
      const x = { mint: deposit.mint, decimals: deposit.decimals, strategy: s.address };
      const firstPhoenix = strategies.find((t) => t.type === "phoenix") === s;
      raw.push(
        { kind: "phoenix_equity", ...x, amount: BigInt(s.equity) },
        { kind: "phoenix_canonical", ...x, amount: firstPhoenix ? BigInt(s.canonicalBalance) : 0n },
      );
```

c) Position rows. Remove the temporary `throw` from Task 3. In the `strategies.map` callback, the `unreadable` branch gains `protocol: s.protocol,` (after `strategy: s.address,`). After the `jupiter` branch, add:

```ts
    if (s.type === "phoenix") {
      return {
        kind: "perp",
        strategy: s.address,
        traderAccount: s.traderAccount,
        equity: s.equity,
        collateral: s.collateral,
        canonicalBalance: s.canonicalBalance,
        leverage: s.leverage,
        positions: s.positions,
        lastActionTs: s.lastActionTs,
        closable: s.positions.length === 0 && BigInt(s.equity) === 0n && BigInt(s.canonicalBalance) === 0n,
        ...money(value),
      };
    }
```

d) Sort. Replace the comment and `groupRank`:

```ts
  // ponytail: idle, then spot, then LP, then perps, then unreadable; value-desc inside each group.
  // Keeps the tall LP cards together instead of scattering them between one-line spot rows.
  const groupRank = { swap: 0, lp: 1, perp: 2, error: 3 } as const;
```

e) `isEmptyPosition`. Add to its doc comment: `A perp row is never hidden: an empty Phoenix account is the row whose "Close strategy" action must stay reachable.` The body needs no change: the final `return false` already covers `perp`.

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npx vitest run test/holdings.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in UI files that narrow `PositionView`: `position-card.tsx` (the `p.kind !== "lp"` branch now includes `perp`, which has no `token`) and `allocation-card.tsx` (`positionIcon` falls through to `p.token`). Task 6 fixes them. To keep this commit compiling, add a minimal guard in each file now:
- `position-card.tsx`, before `if (p.kind !== "lp")`: `if (p.kind === "perp") return null;`
- `allocation-card.tsx`, change `positionIcon`'s `p.kind === "error"` test to `p.kind === "error" || p.kind === "perp"`, and in `positionLabel` insert `: p.kind === "perp" ? "Phoenix Perps"` before the final `: "Unreadable position"`.
- `balance-tab.tsx`, in `actionsFor` right after `if (p.kind === "error") return [];`: `if (p.kind === "perp") return [];` (the code below it assumes an LP row).

Re-run `npx tsc --noEmit` → no errors; `npx vitest run` → all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/valuation.ts src/lib/holdings.ts src/components/holdings/position-card.tsx src/components/holdings/allocation-card.tsx src/components/manage/balance-tab.tsx test/holdings.test.ts
git commit -m "feat(phoenix): book trader equity in live holdings"
```

---

### Task 5: Close a Phoenix strategy

**Files:**
- Modify: `src/server/tx/vault.ts:100-135`
- Test: `test/tx-vault.test.ts`

**Interfaces:**
- Consumes: `PHOENIX_GLOBAL_CONFIG`, `parseGlobalConfig`, `PhoenixReadError` from `@/server/phoenix`.
- Produces: `closeStrategyIx(program, ctx, authority, strategy)` (unchanged signature) handles `phoenixPerp`.

- [ ] **Step 1: Write the failing tests**

In `test/tx-vault.test.ts`, add imports:

```ts
import { getConnection } from "@/server/program";
import { PHOENIX_GLOBAL_CONFIG, PHOENIX_PROGRAM_ID } from "@/server/phoenix";
```

(Merge `getConnection` into the existing `@/server/program` import.) Inside `describe("closeStrategyIx")`, add:

```ts
  const globalConfig = (canonicalMint: PublicKey) => {
    const data = Buffer.alloc(776);
    Buffer.from([37, 146, 212, 210, 47, 136, 111, 20]).copy(data);
    canonicalMint.toBuffer().copy(data, 296);
    return { data, owner: PHOENIX_PROGRAM_ID, lamports: 1, executable: false };
  };

  it("passes the trader, global config, canonical ATA and token program for Phoenix", async () => {
    stub({ vault: ctx.key, strategyType: { phoenixPerp: { traderAccount: pk(7) } } });
    const canonicalMint = pk(8);
    vi.spyOn(getConnection(), "getAccountInfo").mockResolvedValue(globalConfig(canonicalMint));
    const ix = await closeStrategyIx(program, ctx, pk(5), pk(6));
    expect(ix.keys.slice(-4)).toEqual([
      { pubkey: pk(7), isWritable: false, isSigner: false },
      { pubkey: PHOENIX_GLOBAL_CONFIG, isWritable: false, isSigner: false },
      { pubkey: getAssociatedTokenAddressSync(canonicalMint, ctx.key, true, TOKEN_PROGRAM), isWritable: true, isSigner: false },
      { pubkey: TOKEN_PROGRAM, isWritable: false, isSigner: false },
    ]);
  });

  it("fails with 502 when the Phoenix global config cannot be read", async () => {
    stub({ vault: ctx.key, strategyType: { phoenixPerp: { traderAccount: pk(7) } } });
    vi.spyOn(getConnection(), "getAccountInfo").mockResolvedValue(null);
    await expect(closeStrategyIx(program, ctx, pk(5), pk(6))).rejects.toMatchObject({ status: 502 });
  });

  it("rejects an unknown strategy type with 400 instead of treating it as Jupiter", async () => {
    stub({ vault: ctx.key, strategyType: { somethingNew: { account: pk(7) } } });
    await expect(closeStrategyIx(program, ctx, pk(5), pk(6))).rejects.toMatchObject({ status: 400 });
  });
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run test/tx-vault.test.ts`
Expected: FAIL. The Phoenix case throws `Cannot read properties of undefined (reading 'targetMint')`, and the unknown-type case fails with the same TypeError instead of a 400.

- [ ] **Step 3: Implement**

In `src/server/tx/vault.ts`, add `import { parseGlobalConfig, PHOENIX_GLOBAL_CONFIG } from "../phoenix";`. Import `getConnection` and `TOKEN_PROGRAM_ID` from `../program` if they aren't imported already. Then replace the `StrategyType` alias and the `remainingAccounts` block:

```ts
type StrategyType =
  | { jupiterSwap: { targetMint: PublicKey } }
  | { meteoraDlmm: { position: PublicKey } }
  | { phoenixPerp: { traderAccount: PublicKey } };
```

```ts
  const strategyType = account.strategyType as StrategyType;
  let remainingAccounts: AccountMeta[];
  if ("meteoraDlmm" in strategyType) {
    remainingAccounts = [
      writable(strategyType.meteoraDlmm.position),
      readonly(DLMM_PROGRAM_ID),
      readonly(DLMM_EVENT_AUTHORITY),
    ];
  } else if ("phoenixPerp" in strategyType) {
    // The program closes the vault's canonical-mint ATA (SPL Token) if it exists; the mint comes from Phoenix.
    const info = await getConnection().getAccountInfo(PHOENIX_GLOBAL_CONFIG);
    if (!info) throw new ApiError(502, "PhoenixUnavailable", "Phoenix global config not found");
    let canonicalMint: PublicKey;
    try {
      canonicalMint = parseGlobalConfig(info).canonicalMint;
    } catch (e) {
      throw new ApiError(502, "PhoenixUnavailable", (e as Error).message);
    }
    remainingAccounts = [
      readonly(strategyType.phoenixPerp.traderAccount),
      readonly(PHOENIX_GLOBAL_CONFIG),
      writable(getAssociatedTokenAddressSync(canonicalMint, ctx.key, true, TOKEN_PROGRAM_ID)),
      readonly(TOKEN_PROGRAM_ID),
    ];
  } else if ("jupiterSwap" in strategyType) {
    const mint = strategyType.jupiterSwap.targetMint;
    const tokenProgram = await getTokenProgram(mint);
    remainingAccounts = [
      writable(getAssociatedTokenAddressSync(mint, ctx.key, true, tokenProgram)),
      readonly(tokenProgram),
    ];
  } else {
    throw new ApiError(400, "Validation", "Unsupported strategy type");
  }
```

Before settling on `readonly` for the trader, check `vault_close_strategy.rs`: the program only loads `trader_account_info` to call `is_empty()` and never writes it. If `tests/handler/vault_close_strategy.ts` in hedge_vault passes the trader as writable, match the program tests instead.

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run test/tx-vault.test.ts`
Expected: PASS (all existing `closeStrategyIx` tests plus the three new ones).

- [ ] **Step 5: Commit**

```bash
git add src/server/tx/vault.ts test/tx-vault.test.ts
git commit -m "fix(vault): close phoenix strategies with their remaining accounts"
```

---

### Task 6: Portfolio UI for perp rows

**Files:**
- Modify: `src/components/holdings/position-card.tsx`
- Modify: `src/components/holdings/allocation-card.tsx`
- Modify: `src/components/manage/balance-tab.tsx`
- Create: `src/lib/perps.ts`
- Test: `test/perps.test.ts`

**Interfaces:**
- Consumes: `PerpPositionView`, `ErrorPositionView.protocol` from Task 4.
- Produces (from `@/lib/perps`):
  - `USDC_DECIMALS = 6`
  - `usdc(raw: string | bigint): number`: USDC atoms → dollars
  - `perpTotals(p: Pick<PerpPositionView, "positions">): { unrealizedPnl: bigint; accruedFunding: bigint; notional: bigint }`
  - `formatSignedUsd(raw: string | bigint): string`: `+$1.23` / `-$1.23` / `$0.00`
  - `formatLeverage(leverage: number | null): string`: `"1.52x"` or `"—"`

- [ ] **Step 1: Write the failing tests**

Create `test/perps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatLeverage, formatSignedUsd, perpTotals, usdc } from "@/lib/perps";

const pos = (unrealizedPnl: string, accruedFunding: string, notional: string) => ({
  assetId: 0, symbol: "SOL", side: "long" as const, size: "1", entryPrice: "1", markPrice: "1", notional, unrealizedPnl, accruedFunding,
});

describe("perps helpers", () => {
  it("sums uPnL, funding and notional across positions", () => {
    expect(perpTotals({ positions: [pos("100", "-5", "1000"), pos("-40", "2", "500")] })).toEqual({
      unrealizedPnl: 60n, accruedFunding: -3n, notional: 1500n,
    });
    expect(perpTotals({ positions: [] })).toEqual({ unrealizedPnl: 0n, accruedFunding: 0n, notional: 0n });
  });

  it("formats signed USDC amounts and leverage", () => {
    expect(usdc("1500000")).toBe(1.5);
    expect(formatSignedUsd("83700")).toBe("+$0.08");
    expect(formatSignedUsd(-440_000n)).toBe("-$0.44");
    expect(formatSignedUsd("0")).toBe("$0.00");
    expect(formatLeverage(1.5234)).toBe("1.52x");
    expect(formatLeverage(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run test/perps.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/perps"`.

- [ ] **Step 3: Implement `src/lib/perps.ts`**

```ts
import { formatUsd, toUiNumber } from "./format";
import type { PerpPositionView } from "./types";

/** Phoenix amounts are USDC atoms: one quote lot each. */
export const USDC_DECIMALS = 6;

export const usdc = (raw: string | bigint) => toUiNumber(raw, USDC_DECIMALS);

export function perpTotals(p: Pick<PerpPositionView, "positions">) {
  return p.positions.reduce(
    (a, q) => ({
      unrealizedPnl: a.unrealizedPnl + BigInt(q.unrealizedPnl),
      accruedFunding: a.accruedFunding + BigInt(q.accruedFunding),
      notional: a.notional + BigInt(q.notional),
    }),
    { unrealizedPnl: 0n, accruedFunding: 0n, notional: 0n },
  );
}

export function formatSignedUsd(raw: string | bigint): string {
  const n = usdc(raw);
  return n > 0 ? `+${formatUsd(n)}` : formatUsd(n);
}

export const formatLeverage = (leverage: number | null) => (leverage === null ? "—" : `${leverage.toFixed(2)}x`);
```

Check `toUiNumber(raw, decimals)` in `src/lib/format.ts:7` accepts `string | bigint` (it does).

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run test/perps.test.ts`
Expected: PASS.

- [ ] **Step 5: Position card perp branch and protocol-aware error card**

In `src/components/holdings/position-card.tsx`:
- Add imports: `import { formatLeverage, formatSignedUsd, perpTotals, usdc } from "@/lib/perps";`
- In the `error` branch, replace the literal `DLMM position` with `{p.protocol === "phoenix" ? "Phoenix account" : "DLMM position"}`.
- Replace the temporary `if (p.kind === "perp") return null;` from Task 4 with:

```tsx
  if (p.kind === "perp") {
    const totals = perpTotals(p);
    const tone = (raw: bigint) => (raw > 0n ? "text-sky-400" : raw < 0n ? "text-red-400" : "text-muted");
    return (
      <div className="space-y-3 px-6 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Phoenix Perps
              <Badge>Cross margin</Badge>
              <Address value={p.traderAccount} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
              <span>Collateral {formatUsd(usdc(p.collateral))}</span>
              <span>Leverage {formatLeverage(p.leverage)}</span>
              <span className={tone(totals.unrealizedPnl)}>uPnL {formatSignedUsd(totals.unrealizedPnl)}</span>
              {p.lastActionTs > 0 && <span>Last action {formatRelative(p.lastActionTs)}</span>}
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
            <ValueBlock usd={p.usd} shareBps={p.shareBps} />
            {menu}
          </div>
        </div>
        {p.positions.length > 0 ? (
          <ul className="space-y-1 text-[12px] tabular-nums">
            {p.positions.map((q) => (
              <li key={q.assetId} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{q.symbol}</span>
                <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                <span className="text-muted">{q.size}</span>
                <span className={tone(BigInt(q.unrealizedPnl))}>uPnL {formatSignedUsd(q.unrealizedPnl)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted">No open positions.</p>
        )}
        {BigInt(p.canonicalBalance) > 0n && (
          <p className="text-[12px] text-muted">{formatUsd(usdc(p.canonicalBalance))} withdrawn from Phoenix, awaiting unwrap.</p>
        )}
      </div>
    );
  }
```

- [ ] **Step 6: Allocation card label and icon**

In `src/components/holdings/allocation-card.tsx`, replace the Task 4 stopgap so perp rows get their own neutral icon instead of the warning dot:

```tsx
const positionIcon = (p: PositionView): ReactNode =>
  p.kind === "lp" ? (
    <PairLogo x={p.tokenX} y={p.tokenY} size="sm" />
  ) : p.kind === "error" ? (
    <span className="size-5 shrink-0 rounded-full bg-warning-soft" />
  ) : p.kind === "perp" ? (
    <span className="size-5 shrink-0 rounded-full bg-accent-soft" />
  ) : (
    <TokenLogo token={p.token} size="sm" />
  );
```

Keep the label `"Phoenix Perps"` added in Task 4.

- [ ] **Step 7: Close action on the manage Portfolio**

In `src/components/manage/balance-tab.tsx`, inside `actionsFor`, replace the Task 4 stopgap `if (p.kind === "perp") return [];` with:

```tsx
    if (p.kind === "perp")
      return [
        {
          label: "Close strategy",
          disabled: !operational || !p.closable || pending,
          reason: !operational ? "Vault not operational" : "Close all positions and withdraw from Phoenix first",
          onSelect: () => closeStrategy(p.strategy, "Phoenix"),
        },
      ];
```

- [ ] **Step 8: Typecheck, lint, test**

```bash
npx tsc --noEmit
npx eslint src/components/holdings/position-card.tsx src/components/holdings/allocation-card.tsx src/components/manage/balance-tab.tsx src/lib/perps.ts
npx vitest run
```

Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/perps.ts test/perps.test.ts src/components/holdings/position-card.tsx src/components/holdings/allocation-card.tsx src/components/manage/balance-tab.tsx
git commit -m "feat(phoenix): show perp accounts in the portfolio"
```

---

### Task 7: Perps tab

**Files:**
- Create: `src/components/manage/perps-tab.tsx`
- Modify: `src/app/manage/[address]/page.tsx:153-157`

**Interfaces:**
- Consumes: `useHoldings` (`@/hooks/queries`), `PerpPositionView`, `ErrorPositionView`, and `perpTotals` / `formatSignedUsd` / `formatLeverage` / `usdc` from `@/lib/perps`; `PositionCard` for the unreadable card.
- Produces: `PerpsTab({ v }: { v: VaultDetail })`.

- [ ] **Step 1: Implement `src/components/manage/perps-tab.tsx`**

```tsx
"use client";

import { PositionCard } from "@/components/holdings/position-card";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings } from "@/hooks/queries";
import { formatPrice, formatUsd } from "@/lib/format";
import { formatLeverage, formatSignedUsd, perpTotals, usdc } from "@/lib/perps";
import type { ErrorPositionView, PerpPositionView, VaultDetail } from "@/lib/types";

const signTone = (raw: string | bigint) => {
  const n = BigInt(raw);
  return n > 0n ? "text-sky-400" : n < 0n ? "text-red-400" : "text-muted";
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function PerpAccount({ p }: { p: PerpPositionView }) {
  const totals = perpTotals(p);
  return (
    <Card>
      <CardHeader title="Phoenix cross-margin account" description={<Address value={p.traderAccount} />} />
      <CardBody className="space-y-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
          <Stat label="Equity">{formatUsd(usdc(p.equity))}</Stat>
          <Stat label="Collateral">{formatUsd(usdc(p.collateral))}</Stat>
          <Stat label="Leverage">{formatLeverage(p.leverage)}</Stat>
          <Stat label="Unrealized PnL">
            <span className={signTone(totals.unrealizedPnl)}>{formatSignedUsd(totals.unrealizedPnl)}</span>
          </Stat>
          <Stat label="Accrued funding">
            <span className={signTone(totals.accruedFunding)}>{formatSignedUsd(totals.accruedFunding)}</span>
          </Stat>
        </div>
        {BigInt(p.canonicalBalance) > 0n && (
          <p className="text-[12px] text-muted">{formatUsd(usdc(p.canonicalBalance))} withdrawn from Phoenix, awaiting unwrap.</p>
        )}
        {p.positions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No open positions.</p>
        ) : (
          <>
            {/* Table from sm up; stacked cards on phones. */}
            <table className="hidden w-full text-[13px] tabular-nums sm:table">
              <thead className="text-[11px] text-muted">
                <tr className="text-right [&>th:first-child]:text-left">
                  <th className="pb-2 font-normal">Market</th>
                  <th className="pb-2 font-normal">Side</th>
                  <th className="pb-2 font-normal">Size</th>
                  <th className="pb-2 font-normal">Entry</th>
                  <th className="pb-2 font-normal">Mark</th>
                  <th className="pb-2 font-normal">Notional</th>
                  <th className="pb-2 font-normal">uPnL</th>
                  <th className="pb-2 font-normal">Funding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.positions.map((q) => (
                  <tr key={q.assetId} className="text-right [&>td:first-child]:text-left">
                    <td className="py-2 font-medium">{q.symbol}</td>
                    <td className="py-2">
                      <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                    </td>
                    <td className="py-2">{q.size}</td>
                    <td className="py-2">{formatPrice(Number(q.entryPrice))}</td>
                    <td className="py-2">{formatPrice(Number(q.markPrice))}</td>
                    <td className="py-2">{formatUsd(usdc(q.notional))}</td>
                    <td className={`py-2 ${signTone(q.unrealizedPnl)}`}>{formatSignedUsd(q.unrealizedPnl)}</td>
                    <td className={`py-2 ${signTone(q.accruedFunding)}`}>{formatSignedUsd(q.accruedFunding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-3 sm:hidden">
              {p.positions.map((q) => (
                <li key={q.assetId} className="rounded-lg border border-border p-3 text-[13px] tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{q.symbol}</span>
                    <Badge tone={q.side === "long" ? "accent" : "danger"}>{q.side === "long" ? "Long" : "Short"}</Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 [&>dd]:text-right [&>dt]:text-muted">
                    <dt>Size</dt><dd>{q.size}</dd>
                    <dt>Entry</dt><dd>{formatPrice(Number(q.entryPrice))}</dd>
                    <dt>Mark</dt><dd>{formatPrice(Number(q.markPrice))}</dd>
                    <dt>Notional</dt><dd>{formatUsd(usdc(q.notional))}</dd>
                    <dt>uPnL</dt><dd className={signTone(q.unrealizedPnl)}>{formatSignedUsd(q.unrealizedPnl)}</dd>
                    <dt>Funding</dt><dd className={signTone(q.accruedFunding)}>{formatSignedUsd(q.accruedFunding)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Read-only view of the vault's Phoenix accounts, from the same holdings query as the Portfolio. */
export function PerpsTab({ v }: { v: VaultDetail }) {
  const holdings = useHoldings(v.address);
  if (holdings.error)
    return <ErrorState message={`Holdings unavailable: ${holdings.error.message}`} onRetry={() => void holdings.refetch()} />;
  const h = holdings.data;
  if (!h) return <Skeleton className="h-72 rounded-card" />;

  const accounts = h.positions.filter((p): p is PerpPositionView => p.kind === "perp");
  const broken = h.positions.filter((p): p is ErrorPositionView => p.kind === "error" && p.protocol === "phoenix");
  if (accounts.length === 0 && broken.length === 0)
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-muted">No Phoenix account yet. Perp trading actions are coming soon.</CardBody>
      </Card>
    );
  return (
    <div className="space-y-6">
      {broken.length > 0 && (
        <Card>
          <div className="divide-y divide-border">
            {broken.map((p) => (
              <PositionCard key={p.strategy} position={p} depositToken={h.depositToken} />
            ))}
          </div>
        </Card>
      )}
      {accounts.map((p) => (
        <PerpAccount key={p.strategy} p={p} />
      ))}
    </div>
  );
}
```

Before relying on this, check the component APIs. `CardHeader`'s `description` prop type is in `src/components/ui/card.tsx`; if it only accepts `string`, pass `description={`Trader ${shortAddress(p.traderAccount)}`}` (import `shortAddress` from `@/lib/format`) and render `<Address>` inside `CardBody` instead. Also confirm `ErrorState` and `Skeleton` are imported from the same paths `holdings-section.tsx` uses.

- [ ] **Step 2: Wire the tab**

In `src/app/manage/[address]/page.tsx`, import `import { PerpsTab } from "@/components/manage/perps-tab";` and replace:

```tsx
      {tab === "perps" && (
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted">Perps are coming soon. Details TBD.</CardBody>
        </Card>
      )}
```

with:

```tsx
      {tab === "perps" && <PerpsTab v={v} />}
```

If `Card` / `CardBody` are now unused in `page.tsx`, remove them from its import.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint src/components/manage/perps-tab.tsx "src/app/manage/[address]/page.tsx"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/manage/perps-tab.tsx "src/app/manage/[address]/page.tsx"
git commit -m "feat(phoenix): perps tab with account summary and positions"
```

---

### Task 8: End-to-end verification

**Files:** none (verification only; fix and commit anything found).

- [ ] **Step 1: Full suite, typecheck, lint, build**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src test
npm run build
```

Expected: all pass. `next build` also catches server/client boundary mistakes: `src/server/phoenix.ts` imports `server-only`, so no client component may import it. `src/lib/perps.ts` must not import from `@/server`.

- [ ] **Step 2: Run the app against a vault with a Phoenix strategy**

Use the `run` skill (or `npm run dev`) with a mainnet RPC in `.env`. Pick a vault with a Phoenix strategy: find one through the keeper's DB, or ask the user for its address. Then check:
- Portfolio shows a "Phoenix Perps" row with an equity value and NAV share; the allocation bar includes it.
- Perps tab shows the summary strip and positions table. Resize to 375px wide: the table becomes stacked cards with no horizontal scroll.
- The Phoenix row's equity matches the keeper's latest NAV snapshot for that strategy within the price movement since the snapshot (`phoenix_equity` holding in the keeper's valuation logs or DB).
- A vault with no Phoenix strategy shows the "No Phoenix account yet" empty state.

If no vault on the target cluster has a Phoenix strategy, say so in the final report rather than claiming the UI was checked against real data.

- [ ] **Step 3: Commit any fixes**

```bash
git add <each fixed file by path>
git commit -m "fix(phoenix): <what verification found>"
```
