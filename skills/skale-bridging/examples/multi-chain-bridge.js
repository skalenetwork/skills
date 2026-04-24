/**
 * Multi-Chain Bridge to SKALE Example
 *
 * This example demonstrates how to bridge USDC from multiple custom EVM chains
 * (Polygon, Ethereum, Optimism, Arbitrum, Avalanche) to SKALE Base Chain.
 *
 * The key insight is that ALL non-Base chains must route through Base's IMA DepositBox,
 * which is the only entry point to SKALE. This requires different handling for:
 * - Base origin: Direct IMA call with actual amount
 * - Non-Base origin: Multi-hop via Base with Trails Router wrapping
 *
 * Reference Implementation: /Trails-Test-CLI/src/services/bridge.ts
 */

import { TrailsApi } from '@0xtrails/api';
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, polygon, mainnet, optimism, arbitrum, avalancheCChain } from 'viem/chains';

// Configuration
const TRAILS_API_KEY = process.env.TRAILS_API_KEY || '';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// Constants
const BASE_CHAIN_ID = 8453;
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const IMA_DEPOSIT_BOX = '0x7f54e52D08C911eAbB4fDF00Ad36ccf07F867F61';
const TRAILS_ROUTER = '0xF8A739B9F24E297a98b7aba7A9cdFDBD457F6fF8';
const SKALE_CHAIN_NAME = 'winged-bubbly-grumium';
const TRAILS_ROUTER_PLACEHOLDER_AMOUNT = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefn;

// Chain configurations for all supported origin chains
const CHAIN_CONFIGS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    viemChain: mainnet,
    rpcUrl: 'https://eth.llamarpc.com',
  },
  base: {
    chainId: 8453,
    name: 'Base',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    viemChain: base,
    rpcUrl: 'https://mainnet.base.org',
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    viemChain: polygon,
    rpcUrl: 'https://polygon-rpc.com',
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    usdcAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    viemChain: optimism,
    rpcUrl: 'https://mainnet.optimism.io',
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    viemChain: arbitrum,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
  avalanche: {
    chainId: 43114,
    name: 'Avalanche',
    usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    viemChain: avalancheCChain,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  },
};

/**
 * Encode IMA depositERC20Direct call
 */
function encodeDepositCall(schainName, token, amount, receiver) {
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
  return encodeFunctionData({ abi, functionName: 'depositERC20Direct', args: [schainName, token, amount, receiver] });
}

/**
 * Find the offset of the placeholder in calldata
 */
function getAmountOffset(calldata, placeholder) {
  const hex = placeholder.toString(16).padStart(64, '0');
  const offset = calldata.toLowerCase().indexOf(hex.toLowerCase());
  if (offset === -1) return -1;
  return (offset - 2) / 2;
}

/**
 * Wrap IMA calldata with Trails Router for dynamic amount injection
 */
function wrapWithTrailsRouter(token, target, callData) {
  const amountOffset = getAmountOffset(callData, TRAILS_ROUTER_PLACEHOLDER_AMOUNT);
  if (amountOffset === -1) {
    throw new Error('Placeholder amount not found in calldata');
  }

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

  const encoded = encodeFunctionData({
    abi: routerAbi,
    functionName: 'injectAndCall',
    args: [token, target, callData, BigInt(amountOffset), placeholderBytes32]
  });

  return {
    callData: encoded,
    toAddress: TRAILS_ROUTER,
  };
}

/**
 * Prepare bridge parameters based on origin chain
 *
 * This is the KEY function that determines the bridge pattern:
 * - Base → SKALE: Direct IMA call with actual amount
 * - Non-Base → SKALE: Multi-hop via Base with Trails Router
 */
function prepareBridgeParams(originChain, amountBigInt, recipientAddress) {
  const originConfig = CHAIN_CONFIGS[originChain];
  if (!originConfig) {
    throw new Error(`Unsupported origin chain: ${originChain}`);
  }

  console.log(`\n=== Preparing Bridge from ${originConfig.name} to SKALE ===`);
  console.log(`Origin Chain ID: ${originConfig.chainId}`);
  console.log(`Origin USDC: ${originConfig.usdcAddress}`);
  console.log(`Amount: ${amountBigInt.toString()} wei`);

  // Determine bridge pattern
  const isBaseOrigin = originConfig.chainId === BASE_CHAIN_ID;

  let destinationChainId, destinationTokenAddress, destinationToAddress, destinationCallData;

  if (isBaseOrigin) {
    // Pattern 1: Base → SKALE (Direct IMA Call)
    console.log('\nPattern: Direct IMA call (Base → SKALE)');
    destinationChainId = BASE_CHAIN_ID;
    destinationTokenAddress = BASE_USDC;
    destinationToAddress = IMA_DEPOSIT_BOX;

    // Encode IMA call with ACTUAL amount (no placeholder!)
    destinationCallData = encodeDepositCall(
      SKALE_CHAIN_NAME,
      BASE_USDC,
      amountBigInt,
      recipientAddress
    );

    console.log('Destination Chain ID:', destinationChainId);
    console.log('Destination Token:', destinationTokenAddress);
    console.log('Destination To Address:', destinationToAddress);
  } else {
    // Pattern 2: Non-Base → SKALE (Multi-hop via Base)
    console.log(`\nPattern: Multi-hop via Base (${originConfig.name} → Base → SKALE)`);
    destinationChainId = BASE_CHAIN_ID; // Route to Base!
    destinationTokenAddress = BASE_USDC;

    // Encode IMA call with PLACEHOLDER
    const imaCallData = encodeDepositCall(
      SKALE_CHAIN_NAME,
      BASE_USDC,
      TRAILS_ROUTER_PLACEHOLDER_AMOUNT,
      recipientAddress
    );

    // Wrap with Trails Router
    const wrapped = wrapWithTrailsRouter(BASE_USDC, IMA_DEPOSIT_BOX, imaCallData);
    destinationToAddress = wrapped.toAddress;
    destinationCallData = wrapped.callData;

    console.log('Destination Chain ID:', destinationChainId, '(Base)');
    console.log('Destination Token:', destinationTokenAddress, '(Base USDC)');
    console.log('Destination To Address:', destinationToAddress, '(Trails Router)');
  }

  return {
    destinationChainId,
    destinationTokenAddress,
    destinationToAddress,
    destinationCallData,
    originConfig,
  };
}

/**
 * Main bridge function for any origin chain
 */
async function bridgeToSKALE(originChain, amountUSDC) {
  // Validate inputs
  if (!TRAILS_API_KEY) {
    throw new Error('TRAILS_API_KEY environment variable is required');
  }
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  // Initialize account
  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletAddress = account.address;
  const recipientAddress = walletAddress;

  console.log('═══════════════════════════════════════════════════════');
  console.log('       Multi-Chain USDC Bridge to SKALE');
  console.log('═══════════════════════════════════════════════════════');
  console.log('From:', walletAddress);
  console.log('To:', recipientAddress);
  console.log('Amount:', amountUSDC, 'USDC');
  console.log('═══════════════════════════════════════════════════════\n');

  // Prepare bridge parameters
  const amountBigInt = BigInt(Math.floor(amountUSDC * 1e6));
  const bridgeParams = prepareBridgeParams(originChain, amountBigInt, recipientAddress);

  // Initialize viem clients for origin chain
  const publicClient = createPublicClient({
    chain: bridgeParams.originConfig.viemChain,
    transport: http(bridgeParams.originConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: bridgeParams.originConfig.viemChain,
    transport: http(bridgeParams.originConfig.rpcUrl),
  });

  // Initialize Trails API
  const trailsApi = new TrailsApi(TRAILS_API_KEY);

  console.log('\n--- Step 1: Getting Quote from Trails API ---');

  const quote = await trailsApi.quoteIntent({
    ownerAddress: walletAddress,
    originChainId: bridgeParams.originConfig.chainId,
    originTokenAddress: bridgeParams.originConfig.usdcAddress,
    originTokenAmount: amountBigInt,
    destinationChainId: bridgeParams.destinationChainId,
    destinationTokenAddress: bridgeParams.destinationTokenAddress,
    destinationTokenAmount: amountBigInt,
    destinationToAddress: bridgeParams.destinationToAddress,
    destinationCallData: bridgeParams.destinationCallData,
    tradeType: 'EXACT_INPUT',
    options: {
      slippageTolerance: 0.005,
      bridgeProvider: 'RELAY'
    },
    destinationCallValue: 0n,
  });

  console.log('Quote received!');
  console.log('Intent ID:', quote.intent.intentId);
  console.log('Estimated output:', quote.intent.quote.toAmount, 'wei');

  console.log('\n--- Step 2: Committing Intent ---');

  const { intentId } = await trailsApi.commitIntent({ intent: quote.intent });
  console.log('Intent committed:', intentId);

  console.log('\n--- Step 3: Transferring USDC ---');

  // Check and approve if needed
  const ERC20_ABI = [
    { name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' }
  ];

  let allowance = await publicClient.readContract({
    address: bridgeParams.originConfig.usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [walletAddress, quote.intent.depositTransaction.to],
  });

  if (allowance < amountBigInt) {
    console.log('Approving USDC...');

    const nonce = await publicClient.getTransactionCount({ address: walletAddress });

    const approveHash = await walletClient.writeContract({
      nonce,
      address: bridgeParams.originConfig.usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [quote.intent.depositTransaction.to, amountBigInt],
    });

    console.log('Approval transaction:', approveHash);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('Approval confirmed');
  }

  // Transfer USDC
  const nonce = await publicClient.getTransactionCount({ address: walletAddress });

  const transferHash = await walletClient.sendTransaction({
    nonce,
    to: quote.intent.depositTransaction.to,
    data: quote.intent.depositTransaction.data,
    value: quote.intent.depositTransaction.value ? BigInt(quote.intent.depositTransaction.value) : 0n,
  });

  console.log('Transfer transaction:', transferHash);
  await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log('Transfer confirmed');

  console.log('\n--- Step 4: Executing Intent ---');

  await trailsApi.executeIntent({
    intentId,
    depositTransactionHash: transferHash,
  });
  console.log('Intent executed');

  console.log('\n--- Step 5: Waiting for Completion ---');

  let completed = false;
  let attempts = 0;
  const maxAttempts = 60;

  while (!completed && attempts < maxAttempts) {
    attempts++;

    try {
      const result = await trailsApi.waitIntentReceipt({ intentId, timeoutMs: 5000 });

      if (result.done) {
        if (result.intentReceipt.status === 'SUCCEEDED') {
          console.log('\n═══════════════════════════════════════════════════════');
          console.log('       Bridge Completed Successfully!');
          console.log('═══════════════════════════════════════════════════════');
          console.log('Intent ID:', result.intentReceipt.intentId || intentId);
          console.log('Status:', result.intentReceipt.status);

          if (result.intentReceipt.originTransaction?.txnHash) {
            console.log('Origin TX:', result.intentReceipt.originTransaction.txnHash);
          }

          if (result.intentReceipt.destinationTransaction?.txnHash) {
            console.log('Destination TX:', result.intentReceipt.destinationTransaction.txnHash);
          }

          completed = true;
        } else {
          console.error('Bridge failed:', result.intentReceipt.originTransaction?.statusReason || 'Unknown reason');
          process.exit(1);
        }
      } else {
        process.stdout.write(`.`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      if (!error.message?.includes('still executing')) {
        throw error;
      }
      process.stdout.write(`.`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (!completed) {
    console.error('\nTimeout waiting for bridge completion');
    console.log('Check status manually with intent ID:', intentId);
    process.exit(1);
  }
}

// CLI Interface
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node multi-chain-bridge.js <chain> <amount>');
  console.log('\nSupported chains:');
  console.log('  ethereum  - Ethereum Mainnet');
  console.log('  base      - Base (L2)');
  console.log('  polygon   - Polygon');
  console.log('  optimism  - Optimism');
  console.log('  arbitrum  - Arbitrum');
  console.log('  avalanche - Avalanche C-Chain');
  console.log('\nExample: node multi-chain-bridge.js polygon 0.1');
  process.exit(1);
}

const [chain, amountStr] = args;
const amount = parseFloat(amountStr);

if (isNaN(amount) || amount <= 0) {
  console.error('Invalid amount. Please provide a positive number.');
  process.exit(1);
}

bridgeToSKALE(chain, amount).catch((error) => {
  console.error('Bridge failed:', error.message);
  process.exit(1);
});
