# Hedge Vault — Web App

The web interface for the `hedge_vault` Solana program. Depositors browse vaults, read a vault's
state, request deposits and withdrawals and claim resolved requests; managers operate the vaults
whose `authority` is their wallet — settings, fee claims, the request queue, Jupiter swaps and
Meteora DLMM positions, vault creation and closure.

Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, Anchor 0.31.1.

Two rules shape the whole codebase:

- **The browser never talks to an RPC.** There is no client RPC URL and no `ConnectionProvider`;
  the browser never imports the Anchor library. `src/server/` decodes accounts into the view models
  in `src/lib/types.ts`; route handlers in `src/app/api/` just validate input and return JSON.
- **Every write is built on the server, signed in the browser, and sent by the server.**
  `POST /api/tx/*` assembles a v0 transaction, **simulates it**, and returns it unsigned in base64.
  The server holds no keys. The wallet only signs (`signTransaction`, never `sendTransaction`); the
  signed bytes go to `POST /api/tx/send`, and the client polls `GET /api/tx/status` until the
  signature is confirmed. A failed simulation, preflight or on-chain execution comes back with the
  decoded Anchor error code and the program logs.

There is no database in this version. Off-chain vault metadata lives in a static file
(`src/server/registry.ts`); reads are memoized in-process for 10–15 s. See
[`docs/app-fullstack-architecture.md`](../docs/app-fullstack-architecture.md) for how this grows
into an indexer + Postgres architecture.

## Prerequisites

- Node.js 20.9+ (Next 16 requires it)
- Yarn 1.x (`packageManager: yarn@1.22.22`)
- An RPC endpoint. A public endpoint works for browsing; a paid one is needed for anything
  involving Meteora DLMM, which reads many accounts per position.

```bash
cd app
yarn install
cp .env.example .env.local   # then fill in RPC_URL
yarn dev
```

## Environment

Copy `.env.example` to `.env.local`. Only `RPC_URL` matters to get running; `NEXT_PUBLIC_CLUSTER`
defaults to `mainnet-beta`.

| Variable | Side | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CLUSTER` | both | no (defaults to `mainnet-beta`) | `devnet` \| `testnet` \| `mainnet-beta`. Selects explorer links, the known-mint table and the server's public RPC fallback. |
| `RPC_URL` | **server only** | recommended | The one RPC endpoint: *every* read, simulation, lookup-table fetch, transaction send and confirmation. Never shipped to the browser, so it can hold an API key. Falls back to the public endpoint for the cluster. |
| `NEXT_PUBLIC_PROGRAM_ID` | both | no | Overrides the program id baked into `src/idl/hedge_vault.json`. Used for devnet deployments. |
| `JUPITER_API_HOST` | server | no | Jupiter API base. Defaults to `https://lite-api.jup.ag` without a key and `https://api.jup.ag` with one. |
| `JUPITER_API_KEY` | server | no | Sent as `x-api-key`. Raises the rate limit on token metadata, prices and swap instructions. |

## IDL

`src/idl/` is committed so the app builds without the Anchor `target/` directory (e.g. on Vercel).
After **every** `anchor build`, re-sync it:

```bash
cd .. && anchor build && cd app && yarn sync-idl
```

This copies `target/idl/hedge_vault.json` and `target/types/hedge_vault.ts` into `src/idl/`. Skipping
it means the app builds instructions against a stale program interface.

## Scripts

| Command | What it does |
| --- | --- |
| `yarn dev` | Dev server on http://localhost:3000 (`-p <port>` to change). |
| `yarn build` | Production build; also the type check — it fails on any TS error. |
| `yarn start` | Serves the production build. |
| `yarn lint` | ESLint (flat config, `eslint-config-next`). |
| `yarn test` | Vitest, once. Unit tests for the cache, readers, error decoding, formatting, route helpers and every instruction builder. |
| `yarn test:watch` | Vitest in watch mode. |
| `yarn sync-idl` | Copies the Anchor build output into `src/idl/`. |

## Routes

### Pages

| Path | What it is |
| --- | --- |
| `/` | Vault list: every vault with TVL, NAV, fees and status. |
| `/vault/[address]` | Vault detail: metrics, how-it-works, strategy list, your position, deposit and withdraw forms, pending-request panel. |
| `/manage` | Manager home: the vaults your connected wallet is the authority of, plus the create-vault form. |
| `/manage/[address]` | Manager console for one vault, behind a guard on `vault.authority`: overview (vault stats and the fee claim), requests, settings, Jupiter and DLMM panels, danger zone (close the vault). |

### API — reads (GET)

| Path | Returns |
| --- | --- |
| `/api/config` | `ConfigView` — protocol status, role keys, platform fee and cap bps. |
| `/api/vaults` | `VaultSummary[]` |
| `/api/vaults/[address]` | `VaultDetail` |
| `/api/vaults/[address]/position?owner=` | `UserPosition` |
| `/api/vaults/[address]/requests` | `RequestQueue` |
| `/api/vaults/[address]/strategies` | `StrategyView[]` (Jupiter and DLMM) |
| `/api/manager/[wallet]` | `ManagerView` — `isManager` plus the vaults that wallet authorizes |
| `/api/dlmm/pool/[lbPair]` | `PoolInfo` — token X/Y, bin step, active bin id and price |
| `/api/jupiter/quote?vault=&inputMint=&outputMint=&amount=&slippageBps=` | `QuoteView`, with `slippageBps` clamped to the protocol maximum. `vault` is required: one side of the quote must be that vault's deposit mint, which is the only swap the program will accept. Rate limited per IP. |

### API — transaction builders (POST)

Each returns `BuiltTransaction` (`{ transaction: base64, simulation: { unitsConsumed } }`), or an
array of them for `resolve-batch`. All take `payer` and, except for vault creation, `vault`. Two
routes return more than the transaction: `vault/initialize` returns `BuiltTransaction & { vault }`
(the PDA the client navigates to) and `dlmm/initialize` returns
`BuiltTransaction & { position, lowerBinId, upperBinId }` (the generated position key and the range
the position account will actually store). Every builder is rate limited per IP.

| Path | Body beyond `payer`/`vault` | Who may call |
| --- | --- | --- |
| `/api/tx/vault/initialize` | `name`, `depositMint`, fee bps, `depositCap`, `minDeposit`, `minWithdrawalShares` | registered manager |
| `/api/tx/vault/update` | any of fee bps, caps, minimums, `status` | vault authority |
| `/api/tx/vault/claim-fee` | — | vault authority |
| `/api/tx/vault/close` | — | vault authority |
| `/api/tx/deposit/create` | `amount` | anyone (self) |
| `/api/tx/deposit/cancel` | — | anyone (self) |
| `/api/tx/deposit/resolve` | `depositor` | anyone |
| `/api/tx/withdrawal/create` | `shares` | anyone (self) |
| `/api/tx/withdrawal/cancel` | — | anyone (self) |
| `/api/tx/withdrawal/resolve` | `withdrawer` | anyone |
| `/api/tx/resolve-batch` | — | anyone; returns every resolvable request, chunked into transactions |
| `/api/tx/jupiter/initialize` | `targetMint` | vault authority |
| `/api/tx/jupiter/swap` | `sourceMint`, `destinationMint`, `amount`, `slippageBps` | vault authority |
| `/api/tx/dlmm/initialize` | `lbPair`, and either `width` or `lowerBinId`/`upperBinId` (at most 70 bins — the DLMM cap for a position created without an extend) | vault authority |
| `/api/tx/dlmm/add` | `position`, `amountX`, `amountY`, `shape`, `maxActiveBinSlippage` | vault authority |
| `/api/tx/dlmm/remove` | `position`, `bpsToRemove` | vault authority |
| `/api/tx/dlmm/claim-fee` | `position` | vault authority |
| `/api/tx/strategy/close` | `strategy` | vault authority |

### API — send and confirm

| Path | What it does |
| --- | --- |
| `POST /api/tx/send` | Body `{ transaction }`: the wallet-signed transaction in base64. Relays it through `RPC_URL` with preflight and returns `{ signature }`. Only forwards transactions that invoke the hedge_vault program and carry a fee-payer signature; a preflight failure is a `422` with the decoded error. Shares the per-IP builder rate limit. |
| `GET /api/tx/status?signature=&blockhash=` | `{ status: "pending" \| "confirmed" \| "expired" }`, or `{ status: "failed", code, message, logs }`. `expired` means the blockhash can no longer land and the signature was never seen. Uncached, with its own per-IP rate limit bucket. |

Manager-only routes call `assertAuthority` before assembling anything; the UI guard is convenience,
the server check plus the program's `validate_authority()` check in each handler is the enforcement.

## Adding a vault to the registry

The chain stores only a 32-byte vault name. Everything else shown on the card and the detail page —
description, strategy blurb, manager name, tags, logo — comes from `src/server/registry.ts`. Add an
entry keyed by the vault address:

```ts
const REGISTRY: Record<string, VaultMetadata> = {
  YourVaultAddressBase58: {
    description: "One paragraph a depositor reads before depositing.",
    strategy: "One sentence on what the manager actually does.",
    managerName: "Manager",
    tags: ["USDC", "Market neutral"],
    // logo: "https://...",   // optional
  },
};
```

A vault with no entry still renders — `metadata` is `null` and the UI falls back to the on-chain
name. This file is the V1 stand-in for a `vault_metadata` table; see the fullstack doc.

## Layout

```
src/
  app/            pages and API route handlers
  components/     ui/ primitives, vaults/, vault/, manage/, shell/
  hooks/          TanStack Query hooks, useSendTransaction
  lib/            types.ts (the API contract), api.ts (typed client),
                  format.ts, vault-logic.ts (pure derived values), constants.ts
  server/         readers/, tx/ (instruction builders + assembler), program.ts,
                  cache.ts, tokens.ts, prices.ts, dlmm-pool.ts, registry.ts, errors.ts
  idl/            synced Anchor IDL + types
test/             vitest suites
```

## Further reading

- [`docs/app-fullstack-architecture.md`](../docs/app-fullstack-architecture.md) — where this goes
  next: event indexer, Postgres schema, API evolution, auth, notifications.
- [`docs/superpowers/specs/2026-09-14-app-layer-design.md`](../docs/superpowers/specs/2026-09-14-app-layer-design.md)
  — the design spec this app was built from.
- [`docs/accounts.md`](../docs/accounts.md) — the on-chain data model, PDAs and events.
- [`docs/architecture-evolution.md`](../docs/architecture-evolution.md) — how the program itself
  evolves.
