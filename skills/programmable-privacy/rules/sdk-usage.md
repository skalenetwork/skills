---
title: BITE TypeScript SDK Usage
impact: high
tags: [bite, sdk, typescript]
---

# Rule: sdk-usage

## Why It Matters

The `@skalenetwork/bite` TypeScript SDK provides utilities for encrypting transactions and interacting with BITE Protocol from JavaScript/TypeScript applications.

## Installation

```bash
npm install @skalenetwork/bite@0.8.1
# or
bun add @skalenetwork/bite@0.8.1
```

## Basic Usage

```typescript
import { BITE } from '@skalenetwork/bite';

const bite = new BITE('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha');
```

## Encrypted Transactions

### Encrypt Transaction

```typescript
import { BITE } from '@skalenetwork/bite';
import { ethers } from 'ethers';

const bite = new BITE(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

async function sendEncryptedTx(to: string, data: string) {
    const encryptedTx = await bite.encryptTransaction({ to, data });

    const tx = await wallet.sendTransaction({
        ...encryptedTx,
        gasLimit: 300_000
    });

    return await tx.wait();
}
```

### Get Decrypted Data (Optional)

Retrieve decrypted `data` and `to` after execution. Not required for normal operation — transactions execute correctly without reading decrypted data.

```typescript
async function getDecryptedData(txHash: string) {
    const { data, to } = await bite.getDecryptedTransactionData(txHash);
    return { data, to };
}
```

## Message Encryption (CTX + Re-encryption)

### Encrypt Message for CTX

```typescript
// Encrypt arbitrary data for CTX submission
async function encryptForCTX(data: string) {
    const encrypted = await bite.encryptMessage(
        ethers.toUtf8Bytes(data)
    );
    return encrypted;
}

// Encrypt with AAD — only specified contract can submit CTX to decrypt
async function encryptForContract(data: string, ctxSubmitterAddress: string) {
    const encrypted = await bite.encryptMessageForCTX(
        ethers.toUtf8Bytes(data),
        ctxSubmitterAddress
    );
    return encrypted;
}
```

## Error Handling

```typescript
async function safeEncrypt(
    transaction: { to: string; data: string },
    bite: BITE
) {
    try {
        const encrypted = await bite.encryptTransaction(transaction);
        return { success: true, data: encrypted };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

## API Reference

| Method | Description | Feature |
|--------|-------------|---------|
| `encryptTransaction(tx)` | Encrypt transaction data | Encrypted Transactions |
| `getDecryptedTransactionData(hash)` | Get decrypted data (optional) | Encrypted Transactions |
| `encryptMessage(data)` | Encrypt arbitrary data (TE) | Re-encryption |
| `encryptMessageForCTX(data, submitter)` | Encrypt for CTX with AAD | CTX |

## Resources

- **GitHub**: `github.com/skalenetwork/bite-ts`
- **npm**: `@skalenetwork/bite@0.8.1`
