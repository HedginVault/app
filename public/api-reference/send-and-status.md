# Hedgin Manager Bot API: Send and status

Base URL: `https://hedgin.xyz/api/external/v1`. Both endpoints require the bearer header and `send` scope. The key must also have the builder action that produced the ticket.

## Sign and send

1. Deserialize each [builder](transactions.md) result's `transaction` as a Solana `VersionedTransaction` from base64.
2. Sign it locally with the vault's current authority key. Preserve any builder-added signatures, such as a new DLMM position account signature. Never send a private key to the API.
3. `POST /transactions/send` with JSON `{ "transaction": "<signed base64>", "ticket": "<build ticket>" }`.

The relay checks the ticket, unchanged transaction message, fee payer, current vault authority, and authority signature before RPC submission. It returns `{ signature, receipt, status }`. `status` is `pending` after RPC acceptance or `unknown` after an ambiguous RPC result. Keep the signature and receipt in either case.

## Confirm and retry

Poll `GET /transactions/status?receipt=<receipt>` until `confirmed`, `failed`, or `expired`. A failed response also includes `code` and `message`. A submitted or pending transaction is not yet confirmed.

If send returns `unknown`, poll the same receipt before rebuilding; the first transaction may already have landed. Repeating identical signed bytes cannot execute twice on Solana, but a new build may create a distinct action. After partial DLMM batch progress, read current position state and resume only remaining work. See the [complete V1 reference](https://raw.githubusercontent.com/HedginVault/app/main/docs/manager-api.md) for the Node signing example and batch rules.
