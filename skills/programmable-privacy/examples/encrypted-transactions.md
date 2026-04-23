# Encrypted Transaction Examples

## Complete Encrypted Transaction Flow (ethers.js)

```typescript
import { BITE } from '@skalenetwork/bite';
import { ethers } from 'ethers';

const bite = new BITE('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha');
const provider = new ethers.JsonRpcProvider('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function sendEncryptedTransaction() {
    const contractAddress = "0x1234567890123456789012345678901234567890";
    const data = "0x...";

    const encrypted = await bite.encryptTransaction({
        to: contractAddress,
        data: data,
        value: "0"
    });

    // CRITICAL: always set gas manually
    const tx = await wallet.sendTransaction({
        ...encrypted,
        gasLimit: 300_000
    });

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Confirmed in block:", receipt?.blockNumber);
    return tx.hash;
}
```

## Complete Encrypted Transaction Flow (viem)

```typescript
import { BITE } from '@skalenetwork/bite';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const bite = new BITE('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha');
const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`);
const publicClient = createPublicClient({
    transport: http('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha')
});
const walletClient = createWalletClient({
    account,
    transport: http('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha')
});

async function sendEncryptedTransaction() {
    const contractAddress = "0x1234567890123456789012345678901234567890";
    const data = "0x..." as `0x${string}`;

    const encrypted = await bite.encryptTransaction({
        to: contractAddress,
        data: data,
        value: BigInt(0),
    });

    // CRITICAL: always set gas manually
    const hash = await walletClient.sendTransaction({
        ...encrypted,
        gas: 300000n,
    });

    console.log("Transaction sent:", hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
}
```

## Viewing Decrypted Transactions (Optional)

After a transaction executes, you can retrieve the decrypted `to` and `calldata` for debugging. Not required for normal operation.

```typescript
const { data, to } = await bite.getDecryptedTransactionData(txHash);
console.log("Decrypted to:", to);
console.log("Decrypted data:", data);
```
