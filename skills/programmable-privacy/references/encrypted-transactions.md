# Encrypted Transactions Reference

## SDK Methods

| Method | Description |
|--------|-------------|
| `bite.encryptTransaction(tx)` | Encrypt `to` + `data`, returns tx with magic address as recipient |
| `bite.getDecryptedTransactionData(hash)` | Retrieve decrypted `{data, to}` after execution (optional) |

## Gas

| Rule | Detail |
|------|--------|
| Always set `gasLimit` manually | `estimateGas` does not work with encrypted transactions |
| Default | 300,000 |
| Complex txs | 500,000+ |

## What's Encrypted vs Public

| Field | Encrypted |
|-------|-----------|
| Recipient (to) | Yes |
| Calldata | Yes |
| Sender | No (signed) |
| Value | No |
| Gas used | No |

## Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| SKALE Base | 1187947933 | Live |
| SKALE Base Sepolia | 324705682 | Live |
