# Encrypted Transactions Reference

## What It Does

Encrypts the `to` address and `calldata` of any transaction before it hits the mempool. Only the SKALE validator committee can decrypt during execution. MEV-resistant.

## SDK Methods

| Method | Description |
|--------|-------------|
| `bite.encryptTransaction(tx)` | Encrypt `to` + `data`, returns tx with magic address as recipient |
| `bite.getDecryptedTransactionData(hash)` | Retrieve decrypted `{data, to}` after execution |
| `bite.getCommitteesInfo()` | Get committee BLS keys and epoch IDs |
| `BITE.encryptTransactionWithCommitteeInfo(tx, info)` | Static — encrypt with pre-fetched committee info |

## Gas

| Rule | Detail |
|------|--------|
| Always set `gasLimit` manually | `estimateGas` does not work with encrypted transactions |
| Default | 300,000 |
| Complex txs | 500,000+ |

## Committee Model

| Parameter | Value |
|-----------|-------|
| Committee size | 3t + 1 nodes |
| Decryption threshold | 2t + 1 nodes |
| Rotation window | ~3 minutes (dual committee) |

`getCommitteesInfo()` returns 1 committee normally, 2 during rotation. SDK handles dual encryption automatically.

## Encryption Flow

```
encryptTransaction({ to, data })
  → RLP encode [data, to]
  → AES encrypt with random key
  → BLS threshold encrypt AES key
  → RLP encode [epochId, encryptedData]
  → Replace `to` with magic address 0x...0401
```

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
