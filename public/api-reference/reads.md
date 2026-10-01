# Hedgin Manager Bot API: Read endpoints

Base URL: `https://hedgin.xyz/api/external/v1`. Every request requires a bearer key with `read` scope. Vault-specific requests check the key's vault scope and current on-chain authority. Responses use `Cache-Control: no-store`.

| Method and path | Result |
| --- | --- |
| `GET /vaults` | `{ vaults: VaultSummary[] }`, filtered to manager and key scope. |
| `GET /vaults/{vault}/holdings` | `{ vault, data: HoldingsView }`. |
| `GET /vaults/{vault}/strategies` | `{ vault, data: StrategyView[] }`. |
| `GET /jupiter/quote?vault=&inputMint=&outputMint=&amount=&slippageBps=` | `{ vault, data: QuoteView }`. |
| `GET /dlmm/pools?vault=&query=&page=` | `{ vault, data: PoolSearchPage }`. |

`vault`, `inputMint`, and `outputMint` are Solana public keys. `amount` is a decimal string in token base units. `slippageBps` is an integer from 1 to 10,000, subject to the protocol's own limit. Pool `query` is required; `page` is optional. Both discovery routes require a scoped `vault` query parameter.

Holdings may be partial when a provider price is unavailable; missing valuation is not zero value. Quotes are time-sensitive and do not guarantee later execution. See [JSON view-model types](https://raw.githubusercontent.com/HedginVault/app/main/src/lib/types.ts) and the [complete V1 reference](https://raw.githubusercontent.com/HedginVault/app/main/docs/manager-api.md).
