# Multi-Transaction Mode (MTM)

## Overview

Multi-Transaction Mode (MTM) enables extremely high throughput on SKALE Chains by allowing accounts to send multiple transactions with incremental nonces per block. This mode is essential for building high-performance dApps that require processing large volumes of transactions quickly.

## Performance Characteristics

### Without MTM Mode
- Subsequent transactions from the same account within the same block will revert
- Applications must rate limit transactions per block to avoid reverts
- Typical throughput: ~200 TPS per chain

### With MTM Mode
- Multiple transactions per block per account allowed
- Supports up to **700 TPS** for medium SKALE Chains
- Enables large bursts of traffic without transaction failures
- Critical for high-performance dApps with complex operations

## Requirements

### Chain Configuration

**Important:** MTM must be enabled upon chain creation. Future SKALE Chains will allow toggling this mode on or off by the assigned `MTM_ADMIN_ROLE`.

**SKALE Base Chains with MTM Enabled:**

| Network | Chain ID | MTM Status |
|---------|----------|------------|
| SKALE Base Sepolia Testnet | 324705682 | Enabled |
| SKALE Base Mainnet | 1187947933 | Enabled |

### Implementation Requirements

To use MTM mode effectively:

1. **Manual Nonce Management**: Track and increment nonces locally
2. **Async Transaction Execution**: Fire multiple transactions concurrently
3. **Initial Nonce Setup**: Get current transaction count before first transaction

## Implementation Patterns

### Ethers.js v5 Pattern

```javascript
import { providers, Wallet, Contract } from "ethers" // v5.7.2

const provider = new providers.JsonRpcProvider("https://skale-base.skalenodes.com/v1/base");
const signer = new Wallet(PRIVATE_KEY).connect(provider);
const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);

// Initialize nonce to current transaction count
let nonce = await provider.getTransactionCount(signer.address);

/**
 * Send transaction with manual nonce incrementation
 * @param {string} functionName - The function to call on the contract
 * @param {Array} args - The function arguments to pass into the contract write
 */
async function write(functionName, args = []) {
    await signer.sendTransaction({
        to: contract.address,
        data: contract.interface.encodeFunctionData(functionName, args),
        nonce: nonce++
    });
}

// Example: Batch mint NFTs with MTM
async function batchMft(recipients) {
    const promises = recipients.map(recipient =>
        write("mint", [recipient])
    );
    await Promise.all(promises);
}
```

### Ethers.js v6 Pattern

```javascript
import { JsonRpcProvider, Wallet, Contract } from "ethers";

const provider = new JsonRpcProvider("https://skale-base.skalenodes.com/v1/base");
const signer = new Wallet(PRIVATE_KEY, provider);
const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);

// Initialize nonce
let nonce = await provider.getTransactionCount(signer.address);

/**
 * Send transaction with MTM nonce handling
 */
async function write(functionName, args = []) {
    const tx = await signer.sendTransaction({
        to: await contract.getAddress(),
        data: contract.interface.encodeFunctionData(functionName, args),
        nonce: nonce++
    });
    return tx;
}

// Example: High-frequency token transfers
async function highFrequencyTransfers(transfers) {
    const promises = transfers.map(({ to, amount }) =>
        write("transfer", [to, amount])
    );
    const results = await Promise.all(promises);
    return results;
}
```

### Viem Pattern

```typescript
import { createWalletClient, createPublicClient, http } from 'viem';
import { skale } from 'viem/chains';

const publicClient = createPublicClient({
  chain: skale,
  transport: http('https://skale-base.skalenodes.com/v1/base')
});

const walletClient = createWalletClient({
  chain: skale,
  transport: http('https://skale-base.skalenodes.com/v1/base'),
  account: privateKeyToAccount(PRIVATE_KEY)
});

// Initialize nonce
let nonce = await publicClient.getTransactionCount({
  address: walletClient.account.address
});

async function write(functionName, args: unknown[]) {
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName,
    args,
    nonce: nonce++
  });
  return hash;
}
```

## Use Cases for MTM Mode

### High-Performance dApps

MTM mode is essential for dApps that require:

1. **Gaming Platforms**
   - Batch in-game asset transfers
   - Multiple state updates per action
   - Real-time leaderboard updates
   - Tournament reward distributions

2. **NFT Marketplaces**
   - Bulk NFT minting
   - Batch listing updates
   - Multiple auction bids processing
   - Collection management operations

3. **DeFi Protocols**
   - High-frequency trading operations
   - Batch liquidity provision
   - Multi-token swaps
   - Yield farming compounding

4. **Social Applications**
   - Batch follow/unfollow operations
   - Multiple content posts
   - Notification batching
   - Reward distribution

### Example: Gaming Platform

```javascript
// Distribute tournament rewards to 100 winners
async function distributeRewards(winners) {
    const REWARD_AMOUNT = ethers.utils.parseEther("100");

    const distributionPromises = winners.map(winner =>
        write("distributeReward", [
            winner.address,
            REWARD_AMOUNT,
            winner.tournamentId
        ])
    );

    await Promise.all(distributionPromises);
}
```

### Example: NFT Bulk Minting

```javascript
// Mint 1000 NFTs in a single collection launch
async function bulkMintCollection(recipients, tokenURIs) {
    const batchSize = 100;

    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const promises = batch.map((recipient, idx) =>
            write("mint", [
                recipient,
                tokenURIs[i + idx]
            ])
        );

        await Promise.all(promises);
        console.log(`Minted batch ${i / batchSize + 1}`);
    }
}
```

## Best Practices

### Nonce Management

1. **Initialize Once**: Get the current nonce at the start of your batch
2. **Increment Locally**: Never fetch nonce between transactions in a batch
3. **Handle Gaps**: If a transaction fails, you may need to account for the unused nonce

```javascript
// Robust nonce management with error handling
async function writeWithErrorHandling(functionName, args = []) {
    try {
        const tx = await signer.sendTransaction({
            to: contract.address,
            data: contract.interface.encodeFunctionData(functionName, args),
            nonce: nonce++
        });
        return { success: true, tx };
    } catch (error) {
        // Decrement nonce on failure for retry
        nonce--;
        return { success: false, error };
    }
}
```

### Batch Size Optimization

1. **Test Batch Sizes**: Start with smaller batches (10-50 transactions)
2. **Monitor Performance**: Adjust based on network conditions
3. **Handle Failures**: Implement retry logic for failed transactions

```javascript
async function safeBatch(transactions, batchSize = 50) {
    const results = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
            batch.map(tx => write(tx.function, tx.args))
        );
        results.push(...batchResults);

        // Optional: Add delay between batches
        if (i + batchSize < transactions.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}
```

### Confirmation Handling

For critical transactions, wait for confirmations:

```javascript
async function writeWithConfirmation(functionName, args = [], confirmations = 1) {
    const tx = await signer.sendTransaction({
        to: contract.address,
        data: contract.interface.encodeFunctionData(functionName, args),
        nonce: nonce++
    });

    await tx.wait(confirmations);
    return tx;
}
```

## Troubleshooting

### Transaction Reverts

**Symptom**: Transactions revert with "nonce too low" or "nonce too high"

**Solutions**:
- Ensure nonce is initialized correctly before batch
- Verify nonce increments exactly once per transaction
- Check for failed transactions that consumed nonce

### Missing Transactions

**Symptom**: Some transactions don't appear on-chain

**Solutions**:
- Verify MTM is enabled on the chain
- Check that nonces are strictly incremental
- Ensure transactions are sent within the same block window

### Performance Issues

**Symptom**: Throughput below expected 700 TPS

**Solutions**:
- Reduce batch size to find optimal throughput
- Check network congestion
- Verify RPC endpoint performance
- Consider using a local SKALE node for testing

## Testing

### Local Testing

Before deploying to mainnet, test MTM patterns on SKALE Base Sepolia Testnet:

```javascript
const TESTNET_RPC = "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha";

async function testMTM() {
    const testRecipients = Array(100).fill(wallet.address);
    await bulkMintCollection(testRecipients, testTokenURIs);
}
```

### Load Testing

```javascript
// Performance test script
async function loadTest(transactionCount = 700) {
    const startTime = Date.now();
    const transactions = [];

    for (let i = 0; i < transactionCount; i++) {
        transactions.push({
            function: "testFunction",
            args: [i]
        });
    }

    await safeBatch(transactions);
    const duration = Date.now() - startTime;

    console.log(`Processed ${transactionCount} transactions in ${duration}ms`);
    console.log(`Throughput: ${Math.round(transactionCount / (duration / 1000))} TPS`);
}
```

## Resources

- **SKALE Platformer Demo**: https://platformer.dirtroad.dev - Working MTM implementation
- **Source Code**: https://github.com/TheGreatAxios/skale-platformer/blob/main/src/web3/contracts.js
- **SKALE Documentation**: https://docs.skale.space/
