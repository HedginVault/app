# Phoenix perpetuals in a Hedgin vault

The [manager console](https://hedgin.xyz/manage) includes a Perps view for the vault's Phoenix cross-margin trader account. It shows markets, charts, an order book, collateral, positions, orders, and trade history. The current web flow can register and onboard the vault trader, move USDC collateral between the vault and Phoenix, place market or limit orders, cancel orders, withdraw collateral, and sweep eligible canonical tokens.

Phoenix settles in USDC, so this strategy requires a USDC vault. The manager's wallet authorizes the vault program's actions; the vault program checks Phoenix-related accounts and remains the authority over the trader account. The web onboarding flow has two wallet-approved steps, including one in which Phoenix's onboarder co-signs and submits.

The [manager bot API V1](https://hedgin.xyz/api-reference/index.md) does **not** expose Phoenix builders or a bot onboarding route. Seeing Phoenix holdings in a read response does not imply that an API key can trade them. A bot that needs direct Phoenix automation requires a separate supported integration design or direct on-chain implementation using the [program IDL](https://hedgin.xyz/idl/hedge_vault.json) and all current account and signer checks. Do not reuse the web route's signed bytes as a manager API ticket.

Phoenix marks and provider data can be unavailable or stale. The keeper must value required Phoenix holdings completely before posting NAV. Treat missing position or valuation data as unknown, never as zero. See [protocol](protocol.md) and [vaults and NAV](vaults-and-nav.md).
