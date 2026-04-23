---
title: BITE Solidity Helpers
impact: high
tags: [bite, solidity, ctx, re-encryption]
---

# Rule: solidity-helpers

## Why It Matters

The `@skalenetwork/bite-solidity` library provides Solidity interfaces and helpers for BITE Protocol integration. It wraps three precompile contracts. Using the official library ensures compatibility.

## Installation

See `references/solidity-sdk.md` for install commands and version selection.

## Core Imports

```solidity
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";
```

## Library Constants

```solidity
address constant SUBMIT_CTX_ADDRESS = 0x000000000000000000000000000000000000001B;
uint256 constant CTX_GAS_LIMIT = 2_500_000;
```

## IBiteSupplicant Interface

```solidity
interface IBiteSupplicant {
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external;
}
```

## Security: Always Verify Caller

```solidity
function onDecrypt(
    bytes[] calldata decryptedArguments,
    bytes[] calldata plaintextArguments
) external override {
    require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
    // process decrypted data
}
```

## Library Versions

See `references/solidity-sdk.md` for the full version table. Pick the import matching your Solidity compiler.

## Common Patterns

### Decode Single Value

```solidity
function onDecrypt(
    bytes[] calldata decryptedArguments,
    bytes[] calldata plaintextArguments
) external override {
    require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
    uint256 value = abi.decode(decryptedArguments[0], (uint256));
}
```

### Decode Multiple Values

```solidity
function onDecrypt(
    bytes[] calldata decryptedArguments,
    bytes[] calldata plaintextArguments
) external override {
    require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
    (address user, uint256 amount, bytes32 id) = abi.decode(
        decryptedArguments[0],
        (address, uint256, bytes32)
    );
}
```

### Emit Events for Indexing

```solidity
event CTXDecoded(address indexed user, bytes payload);

function onDecrypt(
    bytes[] calldata decryptedArguments,
    bytes[] calldata plaintextArguments
) external override {
    require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
    (address user, bytes memory payload) = abi.decode(
        decryptedArguments[0],
        (address, bytes)
    );
    emit CTXDecoded(user, payload);
}
```

## Resources

- **GitHub**: `github.com/skalenetwork/bite-solidity`
- **CTX Examples**: See `conditional-transactions.md`
- **Re-encryption Examples**: See `re-encryption.md`
