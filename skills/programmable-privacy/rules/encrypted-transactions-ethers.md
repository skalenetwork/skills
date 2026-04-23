---
title: Encrypted Transactions (ethers.js)
impact: high
tags: [bite, encrypted-transactions, transactions, ethers]
---

# Rule: encrypted-transactions-ethers

## Why It Matters

Encrypted Transactions encrypt transaction data (`to` + `calldata`) before submission. The encrypted payload is only decrypted by SKALE validators during execution, keeping sensitive information private from the public mempool. MEV-resistant.

## Available Chains

| Chain | Chain ID | Encrypted TX Support |
|-------|----------|-------------------|
| SKALE Base Sepolia | 324705682 | ✅ |
| SKALE Base | 1187947933 | ✅ |

## Key Constants

```typescript
const BITE_MAGIC_ADDRESS = "0x42495445204D452049274d20454E435259505444";
const DEFAULT_GAS_LIMIT = 300000;
```

## Incorrect

```typescript
// Missing gas limit - BITE requires manual gasLimit
const bite = new BITE(providerUrl);
const encryptedTx = await bite.encryptTransaction(transaction);
await wallet.sendTransaction(encryptedTx);
// ERROR: estimateGas does not work with BITE transactions
```

## Correct

```typescript
import { BITE } from "@skalenetwork/bite";
import { ethers } from "ethers";

const bite = new BITE(rpcUrl);
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

async function sendEncryptedTransaction(
    contractAddress: string,
    calldata: string
): Promise<string> {
    const encryptedTx = await bite.encryptTransaction({
        to: contractAddress,
        data: calldata,
    });

    const tx = await wallet.sendTransaction({
        ...encryptedTx,
        gasLimit: 300000,
    });

    const receipt = await tx.wait();
    return receipt.transactionHash;
}
```

## Viewing Decrypted Transactions (Optional)

After a transaction executes, you can retrieve the decrypted `to` and `calldata` for debugging or logging. This is not required for normal operation — encrypted transactions execute correctly without ever reading the decrypted data.

```typescript
const { data, to } = await bite.getDecryptedTransactionData(txHash);
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
       └───> Send to BITE magic address (0x4249...5044)
              └──> SKALE Validators
                     └──> Threshold decryption → execute
```

## Gas Limit Guidelines

| Scenario | Gas Limit | Notes |
|----------|-----------|-------|
| Default | 300,000 | Works for most txs |
| Complex tx | 500,000+ | Increase for heavy logic |
| estimateGas | ❌ Never | Does not work with BITE |

## Integration Checklist

- [ ] Install `@skalenetwork/bite@0.8.1`
- [ ] Always set `gasLimit` manually (never use `estimateGas`)
- [ ] Test on SKALE Base Sepolia first
