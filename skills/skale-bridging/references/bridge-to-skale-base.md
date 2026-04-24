# Bridge TO SKALE Base - Implementation Guide

Use this guide when bridging USDC **TO** SKALE Base Chain from Base, Polygon, Ethereum, Optimism, or Arbitrum.

## Overview

Uses Trails API. User transfers USDC to intent address, API executes IMA DepositBox call.

## Key Concept

**All TO SKALE bridges route through Base's IMA DepositBox.**
- Base → SKALE: Direct IMA call
- Non-Base → SKALE: Multi-hop via Trails Router to Base, then IMA

## Constants

```typescript
const BASE_CHAIN_ID = 8453;
const SKALE_CHAIN_ID = 1187947933;
const SKALE_CHAIN_NAME = "winged-bubbly-grumium";

// Base addresses
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const IMA_DEPOSIT_BOX = "0x7f54e52D08C911eAbB4fDF00Ad36ccf07F867F61";
const TRAILS_ROUTER = "0xF8A739B9F24E297a98b7aba7A9cdFDBD457F6fF8";
```

## USDC Addresses by Chain

| Chain | Chain ID | USDC Address |
|-------|----------|--------------|
| Ethereum | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Polygon | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Optimism | 10 | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` |
| Arbitrum | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |

## Complete Implementation

### Step 1: Setup

```typescript
import { TrailsApi } from '@0xtrails/api';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, polygon, mainnet, optimism, arbitrum } from 'viem/chains';

// Trails client
const trails_api_key = process.env.TRAILS_API_KEY;
const trailsAPI = new TrailsApi(trails_api_key);

// Account (provide a wallet private key via PRIVATE_KEY env var)
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
```

### Step 2: Configure Chain

```typescript
// Chain mappings
const CHAIN_MAP = {
  8453: base,        // Base
  137: polygon,      // Polygon
  1: mainnet,        // Ethereum
  10: optimism,      // Optimism
  42161: arbitrum,   // Arbitrum
};

const USDC_ADDRESSES = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",        // Ethereum
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",      // Base
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",       // Polygon
  10: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",        // Optimism
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",    // Arbitrum
};

// Set origin chain
const originChainId = 8453; // Base (use 137 for Polygon, 1 for Ethereum, 10 for Optimism, 42161 for Arbitrum)
const originChain = CHAIN_MAP[originChainId];
const originUSDC = USDC_ADDRESSES[originChainId];
```

### Step 3: Prepare Bridge Parameters

```typescript
const recipientAddress = account.address; // Where USDC arrives on SKALE
const amountBigInt = 100000n; // 0.1 USDC (6 decimals)
```

### Step 4: Prepare IMA Calldata

```typescript
function encodeDepositERC20Direct(
  schainName: string,
  tokenAddress: string,
  amount: bigint,
  receiver: string
): string {
  const abi = [
    {
      "inputs": [
        {"internalType": "string", "name": "schainName", "type": "string"},
        {"internalType": "address", "name": "erc20OnMainnet", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"},
        {"internalType": "address", "name": "receiver", "type": "address"}
      ],
      "name": "depositERC20Direct",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  return encodeFunctionData({
    abi,
    functionName: 'depositERC20Direct',
    args: [schainName, tokenAddress as `0x${string}`, amount, receiver as `0x${string}`]
  });
}

const imaCalldata = encodeDepositERC20Direct(
  SKALE_CHAIN_NAME,
  BASE_USDC,
  amountBigInt,
  recipientAddress
);
```

### Step 5: Determine Routing Pattern

```typescript
const TRAILS_PLACEHOLDER_AMOUNT = BigInt('0xdeadbeefdeadbeef');

function wrapWithTrailsRouter(
  tokenAddress: string,
  targetAddress: string,
  targetCallData: string
): { toAddress: string; callData: string } {
  const abi = [
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "address", "name": "target", "type": "address"},
        {"internalType": "bytes", "name": "data", "type": "bytes"}
      ],
      "name": "injectAndCall",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  return {
    toAddress: TRAILS_ROUTER,
    callData: encodeFunctionData({
      abi,
      functionName: 'injectAndCall',
      args: [
        tokenAddress as `0x${string}`,
        targetAddress as `0x${string}`,
        targetCallData as `0x${string}`
      ]
    })
  };
}

// Determine routing based on origin chain
let destinationChainId: number;
let destinationTokenAddress: string;
let destinationToAddress: string;
let destinationCallData: string;

if (originChainId === 8453) {
  // Base → SKALE: Direct IMA call
  destinationChainId = 8453; // Stay on Base!
  destinationTokenAddress = BASE_USDC;
  destinationToAddress = IMA_DEPOSIT_BOX;
  destinationCallData = imaCalldata;
} else {
  // Non-Base → SKALE: Multi-hop via Trails Router
  destinationChainId = 8453; // Route to Base!
  destinationTokenAddress = BASE_USDC;

  // Encode IMA with PLACEHOLDER for non-Base
  const imaCalldataPlaceholder = encodeDepositERC20Direct(
    SKALE_CHAIN_NAME,
    BASE_USDC,
    TRAILS_PLACEHOLDER_AMOUNT,
    recipientAddress
  );

  // Wrap with Trails Router
  const wrapped = wrapWithTrailsRouter(
    BASE_USDC,
    IMA_DEPOSIT_BOX,
    imaCalldataPlaceholder
  );

  destinationToAddress = wrapped.toAddress;
  destinationCallData = wrapped.callData;
}
```

### Step 6: Get Quote

```typescript
const quote = await trailsAPI.getQuote({
  ownerAddress: account.address,
  originChainId: originChainId,
  originTokenAddress: originUSDC,
  originTokenAmount: amountBigInt,
  destinationChainId, // 8453 for ALL SKALE transfers!
  destinationTokenAddress,
  destinationToAddress,
  destinationCallData,
  slippageTolerance: 0.005,
  destinationCallValue: 0n,
});
```

### Step 7: Commit Intent

```typescript
const intentId = await trailsAPI.commitIntent(quote.intent);
```

### Step 8: Setup Clients

```typescript
const walletClient = createWalletClient({
  account,
  chain: originChain,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: originChain,
  transport: http(),
});
```

### Step 9: Approve USDC (if needed)

```typescript
// Check allowance
const allowance = await publicClient.readContract({
  address: originUSDC as `0x${string}`,
  abi: [{ name: 'allowance', inputs: ['address', 'address'], outputs: ['uint256'], stateMutability: 'view', type: 'function' }],
  functionName: 'allowance',
  args: [account.address, quote.intent.depositTransaction.to as `0x${string}`],
});

if (allowance < amountBigInt) {
  // Approve first
  const nonce = await publicClient.getTransactionCount({ address: account.address });
  await walletClient.writeContract({
    nonce,
    address: originUSDC as `0x${string}`,
    abi: [{ name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: ['boolean'], stateMutability: 'nonpayable', type: 'function' }],
    functionName: 'approve',
    args: [quote.intent.depositTransaction.to as `0x${string}`, amountBigInt],
  });

  // Wait for approval
  await new Promise(r => setTimeout(r, 5000));
}
```

### Step 10: Transfer USDC

```typescript
const nonce = await publicClient.getTransactionCount({ address: account.address });
const transferHash = await walletClient.writeContract({
  nonce,
  ...quote.intent.depositTransaction,
});
```

### Step 11: Execute Intent

```typescript
await trailsAPI.executeWithTransactionHash({
  intentId,
  depositTransactionHash: transferHash,
});
```

### Step 12: Monitor Completion

```typescript
while (true) {
  const status = await trailsAPI.getIntentReceipt({ intentId });
  console.log('Status:', status.intentStatus);

  if (status.intentStatus === 'SUCCEEDED' || status.intentStatus === 'FAILED') {
    break;
  }

  await new Promise(r => setTimeout(r, 10000));
}
```

## Common Errors

### "replacement transaction underpriced"

Fetch fresh nonce after approval confirms:
```typescript
await new Promise(r => setTimeout(r, 5000));
const nonce = await publicClient.getTransactionCount({ address: account.address });
```

### "no routes found for request"

Wrong `destinationChainId`. Must be 8453 (Base) for ALL SKALE transfers.

### "call reverted: refund triggered on origin"

IMA DepositBox received placeholder amount instead of actual amount (Base origin only).

For Base origin, use actual amount in calldata. For non-Base, use Trails Router wrapper.

## Dependencies

```json
{
  "dependencies": {
    "@0xtrails/api": "^0.13.2",
    "viem": "^2.47.5"
  }
}
```
