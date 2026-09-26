---
goal: Expose a versioned API for manager-operated bots
version: 1.0
date_created: 2026-09-26
last_updated: 2026-09-26
owner: Hedge Vault app
status: 'Implemented locally; rollout pending'
tags: [feature, api, manager, automation]
---

# Introduction

![Status: Implemented locally](https://img.shields.io/badge/status-Implemented%20locally-blue)

The existing server-built manager transaction flow is exposed to external bots in the app source. A bearer API key identifies one manager and limits API use. The bot signs each transaction locally with the vault's current on-chain authority key. The API never signs for a manager, and the program remains the final authority. Production key provisioning and rollout remain separate operational work.

The source now has `/api/external/v1/*` routes and `MANAGER_API_KEYS` handling. The context pages describe the source implementation; deployment should be verified separately before treating it as live for partners.

## 1. Requirements & Constraints

- **REQ-001**: Expose `GET /api/external/v1/vaults`, `GET /api/external/v1/vaults/{vault}/holdings`, `GET /api/external/v1/vaults/{vault}/strategies`, `GET /api/external/v1/jupiter/quote`, and `GET /api/external/v1/dlmm/pools` through authenticated, versioned routes. Filter manager vault lists by the key's configured manager public key; verify each requested vault's current authority with a fresh chain read. Require the vault parameter on quote and pool discovery so calls can be charged and scoped to one authorized manager vault.
- **REQ-002**: Expose `POST /api/external/v1/transactions/jupiter/swap`, `POST /api/external/v1/transactions/dlmm/open`, `.../add`, `.../remove`, `.../claim-fee`, `.../zap-out`, and `.../strategy/close` using the existing manager builders. Keep request names and base-unit string amounts aligned with their corresponding `/api/tx/*` routes. Add only operations that have an existing builder and complete bot-facing documentation and tests.
- **REQ-003**: Each build returns a v0 transaction or ordered transaction steps, simulation result, blockhash, and a short-lived server-authenticated build ticket. The bot signs the exact returned message locally. A dependent `next` step is built only after its predecessor confirms; independent steps follow the existing `sendConcurrently` contract.
- **REQ-004**: `POST /api/external/v1/transactions/send` accepts signed bytes and the build ticket. It returns a signature or a bounded, redacted error. `GET /api/external/v1/transactions/status` returns pending, confirmed, failed, or expired; a send timeout is unknown until status or chain state resolves it.
- **SEC-001**: An API key is never an on-chain authority. Never accept an API key alone as permission to move funds, accept a private key, or store a manager signing key in the app or keeper.
- **SEC-002**: The external relay verifies the ticket MAC and expiry, the exact built transaction message, key identity, cluster, program, vault, action, fee payer, current vault authority, and a valid Ed25519 signature by that authority before RPC submission. It must not inherit the generic `/api/tx/send` rule that permits extra instructions. The existing signed transaction bytes may contain additional required builder-generated signatures, but no changed message bytes.
- **SEC-003**: API keys are high-entropy secrets provisioned out of band. Store only keyed hashes or digests server-side; compare them in constant time; support key ID, manager public key, optional vault allowlist, enabled actions, expiry, and revocation. Never log or return keys, Authorization headers, signed bytes, tickets, or credential-bearing URLs.
- **SEC-004**: Authenticate before expensive RPC/provider calls. Validate JSON size, query parameters, base64 transaction size, amount units, slippage, and action allowlists at the boundary. Apply per-key and per-IP limits plus an ingress-level request/body limit; the existing in-process IP bucket alone is insufficient across replicas.
- **SEC-005**: Preserve on-chain signer, account, mint, token-program, CPI-target, strategy, status, and slippage checks. Server prechecks are for early rejection and clearer errors.
- **CON-001**: `app/` owns the HTTP API and builder/relay code. `programs/` needs no change for this first release. `keeper/` must not execute manager actions.
- **CON-002**: The current program requires the vault authority to sign manager actions. A bot using this release must have access to that authority signer. Using a separate, limited bot signer requires a later on-chain delegation feature and coordinated IDL sync; an API key cannot provide it.
- **CON-003**: Do not expose admin, depositor, permissionless resolver, fee claim, vault configuration, or raw arbitrary-instruction relay through the external API in v1.
- **CON-004**: Public read responses remain projections of current chain/provider data. Token amounts are base-unit strings, and a stale read never grants authority.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Define the bot contract and authenticate callers before any expensive operation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `app/docs/manager-api.md` with exact V1 requests, response types, signing example, multi-step execution order, error codes, rate limits, idempotent retry guidance, and key provisioning/rotation/revocation procedure. State that the bot needs the vault authority signer and that secrets stay local to the bot. | | |
| TASK-002 | Add server-only `app/src/server/external/auth.ts`: parse `Authorization: Bearer`, look up a configured key ID and digest without logging secrets, compare digests in constant time, check expiry/revocation, and return a typed `{keyId, manager, vaults, actions}` principal. Reject missing or malformed configuration at startup. Add only server-side environment key names to `app/.env.example` if that example exists; otherwise document them in the app README. | | |
| TASK-003 | Add `app/src/server/external/route.ts` for authenticated GET/POST wrappers with Zod validation, bounded JSON bodies, stable redacted errors, and per-key limits. Add ingress request limits in `app/k8s/ingress.yaml` and document their configured values. Keep existing browser routes working. | | |

### Implementation Phase 2

- GOAL-002: Reuse live readers and transaction builders behind a bounded manager API.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Move handler logic shared by external routes and `/api/tx/*` routes into server functions beside existing `app/src/server/readers/*` and `app/src/server/tx/*` modules. Route handlers should validate and call the same owner functions; do not copy Jupiter or DLMM instruction construction. | | |
| TASK-005 | Add the exact V1 GET and build routes under `app/src/app/api/external/v1/`. Before each vault read/build, load the vault uncached through `loadVaultCtx` and require `vault.authority` to equal the authenticated principal's manager key and the vault to be in its configured allowlist, if present. Require an enabled action on each build. | | |
| TASK-006 | Add `app/src/server/external/ticket.ts`: MAC a canonical record containing key ID, manager, vault, action, cluster/program ID, SHA-256 hash of serialized v0 message, blockhash, and expiry. Use a separate server-only ticket secret; use a short lifetime no longer than the transaction blockhash validity window. Create one ticket per built transaction, including each batch member. Do not MAC mutable or noncanonical JSON. | | |

### Implementation Phase 3

- GOAL-003: Relay only the authorized signed message and expose reliable status.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Add external send and status routes under `app/src/app/api/external/v1/transactions/`. External send verifies the ticket, exact v0 message hash, required program/action/vault identity, fee payer, current on-chain authority, and that authority's Ed25519 signature over the message. Reject substituted instructions, keys, lookup tables, message, missing signer, expired ticket, wrong key, wrong cluster, and revoked key before calling `sendRawTransaction`. Keep RPC preflight and existing status classification. | | |
| TASK-008 | Bind status access to the authenticated key and a send receipt/ticket for the submitted signature and blockhash. Return the same status categories as `getTransactionStatus`, but redact raw RPC/provider logs from external responses. On RPC timeout, instruct the client to poll the same signature; do not rebuild or resend a new transaction while its outcome is unknown. | | |
| TASK-009 | Add structured, secret-free audit logs for key ID, manager, vault, action, build/send outcome, RPC signature, and error code. Expose counts for authentication failures, build failures, send ambiguity, confirmation failures, rate limits, and provider failures through the app's existing operations path. | | |

### Implementation Phase 4

- GOAL-004: Validate and release the first manager integration without program or keeper changes.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add tests in `app/test/` for authentication, scope/authority mismatch, key rotation/revocation, tickets, signed-message tampering, extra instructions, wrong signer, wrong cluster, malformed and oversized input, expiry, status ambiguity, and each allowed builder's happy and rejected paths. Include a fixed-clock synthetic bot flow that builds, signs locally, relays, and confirms without live funds. | | |
| TASK-011 | Run `yarn lint`, `yarn test`, and `yarn build` in `app/`; review the diff for secret exposure and generated drift. Document the new routes and server-only configuration in `app/README.md`. Update affected root `CONTEXT/` pages only after source and deployment configuration agree, then run `./scripts/check-context.sh`. | | |
| TASK-012 | Roll out server configuration and ingress limits with the app release, provision one narrowly scoped test key out of band, verify read/build against a safe test environment, and verify an end-to-end signed flow without mainnet funds. Add manager keys gradually and monitor quota, RPC cost, errors, and confirmation outcomes. Production key provisioning and any mainnet transaction require the separate authorization specified by workspace rules. | | |

## 3. Alternatives

- **ALT-001**: A client SDK alone would reduce request boilerplate but still leave each bot to own transaction construction, provider integration, and protocol-specific validation. A thin optional SDK can wrap the stable HTTP contract later.
- **ALT-002**: API-key-only trading would require the app to hold a manager key or a new on-chain delegation authority. The former crosses the current custody boundary; the latter is a separate program change. Neither is part of V1.
- **ALT-003**: Forwarding signed bytes to the existing generic `/api/tx/send` does not bind a bot request to one authenticated build and permits caller-added instructions. External send needs its own ticket and exact-message check.
- **ALT-004**: A new application database or queue is unnecessary for first-release build/sign/send/status. If scale requires durable per-key quota, audit, or job idempotency, define ownership and operational behavior in a later phase.

## 4. Dependencies

- **DEP-001**: Existing `app/src/server/tx/*` builders, readers, `getTransactionStatus`, generated IDL, and Next.js route runtime.
- **DEP-002**: Server-only secret provisioning for API-key digests and ticket MAC secret, plus ingress request limits; no browser-exposed environment variable.
- **DEP-003**: Manager bot controls its own Solana authority signer and implements v0 transaction signing, signature/status polling, and dependent-step sequencing.
- **DEP-004**: Any later limited bot signer requires a separate program design, program build, and synchronized `app/` and `keeper/` IDLs before deployment.

## 5. Files

- **FILE-001**: `app/src/app/api/external/v1/**/route.ts` — new authenticated external routes.
- **FILE-002**: `app/src/server/external/auth.ts`, `route.ts`, `ticket.ts` — key authentication, route boundary, and exact-build admission.
- **FILE-003**: Existing `app/src/server/readers/*`, `app/src/server/tx/*`, and selected `/api/tx/*/route.ts` — shared functions with unchanged browser behavior.
- **FILE-004**: `app/test/*`, `app/docs/manager-api.md`, `app/README.md`, `app/k8s/ingress.yaml` — tests, API contract, setup, and ingress controls.
- **FILE-005**: `CONTEXT/services/app.md` and `CONTEXT/CROSS-SERVICE-FLOWS.md` — correct the currently premature API claims and describe the verified released flow; report these root changes separately because the root is not a Git repository.

## 6. Testing

- **TEST-001**: A key for manager A cannot read/build/send against manager B's vault, even if a cached view or request body names manager A.
- **TEST-002**: A signed transaction with a modified message, added instruction, changed lookup table, wrong blockhash, wrong signer, expired ticket, or revoked key is rejected before RPC send.
- **TEST-003**: An exact locally signed build is submitted once, reports pending on ambiguous RPC outcome, and resolves from signature status without duplicate strategy effects.
- **TEST-004**: Jupiter and DLMM multi-step flows preserve ordering, resume safely after partial confirmation, and reject malformed amount/slippage/position inputs.
- **TEST-005**: `yarn lint`, `yarn test`, `yarn build`, and, if context changes, `./scripts/check-context.sh` pass with no production endpoint or wallet use.

## 7. Risks & Assumptions

- **RISK-001**: V1 bots must hold the full vault authority signer. A compromised bot can use that key outside this API; API key scopes do not constrain its direct on-chain power. Prefer a dedicated on-chain delegated signer with explicit limits before calling the integration safe for broad unattended trading.
- **RISK-002**: Jupiter quotes, market state, blockhashes, and DLMM positions can change between build and send. Simulation is advisory; program constraints, preflight, and status handling remain necessary.
- **RISK-003**: In-process rate limits and logs are per replica. Ingress limits are required at launch; durable per-key accounting is a separate scale decision.
- **RISK-004**: A bot may still submit a signed transaction directly to Solana. API tickets protect this service's relay and RPC quota; they do not revoke an on-chain signature.
- **ASSUMPTION-001**: Initial integrations need manager read, Jupiter, and DLMM actions already supported by the app. Phoenix manager builders are absent from the app and require separate work.
- **ASSUMPTION-002**: API keys are manually provisioned and rotated for a small set of partner managers at first release; no self-service key UI or application database is required.

## 8. Related Specifications / Further Reading

- [`../README.md`](../README.md) — current app route and transaction contracts.
- [`../src/server/tx/send.ts`](../src/server/tx/send.ts) — current relay and status behavior.
- [`../../CONTEXT/PLATFORM.md`](../../CONTEXT/PLATFORM.md) — authority and custody boundaries.
- [`../../CONTEXT/CROSS-SERVICE-FLOWS.md`](../../CONTEXT/CROSS-SERVICE-FLOWS.md) — cross-service transaction flow; external API claim is ahead of this checkout.
