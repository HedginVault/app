# Transaction lifecycle for bots

Hedgin manager actions have four separate stages: build and simulation, local wallet or bot signature, RPC submission, and on-chain confirmation. Only the last stage proves the transaction landed successfully. The Solana program re-checks authority, accounts, programs, mints, status, and bounds when it executes.

## Manager bot API sequence

1. Build a supported action with `POST /api/external/v1/transactions/{action}`. The response contains one or more unsigned Solana v0 transaction steps. Each step has a `ticket` valid for 90 seconds and a recent `blockhash`.
2. Sign each step locally with the vault's current authority key. Preserve signatures already included by the builder. The API key is only for HTTP access.
3. Send signed base64 bytes and the matching ticket to `POST /api/external/v1/transactions/send`. The relay checks the exact message, authority signature, fee payer, key scope, and current vault authority.
4. Save the returned `signature` and `receipt`. Poll `GET /api/external/v1/transactions/status?receipt=<receipt>` until confirmed, failed, or expired. `pending` and `unknown` are not confirmations.

For an `unknown` send result, poll the same receipt before creating a new build. The original transaction may have landed. A repeated identical signed transaction cannot execute twice, but a new build can represent a new action. If a batch partly confirms, read current chain state and resume only unfinished work. Follow `sendConcurrently` markers and `next` continuation steps exactly as documented in [builder reference](https://hedgin.xyz/api-reference/transactions.md).

The website also has transaction routes for wallet flows such as deposits, withdrawals, vault settings, and Phoenix. Those routes use the web app's own transaction flow and are not part of the versioned manager bot API. See [start here](start-here.md) for the supported access path to each product feature.
