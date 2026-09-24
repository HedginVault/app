# Phoenix Perps: read and display vault positions

Date: 2026-09-24
Status: approved design, pending implementation plan

## Goal

The hedge_vault program gained a `PhoenixPerp { trader_account }` strategy (hedge_vault `ff4a1be`), and the
keeper already counts its equity in NAV (hedgin_keeper `8925632`..`4095934`). The app silently drops these
strategies. This change makes the app read a vault's Phoenix cross-margin account and display it in the
Portfolio (manage and public vault pages) and in the manage page's Perps tab.

Success: a vault with a Phoenix strategy shows its equity, collateral, leverage and per-position detail;
its live holdings total includes Phoenix equity using the same arithmetic as the keeper; and closing an empty
Phoenix strategy builds a valid instruction.

## Scope

In scope:
- Reading and valuing Phoenix trader accounts server-side.
- Display fields (option B): market, side, size, entry, mark, notional, unrealized PnL, accrued funding,
  plus account-level equity, collateral and leverage.
- Fixing `closeStrategyIx` for `phoenixPerp` (today it falls into the Jupiter branch and throws).
- Accepting `"phoenix"` in strategy history types.

Out of scope:
- Trading actions (initialize, deposit, withdraw, place or cancel orders).
- Liquidation price and margin health (would need the SDK's risk engine).
- Hawkeye cross-check (keeper-only, opt-in).
- IDL sync: `src/idl/hedge_vault.json` already matches `hedge_vault/target/idl` and includes every Phoenix type.

## Approach

Server-side on-chain decode, patch-ported from `hedgin_keeper/src/valuation/phoenix.ts`, following the
existing rule that the app ports keeper arithmetic (as `lib/valuation.ts` does) rather than sharing a
package. Market symbols come from Phoenix's HTTP API; everything that affects value comes from chain.

New dependency: `@ellipsis-labs/rise@0.5.28` (same pin as the keeper), used for `decodeTrader`,
`decodePerpAssetMap` and the HTTP client's `exchange.getMarkets()`.

## Units

Phoenix collateral is USDC wrapped 1:1 by Ember; one quote lot is one USDC atom (6 decimals).
For a market with `tickSize` and `baseLotDecimals`:

- size (base units) = `baseLots / 10^baseLotDecimals`
- price (USDC per base unit) = `ticks * tickSize * 10^baseLotDecimals / 10^6`
- entry (quote lots per base lot) = `-virtualQuoteLots / baseLots`
- mark (quote lots per base lot) = `markTicks * tickSize`
- notional (quote lots) = `|baseLots| * markTicks * tickSize`
- unrealized PnL (quote lots) = `virtualQuoteLots + baseLots * markTicks * tickSize`
- accrued funding (quote lots) = `-baseLots * (cumulativeFundingRate - fundingSnapshot)`
- equity (quote lots) = `max(0, collateral + Σ (uPnL + funding))` — identical to the keeper's `computeTraderEquity`
- leverage = `Σ notional / equity`, `null` when equity is 0

Sign conventions are verified against the keeper's mainnet fixture (pinned to Hawkeye ViewMargin) before
the display helpers are trusted.

## Components

### `src/server/phoenix.ts` (new)

Patch-port of the keeper module:
- Constants `PHOENIX_PROGRAM_ID`, `PHOENIX_GLOBAL_CONFIG`, `USDC_MINT`, `MAX_MARK_AGE_SLOTS`.
- `parseGlobalConfig`, `decodeTraderState`, `decodeMarkets`, `checkTrader`, `computeTraderEquity`,
  unchanged except `decodeMarkets` also returns `baseLotDecimals`. Errors use a local `PhoenixReadError`
  carrying the keeper's reason strings (`phoenix_decode:<key>`, `phoenix_stale_mark:<assetId>`, ...).
- `describePosition(position, market)` — pure; returns the display fields above as decimal strings.
- `getPhoenixMarketNames()` — `Map<assetId, symbol>` from `exchange.getMarkets()`, cached 10 min via
  `cached()`; on failure returns an empty map and logs a warning.

### `src/lib/types.ts`

```ts
interface PhoenixPerpPositionView {
  assetId: number;
  symbol: string;              // "Asset #<id>" when the name is unknown
  side: "long" | "short";
  size: string;                // base units, decimal string
  entryPrice: string;          // USDC, decimal string
  markPrice: string;           // USDC, decimal string
  notional: string;            // USDC base units
  unrealizedPnl: string;       // USDC base units, signed
  accruedFunding: string;      // USDC base units, signed
}

interface PhoenixStrategyView extends StrategyBase {
  type: "phoenix";
  traderAccount: string;
  canonicalMint: string;
  collateral: string;          // USDC base units
  equity: string;              // USDC base units
  canonicalBalance: string;    // canonical-mint base units in the vault's ATA
  leverage: number | null;
  positions: PhoenixPerpPositionView[];
  closable: boolean;           // mirrors the program's close precondition: see below
}
```

- `StrategyView` adds `PhoenixStrategyView`.
- `StrategyHistoryItem.type` and the history reader's `strategy_type` add `"phoenix"`.
- `PositionView` adds `PerpPositionView` (`kind: "perp"`): `strategy`, `traderAccount`, `equity`,
  `collateral`, `leverage`, `positions`, `canonicalBalance`, `lastActionTs`, `closable`, plus `Money`.
- `UnreadableStrategyView.position` holds the trader account for Phoenix failures.

### `src/server/readers/strategies.ts`

- Select rows with `"phoenixPerp" in strategyType`.
- `phoenixViewsFor(vault, items)`:
  1. Read `PHOENIX_GLOBAL_CONFIG`; parse for `perpAssetMap` and `canonicalMint`.
  2. One `getMultipleAccountsInfoAndContext` for the perp asset map, the vault's canonical ATA
     (`getAssociatedTokenAddressSync(canonicalMint, vault, true, TOKEN_PROGRAM_ID)`) and every trader
     account; its context slot drives the mark-age check, so all values come from one slot.
  3. `getPhoenixMarketNames()` in parallel.
  4. Per strategy: decode, `checkTrader`, `computeTraderEquity`, `describePosition` for each position with
     non-zero base lots.
- Any failure for a single trader yields an `unreadable` view with the reason; a failure reading the global
  config or asset map makes every Phoenix strategy unreadable. Jupiter and DLMM views are unaffected.

### `src/lib/valuation.ts`

- `HoldingKind` adds `"phoenix_equity" | "phoenix_canonical"`. No arithmetic change: in a USDC vault both
  pass through the `mint === deposit.mint` branch or the 1:1 canonical rule below.

### `src/lib/holdings.ts`

- For each `phoenix` strategy push `phoenix_equity` and `phoenix_canonical`, both with the vault's deposit
  mint and decimals (amounts `equity` and `canonicalBalance`). This is exactly what the keeper books: the
  canonical token is USDC wrapped 1:1, so it needs no price of its own and never makes the total partial.
- Drop the canonical mint from `unmanagedHoldings`, as Jupiter target mints are, so it is not counted twice.
- No non-USDC fallback: `phoenix_initialize_strategy` requires `vault.deposit_mint == USDC_MINT`, so a
  Phoenix strategy only exists in a USDC vault.
- Build `kind: "perp"` rows; `closable` comes straight from the Phoenix strategy view, which mirrors the
  program's `PhoenixTrader::is_empty` check: raw `quote_lot_collateral == 0`, every position entry absent
  (`position_count == 0`, not just the ones with a non-zero base lot the UI renders), no withdrawal queued
  (`withdraw_queue_node == 0`, decoded by rise as `withdrawQueueNode === null`), and the canonical ATA the
  close instruction also touches empty.
- Sort order: idle → swap → lp → perp → error. `isEmptyPosition` never hides a perp row: an empty Phoenix
  account is exactly the row whose "Close strategy" action must stay reachable.

### `src/server/tx/vault.ts`

- `StrategyType` adds `{ phoenixPerp: { traderAccount: PublicKey } }`.
- `closeStrategyIx` Phoenix branch, remaining accounts per `vault_close_strategy.rs`:
  1. trader account (readonly)
  2. `PHOENIX_GLOBAL_CONFIG` (readonly)
  3. vault canonical ATA (writable; canonical mint read from the global config)
  4. SPL Token program (readonly)
- Unknown strategy types throw `ApiError(400, "Validation", ...)` instead of falling into the Jupiter branch.

### UI

`src/components/holdings/position-card.tsx` — `kind === "perp"` branch: "Phoenix Perps" badge; equity and
NAV share via `ValueBlock`; collateral, leverage and net uPnL (sign-colored); one line per position
(`SOL-PERP · Long 12.5 · uPnL +$84.20`); a note when `canonicalBalance > 0` ("X USDC withdrawn, awaiting
unwrap"); last action time. Renders on both manage Portfolio and the public vault page via `HoldingsSection`.
On the manage Portfolio, a closable perp row gets the same "Close strategy" menu action swap rows have, so the
fixed `closeStrategyIx` has a caller. The unreadable card names its protocol ("Phoenix account" vs
"DLMM position") instead of always saying DLMM.

Units, verified against 67 mainnet positions: USDC price = `ticks × tickSize × 10^baseLotDecimals / 10^6`;
`baseLotDecimals` can be negative (PUMP is −2). `accumulatedFundingForActivePosition` is 0 on every sampled
position, so accrued funding uses the snapshot formula above.

`src/components/manage/perps-tab.tsx` (new) replaces the placeholder in `app/manage/[address]/page.tsx`:
- Uses the existing holdings query; no new API route.
- Summary strip per trader account: equity, collateral, leverage, total uPnL, total accrued funding, trader
  account (Solscan link).
- Positions table: Market · Side · Size · Entry · Mark · Notional · uPnL · Funding; numbers right-aligned
  with existing `format.ts` helpers; long/short badges; stacks to one card per position at phone width.
- Empty states: no Phoenix strategy → "No Phoenix account yet. Perp trading actions are coming soon.";
  account with no positions → summary strip plus "No open positions".
- Unreadable Phoenix strategy → existing error card with its reason.

## Error handling

| Condition | Result |
|---|---|
| Trader decode fails, authority/index mismatch, native SOL, splines | that strategy `unreadable`, holdings `partial` |
| Stale (> 1,500 slots) or zero mark under an open position | that strategy `unreadable` (`phoenix_stale_mark` / `phoenix_zero_mark`) |
| Global config or perp asset map missing / RPC error | all Phoenix strategies `unreadable` |
| Market-name API unavailable | symbols fall back to `Asset #<id>` |
| Equity ≤ 0 | equity clamped to 0, leverage `null` ("—") |

## Testing (vitest, TDD)

- `test/phoenix.test.ts` — port the keeper's `test/phoenix-fixture.ts` (mainnet bytes pinned to Hawkeye);
  assert decode and equity parity with the keeper's expected values; unit-test `describePosition` for long and
  short, entry, uPnL and funding signs, and `baseLotDecimals` / `tickSize` scaling.
- `test/holdings.test.ts` — Phoenix equity and canonical valued 1:1 in a USDC vault; canonical ATA removed
  from unmanaged; perp row sort and `closable`.
- `test/readers.test.ts` — `phoenixPerp` rows produce a `phoenix` view; a decode failure yields `unreadable`
  without affecting other strategies.
- `test/tx-*.test.ts` — `closeStrategyIx` Phoenix remaining accounts; unknown type → 400.
- Manual: run the app against a vault with a Phoenix strategy; compare equity with the keeper's latest NAV
  snapshot.
