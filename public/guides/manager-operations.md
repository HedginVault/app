# Manager operations

Whitelisted managers use the [manager console](https://hedgin.xyz/manage) with the vault's current authority wallet. The console has Portfolio, Swap, Liquidity, Perps, History, Requests, and Settings views. It supports vault creation, settings changes, fee claims, strategy actions, and eligible vault closure through wallet-approved transactions.

The [manager bot API V1](https://hedgin.xyz/api-reference/index.md) covers a narrower set: scoped vault/holding/strategy reads, Jupiter quotes and swaps, Meteora pool discovery and position actions, eligible strategy close, signed transaction relay, and status polling. It does not create/configure vaults, claim manager fees, resolve requests, or build Phoenix trades. Do not call a web transaction route as though it were a versioned bot endpoint; its request and relay contract differs.

## Before acting

- Confirm the key is scoped to the vault and the exact builder action. The API checks the current on-chain vault authority against the key's manager public key.
- Inspect vault and protocol status, deposit mint, holdings, and pending requests. Manager actions can be blocked by pauses or reduce-only policy.
- Use token base-unit strings for amounts, not JavaScript floating-point token amounts. Respect the vault's deposit mint and configured slippage bound for swaps.
- Build, sign, send, and confirm each transaction. For a multi-step action, preserve order and re-read state after partial completion.

Read [Jupiter swaps](jupiter-swaps.md), [Meteora DLMM](meteora-dlmm.md), [Phoenix perps](phoenix-perps.md), [transaction lifecycle](transactions.md), and [call examples](https://hedgin.xyz/api-reference/examples.md).
