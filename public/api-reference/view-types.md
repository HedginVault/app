# Manager API response views

The manager API returns JSON views, not raw Solana account layouts. Token amounts such as `totalAssets`, `vaultBalance`, `amountX`, and `totalValue` are decimal strings in base units. Prices and percentages are separate fields with their documented units. Public keys are base58 strings.

| Route | Top-level response | Main fields |
| --- | --- | --- |
| `GET /vaults` | `{ vaults: VaultSummary[] }` | Each summary has `address`, `name`, `status`, `depositMint`, `depositDecimals`, `totalAssets`, `navPerShare`, fees, `lastNavTs`, and optional display `metadata`. |
| `GET /vaults/{vault}/holdings` | `{ vault, data: HoldingsView }` | `data` has `depositToken`, `totalValue`, `totalUsd`, `navTotalAssets`, `navDeltaBps`, `partial`, `unpriced`, `tokens`, and `positions`. |
| `GET /vaults/{vault}/strategies` | `{ vault, data: StrategyView[] }` | Each strategy has a `type`: `jupiter`, `dlmm`, `phoenix`, or `unreadable`, with type-specific fields. |
| `GET /jupiter/quote` | `{ vault, data: QuoteView }` | `inAmount`, `outAmount`, `priceImpactPct`, and `routeLabels`. |
| `GET /dlmm/pools` | `{ vault, data: PoolSearchPage }` | `total`, `page`, `pages`, and `pools`; each pool has address, pair tokens, bin step, fees, TVL, volume, and price. |
| `POST /transactions/{action}` | `{ vault, result: BuiltStep | BuiltStep[] }` | Each step has `transaction`, `simulation`, `ticket`, and `blockhash`; it may have `sendConcurrently`, `next`, or action metadata. |
| `POST /transactions/send` | `{ signature, receipt, status }` | Send status is `pending` or `unknown`. Neither proves chain confirmation. |
| `GET /transactions/status` | Status object | `pending`, `confirmed`, or `expired`; `failed` also has `code` and `message`. |

`HoldingsView.partial: true` means at least one required display price was unavailable. Check `unpriced` and never treat an absent valuation as zero. An `unreadable` strategy remains visible rather than disappearing from the list. On-chain vault state is authoritative; view metadata and provider estimates are for presentation.

The [read reference](reads.md), [builder reference](transactions.md), and [protocol guide](https://hedgin.xyz/guides/protocol.md) explain how to interpret and use these fields.
