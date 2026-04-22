# SDK Reference

Install: `npm install @skalenetwork/bite@0.8.1`

## Initialization

```typescript
import { BITE } from '@skalenetwork/bite';
const bite = new BITE('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha');
```

## Encrypted Transactions

### `encryptTransaction(tx)`

Encrypts transaction `to` + `data` using BLS threshold encryption. Returns modified tx with BITE magic address as recipient.

```typescript
const encrypted = await bite.encryptTransaction({
    to: "0xContractAddress",
    data: "0xCalldata"
});
// Send with manual gasLimit
const tx = await wallet.sendTransaction({ ...encrypted, gasLimit: 300_000 });
```

### `getDecryptedTransactionData(txHash)`

Retrieves decrypted `data` and `to` after execution.

```typescript
const { data, to } = await bite.getDecryptedTransactionData(txHash);
```

### `getCommitteesInfo()`

Returns array of committee objects. Length 2 = rotation in progress (3 min window).

```typescript
const committees = await bite.getCommitteesInfo();
// { commonBLSPublicKey: string, epochId: number }[]
```

### `encryptTransactionWithCommitteeInfo(tx, committees)` (static)

Encrypt with pre-fetched committee info. Useful for batch encryption.

```typescript
const committees = await bite.getCommitteesInfo();
const batch = transactions.map(tx =>
    BITE.encryptTransactionWithCommitteeInfo(tx, committees)
);
```

## CTX & Re-encryption

### `encryptMessage(message)`

Encrypts raw data using threshold encryption (network key). For CTX submission.

```typescript
const encrypted = await bite.encryptMessage(ethers.toUtf8Bytes(data));
```

### `encryptMessageForCTX(message, ctxSubmitterAddress)`

Encrypts data with AAD (Additional Authenticated Data) set to the CTX submitter address. Only that contract can submit the CTX to decrypt.

```typescript
const encrypted = await bite.encryptMessageForCTX(
    ethers.toUtf8Bytes(data),
    contractAddress
);
```

## Method Summary

| Method | Feature | Description |
|--------|---------|-------------|
| `encryptTransaction(tx)` | Encrypted Transactions | Encrypt tx to + data |
| `getDecryptedTransactionData(hash)` | Encrypted Transactions | Retrieve decrypted tx data |
| `getCommitteesInfo()` | Encrypted Transactions | Get committee BLS keys |
| `encryptTransactionWithCommitteeInfo(tx, info)` | Encrypted Transactions | Encrypt with cached committee |
| `encryptMessage(data)` | Re-encryption | TE encrypt arbitrary data |
| `encryptMessageForCTX(data, submitter)` | CTX | TE encrypt with AAD for CTX |

## Resources

- [npm: @skalenetwork/bite@0.8.1](https://www.npmjs.com/package/@skalenetwork/bite)
- [GitHub: bite-ts](https://github.com/skalenetwork/bite-ts)
