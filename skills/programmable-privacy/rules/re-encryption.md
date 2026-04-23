---
title: Re-encryption (EncryptECIES + EncryptTE)
impact: high
tags: [bite, re-encryption, ecies, threshold-encryption]
---

# Rule: re-encryption

## Why It Matters

Re-encryption enables private storage onchain. There are two fundamental encryption primitives:

1. **EncryptTE** (`0x1D`) — encrypts with the network's threshold key. Only the consensus committee can decrypt via CTX.
2. **EncryptECIES** (`0x1C`) — encrypts with a specific viewer's secp256k1 public key. Only that viewer can decrypt off-chain.

These combine into three patterns depending on who needs access and whether the data changes over time.

## Precompiles

| Precompile | Address | Call Type | Purpose |
|---|---|---|---|
| `EncryptECIES` | `0x1C` | `staticcall` | Encrypt for a specific viewer's secp256k1 public key |
| `EncryptTE` | `0x1D` | `staticcall` | Encrypt with the network's BLS threshold key |
| `SubmitCTX` | `0x1B` | `call` | Submit encrypted data for threshold decryption + callback |

## Solidity API

```solidity
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";

// Threshold encryption — only consensus (2t+1 nodes) can decrypt
(bytes memory encrypted, ) = BITE.encryptTE(
    0x000000000000000000000000000000000000001D,
    abi.encode(value)
);

// ECIES encryption — only the viewer's private key can decrypt off-chain
(bytes memory encrypted, ) = BITE.encryptECIES(
    0x000000000000000000000000000000000000001C,
    abi.encode(value),
    PublicKey({ x: pubKeyX, y: pubKeyY })
);
```

## PublicKey Struct

```solidity
struct PublicKey {
    bytes32 x;
    bytes32 y;
}
```

A secp256k1 public key (uncompressed point). The viewer generates a keypair off-chain, submits the public key onchain, and decrypts ciphertext off-chain with their private key.

## Error Codes

| Code | Error | Cause |
|------|-------|-------|
| 1 | InputTooLarge | Data exceeds maximum size |
| 2 | InputTooShort | Data too small |
| 3 | InputNot32ByteAligned | Data not aligned to 32-byte words |
| 4 | InvalidDataOffset | Data offset out of bounds |
| 5 | DataLengthMismatch | Declared length doesn't match actual |
| 6 | TrailingPaddingNotZeros | Non-zero padding bytes |
| 7 | InvalidPublicKey | ECIES: malformed secp256k1 public key |
| 8 | EncryptionFailed | ECIES: encryption operation failed |

## Pattern 1: Private Onchain State (TE)

Store values encrypted with `EncryptTE`. The consensus committee can decrypt via CTX — useful when validators need to process or update the value over time (transfers, tallies, state transitions).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";

contract EncryptedState is IBiteSupplicant {
    address public owner;
    bytes public encryptedValue;

    function setValue(uint256 value) external {
        require(msg.sender == owner, "Only owner");
        (bytes memory encrypted, bool ok) = BITE.encryptTE(
            0x000000000000000000000000000000000000001D,
            abi.encode(value)
        );
        require(ok, "Encryption failed");
        encryptedValue = encrypted;
    }

    function revealValue() external payable {
        require(msg.value >= 0.06 ether, "CTX payment required");
        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedValue,
            new bytes[](0)
        );
    }

    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
        uint256 value = abi.decode(decryptedArguments[0], (uint256));
        // Use the revealed value
    }
}
```

## Pattern 2: Viewer-Key Storage (ECIES)

Store values encrypted with `EncryptECIES` for a specific viewer's key. Only that viewer can decrypt off-chain. Data cannot be manipulated by validators — great for sharing sensitive data (medical records, credentials, private messages).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";

contract ViewerEncryptedStorage {
    mapping(bytes32 => bytes) private encryptedRecords;

    function storeRecord(bytes32 id, uint256 value, PublicKey calldata viewerKey) external {
        (bytes memory encrypted, bool ok) = BITE.encryptECIES(
            0x000000000000000000000000000000000000001C,
            abi.encode(value),
            viewerKey
        );
        require(ok, "Encryption failed");
        encryptedRecords[id] = encrypted;
    }

    function getRecord(bytes32 id) external view returns (bytes memory) {
        return encryptedRecords[id];
    }
}
```

Viewer decrypts off-chain:

```
Ciphertext: IV(16) || ephemeralPubKey(33) || ciphertext
  → ECDH(privateKey, ephemeralPubKey) → sharedSecret
  → SHA-256(sharedSecret) → AES key
  → AES-256-CBC(AES key, IV, ciphertext) → plaintext
```

## Pattern 3: Both (TE + ECIES)

Encrypt with TE for validator processing and ECIES for viewer access. The best of both — data can be manipulated by consensus when needed and privately viewed by specific keys.

For a full example, see [examples/confidential-poker.md](../examples/confidential-poker.md).

## Data Flow: Pattern 3 (TE → CTX → ECIES)

```
Owner calls setValue(value, viewerKey)
    │
    ├──> EncryptTE(0x1D, value)     → store (for validator processing)
    └──> EncryptECIES(0x1C, value, viewerKey) → store (for viewer access)

Viewer reads value anytime:
    └──> getEncryptedValue() → ECIES ciphertext → decrypt off-chain

Owner triggers processing via CTX:
    └──> SubmitCTX(0x1B, teEncryptedValue)
           └──> Consensus decrypts
                  └──> onDecrypt(plaintext) → process value, re-encrypt
```

## Use Cases

| Use Case | Pattern | Example |
|----------|---------|---------|
| Private voting | Pattern 1 (TE) | Votes encrypted, tallied onchain |
| Sealed-bid auctions | Pattern 1 (TE) | Encrypted bids revealed after deadline |
| Medical/financial records | Pattern 2 (ECIES) | Grant access to specific researchers |
| Credentials, private messages | Pattern 2 (ECIES) | Share data without validator access |
| Confidential token balances | Pattern 3 (Both) | `references/confidential-tokens.md` |
| Encrypted game state | Pattern 3 (Both) | `examples/confidential-poker.md` |

## Integration Checklist

- [ ] Import the BITE library version matching your Solidity compiler
- [ ] Use `staticcall` for encryptTE and encryptECIES (they are view functions)
- [ ] Handle encryption failure (check bool return / try/catch)
- [ ] For ECIES: validate PublicKey before calling encryptECIES
- [ ] For data sharing: pass viewer address as plaintext argument to SubmitCTX
- [ ] Test on SKALE Base Sepolia (Chain ID: 324705682)

## Resources

- **confidential-token**: `github.com/skalenetwork/confidential-token`
- **confidential-poker**: `github.com/thegreataxios/confidential-poker`
- **EncryptedValueRegistry**: `github.com/skalenetwork/bite-solidity` (examples/)
