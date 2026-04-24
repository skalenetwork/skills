# Bridge FROM SKALE Base - Implementation Guide

Use this guide when bridging USDC **FROM** SKALE Base Chain **TO** Base.

## Overview

Uses direct IMA exit with Community Pool for gas funding. No Trails API involved.

## Key Concept

**Exit flow requires Community Pool activation** to fund gas on Base for the receiving transaction.

## Constants

```typescript
const SKALE_CHAIN_ID = 1187947933;
const SKALE_CHAIN_NAME = "winged-bubbly-grumium";

// SKALE addresses
const SKALE_USDC = "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20";
const TOKEN_MANAGER_ERC20 = "0xD2aAA00500000000000000000000000000000000";
const COMMUNITY_LOCKER = "0xD2aaa00300000000000000000000000000000000";

// Base addresses
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const COMMUNITY_POOL = "0x7153b03C04E0DeeDB24FD745F6765C676E33330c";
```

## Complete Implementation

### Step 1: Setup

```typescript
import { createWalletClient, createPublicClient, http, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Account (provide a wallet private key via PRIVATE_KEY env var)
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
```

### Step 2: Setup SKALE Client

```typescript
const skaleClient = createWalletClient({
  account,
  chain: {
    id: SKALE_CHAIN_ID,
    name: 'SKALE Base',
    nativeCurrency: { name: 'Credits', symbol: 'CREDIT', decimals: 18 },
    rpcUrls: { default: { http: ['https://skale-base.skalenodes.com/v1/base'] } }
  },
  transport: http(),
});

const skalePublicClient = createPublicClient({
  chain: {
    id: SKALE_CHAIN_ID,
    name: 'SKALE Base',
    nativeCurrency: { name: 'Credits', symbol: 'CREDIT', decimals: 18 },
    rpcUrls: { default: { http: ['https://skale-base.skalenodes.com/v1/base'] } }
  },
  transport: http(),
});
```

### Step 3: Setup Base Client

```typescript
const baseClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(),
});
```

### Step 4: Prepare Bridge Parameters

```typescript
const recipientOnBase = account.address; // Where USDC arrives on Base
const amountToExit = 100000n; // 0.1 USDC (6 decimals)
```

### Step 5: Check Community Pool Activation

```typescript
// Check pool balance on Base
const poolBalance = await basePublicClient.readContract({
  address: COMMUNITY_POOL as `0x${string}`,
  abi: [{
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "string", "name": "schainName", "type": "string"}
    ],
    "name": "getBalance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }],
  functionName: 'getBalance',
  args: [account.address, SKALE_CHAIN_NAME],
});

// Check activation status on SKALE
const isActiveOnLocker = await skalePublicClient.readContract({
  address: COMMUNITY_LOCKER as `0x${string}`,
  abi: [{
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "activeUsers",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }],
  functionName: 'activeUsers',
  args: [account.address],
});

console.log('Pool Balance:', poolBalance);
console.log('Active on Locker:', isActiveOnLocker);
```

### Step 6: Recharge Community Pool (if needed)

```typescript
if (poolBalance === 0n || !isActiveOnLocker) {
  console.log('Community Pool not active. Recharging with 0.0001 ETH...');

  const rechargeHash = await baseClient.writeContract({
    address: COMMUNITY_POOL as `0x${string}`,
    abi: [{
      "inputs": [
        {"internalType": "string", "name": "schainName", "type": "string"},
        {"internalType": "address", "name": "receiver", "type": "address"}
      ],
      "name": "rechargeUserWallet",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    }],
    functionName: 'rechargeUserWallet',
    args: [SKALE_CHAIN_NAME, account.address],
    value: 100000000000n, // 0.0001 ETH
  });

  console.log(`Recharge transaction sent: ${rechargeHash}`);
  console.log('Waiting for confirmation...');

  // Wait for receipt and verify success
  const receipt = await basePublicClient.waitForTransactionReceipt({ hash: rechargeHash });

  if (receipt.status !== 'success') {
    throw new Error('Recharge transaction failed. Check transaction on Base explorer.');
  }

  console.log('Recharge confirmed! Waiting for activation (10-60 seconds)...');
  await new Promise(r => setTimeout(r, 30000));
}
```

### Step 7: Approve TokenManager

```typescript
const nonce = await skalePublicClient.getTransactionCount({ address: account.address });
await skaleClient.writeContract({
  nonce,
  address: SKALE_USDC as `0x${string}`,
  abi: [{
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }],
  functionName: 'approve',
  args: [TOKEN_MANAGER_ERC20 as `0x${string}`, amountToExit],
});

// Wait for approval
await new Promise(r => setTimeout(r, 5000));
```

### Step 8: Execute Exit

```typescript
const exitNonce = await skalePublicClient.getTransactionCount({ address: account.address });
const exitHash = await skaleClient.writeContract({
  nonce: exitNonce,
  address: TOKEN_MANAGER_ERC20 as `0x${string}`,
  abi: [{
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "exitToMainERC20",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }],
  functionName: 'exitToMainERC20',
  args: [BASE_USDC as `0x${string}`, amountToExit],
});

console.log('Exit transaction hash:', exitHash);
```

## Common Errors

### "Community Pool is not active"

User hasn't recharged Community Pool for SKALE → Base bridging.

**Solution**: Recharge with 0.0001 ETH to `COMMUNITY_POOL` contract on Base (Step 6).

### Exit transaction fails

Check that:
1. USDC is approved for TokenManager
2. Sufficient USDC balance in wallet
3. Sufficient CREDIT balance for transaction on SKALE

## Notes

- **Gas cost**: SKALE has near-zero gas fees (CREDIT), but Base requires ETH for Community Pool
- **Timing**: USDC arrives on Base in 10-20 seconds after exit
- **Recharge amount**: 0.0001 ETH is sufficient for most exits
- **Pool balance**: Can be reused for multiple exits until depleted

## Dependencies

```json
{
  "dependencies": {
    "viem": "^2.47.5"
  }
}
```

**Note**: No Trails API required for SKALE → Base bridges.
