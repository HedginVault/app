# Meteora DLMM liquidity in a Hedgin vault

Managers can open a vault-owned Meteora DLMM position, add or remove liquidity, claim fees, and zap out through the web manager console or the manager bot API V1. DLMM positions use price bins. Wide positions need several Solana transactions to stay within size and compute limits.

## Discover and manage

- Search with `GET /dlmm/pools?vault=&query=&page=` using a key with `read` scope. The vault must be in key scope. Inspect the pair, bin step, active price, liquidity, and fees before choosing a range.
- Build `dlmm/open` with pool `lbPair`, lower and upper bin IDs, `amountX`, `amountY`, `shape`, and `maxActiveBinSlippage`.
- Build `dlmm/add` for an existing position, `dlmm/remove` for a portion, or `dlmm/claim-fee` for earned fees. `dlmm/zap-out` removes liquidity, claims fees, swaps eligible non-deposit tokens toward the deposit mint, and closes when safe. Zap-out requires the deposit mint to be one side of the pool pair.
- Continuation actions `dlmm/extend`, `dlmm/add-range`, and `dlmm/zap-out/swap` are driven by the preceding result's `next.path` and `next.body`. Do not invent continuation bodies.

Each builder requires its exact action scope, current vault manager authority, and the documented body fields. `amountX` and `amountY` are decimal strings in token base units. The supported deposit-mint and pair constraints still apply on chain. Wide actions can return a transaction array: confirm setup before dependent steps, submit only consecutive `sendConcurrently` steps together, and confirm the entire batch before the next barrier. If interrupted, read current position state and resume remaining work; confirmed prior steps cannot be rolled back.

See the [builder reference](https://hedgin.xyz/api-reference/transactions.md), [send and status](https://hedgin.xyz/api-reference/send-and-status.md), and [transaction lifecycle](transactions.md).
