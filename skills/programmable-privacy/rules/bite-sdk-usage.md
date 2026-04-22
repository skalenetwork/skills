---
title: BITE TypeScript SDK Usage
impact: high
tags: [bite, sdk, typescript]
---

# Rule: bite-sdk-usage

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

### Get Decrypted Data

```typescript
async function getDecryptedData(txHash: string) {
    const { data, to } = await bite.getDecryptedTransactionData(txHash);
    return { data, to };
}
```

### Committee Info

```typescript
async function checkCommittees() {
    const committees = await bite.getCommitteesInfo();

    if (committees.length === 2) {
        console.log('⚠️ Committee rotation in progress');
    }

    return committees;
}
```

### Batch Encryption

```typescript
async function encryptBatch(
    transactions: Array<{ to: string; data: string }>,
    bite: BITE
) {
    const committees = await bite.getCommitteesInfo();
    return transactions.map(tx =>
        BITE.encryptTransactionWithCommitteeInfo(tx, committees)
    );
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

## Complete Example: Private Transfer

```typescript
import { BITE } from '@skalenetwork/bite';
import { ethers, Contract } from 'ethers';

const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address) view returns (uint256)'
];

class PrivateTokenTransfer {
    private bite: BITE;
    private wallet: ethers.Wallet;

    constructor(rpcUrl: string, privateKey: string) {
        this.bite = new BITE(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpcUrl));
    }

    async transferPrivate(tokenAddress: string, to: string, amount: bigint) {
        const token = new Contract(tokenAddress, ERC20_ABI, this.wallet);
        const calldata = token.interface.encodeFunctionData('transfer', [to, amount]);

        const encryptedTx = await this.bite.encryptTransaction({
            to: tokenAddress,
            data: calldata
        });

        const tx = await this.wallet.sendTransaction({
            ...encryptedTx,
            gasLimit: 300_000
        });

        return await tx.wait();
    }

    async verifyTransfer(txHash: string) {
        const { data, to } = await this.bite.getDecryptedTransactionData(txHash);
        const token = new Contract(to, ERC20_ABI, this.wallet);
        return token.interface.decodeFunctionData('transfer', data);
    }
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
        if (error.message.includes('committee')) {
            console.log('Committee rotation detected, retrying...');
            await new Promise(r => setTimeout(r, 3000));
            return safeEncrypt(transaction, bite);
        }
        return { success: false, error: error.message };
    }
}
```

## API Reference

| Method | Description | Feature |
|--------|-------------|---------|
| `encryptTransaction(tx)` | Encrypt transaction data | Encrypted Transactions |
| `getDecryptedTransactionData(hash)` | Get decrypted data | Encrypted Transactions |
| `getCommitteesInfo()` | Get committee BLS keys | Encrypted Transactions |
| `encryptTransactionWithCommitteeInfo(tx, info)` | Encrypt with cached info | Encrypted Transactions |
| `encryptMessage(data)` | Encrypt arbitrary data (TE) | Re-encryption |
| `encryptMessageForCTX(data, submitter)` | Encrypt for CTX with AAD | CTX |

## Resources

- **GitHub**: `github.com/skalenetwork/bite-ts`
- **npm**: `@skalenetwork/bite@0.8.1`
