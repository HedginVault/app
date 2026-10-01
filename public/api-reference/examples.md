# Hedgin Manager Bot API: Call examples

Base URL: `https://hedgin.xyz/api/external/v1`. These examples use placeholders and do not submit a transaction until the send step. Obtain a scoped API key from a Hedgin administrator and load it from your bot's secret store. Keep the Solana manager signing key local to the bot.

## 1. List vaults and request a quote

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $HEDGIN_API_KEY" \
  https://hedgin.xyz/api/external/v1/vaults

curl --fail-with-body --get \
  -H "Authorization: Bearer $HEDGIN_API_KEY" \
  --data-urlencode "vault=$VAULT_PUBLIC_KEY" \
  --data-urlencode "inputMint=$SOURCE_MINT" \
  --data-urlencode "outputMint=$DESTINATION_MINT" \
  --data-urlencode "amount=1000000" \
  --data-urlencode "slippageBps=50" \
  https://hedgin.xyz/api/external/v1/jupiter/quote
```

The `amount` above is one million token base units. A quote can change before a transaction is built or sent. The key needs `read` scope and access to the vault.

## 2. Build an unsigned Jupiter swap

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $HEDGIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vault":"VAULT_PUBLIC_KEY","sourceMint":"SOURCE_MINT","destinationMint":"DESTINATION_MINT","amount":"1000000","slippageBps":50}' \
  https://hedgin.xyz/api/external/v1/transactions/jupiter/swap
```

The key needs `jupiter/swap` scope. The response is `{ "vault": "...", "result": { "transaction": "...", "simulation": { ... }, "ticket": "...", "blockhash": "..." } }` for a single step; `result` can also be an array. A step can contain `next` when a follow-up build is required. Do not include `payer` in the request.

## 3. Sign locally, send, and poll

For one returned step, use a Solana v0 transaction library such as `@solana/web3.js`. Pass in the step from the parsed build response, the API key, and a manager keypair loaded from your bot's secret store:

```ts
import { Keypair, VersionedTransaction } from "@solana/web3.js";

type BuildStep = { transaction: string; ticket: string };

async function sendOneStep(step: BuildStep, apiKey: string, managerKeypair: Keypair) {
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(step.transaction, "base64"),
  );
  transaction.sign([managerKeypair]);

  const sendResponse = await fetch(
    "https://hedgin.xyz/api/external/v1/transactions/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: Buffer.from(transaction.serialize()).toString("base64"),
        ticket: step.ticket,
      }),
    },
  );
  if (!sendResponse.ok) throw new Error(`Send returned HTTP ${sendResponse.status}`);
  const sent = await sendResponse.json(); // { signature, receipt, status }

  const statusResponse = await fetch(
    `https://hedgin.xyz/api/external/v1/transactions/status?receipt=${encodeURIComponent(sent.receipt)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!statusResponse.ok) throw new Error(`Status returned HTTP ${statusResponse.status}`);
  const status = await statusResponse.json();
  return { sent, status };
}
```

The key needs `send` scope to relay and poll. Keep `sent.signature` and `sent.receipt` even when `sent.status` is `unknown`; poll the same receipt because the transaction may already have landed. Continue polling while status is `pending`. Treat only `confirmed` as success. If `result` is an array, process all steps using the documented `sendConcurrently` and confirmation rules. If a confirmed step returns `next`, build `next.path` with `next.body` after that confirmation. See [transaction builders](transactions.md) and [send and status](send-and-status.md).
