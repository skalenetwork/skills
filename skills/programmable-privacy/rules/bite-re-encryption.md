---
title: Re-encryption (EncryptECIES + EncryptTE)
impact: high
tags: [bite, re-encryption, ecies, threshold-encryption]
---

# Rule: bite-re-encryption

## Why It Matters

Re-encryption is the process of encrypting data on-chain using either the network's threshold encryption key (`EncryptTE`) or a specific recipient's public key (`EncryptECIES`). This enables two key patterns:

1. **Private on-chain state** — store encrypted values that only the consensus committee can decrypt (confidential-token pattern)
2. **Data sharing** — decrypt via CTX, then re-encrypt for a specific recipient's key so only they can read it off-chain (confidential-poker pattern)

## Precompiles

| Precompile | Address | Call Type | Purpose |
|---|---|---|---|
| `EncryptECIES` | `0x1C` | `staticcall` | Encrypt for a specific recipient's secp256k1 public key |
| `EncryptTE` | `0x1D` | `staticcall` | Encrypt with the network's BLS threshold key |
| `SubmitCTX` | `0x1B` | `call` | Submit encrypted data for threshold decryption + callback |

## Solidity API

```solidity
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";

// Threshold encryption — encrypted with network key
// Only consensus (2t+1 nodes) can decrypt
(bytes memory encrypted, ) = BITE.encryptTE(
    0x000000000000000000000000000000000000001D,
    abi.encode(value)
);

// ECIES encryption — encrypted for a specific recipient's secp256k1 key
// Only the holder of the corresponding private key can decrypt off-chain
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

A secp256k1 public key (uncompressed point). The recipient provides this on-chain and decrypts the ciphertext off-chain with their private key.

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

## Pattern 1: Private On-Chain State (Confidential Token)

Store values encrypted with `EncryptTE`. Only the consensus committee can decrypt via CTX.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";

contract ConfidentialBalance is IBiteSupplicant {
    address public owner;
    bytes public encryptedBalance;

    constructor() {
        owner = msg.sender;
    }

    function setBalance(uint256 balance) external {
        require(msg.sender == owner, "Only owner");

        bytes memory encrypted = BITE.encryptTE(
            0x000000000000000000000000000000000000001D,
            abi.encode(balance)
        );
        require(encrypted.length > 0, "Encryption failed");

        encryptedBalance = encrypted;
    }

    // Decrypt via CTX to read the balance
    function revealBalance() external payable {
        require(msg.value >= 0.06 ether, "CTX payment required");

        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = encryptedBalance;

        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedArgs,
            new bytes[](0)
        );
    }

    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");
        uint256 balance = abi.decode(decryptedArguments[0], (uint256));
        // Use the revealed balance
    }
}
```

## Pattern 2: Data Sharing (TE → CTX Decrypt → ECIES Re-encrypt)

Store encrypted with TE, then grant access by decrypting via CTX and re-encrypting for a specific recipient's key.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";

contract EncryptedValueRegistry is IBiteSupplicant {
    address public owner;
    bytes public encryptedValue;

    struct AccessGrant {
        PublicKey viewerKey;
        bytes eciesCiphertext;
        bool exists;
    }

    mapping(address => AccessGrant) public grants;

    event ValueSet();
    event AccessGranted(address indexed viewer);
    event ValueRevealed(bytes eciesCiphertext);

    constructor() {
        owner = msg.sender;
    }

    // Store encrypted value with network threshold key
    function setValue(uint256 value) external {
        require(msg.sender == owner, "Only owner");

        bytes memory encrypted = BITE.encryptTE(
            0x000000000000000000000000000000000000001D,
            abi.encode(value)
        );
        require(encrypted.length > 0, "TE encryption failed");

        encryptedValue = encrypted;
        emit ValueSet();
    }

    // Grant access: decrypt via CTX, re-encrypt for viewer's key
    function grantAccess(address viewer, PublicKey calldata viewerKey) external payable {
        require(msg.sender == owner, "Only owner");
        require(msg.value >= 0.06 ether, "CTX payment required");
        require(encryptedValue.length > 0, "No value set");

        grants[viewer] = AccessGrant({
            viewerKey: viewerKey,
            eciesCiphertext: bytes(""),
            exists: true
        });

        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedValue,
            abi.encode(viewer)
        );
    }

    // Called by BITE after threshold decryption
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");

        // plaintextArguments[0] = viewer address (passed unencrypted)
        address viewer = abi.decode(plaintextArguments[0], (address));
        require(grants[viewer].exists, "No grant");

        // Re-encrypt the decrypted value with the viewer's ECIES public key
        bytes memory eciesEncrypted = BITE.encryptECIES(
            0x000000000000000000000000000000000000001C,
            decryptedArguments[0],
            grants[viewer].viewerKey
        );
        require(eciesEncrypted.length > 0, "ECIES re-encryption failed");

        grants[viewer].eciesCiphertext = eciesEncrypted;
        emit AccessGranted(viewer);
        emit ValueRevealed(eciesEncrypted);
    }

    // Viewer retrieves their ECIES-encrypted value
    function getEncryptedValue(address viewer) external view returns (bytes memory) {
        require(grants[viewer].exists, "No access grant");
        require(grants[viewer].eciesCiphertext.length > 0, "Not yet decrypted");
        return grants[viewer].eciesCiphertext;
    }
}
```

## Data Flow: TE → CTX → ECIES

```
Owner calls setValue(balance)
    │
    └──> EncryptTE(0x1D, abi.encode(balance))
           │
           └──> Store encrypted bytes on-chain
                  │
Owner calls grantAccess(viewer, pubKey)
    │
    └──> SubmitCTX(0x1B, encryptedValue, [viewer])
           │
           └──> Consensus decrypts (2t+1 nodes)
                  │
                  └──> onDecrypt(decryptedArguments, plaintextArguments)
                         │
                         ├──> Read viewer from plaintextArguments
                         └──> EncryptECIES(0x1C, value, viewerPubKey)
                                │
                                └──> Store ECIES ciphertext for viewer
                                       │
Viewer calls getEncryptedValue(myAddress)
    │
    └──> Returns ECIES ciphertext
           │
           └──> Viewer decrypts off-chain with their private key
```

## Use Cases

| Use Case | Pattern | Example |
|----------|---------|---------|
| Confidential token balances | Private state (TE) | `skalenetwork/confidential-token` |
| Encrypted game state | Data sharing (TE→ECIES) | `thegreataxios/confidential-poker` |
| Sealed-bid auctions | Private state + CTX reveal | Encrypted bids revealed after deadline |
| Medical/financial records | Data sharing with consent | Grant access to specific researchers |
| Private voting | Private state + CTX tally | Votes encrypted, tallied on-chain |

## Foundry Configuration

```toml
# foundry.toml — recommended (BITE.sol). Use LegacyBITE.sol etc. for older compilers.
[profile.default]
solc_version = "0.8.27"
evm_version = "istanbul"

[dependencies]
bite-solidity = { git = "https://github.com/skalenetwork/bite-solidity", tag = "1.0.1-stable.0" }
```

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
- **EncryptedValueRegistry example**: `github.com/skalenetwork/bite-solidity` (examples/encrypted-value-registry)
