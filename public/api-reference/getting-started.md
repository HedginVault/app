# Hedgin Manager Bot API: Getting started

Base URL: `https://hedgin.xyz/api/external/v1`

V1 lets approved manager bots read their vaults and request server-built Solana transactions. It supports Jupiter swaps, Meteora DLMM actions, and strategy close. Phoenix, depositor, resolver, admin, vault-settings, and fee-claim actions are outside this API.

1. Obtain a bearer API key scoped to your manager, vaults, and actions. Keep it in the bot's secret store.
2. Send `Authorization: Bearer hv1_<id>_<secret>` on every request. Use `Content-Type: application/json` for POST requests.
3. `GET /vaults`, then read holdings or strategies and request a quote or pool data as needed.
4. `POST /transactions/{action}` with `vault` and the action fields. The server returns an unsigned base64 Solana v0 transaction and a short-lived ticket.
5. Sign the exact transaction locally with the vault's current authority key. `POST /transactions/send` with the signed base64 bytes and ticket.
6. Poll `GET /transactions/status?receipt=<receipt>` until confirmed, failed, or expired.

The API key grants HTTP access but cannot sign or bypass Solana program authorization. Amounts in JSON are decimal strings in token base units. See [authentication](authentication.md), [reads](reads.md), [builders](transactions.md), [send and status](send-and-status.md), and [errors](errors-and-limits.md). The [complete V1 reference](https://raw.githubusercontent.com/HedginVault/app/main/docs/manager-api.md) includes examples.
