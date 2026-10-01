# Vault discovery, holdings, and NAV

Browse vaults at `https://hedgin.xyz/vaults` and inspect a vault at `https://hedgin.xyz/vault/{vault}`. Public read routes include `GET /api/config`, `GET /api/vaults`, `GET /api/vaults/{vault}`, `GET /api/vaults/{vault}/holdings`, `GET /api/vaults/{vault}/strategies`, and `GET /api/vaults/{vault}/nav`. These are the current web app reads; the [versioned manager bot API](https://hedgin.xyz/api-reference/index.md) is the supported integration contract for manager automation.

A vault accepts one deposit mint and issues vault-specific shares. Its summary shows status, deposit token, total assets, NAV per share, limits, and fees. The detail view adds the current manager authority, share supply, idle balance, pending requests, open strategy count, and current protocol limits. Display metadata such as logos and descriptions is presentation data; it is not on-chain authorization.

The keeper posts complete NAV after valuing idle assets and open strategies. The public holdings endpoint provides a live estimate and may include a `partial` flag and `unpriced` token list when provider prices are missing. Use the on-chain posted NAV for request accounting; do not substitute an app estimate. NAV history may depend on the keeper's historical data store and can be unavailable without changing current vault state.

Statuses and pause flags affect which actions can proceed. Read them near transaction construction, and expect the program to re-check them during execution. A successful quote or earlier read cannot guarantee a later transaction. For response envelopes and units, see [API view types](https://hedgin.xyz/api-reference/view-types.md).
