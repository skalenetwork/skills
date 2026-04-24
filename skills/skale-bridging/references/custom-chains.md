# Bridging from Custom EVM Chains to SKALE Base

This guide explains how to bridge USDC from any EVM-compatible chain (Polygon, Ethereum, Optimism, Arbitrum, Avalanche, or custom chains) to SKALE Base Chain using the Trails SDK and IMA DepositBox.

## Overview

Bridging from custom chains to SKALE follows one of two patterns:

1. **Base → SKALE**: Direct IMA DepositBox call (simplest)
2. **Non-Base → SKALE**: Multi-hop via Base using Trails Router

All non-Base chains must route through Base's IMA DepositBox, as that's the only entry point to SKALE.

## Supported Origin Chains

| Chain | Chain ID | USDC Address | Pattern |
|-------|----------|--------------|---------|
| Ethereum | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Multi-hop |
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Direct IMA |
| Polygon | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Multi-hop |
| Optimism | 10 | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | Multi-hop |
| Arbitrum | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Multi-hop |
| Avalanche | 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | Multi-hop |

## Chain Configuration Pattern

When adding a new custom chain, follow this configuration pattern:

```typescript
interface ChainConfig {
  chainId: number;
  name: string;
  usdcAddress: string;
  isSkale: boolean;
  rpcUrl?: string;
  viemChain?: any; // viem chain definition
}

// Example: Adding Arbitrum
arbitrum: {
  chainId: 42161,
  name: 'Arbitrum',
  usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  isSkale: false,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  viemChain: arbitrum, // from 'viem/chains'
}

// Example: Adding Avalanche
avalanche: {
  chainId: 43114,
  name: 'Avalanche',
  usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  isSkale: false,
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  viemChain: avalancheCChain, // from 'viem/chains'
}
```

## Bridge Pattern Detection

The bridge service must detect the origin chain and apply the correct pattern:

```typescript
// Determine bridge pattern based on origin chain
const originConfig = getChainConfig(originChain);
const BASE_CHAIN_ID = 8453;

if (originConfig.chainId === BASE_CHAIN_ID) {
  // Pattern 1: Base → SKALE (Direct IMA)
  destinationChainId = BASE_CHAIN_ID;
  destinationTokenAddress = BASE_USDC;
  destinationToAddress = IMA_DEPOSIT_BOX;

  // Encode with ACTUAL amount
  const imaCalldata = encodeDepositERC20Direct(
    skaleChainName,
    BASE_USDC,
    ACTUAL_AMOUNT,
    recipientAddress
  );
  destinationCallData = imaCalldata;
} else {
  // Pattern 2: Non-Base → SKALE (Multi-hop via Base)
  destinationChainId = BASE_CHAIN_ID; // Route to Base!
  destinationTokenAddress = BASE_USDC;

  // Encode with PLACEHOLDER
  const imaCalldata = encodeDepositERC20Direct(
    skaleChainName,
    BASE_USDC,
    TRAILS_ROUTER_PLACEHOLDER_AMOUNT,
    recipientAddress
  );

  // Wrap with Trails Router
  const wrapped = wrapWithTrailsRouter(BASE_USDC, IMA_DEPOSIT_BOX, imaCalldata);
  destinationToAddress = wrapped.toAddress;
  destinationCallData = wrapped.callData;
}
```

## Complete Bridge Flow

### Step 1: Get Quote

```typescript
const quote = await trailsClient.getQuote({
  ownerAddress: walletAddress,
  originChainId: originConfig.chainId,
  originTokenAddress: originConfig.usdcAddress,
  originTokenAmount: amountBigInt,
  destinationChainId: destinationChainId, // Always Base (8453)
  destinationTokenAddress: destinationTokenAddress, // Base USDC
  destinationTokenAmount: amountBigInt,
  destinationToAddress: destinationToAddress, // IMA_DEPOSIT_BOX or TRAILS_ROUTER
  destinationCallData: destinationCallData, // IMA call or wrapped call
  slippageTolerance: 0.005,
  destinationCallValue: 0n,
});
```

### Step 2: Commit Intent

```typescript
const intentId = await trailsClient.commitIntent(quote.intent);
```

### Step 3: Transfer Tokens

```typescript
const transferResult = await signer.sendDepositTransaction({
  to: quote.intent.depositTransaction.to,
  data: quote.intent.depositTransaction.data,
  value: quote.intent.depositTransaction.value || 0n,
  chainId: quote.intent.originChainId,
  tokenAddress: quote.intent.depositTransaction.tokenAddress,
  amount: quote.intent.depositTransaction.amount,
});
```

### Step 4: Execute Intent

```typescript
await trailsClient.executeWithTransactionHash({
  intentId,
  depositTransactionHash: transferResult.txHash,
});
```

### Step 5: Monitor Completion

```typescript
const receipt = await trailsClient.waitForCompletion(intentId);
```

## Multi-Hop Bridge Explanation

When bridging from non-Base chains (e.g., Polygon), the Trails API handles a two-hop process:

1. **Hop 1**: Polygon USDC → Base USDC (via Trails bridge)
2. **Hop 2**: Base USDC → SKALE USDC (via IMA DepositBox)

The Trails Router (`injectAndCall`) dynamically injects the actual USDC amount into the IMA call during execution, ensuring the correct amount reaches SKALE.

## Gas Requirements

| Origin Chain | Gas Token | Typical Cost |
|--------------|-----------|--------------|
| Ethereum | ETH | $0.50-2.00 |
| Base | ETH | $0.001-0.01 |
| Polygon | MATIC | $0.01-0.05 |
| Optimism | ETH | $0.01-0.05 |
| Arbitrum | ETH | $0.01-0.05 |
| Avalanche | AVAX | $0.01-0.05 |

Users need:
- USDC on the origin chain (amount being bridged)
- Gas tokens on the origin chain (for transaction fees)

## RPC Endpoints

Ensure your chain configuration includes the correct RPC endpoints:

```typescript
const RPC_URLS: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  8453: 'https://mainnet.base.org',
  137: 'https://polygon-rpc.com',
  10: 'https://mainnet.optimism.io',
  42161: 'https://arb1.arbitrum.io/rpc',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
};
```

## Common Issues

### "no routes found for request"

**Cause**: Incorrect destination chain ID for SKALE

**Solution**: Ensure `destinationChainId = 8453` (Base) for all SKALE transfers, regardless of origin chain.

### "call reverted: refund triggered on origin"

**Cause**: IMA DepositBox received placeholder instead of actual amount

**Solution**: For Base origin, replace placeholder with actual amount before quote. For non-Base origins, use Trails Router wrapping.

### "Invalid chain ID"

**Cause**: Chain not configured or incorrect chain ID

**Solution**: Add chain configuration with correct chain ID, USDC address, and RPC endpoint.

## Production CLI Reference

See the complete working implementation in `/Trails-Test-CLI/src/`:

**Key Files:**
- `src/services/bridge.ts` - Complete bridge orchestration with pattern detection
- `src/services/skaleHelper.ts` - IMA encoding and Trails Router wrapping
- `src/config/chains.ts` - Chain configuration patterns
- `src/cli.ts` - CLI interface with chain selection

**Usage:**
```bash
# Bridge from Polygon to SKALE
node dist/cli.js bridge --origin polygon --destination skale-base --amount 0.1

# Bridge from Ethereum to SKALE
node dist/cli.js bridge --origin ethereum --destination skale-base --amount 0.1

# Bridge from Arbitrum to SKALE
node dist/cli.js bridge --origin arbitrum --destination skale-base --amount 0.1
```

## Adding New Custom Chains

To add support for a new EVM chain:

1. **Add Chain Configuration**:
   ```typescript
   myCustomChain: {
     chainId: 123456,
     name: 'My Custom Chain',
     usdcAddress: '0x...', // USDC address on custom chain
     isSkale: false,
     rpcUrl: 'https://rpc.custom-chain.io',
     viemChain: defineChain({
       id: 123456,
       name: 'My Custom Chain',
       nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
       rpcUrls: { default: { http: ['https://rpc.custom-chain.io'] } },
     }),
   }
   ```

2. **Update USDC Address Mapping**: Add the chain's native USDC address

3. **Test Bridge**: Use the multi-hop pattern (via Base) for all non-Base origins

4. **Verify RPC**: Ensure the RPC endpoint is reliable and supports transaction broadcasting

## Complete Example: Multi-Chain Bridge

For a complete implementation supporting all major EVM chains, see `/Trails-Test-CLI/src/services/bridge.ts`. This production implementation includes:

- Automatic pattern detection (Base vs non-Base)
- Trails Router wrapping for non-Base origins
- Complete error handling
- Transaction signing and execution
- Status monitoring

The implementation demonstrates the best practices for building robust multi-chain bridges to SKALE.
