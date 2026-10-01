# Manager bot API V1

Base URL: `https://hedgin.xyz/api/external/v1`. Every call requires `Authorization: Bearer hv1_<id>_<secret>`. POST calls also need `Content-Type: application/json`.

This versioned API is for approved manager bots. A key grants HTTP access to its manager, permitted vaults, and named actions. It never signs a Solana transaction. The bot holds the vault's current authority key locally; the program checks that signer on chain.

## Endpoint map

| Method and path after the base URL | Required key action | Result |
| --- | --- | --- |
| `GET /vaults` | `read` | Scoped vault summaries. |
| `GET /vaults/{vault}/holdings` | `read` | Live holdings and valuation view. |
| `GET /vaults/{vault}/strategies` | `read` | Open strategy views. |
| `GET /jupiter/quote?vault=&inputMint=&outputMint=&amount=&slippageBps=` | `read` | Swap quote. |
| `GET /dlmm/pools?vault=&query=&page=` | `read` | Pool search results. |
| `POST /transactions/{action}` | Exact builder action | Unsigned v0 transaction step or batch plus a short-lived ticket. |
| `POST /transactions/send` | `send` and ticket's builder action | Signed transaction signature, receipt, and pending or unknown send status. |
| `GET /transactions/status?receipt=<receipt>` | `send` | Pending, confirmed, failed, or expired status. |

The supported `{action}` values are `jupiter/swap`, `dlmm/open`, `dlmm/add`, `dlmm/remove`, `dlmm/claim-fee`, `dlmm/zap-out`, `strategy/close`, and continuation actions `dlmm/extend`, `dlmm/add-range`, `dlmm/zap-out/swap`. No Phoenix, depositor, resolver, admin, vault-settings, or fee-claim builder is exposed in V1.

## Transaction sequence

1. Read current vault state and choose a supported action.
2. Build with `POST /transactions/{action}`. The JSON body includes `vault` and action fields. Do not send `payer`; the API sets it from the key's manager public key.
3. Deserialize each `result.transaction` from base64 as a Solana v0 `VersionedTransaction`. Sign the exact message locally, preserving builder-added signatures.
4. Send signed base64 bytes with the step's `ticket` to `POST /transactions/send`.
5. Keep the returned `signature` and `receipt`; poll the receipt until confirmed, failed, or expired. If send is `unknown`, poll the same receipt before rebuilding.
6. Follow `sendConcurrently` batch markers and `next` continuation steps only after required confirmations.

Amounts cross JSON as decimal strings in token base units. A successful build, local signature, RPC acceptance, and on-chain confirmation are separate states. For a working call sequence, read [examples](examples.md); for fields and errors, read [builders](transactions.md), [send and status](send-and-status.md), and [errors and limits](errors-and-limits.md). For the full set of product features and their access paths, start with the [agent onboarding guide](https://hedgin.xyz/guides/start-here.md).
