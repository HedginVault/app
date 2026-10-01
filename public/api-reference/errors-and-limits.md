# Hedgin Manager Bot API: Errors and limits

Errors use `{ error: { code, message } }`. External responses do not expose raw provider logs.

| HTTP status | Meaning |
| --- | --- |
| 400 | Malformed request or invalid field. |
| 401 | Invalid or revoked API key. |
| 403 | Key scope, vault authority, ticket, or signature mismatch. |
| 404 | Unknown manager API route. |
| 413 | Oversized request body. |
| 422 | Builder simulation or RPC preflight rejection. |
| 429 | Rate limit exceeded. |
| 503 | Provider, key database, or configuration unavailable. |

The app limits each key to 120 requests per minute and each IP to 60 per minute per app replica. Production ingress adds a 20 requests per second IP limit and a 16 KB request body limit. App-local counters are not a durable cross-replica quota. Build and send also use the web route's per-IP bucket.

A network or RPC error during send can be ambiguous. After local validation, the API returns `status: "unknown"` with a signature and receipt. Poll [transaction status](send-and-status.md) before rebuilding or retrying an action.

Use synthetic keys and a test cluster for development. The app defaults to mainnet-beta, so do not treat its default endpoint as a test network. See [transaction lifecycle](https://hedgin.xyz/guides/transactions.md) and [call examples](examples.md).
