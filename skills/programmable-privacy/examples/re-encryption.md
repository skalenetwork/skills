# Re-encryption Examples

## EncryptedValueRegistry — TE Storage + ECIES Sharing

A contract that stores a value encrypted with the network threshold key, then grants access by re-encrypting for specific viewers.

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

    event ValueSet(bytes teCiphertext);
    event AccessGranted(address indexed viewer);
    event ValueShared(address indexed viewer, bytes eciesCiphertext);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Store a value encrypted with the network threshold key
    function setValue(uint256 value) external {
        require(msg.sender == owner, "Only owner");

        (bytes memory encrypted, bool success) = BITE.encryptTE(
            0x000000000000000000000000000000000000001D,
            abi.encode(value)
        );
        require(success, "TE encryption failed");

        encryptedValue = encrypted;
        emit ValueSet(encrypted);
    }

    /// @notice Grant access by decrypting via CTX and re-encrypting for viewer
    function grantAccess(address viewer, PublicKey calldata viewerKey) external payable {
        require(msg.sender == owner, "Only owner");
        require(msg.value >= 0.06 ether, "CTX payment required");
        require(encryptedValue.length > 0, "No value set");

        grants[viewer] = AccessGrant({
            viewerKey: viewerKey,
            eciesCiphertext: bytes(""),
            exists: true
        });

        // Pass viewer address as plaintext argument so onDecrypt knows who to re-encrypt for
        bytes[] memory plaintextArgs = new bytes[](1);
        plaintextArgs[0] = abi.encode(viewer);

        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = encryptedValue;

        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedArgs,
            plaintextArgs
        );
    }

    /// @notice Called by BITE after threshold decryption
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");

        // Get viewer from plaintext args
        address viewer = abi.decode(plaintextArguments[0], (address));
        require(grants[viewer].exists, "No grant");

        // Re-encrypt the decrypted value for the viewer's ECIES key
        (bytes memory eciesEncrypted, bool success) = BITE.encryptECIES(
            0x000000000000000000000000000000000000001C,
            decryptedArguments[0],
            grants[viewer].viewerKey
        );
        require(success, "ECIES re-encryption failed");

        grants[viewer].eciesCiphertext = eciesEncrypted;
        emit AccessGranted(viewer);
        emit ValueShared(viewer, eciesEncrypted);
    }

    /// @notice Viewer retrieves their ECIES-encrypted value
    function getEncryptedValue(address viewer) external view returns (bytes memory) {
        require(grants[viewer].exists, "No access grant");
        require(grants[viewer].eciesCiphertext.length > 0, "Not yet decrypted");
        return grants[viewer].eciesCiphertext;
    }
}
```

## ConfidentialBalance — Private On-Chain State

Store a balance encrypted with TE. Only the consensus committee can decrypt via CTX.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";

contract ConfidentialBalance is IBiteSupplicant {
    address public owner;
    bytes public encryptedBalance;

    uint256 public lastRevealedBalance;
    bool public isRevealed;

    event BalanceSet(bytes teCiphertext);
    event BalanceRevealed(uint256 balance);

    constructor() {
        owner = msg.sender;
    }

    function setBalance(uint256 balance) external {
        require(msg.sender == owner, "Only owner");

        (bytes memory encrypted, bool success) = BITE.encryptTE(
            0x000000000000000000000000000000000000001D,
            abi.encode(balance)
        );
        require(success, "Encryption failed");

        encryptedBalance = encrypted;
        isRevealed = false;
        emit BalanceSet(encrypted);
    }

    function revealBalance() external payable {
        require(msg.sender == owner, "Only owner");
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

        lastRevealedBalance = abi.decode(decryptedArguments[0], (uint256));
        isRevealed = true;
        emit BalanceRevealed(lastRevealedBalance);
    }
}
```

## Client-Side ECIES Decryption (TypeScript)

Decrypt ECIES ciphertext from the `0x1C` precompile using the recipient's private key.

```typescript
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

async function decryptECIES(
    privateKey: `0x${string}`,
    ciphertext: `0x${string}`
): Promise<Uint8Array> {
    const payload = hexToBytes(ciphertext);

    // Ciphertext format: IV(16) || ephemeralPubKey(33) || ciphertext
    const iv = payload.slice(0, 16);
    const ephemeralPubKey = payload.slice(16, 49);
    const encrypted = payload.slice(49);

    // ECDH: derive shared secret
    const sharedSecret = secp256k1.getSharedSecret(
        hexToBytes(privateKey),
        ephemeralPubKey,
        true // compressed output
    ).slice(1);

    // Derive AES key from shared secret
    const encryptionKey = sha256(sharedSecret);

    // AES-256-CBC decryption
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encryptionKey,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        encrypted
    );

    return new Uint8Array(decrypted);
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = hex.replace('0x', '');
    return new Uint8Array(bytes.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
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

[dependencies]
bite-solidity = { git = "https://github.com/skalenetwork/bite-solidity", tag = "1.0.1-stable.0" }
```

## Resources

- **confidential-token**: `github.com/skalenetwork/confidential-token` — production confidential ERC20 using TE + ECIES
- **confidential-poker**: `github.com/thegreataxios/confidential-poker` — poker game using dual TE/ECIES encryption
- **EncryptedValueRegistry**: `github.com/skalenetwork/bite-solidity` (examples/encrypted-value-registry)
