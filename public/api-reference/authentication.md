# Hedgin Manager Bot API: Authentication

Every request to `https://hedgin.xyz/api/external/v1` requires `Authorization: Bearer hv1_<id>_<secret>`. A Hedgin administrator creates, scopes, rotates, and revokes keys in the admin dashboard. The full key is shown once. Keep it out of Git, logs, URLs, and browser variables.

Each key has a manager Solana public key, optional vault allowlist, allowed actions, and optional expiry. Allowed actions are `read`, `send`, and exact [builder action names](transactions.md). `read` permits documented GET reads. `send` permits signed transaction relay and status polling. Vault-specific requests check current on-chain authority.

The API sets `payer` from the key's manager public key. The bot must still sign each transaction locally with the vault's current Solana authority key. The server never holds this key.

Database-backed edits and revocations take effect after an app cache of about five seconds. If the key database is unavailable or its record is invalid, authentication fails closed with HTTP 503. Revoking an API key does not rotate a compromised Solana manager key; rotate vault authority on chain separately.

For an integration, ask a Hedgin administrator to provision the key with the correct manager public key, vault allowlist, `read` and `send` scopes, and exact builder actions. Rotate by creating a new key, moving the bot to it, and revoking the old key. See [getting started](getting-started.md), [builder actions](transactions.md), and [call examples](examples.md).
