# Hedgin Manager Bot API: Transaction builders

Call `POST https://hedgin.xyz/api/external/v1/transactions/{action}` with a bearer key scoped to the exact action, `Content-Type: application/json`, and a JSON body containing `vault` plus the fields below. Do not send `payer`; the API sets it from the key's manager public key. The vault must still have that manager as its current on-chain authority.

| Action | Fields beyond `vault` |
| --- | --- |
| `jupiter/swap` | `sourceMint`, `destinationMint`, `amount`, `slippageBps` |
| `dlmm/open` | `lbPair`, `lowerBinId`, `upperBinId`, `amountX`, `amountY`, `shape`, `maxActiveBinSlippage` |
| `dlmm/add` | `position`, `amountX`, `amountY`, `shape`, `maxActiveBinSlippage` |
| `dlmm/remove` | `position`, `bpsToRemove`; optional `cursorBinId` |
| `dlmm/claim-fee` | `position`; optional `cursorBinId` |
| `dlmm/zap-out` | `position`, `slippageBps`; optional `cursorBinId` |
| `strategy/close` | `strategy` |
| `dlmm/extend`, `dlmm/add-range`, `dlmm/zap-out/swap` | Continuation actions: pass `next.body` from the preceding build after its transaction confirms. |

`amount`, `amountX`, and `amountY` are decimal strings in token base units. Consult the [complete V1 reference](https://raw.githubusercontent.com/HedginVault/app/main/docs/manager-api.md) and builder validation for other bounds and accepted `shape` values.

The build response is `{ vault, result }`. `result` is one transaction object or an array. Each object includes `transaction` (unsigned base64 Solana v0 transaction), `simulation`, `ticket`, and `blockhash`. It may include `next`, `sendConcurrently`, or action metadata. `simulation.deferred: true` means the step depends on earlier confirmed state and will be checked at send preflight. The build ticket expires after 90 seconds and binds the exact transaction message, key, vault, action, cluster, and program.

Keep batch order. A step without `sendConcurrently` is a confirmation barrier. Consecutive steps marked `sendConcurrently` may submit together, but all must confirm before the next barrier. Follow `next.path` with `next.body` only after the preceding transaction confirms. Refresh expired unsigned builds from current chain state. See [send and status](send-and-status.md).
