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
const baseClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(),
});

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

const ERC20_ABI = [
  {
    name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

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
  console.log(`⏳ Waiting for confirmation...`);

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash: rechargeHash });

  if (receipt.status !== 'success') {
    throw new Error('Recharge transaction failed. Check transaction on Base explorer.');
  }

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
  abi: ERC20_ABI,
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
console.log(`\n✅ Bridge initiated!`);
console.log(`USDC will arrive on Base in 5-10 minutes`);
console.log(`Track on Base explorer: https://basescan.org/address/${recipientOnBase}`);
