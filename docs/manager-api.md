# Manager bot API (V1)

The public [`llms.txt`](https://hedgin.xyz/llms.txt) indexes short Markdown pages for AI tools. This file remains the complete V1 contract; update the public pages when the contract changes.

The manager bot API is a versioned interface at `/api/external/v1`. It lets an approved bot read its manager's vaults and request server-built Solana transactions. The bot signs transactions locally with the vault's **current authority key**. The API server never holds that key. The bearer API key controls access to this HTTP service; it is not a Solana signing key or a replacement for the program's authority checks.

V1 supports Jupiter swaps and the app's existing Meteora DLMM actions. The app has no Phoenix transaction builder, so Phoenix actions are not available here. Admin, depositor, resolver, vault settings, and fee claims are also outside V1.

## Provisioning and rotation

Keys are created, scoped, edited, and revoked in the admin dashboard (`admin-dashboard/`). The app reads them from Postgres. Set these server-only variables in the app deployment secret:

- `API_KEYS_DATABASE_URL`: optional explicit connection string for the key database, using a SELECT-only role on `api_keys`. The app never writes key records. When it is unset, the app uses `DATABASE_URL`; use that fallback only when the `DATABASE_URL` role can also `SELECT api_keys` in the same database.
- `API_KEY_USAGE_DATABASE_URL`: connection string for a role that may only select, insert, and update the usage counters table (select is needed because the counter upsert reads the row). Recording usage is fire-and-forget and never changes an API response.
- `MANAGER_API_TICKET_SECRET`: a distinct random secret of at least 32 bytes used to authenticate build tickets and status receipts. Keep it stable across app replicas and rollouts until outstanding receipts expire.
- `MANAGER_API_KEYS` (fallback only, see below): JSON array of records with `id`, `digest`, `manager`, optional `vaults`, `actions`, `expiresAt`, and `revoked`.

Deploy order: this app's workflow deploys on merge to `main`. For a shared database, verify the `DATABASE_URL` role can read `api_keys` before relying on the fallback. A dedicated `API_KEYS_DATABASE_URL` with the `hv_app_reader` role remains the preferred least-privilege setup. Set `API_KEY_USAGE_DATABASE_URL` separately for usage counters, import existing keys before enabling database lookup, and restart the app after changing Secret values.

Each key record has an `id`, a `digest` (the lowercase hex SHA-256 digest of the random key secret), a `manager` (the Solana public key that currently controls the vault), optional `vaults` (an array of vault public keys; if omitted, all current vaults of that manager are in scope), `actions`, and an optional expiry. The HTTP header is `Authorization: Bearer hv1_<id>_<secret>`. The allowed `actions` are `read`, `send`, and exact builder names from the table below. Include `send` when the bot should relay through this service. The dashboard shows the full key once at creation and stores only the digest. Do not place plaintext keys, the ticket secret, or manager keypairs in Git, logs, URLs, or browser variables.

How the app resolves a key:

- A key found in the database is authoritative. The database row wins over any `MANAGER_API_KEYS` entry with the same id.
- The app caches key lookups in process for about 5 seconds. Revoking or editing a key in the dashboard therefore takes effect within about 5 seconds.
- If the database is unreachable, or a stored row fails validation, the API returns 503. It never falls back to `MANAGER_API_KEYS` for an id that exists in the database, and it never fails open.
- `MANAGER_API_KEYS` is only a fallback for ids that are absent from the database. It is scheduled for removal one release after the existing keys have been imported into the database.

Key format: keys created by the dashboard use a lowercase id without underscores and a 64-character hex secret. The header parser accepts `[a-zA-Z0-9_-]{1,48}` for the id and `[a-zA-Z0-9_-]{32,128}` for the secret, and the id part is matched greedily. It therefore splits at the last `_` that still leaves at least 32 secret characters, not at the first `_`. A secret that contains `_` can be split in the wrong place and the key will then fail with 401. Hand-made keys should use ids without `_` and secrets without `_` or `-` (plain hex is safest).

To rotate a key, create a new key in the dashboard and give it to the partner, then revoke the old key. A revoked key cannot build, send, or poll through this service. An API key does not replace on-chain authority: it only lets the bot call this HTTP API, and every transaction still needs the manager's Solana signature. Revoking an API key does **not** revoke a Solana manager key; the manager must rotate vault authority on chain if that signer is compromised. Ticket secret rotation invalidates outstanding build tickets and status receipts.

## Reads

All requests require the bearer header. Responses use `Cache-Control: no-store`. Vault-specific reads check current on-chain authority before returning data. Amounts in JSON are base-unit decimal strings.

| GET path | Result |
| --- | --- |
| `/vaults` | `{ vaults: VaultSummary[] }`, filtered to this manager and key scope |
| `/vaults/{vault}/holdings` | `{ vault, data: HoldingsView }` |
| `/vaults/{vault}/strategies` | `{ vault, data: StrategyView[] }` |
| `/jupiter/quote?vault=&inputMint=&outputMint=&amount=&slippageBps=` | `{ vault, data: QuoteView }` |
| `/dlmm/pools?vault=&query=&page=` | `{ vault, data: PoolSearchPage }` |

Quotes and pool discovery require a scoped `vault` query parameter. A quote is time-sensitive and does not promise the later transaction will succeed. Holdings can be a partial view when a provider price is unavailable; never interpret missing valuation as zero.

## Build, sign, send, confirm

Call `POST /transactions/{action}` with a JSON body using the same fields as the web builder, **except `payer`**. The API sets `payer` to the key's configured manager public key. Every body includes `vault`.

| Action | Additional body fields |
| --- | --- |
| `jupiter/swap` | `sourceMint`, `destinationMint`, `amount`, `slippageBps` |
| `dlmm/open` | `lbPair`, `lowerBinId`, `upperBinId`, `amountX`, `amountY`, `shape`, `maxActiveBinSlippage` |
| `dlmm/add` | `position`, `amountX`, `amountY`, `shape`, `maxActiveBinSlippage` |
| `dlmm/remove` | `position`, `bpsToRemove`, optional `cursorBinId` |
| `dlmm/claim-fee` | `position`, optional `cursorBinId` |
| `dlmm/zap-out` | `position`, `slippageBps`, optional `cursorBinId` |
| `strategy/close` | `strategy` |
| `dlmm/extend`, `dlmm/add-range`, `dlmm/zap-out/swap` | Continuation routes; pass the `next.body` returned by the preceding build after that transaction confirms. |

The build response is `{ vault, result }`, where `result` is one transaction object or an array. Each object has `transaction` (unsigned base64 serialized v0 transaction), `simulation`, `ticket`, `blockhash`, and sometimes `next`, `sendConcurrently`, or action metadata. `simulation.deferred: true` means the builder intentionally left simulation to send preflight because the transaction depends on a preceding step. The ticket expires 90 seconds after build and is tied to that exact transaction message, key, vault, action, cluster, and program.

For each transaction:

1. Deserialize `transaction` as a Solana `VersionedTransaction`.
2. Sign it locally with the vault authority key. Preserve any builder-added signatures, such as a new DLMM position account signature. Never send the private key to this API.
3. `POST /transactions/send` with `{ "transaction": "<signed base64>", "ticket": "<build ticket>" }`.
4. The response contains `{ signature, receipt, status }`. `status` is `pending` after RPC acceptance or `unknown` when RPC timed out or returned an ambiguous provider error. Keep the signature and receipt in both cases.
5. Poll `GET /transactions/status?receipt=<receipt>` until `confirmed`, `failed`, or `expired`. Failed responses contain `code` and `message`, without provider logs.

The relay checks the ticket, unchanged transaction message, fee payer, current vault authority, and authority Ed25519 signature before RPC submission. A bot can also send its own signed transaction directly to Solana; API ticket and action scopes protect this HTTP service, not the manager key's on-chain power.

### Example

```sh
curl -H "Authorization: Bearer hv1_partner_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"vault":"VAULT_PUBLIC_KEY","sourceMint":"SOURCE_MINT","destinationMint":"DESTINATION_MINT","amount":"1000000","slippageBps":50}' \
  https://hedgin.xyz/api/external/v1/transactions/jupiter/swap
```

The bot then signs the returned base64 transaction using its Solana v0 transaction library and posts the signed bytes with the returned ticket. The `amount` example is **one million base units**, not one million display tokens.

For a Node bot using `@solana/web3.js`, the signing step is:

```ts
const step = build.result; // one step from the build response
const tx = VersionedTransaction.deserialize(Buffer.from(step.transaction, "base64"));
tx.sign([managerKeypair]); // managerKeypair stays in the bot's own secret store
const signedBase64 = Buffer.from(tx.serialize()).toString("base64");
await fetch(`${baseUrl}/api/external/v1/transactions/send`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ transaction: signedBase64, ticket: step.ticket }),
});
```

### Batches and retries

Keep returned batch order. A step without `sendConcurrently` is a confirmation barrier. Consecutive steps marked `sendConcurrently` may submit together, but all must confirm before the next barrier step. When `next` is present, build `POST /transactions/{next.path}` with `next.body` only **after** the current step confirms. Refresh expired unsigned builds from current chain state; do not sign an old blockhash.

For an unknown send result, poll the **same signature and receipt**. Do not immediately rebuild or submit a new transaction: the first may already have landed. Repeating the identical signed transaction is safe against duplicate execution on Solana, but a new build can produce a new action. After partial DLMM batch progress, read the current position and resume from its remaining ranges; confirmed earlier transactions cannot be rolled back.

## Errors and limits

Errors have `{ error: { code, message } }`. Common HTTP statuses: 400 malformed request, 401 invalid or revoked key, 403 key scope, authority, ticket, or signature mismatch, 404 unknown route, 413 oversized request, 422 builder simulation or RPC preflight rejection, 429 rate limit, 503 provider or configuration outage. No external response contains raw provider logs. A 503 during send may be ambiguous; when the signed transaction passed local checks, the send endpoint returns `status: "unknown"` with a receipt so the bot can poll.

The app limits each key to 120 requests per minute and each IP to 60 per minute per app replica. nginx ingress adds a 20 requests per second IP limit and a 16 KB request body limit. These limits protect initial partner access; app-local counters are not a durable cross-replica quota. Build and send still use the web route's existing per-IP bucket. Monitor `[manager-api]` structured log records by key ID, action, vault, outcome, and transaction signature; they intentionally omit keys, tickets, and transaction bytes.

For development, use synthetic keys and a test cluster. The default app cluster is mainnet-beta; never run a live send or use real funds as a test.
