# Encrypted Transaction Examples

## Complete Encrypted Transaction Flow (TypeScript)

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

async function viewDecryptedTransaction(txHash: string) {
    const { data, to } = await bite.getDecryptedTransactionData(txHash);
    console.log("Decrypted to:", to);
    console.log("Decrypted data:", data);
}

async function checkCommitteeStatus() {
    const committees = await bite.getCommitteesInfo();
    console.log("Active committees:", committees.length);

    if (committees.length === 2) {
        console.log("⚠️ Committee rotation in progress (3 min window)");
    }
}
```

## Rotation-Aware Batch Encryption

```typescript
async function sendBatchWithRotation(
    transactions: Array<{ to: string; data: string }>,
    bite: BITE,
    wallet: ethers.Wallet
) {
    const committees = await bite.getCommitteesInfo();

    if (committees.length === 2) {
        console.log(`Rotation: epoch ${committees[0].epochId} → ${committees[1].epochId}`);
    }

    const encrypted = await Promise.all(
        transactions.map(tx =>
            BITE.encryptTransactionWithCommitteeInfo(tx, committees)
        )
    );

    const receipts = await Promise.all(
        encrypted.map(tx =>
            wallet.sendTransaction({ ...tx, gasLimit: 300_000 }).then(t => t.wait())
        )
    );

    return receipts.map(r => r.transactionHash);
}
```

## Private ERC20 Transfer

```typescript
import { BITE } from '@skalenetwork/bite';
import { ethers, Contract } from 'ethers';

const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address) view returns (uint256)'
];

class PrivateTokenTransfer {
    private bite: BITE;
    private wallet: ethers.Wallet;

    constructor(rpcUrl: string, privateKey: string) {
        this.bite = new BITE(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpcUrl));
    }

    async transferPrivate(tokenAddress: string, to: string, amount: bigint) {
        const token = new Contract(tokenAddress, ERC20_ABI, this.wallet);
        const calldata = token.interface.encodeFunctionData('transfer', [to, amount]);

        const encryptedTx = await this.bite.encryptTransaction({
            to: tokenAddress,
            data: calldata
        });

        const tx = await this.wallet.sendTransaction({
            ...encryptedTx,
            gasLimit: 300_000
        });

        console.log(`Private transfer sent: ${tx.hash}`);
        return await tx.wait();
    }
}
```

## CTX Contract (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";

contract SecretRevealer is IBiteSupplicant {
    bytes public revealedSecret;
    address public owner;

    event SecretSubmitted(bytes32 indexed ctxId);
    event SecretRevealed(bytes secret);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function submitSecret(bytes calldata encryptedSecret) external payable onlyOwner {
        require(msg.value >= tx.gasprice * 100000, "Insufficient gas payment");

        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedSecret,
            new bytes[](0)
        );

        emit SecretSubmitted(keccak256(encryptedSecret));
    }

    function onDecrypt(
        bytes[] calldata decrypted,
        bytes[] calldata
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
        revealedSecret = decrypted[0];
        emit SecretRevealed(decrypted[0]);
    }

    function getSecret() external view returns (bytes memory) {
        require(revealedSecret.length > 0, "Secret not yet revealed");
        return revealedSecret;
    }
}
```

## Foundry Configuration

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.27"
evm_version = "istanbul"

[rpc_endpoints]
skale_base_sepolia = "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha"
skale_base = "https://skale-base.skalenodes.com/v1/base"
bite_v2_sandbox_2 = ""  # Coordinate with SKALE team
```
