# CTX Reference

## What It Does

Conditional Transactions — submit encrypted data to the BITE precompile. The SKALE validator committee threshold-decrypts it, then calls `onDecrypt()` on your contract. Enables: sealed-bid auctions, voting, private games.

## IBiteSupplicant Interface

```solidity
interface IBiteSupplicant {
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external;
}
```

## SubmitCTX

```solidity
address payable callbackSender = BITE.submitCTX(
    BITE.SUBMIT_CTX_ADDRESS,    // 0x1B
    gasLimit,                   // gas for onDecrypt callback execution
    encryptedArguments,         // bytes[] - TE-encrypted data
    plaintextArguments          // bytes[] - unencrypted metadata (e.g. recipient address)
);
// Fund the callback
callbackSender.transfer(gasPayment);
```

- `callbackSender` is a temporary contract that holds the decrypted args and calls your `onDecrypt`
- `plaintextArguments` pass through unencrypted — use for routing info (who to re-encrypt for, which game, etc.)

## CTX Flow

```
User encrypts data off-chain
  → submitCTX(encryptedArgs, plaintextArgs) + gas payment
    → Precompile at 0x1B
      → Consensus threshold-decrypts (2t+1 of 3t+1 nodes)
        → Deploys callbackSender contract
          → callbackSender.onDecrypt{gas: gasLimit}(decryptedArgs, plaintextArgs)
            → Your contract executes logic with revealed data
```

## Key Rules

| Rule | Detail |
|------|--------|
| Always verify `msg.sender` | `require(msg.sender == BITE.SUBMIT_CTX_ADDRESS)` in `onDecrypt` |
| Gas payment | 0.06 ETH/SFUEL per CTX |
| Callback gas limit | Max 2,500,000 |
| Callback funding | Must transfer ETH to `callbackSender` for gas |

## Library

Install the version matching your Solidity compiler (see `solidity-helpers` rule for version table):

```
forge install skalenetwork/bite-solidity@1.0.1-stable.0
```

## Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| SKALE Base | 1187947933 | Beta |
| SKALE Base Sepolia | 324705682 | Beta |

## Resources

- [CTX Docs](https://docs.skale.space/developers/bite-protocol/conditional-transactions.md)
