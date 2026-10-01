# Hedge Vault protocol

The Solana `hedge_vault` program is authoritative for vault assets, shares, fees, roles, requests, strategies, status, and posted NAV. The app projects chain and provider data into views. The manager bot API controls HTTP access and builds transactions, but it does not hold user or manager signing keys and cannot override on-chain rules.

## Roles and accounts

| Role or account | Meaning |
| --- | --- |
| Admin | Whitelists managers, configures protocol policy, handles exceptional request and NAV actions. |
| Manager authority | Current on-chain authority for a vault; signs vault and strategy actions. A manager API key is associated with this public key but cannot replace its signature. |
| Depositor | Creates or cancels their own deposit and withdrawal requests. |
| NAV updater | Posts complete vault valuation. The keeper acts only as the configured updater. |
| Guardian | Can pause protocol activity. |
| Config | Global roles, status, fees, and bounds. |
| Vault | One deposit mint, share mint, manager authority, posted accounting state, limits, and status. |
| Strategy | Program record for a Jupiter target token, Meteora DLMM position, or Phoenix trader account. |
| Request | Pending deposit assets or withdrawal shares held in escrow until cancellation, rejection, or valid resolution. |

Vault program-derived addresses control the token accounts and positions. The program restricts strategy actions to checked Jupiter, Meteora DLMM, and Phoenix paths. Each on-chain instruction validates its signers and relevant accounts, mints, programs, amounts, status, and bounds. A manager may operate the vault through permitted instructions but does not take custody of depositor funds.

## NAV and settlement

One epoch lasts 14,400 seconds (4 hours). The keeper values idle assets and open strategies, then posts NAV for a due vault. Deposits and withdrawals are requests; a request can resolve only after a later NAV epoch and only when current program rules allow it. Withdrawal resolution also depends on available idle deposit assets and the current outflow policy. An API holding estimate is not the authoritative posted NAV, and missing price data must not be interpreted as zero.

## Integration boundaries

- [Manager bot API V1](https://hedgin.xyz/api-reference/index.md) exposes a limited, versioned HTTP allowlist for manager reads, Jupiter, Meteora DLMM, relay, and status. Phoenix, depositor, resolver, admin, vault settings, and fee claims are not exposed there.
- The [web app](https://hedgin.xyz/) supports additional wallet-driven flows. Its browser transaction routes use a different contract from the manager bot API.
- The [generated on-chain IDL](https://hedgin.xyz/idl/hedge_vault.json) describes program instructions and account types for direct Solana integration. It is synced from the program build. Do not treat every IDL instruction as an available HTTP API action.

For product flows, read [vaults and NAV](vaults-and-nav.md), [deposits and withdrawals](deposits-and-withdrawals.md), [manager operations](manager-operations.md), [Jupiter swaps](jupiter-swaps.md), [Meteora DLMM](meteora-dlmm.md), and [Phoenix perps](phoenix-perps.md).
