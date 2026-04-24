---
name: SKALE-Bridge
description: This skill should be used when the user asks to "bridge USDC to SKALE", "bridge USDC from SKALE", "transfer USDC to SKALE Base Chain", "move USDC from SKALE to Base", "bridge from [base/polygon/optimism/arbitrum/avalanche/monad/custom-chain] to SKALE", or mentions cross-chain USDC transfers involving SKALE Network from any EVM-compatible chain. Supports bridging FROM any EVM chain (Base, Polygon, Optimism, Arbitrum, Avalanche, Monad, and custom EVM chains) TO SKALE Base, and FROM SKALE Base TO Base using Trails API and IMA with proper RouteProvider selection (RELAY for Base→SKALE, AUTO for non-Base→SKALE).
metadata: {"openclaw": {"emoji": "🌉", "requires": {"env": ["TRAILS_API_KEY"]}}, "version": "1.1.0"}
---

# SKALE Bridge - USDC Cross-Chain Transfers

Bridge USDC bidirectionally between any EVM-compatible chain (Base, Polygon, Ethereum, Optimism, Arbitrum, Avalanche, and custom chains) and SKALE Base Chain using Trails API.

## Quick Reference

| Direction | Origin Chains | Destination | Method |
|-----------|--------------|-------------|---------|
| **TO SKALE** | Base, Polygon, Ethereum, Optimism, Arbitrum, Avalanche, Custom EVM | SKALE Base | Trails API + IMA |
| **FROM SKALE** | SKALE Base | Base | Direct IMA exit + Community Pool |

**See `references/bridge-to-skale-base.md` for detailed multi-chain bridging patterns.**

---

## Key Contract Addresses

```typescript
// === TO SKALE (IMA DepositBox on Base) ===
IMA_DEPOSIT_BOX = "0x7f54e52D08C911eAbB4fDF00Ad36ccf07F867F61";     // Base only
TRAILS_ROUTER = "0xBaE357CBAA04a68cbfD5a560Ab06C4E9A3328A90";       // Base only (updated address)
BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";               // Used for all SKALE transfers

// === FROM SKALE (Community Pool + IMA Exit) ===
COMMUNITY_POOL = "0x7153b03C04E0DeeDB24FD745F6765C676E33330c";    // On Base (gas funding)
COMMUNITY_LOCKER = "0xD2aaa00300000000000000000000000000000000"; // On SKALE (activation check)
TOKEN_MANAGER_ERC20 = "0xD2aAA00500000000000000000000000000000000"; // On SKALE (exit contract)
SKALE_USDC = "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20";          // SKALE USDC address
```

---

## Supported Origin Chains (Custom EVM Chains)

**TO SKALE Origin Chains:**
- Base (Chain ID: 8453) - Direct IMA call
- Polygon (Chain ID: 137) - Multi-hop via Base
- Optimism (Chain ID: 10) - Multi-hop via Base
- Arbitrum (Chain ID: 42161) - Multi-hop via Base
- Avalanche (Chain ID: 43114) - Multi-hop via Base
- Monad (Chain ID: 143) - Multi-hop via Base
- **Any EVM-compatible chain** with USDC support

**All routes use `RouteProvider.AUTO` for automatic route selection.**

**See `references/custom-chains.md` for complete chain configurations and adding new custom chains.**

---

## Bridge Patterns Overview

SKALE bridging uses different patterns depending on the origin chain:

### Pattern 1: Base → SKALE (Direct IMA)
```
Base → IMA DepositBox → SKALE
```
- Uses direct IMA DepositBox call with actual USDC amount
- Simplest and most direct route
- No Trails Router needed

### Pattern 2: Non-Base → SKALE (Multi-hop via Base)
```
Polygon/Ethereum/Optimism/Arbitrum/Avalanche → Base → SKALE
```
- Uses Trails Router to bridge USDC from origin to Base
- Then calls IMA DepositBox to bridge from Base to SKALE
- Trails Router dynamically injects actual USDC amount into IMA call

**Reference Implementation**: See `/Trails-Test-CLI/src/` for production CLI supporting all major EVM chains.

---

## Quick Execute Examples

### Base to SKALE Base (Direct IMA)

**When user says**: "Bridge 0.01 USDC from Base to SKALE Base to wallet 0x..."

**Prerequisites:**
- `TRAILS_API_KEY` environment variable is set
- `PRIVATE_KEY` environment variable set to a wallet private key
- Wallet has >= amount + gas (ETH) on Base

**Execute:**
```bash
TRAILS_API_KEY="your_key" PRIVATE_KEY="0x..." node examples/bridge-base-to-skale.js
```

**Result**: Intent ID returned in ~90 seconds.

---

### Polygon to SKALE Base (Multi-hop via Base)

**When user says**: "Bridge 0.01 USDC from Polygon to SKALE Base to wallet 0x..."

**Prerequisites:**
- `TRAILS_API_KEY` environment variable is set
- `PRIVATE_KEY` environment variable set to a wallet private key
- Wallet has >= amount USDC on Polygon
- Wallet has >= gas (MATIC) on Polygon

**Execute:**
```bash
TRAILS_API_KEY="your_key" PRIVATE_KEY="0x..." node examples/bridge-polygon-to-skale.js
```

**Result**: Intent ID returned in ~2-5 minutes (multi-hop routing).

---

### Arbitrum to SKALE Base (Multi-hop via Base)

**When user says**: "Bridge 0.01 USDC from Arbitrum to SKALE Base to wallet 0x..."

**Execute:**
```bash
TRAILS_API_KEY="your_key" PRIVATE_KEY="0x..." node examples/bridge-arbitrum-to-skale.js
```

**Result**: Intent ID returned in ~2-5 minutes.

---

### Monad to SKALE Base (Multi-hop via Base)

**When user says**: "Bridge 0.01 USDC from Monad to SKALE Base to wallet 0x..."

**Execute:**
```bash
TRAILS_API_KEY="your_key" PRIVATE_KEY="0x..." node examples/bridge-monad-to-skale.js
```

**Result**: Intent ID returned in ~2-5 minutes.

---

### SKALE Base to Base (Direct IMA Exit)

**When user says**: "Bridge 0.01 USDC from SKALE Base to Base to wallet 0x..."

**Prerequisites:**
- `PRIVATE_KEY` environment variable set to a wallet private key
- Wallet has >= 0.0001 ETH on Base (for Community Pool)
- Wallet has >= amount USDC on SKALE Base
- Wallet has >= 1 CREDIT on SKALE Base (gas)

**Execute:**
```bash
PRIVATE_KEY="0x..." node examples/bridge-skale-to-base.js
```

**Result**: Exit transaction submitted immediately. USDC arrives on Base in 5-10 minutes.

---

## Preconditions (Check Before Bridging)

Verify all conditions before executing:

For Base → SKALE Base (or other origins → SKALE):

* Bridge Direction — Are you bridging TO SKALE Base (or FROM SKALE Base)?
* Source Chain — Which chain are you bridging FROM? (Base, Polygon, Optimism, Arbitrum, Avalanche, Monad)
* Amount — How much USDC do you want to bridge? (e.g., 0.01)
* Recipient Address — Where should USDC arrive on SKALE? (confirm if same as signer or specify different)
* Source Balance Check — What's your current USDC balance on the source chain? (to verify >= amount)
* Gas Balance Check — What's your native token balance on the source chain? (to verify >= gas cost ~0.001 ETH)
* Signer Wallet — Which wallet should sign the transaction?

For SKALE Base → Base:

* Same as above, but:
* Source is always SKALE Base
* Need ETH balance on Base (for Community Pool recharge, if needed) -> 0.0001 ETH

**If any fail:** Script will error with clear reason. Stop and fix.

---

## USDC Addresses by Chain

| Chain | Chain ID | USDC Address | Bridge Pattern | RouteProvider |
|-------|----------|--------------|----------------|---------------|
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Direct IMA | `AUTO` |
| Polygon | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Multi-hop via Base | `AUTO` |
| Optimism | 10 | `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` | Multi-hop via Base | `AUTO` |
| Arbitrum | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | Multi-hop via Base | `AUTO` |
| Avalanche | 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | Multi-hop via Base | `AUTO` |
| Monad | 143 | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | Multi-hop via Base | `AUTO` |

**For complete custom chain configuration patterns, see `references/custom-chains.md`**

---

## Complete Implementation - Base to SKALE Base (Direct IMA)

Copy this code for Base → SKALE Base bridging:

```javascript
import { TrailsApi, TradeType, RouteProvider } from '@0xtrails/api';
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Config
const trails_api_key = process.env.TRAILS_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!trails_api_key || !PRIVATE_KEY) {
  console.error('Missing TRAILS_API_KEY or PRIVATE_KEY');
  process.exit(1);
}

const trailsAPI = new TrailsApi(trails_api_key);
const account = privateKeyToAccount(PRIVATE_KEY);

// Constants
const BASE_CHAIN_ID = 8453;
const SKALE_CHAIN_NAME = "winged-bubbly-grumium";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const IMA_DEPOSIT_BOX = "0x7f54e52D08C911eAbB4fDF00Ad36ccf07F867F61";
const TRAILS_ROUTER = "0xBaE357CBAA04a68cbfD5a560Ab06C4E9A3328A90"; // Updated address

// Bridge params - MODIFY THESE
const amountBigInt = BigInt('10000'); // 0.01 USDC (6 decimals)
const recipientAddress = account.address; // Where USDC arrives on SKALE

console.log(`Bridge: ${amountBigInt / 10000n} USDC from Base to SKALE Base`);
console.log(`From: ${account.address}`);
console.log(`To: ${recipientAddress}`);

// Encode IMA call
function encodeDepositERC20Direct(schainName, tokenAddress, amount, receiver) {
  const abi = [{
    inputs: [
      { internalType: "string", name: "schainName", type: "string" },
      { internalType: "address", name: "erc20OnMainnet", type: "address" },
      { internalType: "uint256", "name": "amount", type: "uint256" },
      { internalType: "address", "name": "receiver", type: "address" }
    ],
    name: "depositERC20Direct",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }];
  return encodeFunctionData({ abi, functionName: 'depositERC20Direct', args: [schainName, tokenAddress, amount, receiver] });
}

const imaCalldata = encodeDepositERC20Direct(SKALE_CHAIN_NAME, BASE_USDC, amountBigInt, recipientAddress);

// 1. Get quote
console.log(`\n⏳ Getting quote from Trails API...`);
const quote = await trailsAPI.quoteIntent({
  ownerAddress: account.address,
  originChainId: BASE_CHAIN_ID,
  originTokenAddress: BASE_USDC,
  originTokenAmount: amountBigInt.toString(),
  destinationChainId: BASE_CHAIN_ID,
  destinationTokenAddress: BASE_USDC,
  destinationTokenAmount: amountBigInt.toString(),
  destinationToAddress: IMA_DEPOSIT_BOX,
  destinationCallData: imaCalldata,
  slippageTolerance: 0.005,
  destinationCallValue: '0',
  tradeType: 'EXACT_INPUT',
  options: {
    bridgeProvider: RouteProvider.AUTO, // Use AUTO for all routes
  },
});

const intentId = quote.intent.intentId;
console.log(`✓ Intent ID: ${intentId}`);

// 2. Commit intent (CRITICAL STEP - do not skip)
console.log(`\n⏳ Committing intent...`);
await trailsAPI.commitIntent({ intent: quote.intent });
console.log(`✓ Intent committed`);

// 3. Setup clients
const walletClient = createWalletClient({ account, chain: base, transport: http() });
const publicClient = createPublicClient({ chain: base, transport: http() });

// 4. Check/approve allowance
const ERC20_ABI = [
  { name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
];

let allowance = await publicClient.readContract({ address: BASE_USDC, abi: ERC20_ABI, functionName: 'allowance', args: [account.address, quote.intent.depositTransaction.to] });

if (allowance < amountBigInt) {
  console.log(`⏳ Approving USDC...`);
  const nonce = await publicClient.getTransactionCount({ address: account.address });
  const approveTx = await walletClient.writeContract({ nonce, address: BASE_USDC, abi: ERC20_ABI, functionName: 'approve', args: [quote.intent.depositTransaction.to, amountBigInt] });
  console.log(`✓ Approval tx: ${approveTx}`);
  await new Promise(r => setTimeout(r, 5000));
}

// 5. Transfer USDC
console.log(`\n⏳ Transferring USDC...`);
const nonce = await publicClient.getTransactionCount({ address: account.address });
const transferHash = await walletClient.sendTransaction({ nonce, to: quote.intent.depositTransaction.to, data: quote.intent.depositTransaction.data, value: quote.intent.depositTransaction.value ? BigInt(quote.intent.depositTransaction.value) : 0n });
console.log(`✓ Transfer tx: ${transferHash}`);

// 6. Wait for confirmation
await publicClient.waitForTransactionReceipt({ hash: transferHash });
console.log(`✓ Transfer confirmed!`);

// 7. Execute intent
console.log(`\n⏳ Executing bridge intent...`);
await trailsAPI.executeIntent({ intentId, depositTransactionHash: transferHash });
console.log(`✓ Bridge execution initiated!`);

// 8. Wait for completion
const receipt = await trailsAPI.waitIntentReceipt({ intentId, timeoutMs: 120000 });
console.log(`✓ Bridge ${receipt.intentStatus}`);
if (receipt.executionTransactionHash) console.log(`  Execution tx: ${receipt.executionTransactionHash}`);
```

**Also available as**: `examples/bridge-base-to-skale.js`

---

## Complete Implementation - Polygon to SKALE Base (Multi-hop via Base)

For non-Base origins, use Trails Router wrapper. See: `references/bridge-to-skale-base.md`

Key difference: Non-Base origins require wrapping IMA call with Trails Router's `injectAndCall` function.

```javascript
import { TrailsApi } from '@0xtrails/api';
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon, base } from 'viem/chains';
import { keccak256, toHex } from 'viem';

// Config
const trails_api_key = process.env.TRAILS_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const trailsAPI = new TrailsApi(trails_api_key);
const account = privateKeyToAccount(PRIVATE_KEY);

// Constants
const POLYGON_CHAIN_ID = 137;
const BASE_CHAIN_ID = 8453;
const SKALE_CHAIN_NAME = "winged-bubbly-grumium";

const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const IMA_DEPOSIT_BOX = "0x7f54e52D08C911eAbB4fDF00Ad36ccf07F867F61";
const TRAILS_ROUTER = "0xF8A739B9F24E297a98b7aba7A9cdFDBD457F6fF8";

const TRAILS_ROUTER_PLACEHOLDER_AMOUNT = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefn;

// Bridge params
const amountBigInt = BigInt('10000'); // 0.01 USDC (6 decimals)
const recipientAddress = account.address;

console.log(`Bridge: ${amountBigInt / 10000n} USDC from Polygon to SKALE Base`);
console.log(`Route: Polygon → Base → SKALE (multi-hop)`);

// Encode IMA call with PLACEHOLDER
function encodeDepositERC20Direct(schainName, tokenAddress, amount, receiver) {
  const abi = [{
    inputs: [
      { internalType: "string", name: "schainName", type: "string" },
      { internalType: "address", name: "erc20OnMainnet", type: "address" },
      { internalType: "uint256", "name": "amount", type: "uint256" },
      { internalType: "address", "name": "receiver", type: "address" }
    ],
    name: "depositERC20Direct",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }];
  return encodeFunctionData({ abi, functionName: 'depositERC20Direct', args: [schainName, tokenAddress, amount, receiver] });
}

// Find placeholder offset in calldata
function getAmountOffset(calldata, placeholder) {
  const hex = placeholder.toString(16).padStart(64, '0');
  const offset = calldata.toLowerCase().indexOf(hex.toLowerCase());
  if (offset === -1) return -1;
  return (offset - 2) / 2;
}

// Wrap with Trails Router
function wrapWithTrailsRouter(token, target, callData) {
  const amountOffset = getAmountOffset(callData, TRAILS_ROUTER_PLACEHOLDER_AMOUNT);
  if (amountOffset === -1) throw new Error('Placeholder not found');

  const routerAbi = [{
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'callData', type: 'bytes' },
      { name: 'amountOffset', type: 'uint256' },
      { name: 'placeholder', type: 'bytes32' }
    ],
    name: 'injectAndCall',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }];

  const placeholderBytes32 = `0x${TRAILS_ROUTER_PLACEHOLDER_AMOUNT.toString(16).padStart(64, '0')}`;

  return {
    callData: encodeFunctionData({
      abi: routerAbi,
      functionName: 'injectAndCall',
      args: [token, target, callData, BigInt(amountOffset), placeholderBytes32]
    }),
    toAddress: TRAILS_ROUTER
  };
}

// Step 1: Prepare bridge parameters for multi-hop
const imaCallData = encodeDepositERC20Direct(
  SKALE_CHAIN_NAME,
  BASE_USDC,
  TRAILS_ROUTER_PLACEHOLDER_AMOUNT, // Keep placeholder!
  recipientAddress
);

const wrapped = wrapWithTrailsRouter(BASE_USDC, IMA_DEPOSIT_BOX, imaCallData);

console.log(`\n⏳ Getting quote from Trails API...`);

// Step 2: Get quote with multi-hop routing
const quote = await trailsAPI.quoteIntent({
  ownerAddress: account.address,
  originChainId: POLYGON_CHAIN_ID,
  originTokenAddress: POLYGON_USDC,
  originTokenAmount: amountBigInt.toString(),
  destinationChainId: BASE_CHAIN_ID, // Route to Base!
  destinationTokenAddress: BASE_USDC, // Base USDC!
  destinationTokenAmount: amountBigInt.toString(),
  destinationToAddress: wrapped.toAddress,
  destinationCallData: wrapped.callData,
  slippageTolerance: 0.005,
  destinationCallValue: '0',
  tradeType: 'EXACT_INPUT',
});

const intentId = quote.intent.intentId;
console.log(`✓ Intent ID: ${intentId}`);

// Continue with commit, transfer, execute (same as Base example)
// Use Polygon wallet client for transactions
const polygonWalletClient = createWalletClient({ account, chain: polygon, transport: http() });
const polygonPublicClient = createPublicClient({ chain: polygon, transport: http() });

// ... rest of flow is identical to Base example ...
```

**Also available as**: `examples/bridge-polygon-to-skale.js`

---

## Complete Implementation - SKALE Base to Base

Copy this code for SKALE Base → Base bridging:

```javascript
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Config
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('Missing PRIVATE_KEY');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

// Constants
const SKALE_CHAIN_ID = 1187947933;
const SKALE_CHAIN_NAME = "winged-bubbly-grumium";

// SKALE addresses
const SKALE_USDC = "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20";
const TOKEN_MANAGER_ERC20 = "0xD2aAA00500000000000000000000000000000000";
const COMMUNITY_LOCKER = "0xD2aaa00300000000000000000000000000000000";

// Base addresses
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const COMMUNITY_POOL = "0x7153b03C04E0DeeDB24FD745F6765C676E33330c";

// Bridge params - MODIFY THESE
const amountToExit = BigInt('10000'); // 0.01 USDC (6 decimals)
const recipientOnBase = account.address; // Where USDC arrives on Base

console.log(`Bridge: ${amountToExit / 10000n} USDC from SKALE Base to Base`);
console.log(`From: ${account.address}`);
console.log(`To: ${recipientOnBase}`);

// Setup SKALE client
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

// Setup Base client
const baseClient = createWalletClient({ account, chain: base, transport: http() });
const basePublicClient = createPublicClient({ chain: base, transport: http() });

// ABIs
const COMMUNITY_POOL_ABI = [{
  inputs: [
    { internalType: "address", name: "user", type: "address" },
    { internalType: "string", name: "schainName", type: "string" }
  ],
  name: "getBalance",
  outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  stateMutability: "view",
  type: "function"
}, {
  inputs: [
    { internalType: "string", name: "schainName", type: "string" },
    { internalType: "address", name: "receiver", type: "address" }
  ],
  name: "rechargeUserWallet",
  outputs: [],
  stateMutability: "payable",
  type: "function"
}];

const COMMUNITY_LOCKER_ABI = [{
  inputs: [{ internalType: "address", name: "", type: "address" }],
  name: "activeUsers",
  outputs: [{ internalType: "bool", name: "", type: "bool" }],
  stateMutability: "view",
  type: "function"
}];

const TOKEN_MANAGER_ABI = [{
  inputs: [
    { internalType: "address", name: "to", type: "address" },
    { internalType: "uint256", "name": "amount", type: "uint256" }
  ],
  name: "exitToMainERC20",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function"
}];

// 1. Check Community Pool activation
console.log(`\n⏳ Checking Community Pool status...`);
const poolBalance = await basePublicClient.readContract({
  address: COMMUNITY_POOL,
  abi: COMMUNITY_POOL_ABI,
  functionName: 'getBalance',
  args: [account.address, SKALE_CHAIN_NAME],
});

const isActiveOnLocker = await skalePublicClient.readContract({
  address: COMMUNITY_LOCKER,
  abi: COMMUNITY_LOCKER_ABI,
  functionName: 'activeUsers',
  args: [account.address],
});

console.log(`  Pool Balance: ${poolBalance}`);
console.log(`  Active on Locker: ${isActiveOnLocker}`);

// 2. Recharge Community Pool if needed
if (poolBalance === 0n || !isActiveOnLocker) {
  console.log(`\n⏳ Community Pool not active. Recharging with 0.0001 ETH...`);
  const rechargeHash = await baseClient.writeContract({
    address: COMMUNITY_POOL,
    abi: COMMUNITY_POOL_ABI,
    functionName: 'rechargeUserWallet',
    args: [SKALE_CHAIN_NAME, account.address],
    value: 100000000000n, // 0.0001 ETH
  });
  console.log(`✓ Recharge tx: ${rechargeHash}`);
  await basePublicClient.waitForTransactionReceipt({ hash: rechargeHash });
  console.log(`✓ Recharge confirmed! Waiting for activation (30 seconds)...`);
  await new Promise(r => setTimeout(r, 30000));
} else {
  console.log(`✓ Community Pool already active`);
}

// 3. Approve TokenManager
console.log(`\n⏳ Approving USDC for TokenManager...`);
const nonce = await skalePublicClient.getTransactionCount({ address: account.address });
const approveTx = await skaleClient.writeContract({
  nonce,
  address: SKALE_USDC,
  abi: [{ name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }],
  functionName: 'approve',
  args: [TOKEN_MANAGER_ERC20, amountToExit],
});
console.log(`✓ Approval tx: ${approveTx}`);
await new Promise(r => setTimeout(r, 5000));

// 4. Execute Exit
console.log(`\n⏳ Executing exit from SKALE...`);
const exitNonce = await skalePublicClient.getTransactionCount({ address: account.address });
const exitHash = await skaleClient.writeContract({
  nonce: exitNonce,
  address: TOKEN_MANAGER_ERC20,
  abi: TOKEN_MANAGER_ABI,
  functionName: 'exitToMainERC20',
  args: [BASE_USDC, amountToExit],
});

console.log(`✓ Exit tx: ${exitHash}`);
console.log(`\n✅ Bridge initiated! USDC will arrive on Base in 5-10 minutes`);
```

**Also available as**: `examples/bridge-skale-to-base.js`

---

## Reference Implementations

### Production CLI Implementation
See `/Trails-Test-CLI/src/` for a complete CLI implementation supporting:
- Multiple origin chains (Ethereum, Base, Polygon, Optimism)
- Bidirectional bridging (TO SKALE and FROM SKALE)
- Complete service layer architecture
- Community Pool activation for SKALE → Base
- Comprehensive error handling

**Key Files:**
- `src/services/bridge.ts` - Main bridge orchestration with pattern detection
- `src/services/skaleHelper.ts` - IMA encoding and Trails Router wrapping
- `src/config/chains.ts` - Chain configuration patterns
- `src/services/communityPool.ts` - Community Pool activation

---

## Parameter Reference

| Param | Type | Example | Notes |
|-------|------|---------|-------|
| amount | bigint | `10000n` | In USDC (6 decimals) |
| recipientAddress | address | `0x1c50...` | Where USDC arrives on SKALE |
| TRAILS_API_KEY | string | from dashboard | Required env var (TO SKALE) |
| PRIVATE_KEY | string | `0x...` | Wallet private key from any source |
| originChain | string | `polygon` | Supported: ethereum, base, polygon, optimism, arbitrum, avalanche |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing TRAILS_API_KEY" | Env var not set | `export TRAILS_API_KEY=...` |
| "insufficient balance" | Not enough USDC or gas | Fund wallet on origin chain |
| "no routes found" | Wrong destinationChainId | Must be 8453 (Base) for SKALE |
| "call reverted" | IMA received placeholder (Base origin) | Replace placeholder with actual amount |
| "Community Pool not active" | First SKALE → Base transfer | Recharge with 0.0001 ETH on Base |

---

## Key Addresses

### Base (Entry point for all SKALE transfers)
| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| IMA DepositBox | `0x7f54e52D08C911eAbB4fDF00Ad36ccf07F867F61` |
| Community Pool | `0x7153b03C04E0DeeDB24FD745F6765C676E33330c` |
| Trails Router | `0xF8A739B9F24E297a98b7aba7A9cdFDBD457F6fF8` |

### SKALE Base
| Contract | Address |
|----------|---------|
| USDC | `0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20` |
| TokenManager ERC20 | `0xD2aAA00500000000000000000000000000000000` |
| Community Locker | `0xD2aaa00300000000000000000000000000000000` |

---

## Wallet Integration

To perform these operations, you'll need a wallet with sufficient funds on the relevant chains. Use your wallet of choice to manage private keys and check balances.

**Recommendation**: If you want to provide your AI Agent with an agentic wallet (a wallet designed for autonomous agent operations), consider using OWS (One World Shield). OWS provides enhanced security features specifically designed for AI agent interactions.

To use OWS for your wallet operations:

```bash
# Check wallet balance
ows fund balance --wallet "my-wallet" --chain base

# Get private key
ows wallet export --wallet "my-wallet"

# Check balance on any chain
ows fund balance --wallet "my-wallet" --chain polygon
ows fund balance --wallet "my-wallet" --chain skale-base
```

**Note**: You can use any wallet provider. The `PRIVATE_KEY` environment variable accepts a private key from any source.

---

## Dependencies

```json
{
  "dependencies": {
    "@0xtrails/api": "^0.13.2",
    "viem": "^2.47.5",
    "ethers": "^6.16.0"
  }
}
```

---

## Additional Resources

### Reference Files
- **`references/bridge-to-skale-base.md`** - Detailed multi-chain bridging patterns
- **`references/bridge-from-skale-base.md`** - SKALE → Base with Community Pool
- **`references/custom-chains.md`** - Adding custom EVM chains

### Example Files
- **`examples/bridge-base-to-skale.js`** - Base → SKALE (Direct IMA)
- **`examples/bridge-polygon-to-skale.js`** - Polygon → SKALE (Multi-hop)
- **`examples/bridge-skale-to-base.js`** - SKALE → Base (IMA Exit)
- **`examples/multi-chain-bridge.js`** - Support for all major EVM chains

### External Documentation
- Trails SDK Docs: https://docs.trails.build
- SKALE IMA Docs: https://docs.skale.network
- Trails Dashboard: https://dashboard.trails.build
