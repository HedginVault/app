# Start here: Hedgin for agents and bots

Hedgin is a Solana vault product. Depositors request deposits and withdrawals. Whitelisted managers operate vaults through Jupiter swaps, Meteora DLMM liquidity, and Phoenix perpetuals. The program keeps custody; a keeper values holdings and posts net asset value (NAV), the accounting value used to price vault shares.

## Choose the right surface

| Goal | Current surface | Access |
| --- | --- | --- |
| Discover vaults, view holdings, NAV, and public positions | [Public web app](https://hedgin.xyz/vaults) and public GET routes | No manager key. Read values can be briefly stale or partially priced. |
| Automate manager Jupiter swaps, Meteora DLMM positions, or eligible strategy close | [Manager bot API V1](https://hedgin.xyz/api-reference/index.md) | Administrator-issued bearer key with exact action scope, plus the vault's current Solana authority signer held by the bot. |
| Create/configure vaults, claim fees, review requests, or use Phoenix perps | [Manager console](https://hedgin.xyz/manage) | Connected manager wallet. These actions are not in the manager bot API V1. |
| Deposit or withdraw vault assets | [Vault page](https://hedgin.xyz/vaults) | Connected depositor wallet. Depositor transactions are not in the manager bot API V1. |
| Build direct on-chain integrations | [Protocol guide](protocol.md) and [published IDL](https://hedgin.xyz/idl/hedge_vault.json) | Your own Solana client and signer; the program enforces every role and account constraint. The IDL is not an HTTP endpoint list. |

## First manager bot workflow

1. Have a Hedgin administrator provision a key for the manager's public key, allowed vaults, and the exact actions needed. Include `read` and `send` where required.
2. Keep the bearer key and Solana authority signing key in the bot's secret store. Never put them in URLs, browser variables, logs, or prompts.
3. Read `GET /vaults`, then the vault's holdings and strategies. Check its current status and current authority before deciding to act.
4. Build a supported transaction through `/api/external/v1/transactions/{action}`. Sign the exact returned v0 transaction locally, relay with its ticket, and poll the receipt until confirmed.
5. Re-read vault or position state after confirmation. If a send result is unknown, resolve that signature before building a new transaction.

Read the [call examples](https://hedgin.xyz/api-reference/examples.md), [transaction lifecycle](transactions.md), and [API errors and limits](https://hedgin.xyz/api-reference/errors-and-limits.md) before a bot moves funds. Do not infer that a feature in the web app has a bot endpoint; the [API endpoint map](https://hedgin.xyz/api-reference/index.md) is the V1 allowlist.
