# Jupiter swaps in a Hedgin vault

Managers can swap vault assets through the program's checked Jupiter path. The manager bot API supports a scoped quote and `POST /transactions/jupiter/swap`. One side of a supported swap must be the vault's deposit mint. The program caps slippage by protocol policy and validates the Jupiter route and relevant token accounts on chain.

## Bot flow

1. Read the vault's deposit mint and current holdings. Request `GET /jupiter/quote?vault=&inputMint=&outputMint=&amount=&slippageBps=` with `read` scope. The quote is an estimate, not a promise of execution.
2. Build `POST /transactions/jupiter/swap` with JSON `{ "vault": "...", "sourceMint": "...", "destinationMint": "...", "amount": "1000000", "slippageBps": 50 }`. The key needs `jupiter/swap` scope. Do not include `payer`.
3. The builder may first initialize a Jupiter strategy for the target mint and return a `next` step. Confirm the first transaction before building `next.path` with `next.body`.
4. Sign each returned v0 transaction with the manager authority, send with its ticket, poll the receipt, and re-read holdings after confirmation.

`amount` is a decimal string in source-token base units. `slippageBps` is basis points; 50 means 0.5%. The program's configured maximum can be lower than the requested value. A quote can expire or become unfillable between reading and execution. See the [builder fields](https://hedgin.xyz/api-reference/transactions.md), [call examples](https://hedgin.xyz/api-reference/examples.md), and [transaction lifecycle](transactions.md).
