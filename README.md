# Hedgin — Web App

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
  The server holds no keys. The wallet signs (`signTransaction` or `signAllTransactions`, never `sendTransaction`); the
  signed bytes go to `POST /api/tx/send`, and the client polls `GET /api/tx/status` until the
  signature is confirmed. A failed simulation, preflight or on-chain execution comes back with the
  decoded Anchor error code and the program logs.

There is no database in this version. Off-chain vault metadata lives in a static file
(`src/server/registry.ts`); reads are memoized in-process for 10–15 s. See
[`docs/app-fullstack-architecture.md`](docs/app-fullstack-architecture.md) for how this grows
into an indexer + Postgres architecture.

## Prerequisites

- Node.js 20.9+ (Next 16 requires it)
- Yarn 1.x (`packageManager: yarn@1.22.22`)
- An RPC endpoint. A public endpoint works for browsing; a paid one is needed for anything
  involving Meteora DLMM, which reads many accounts per position.

```bash
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
| `METEORA_DLMM_API_HOST` | server | no | Meteora DLMM pool search API base. Defaults to `https://dlmm.datapi.meteora.ag`. |
| `DATABASE_URL` | **server only** | for closed-position and NAV history | Read-only access to the keeper's indexed strategy-history and nav_history tables. Never exposed to the browser. |

## IDL

`src/idl/` is committed so the app builds without the Anchor `target/` directory (e.g. on Vercel).
After building the standalone program repository, re-sync it:

```bash
HEDGE_VAULT_PROGRAM_REPO=../programs yarn sync-idl
```

The sync script defaults to a sibling `../programs` repository and copies its
`target/idl/hedge_vault.json` and `target/types/hedge_vault.ts` into `src/idl/`. Skipping it means
the app builds instructions against a stale program interface.

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
| `/vault/[address]` | Vault detail: NAV summary, live allocation by token and by position (logos, USD, share), position cards (Jupiter holdings, DLMM range, fees, bin chart), vault details, your position with deposit/withdraw. |
| `/manage` | Manager home: the vaults your connected wallet is the authority of, plus the create-vault form. |
| `/manage/[address]` | Manager console behind a guard on `vault.authority`: overview (holdings with per-position actions and a Swap / Liquidity panel whose state lives in the URL), requests, settings, danger zone. |

### API — reads (GET)

| Path | Returns |
| --- | --- |
| `/api/config` | `ConfigView` — protocol status, role keys, platform fee and cap bps. |
| `/api/vaults` | `VaultSummary[]` |
| `/api/vaults/[address]` | `VaultDetail` |
| `/api/vaults/[address]/position?owner=` | `UserPosition` |
| `/api/vaults/[address]/requests` | `RequestQueue` |
| `/api/vaults/[address]/strategies` | `StrategyView[]` (Jupiter and DLMM) |
| `/api/vaults/[address]/strategy-history` | Closed strategies with exact per-token contributed, returned, fee and realized-PnL base units; pre-upgrade rows are marked incomplete. |
| `/api/manager/[wallet]` | `ManagerView` — `isManager` plus the vaults that wallet authorizes |
| `/api/dlmm/pool/[lbPair]` | `PoolInfo` — token X/Y, bin step, active bin id and price |
| `/api/dlmm/position-rent?bins=` | Refundable PositionV2 rent in lamports for 1–1,400 bins, quoted from RPC and cached 10 min; excludes transaction fees and any new bin arrays. |
| `/api/jupiter/quote?vault=&inputMint=&outputMint=&amount=&slippageBps=` | `QuoteView`, with `slippageBps` clamped to the protocol maximum. `vault` is required: one side of the quote must be that vault's deposit mint, which is the only swap the program will accept. Rate limited per IP. |
| `/api/vaults/[address]/holdings` | `HoldingsView` — live valuation (keeper rules: deposit units, fees at 90%), token exposure and positions, NAV delta; `partial` when a price is missing. |
| `/api/tokens/search?query=` | `TokenSearchResult[]` from Jupiter token search, cached 1 h per query, rate limited. |
| `/api/dlmm/pools/search?query=&page=` | `PoolSearchPage` from Meteora's DLMM data API (logos from Jupiter), cached 60 s, rate limited. |

### API — transaction builders (POST)

Each returns `BuiltTransaction` (`{ transaction: base64, simulation: { unitsConsumed } }`), or an
array when all transactions can be prepared together. All take `payer` and, except for vault creation, `vault`. Two
routes return more than the transaction: `vault/initialize` returns `BuiltTransaction & { vault }`
(the PDA the client navigates to) and `dlmm/initialize` returns
`BuiltTransaction & { position, lowerBinId, upperBinId }` (the generated position key and the range
the position account will actually store). Compatible wallets approve a prepared transaction array
in one batch request; the client relays dependent transactions in order and submits independent
range transactions together before confirming them. A flow
whose next transaction depends on confirmed state returns `next: { path, body }` (`BuiltStep`). The
first transaction is simulated before signing. A later transaction that depends on state created by
the first is checked by relay preflight immediately before it is sent. Every builder is rate limited per IP.

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
| `/api/tx/jupiter/swap` | `sourceMint`, `destinationMint`, `amount`, `slippageBps`; initializes the Jupiter strategy for the target mint when missing (`initializesStrategy`); requests a direct non-shared Jupiter route so the vault PDA remains the CPI signer | vault authority |
| `/api/tx/dlmm/initialize` | `lbPair`, and either `width` or `lowerBinId`/`upperBinId` (at most 70 initial bins) | vault authority |
| `/api/tx/dlmm/open` | `lbPair`, `lowerBinId`, `upperBinId` (exclusive, ≤ 1,400 bins), `amountX`, `amountY`, `shape`, `maxActiveBinSlippage`; split positions return a resize and funding transaction batch | vault authority |
| `/api/tx/dlmm/extend` | Confirmed follow-up step that grows a position by at most 91 bins; repeats until the requested upper bin is reached | vault authority |
| `/api/tx/dlmm/add-range` | Funds a wide position in a batch of transaction-sized bin ranges | vault authority |
| `/api/tx/dlmm/add` | `position`, `amountX`, `amountY`, `shape`, `maxActiveBinSlippage` | vault authority |
| `/api/tx/dlmm/remove` | `position`, `bpsToRemove`; wide positions return a range transaction batch | vault authority |
| `/api/tx/dlmm/claim-fee` | `position`; wide positions return a range transaction batch | vault authority |
| `/api/tx/dlmm/zap-out` | `position`, `slippageBps`; available for positions up to 70 bins; removes all liquidity, claims fees, closes the DLMM position, then swaps only the non-deposit tokens returned by that position into the vault deposit mint (pre-existing idle balances are preserved) | vault authority |
| `/api/tx/strategy/close` | `strategy` | vault authority |

### API — send and confirm

| Path | What it does |
| --- | --- |
| `POST /api/tx/send` | Body `{ transaction }`: the wallet-signed transaction in base64. Relays it through `RPC_URL` with preflight and returns `{ signature }`. Only forwards transactions that invoke the hedge_vault program and carry a fee-payer signature; a preflight failure is a `422` with the decoded error. Shares the per-IP builder rate limit. |
| `GET /api/tx/status?signature=&blockhash=` | `{ status: "pending" \| "confirmed" \| "expired" }`, or `{ status: "failed", code, message, logs }`. Before returning `expired`, the server verifies the blockhash can no longer land and searches transaction history for the signature. Uncached, with its own per-IP rate limit bucket. |

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

## Deploy

`.github/workflows/build-deploy.yml` runs on pushes to `main` (except documentation-only
changes) and manual dispatches. It builds and pushes immutable and `main` tags to
`ghcr.io/hedginvault/app`, runs lint, tests, and the production build, then deploys the
immutable image to the `hedgevault-prod` namespace. The Kubernetes manifests provide a
Deployment, ClusterIP Service, nginx Ingress with cert-manager TLS, and health probes at
`/api/health`.

One-time GitHub setup:

- Add the base64-encoded cluster configuration as the `KUBECONFIG` secret.
- Point `hedgin.xyz` DNS to the server running nginx Ingress.
- Optionally add required reviewers to the `production` Environment.

One-time cluster setup (not managed by the workflow):

- `ghcr-pull` in `hedgevault-prod` — image pull credentials for GHCR.
- `app-secrets` in `hedgevault-prod` — `RPC_URL`, `DATABASE_URL`, and, when used, `JUPITER_API_KEY`.
  Never put these values in the ConfigMap, image, or a `NEXT_PUBLIC_*` variable.

`NEXT_PUBLIC_CLUSTER` is intentionally set to `mainnet-beta` in both the image build and
`k8s/configmap.yaml`. Because Next.js embeds public variables during `yarn build`, change both
together if the deployment target changes.

## Further reading

- [`docs/app-fullstack-architecture.md`](docs/app-fullstack-architecture.md) — the broader event-indexing,
  Postgres, API, auth and notification roadmap; strategy history is the first implemented slice.
- [`docs/accounts.md`](docs/accounts.md) — the on-chain data model, PDAs and events.
- [`docs/architecture-evolution.md`](docs/architecture-evolution.md) — how the program itself
  evolves.
