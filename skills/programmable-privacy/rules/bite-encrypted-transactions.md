---
title: Encrypted Transactions
impact: high
tags: [bite, encrypted-transactions, transactions]
---

# Rule: bite-encrypted-transactions

## Why It Matters

Encrypted Transactions encrypts transaction data (calldata + recipient) before submission. The encrypted data is only decrypted by the consensus committee during execution, keeping sensitive information private from the public mempool. MEV-resistant.

## Available Chains

| Chain | Chain ID | Encrypted TX Support |
|-------|----------|-------------------|
| SKALE Base Sepolia | 324705682 | ✅ |
| SKALE Base | 1187947933 | ✅ |

## Key Constants

```typescript
const BITE_MAGIC_ADDRESS = "0x0000000000000000000000000000000000000401";
const DEFAULT_GAS_LIMIT = 300000;
```

## Incorrect

```typescript
// Missing gas limit - BITE requires manual gasLimit
const bite = new BITE(providerUrl);
const encryptedTx = await bite.encryptTransaction(transaction);
await wallet.sendTransaction(encryptedTx);
// ERROR: estimateGas does not work for BITE transactions
```

## Correct

```typescript
import { BITE } from "@skalenetwork/bite";

class BITETransactionManager {
    private bite: BITE;

    constructor(private providerUrl: string) {
        this.bite = new BITE(providerUrl);
    }

    async sendEncryptedTransaction(
        contractAddress: string,
        calldata: string
    ): Promise<string> {
        const transaction = { to: contractAddress, data: calldata };
        const encryptedTx = await this.bite.encryptTransaction(transaction);

        // CRITICAL: Set gasLimit manually
        const txWithGas = {
            ...encryptedTx,
            gasLimit: 300000
        };

        const tx = await wallet.sendTransaction(txWithGas);
        const receipt = await tx.wait();
        return receipt.transactionHash;
    }

    async getDecryptedData(txHash: string) {
        return await this.bite.getDecryptedTransactionData(txHash);
    }

    async getCommitteeInfo() {
        const committees = await this.bite.getCommitteesInfo();
        if (committees.length === 2) {
            console.log("Committee rotation - dual encryption mode");
        }
        return committees;
    }
}
```

## Committee Rotation Handling

```typescript
async sendWithRotationCheck(
    contractAddress: string,
    calldata: string
): Promise<string> {
    const committees = await this.bite.getCommitteesInfo();

    if (committees.length === 2) {
        console.log(`Rotation: epoch ${committees[0].epochId} → ${committees[1].epochId}`);
    }

    // SDK handles dual encryption automatically
    const encryptedTx = await this.bite.encryptTransaction({
        to: contractAddress,
        data: calldata,
        gasLimit: 300000
    });

    const tx = await wallet.sendTransaction(encryptedTx);
    return (await tx.wait()).transactionHash;
}
```

## Batch Encryption

```typescript
async function encryptBatch(
    transactions: Array<{ to: string; data: string }>,
    bite: BITE
) {
    const committees = await bite.getCommitteesInfo();
    return Promise.all(
        transactions.map(tx =>
            BITE.encryptTransactionWithCommitteeInfo(tx, committees)
        )
    );
}
```

## Encryption Flow

```
User Transaction
       │
       ├───> BITE.encryptTransaction()
       │        ├── 1. RLP encode (data, to)
       │        ├── 2. AES encrypt with random key
       │        ├── 3. BLS threshold encrypt AES key
       │        └── 4. Create payload: [EPOCH_ID, ENCRYPTED_DATA]
       │
       └───> Send to BITE magic address (0x...0401)
              └──> SKALE Consensus (2t+1 nodes)
                     └──> Threshold decryption → execute
```

## Gas Limit Guidelines

| Scenario | Gas Limit | Notes |
|----------|-----------|-------|
| Default | 300,000 | Works for most txs |
| Complex tx | 500,000+ | Increase for heavy logic |
| estimateGas | ❌ Never | Does not work with BITE |

## Committee Model

| Parameter | Value |
|-----------|-------|
| Committee size | 3t + 1 nodes |
| Decryption threshold | 2t + 1 nodes |
| Single committee | Normal operation |
| Dual committee | Rotation (3 min window) |

## Integration Checklist

- [ ] Install `@skalenetwork/bite@0.8.1`
- [ ] Always set `gasLimit` manually (never use estimateGas)
- [ ] Handle committee rotation for time-sensitive txs
- [ ] Cache committee info for batch operations
- [ ] Use `getDecryptedTransactionData` to retrieve decrypted data
- [ ] Test on testnet/sandbox first
