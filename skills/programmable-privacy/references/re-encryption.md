# Re-encryption Reference

## What It Does

Encrypt data onchain using either the network's threshold encryption key (EncryptTE) or a specific viewer's public key (EncryptECIES). Enables private onchain state and selective data sharing.

## Precompiles

| Precompile | Address | Call Type | Purpose |
|---|---|---|---|
| EncryptTE | `0x1D` | `staticcall` | Encrypt with network BLS threshold key |
| EncryptECIES | `0x1C` | `staticcall` | Encrypt for a specific viewer's secp256k1 public key |

## Solidity API

### EncryptTE — network key

Only the consensus committee (2t+1 of 3t+1 validators) can decrypt. Use for private onchain state.

```solidity
(bytes memory encrypted, ) = BITE.encryptTE(
    0x000000000000000000000000000000000000001D,
    abi.encode(value)
);
```

### EncryptECIES — viewer key

Only the holder of the corresponding private key can decrypt off-chain. Use for data sharing.

```solidity
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

Uncompressed secp256k1 point (without the 0x04 prefix). Viewer generates a keypair off-chain, submits the public key onchain.

## Patterns

### Pattern 1: Private Onchain State (TE)

Store values TE-encrypted. Validators can decrypt via CTX for processing. Data can be manipulated over time.

```
setValue(value) → EncryptTE(0x1D, abi.encode(value)) → store
revealValue() → SubmitCTX(0x1B, storedCiphertext) → onDecrypt(plaintext)
```

### Pattern 2: Viewer-Key Storage (ECIES)

Store values ECIES-encrypted for a specific viewer key. Cannot be manipulated by validators.

```
storeRecord(id, value, viewerKey) → EncryptECIES(0x1C, value, viewerKey) → store
viewer → getRecord(id) → decrypt off-chain with private key
```

### Pattern 3: Both (TE + ECIES)

TE for validator processing + ECIES for viewer access. Best for scenarios needing both consensus-driven state transitions and private viewing.

```
store(id, value, viewerKey) → EncryptTE + EncryptECIES → store both
viewer → getEncrypted(id) → decrypt ECIES off-chain
process → SubmitCTX(0x1B, teCiphertext) → onDecrypt(plaintext) → update
```

### Client-Side ECIES Decryption

Ciphertext format: `IV(16 bytes) || ephemeralPubKey(33 bytes) || ciphertext`

```
ECDH(privateKey, ephemeralPubKey) → sharedSecret
SHA-256(sharedSecret) → AES key
AES-256-CBC(AES key, IV, ciphertext) → plaintext
```

## Error Codes

| Code | Error |
|------|-------|
| 1 | InputTooLarge |
| 2 | InputTooShort |
| 3 | InputNot32ByteAligned |
| 4 | InvalidDataOffset |
| 5 | DataLengthMismatch |
| 6 | TrailingPaddingNotZeros |
| 7 | InvalidPublicKey (ECIES only) |
| 8 | EncryptionFailed (ECIES only) |

## Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| SKALE Base | 1187947933 | Beta |
| SKALE Base Sepolia | 324705682 | Beta |
