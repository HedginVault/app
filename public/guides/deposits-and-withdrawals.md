# Deposits and withdrawals

Depositors use the [vault page](https://hedgin.xyz/vaults) with a connected Solana wallet. These actions are not in the manager bot API V1. The web app builds unsigned transactions, the wallet signs, the server relays, and the client waits for chain confirmation. A direct on-chain integration requires its own Solana client and must follow the [program IDL](https://hedgin.xyz/idl/hedge_vault.json) and current program rules.

## Deposit

1. Choose a vault and inspect its deposit mint, status, minimum, cap, and latest posted NAV.
2. Create a deposit request. The program moves the deposit token amount into escrow and records the request epoch.
3. Wait until a later valid NAV update. The request can then be resolved if current program gates pass, minting vault shares at that NAV.
4. Before a covering NAV, the user may cancel under program rules. An admin can reject a pending request under its authority and current program rules.

## Withdrawal

1. Choose a share amount and create a withdrawal request. The program escrows those shares.
2. Wait for a later NAV epoch. A valid resolution converts shares to deposit tokens at the posted NAV and applies status, available idle assets, and outflow limits.
3. If idle assets are insufficient, the manager must free liquidity; the keeper does not silently unwind strategies for the user.

Resolution is permissionless when the program's conditions pass, but the current manager bot API does not expose resolver routes. A request submission, keeper attempt, or RPC send is not final success; check confirmed chain status or the request's on-chain state. See [transaction lifecycle](transactions.md) and [protocol](protocol.md).
