# Re-encryption Reference

## What It Does

Encrypt data on-chain using either the network's threshold encryption key (EncryptTE) or a specific recipient's public key (EncryptECIES). Enables private on-chain state and selective data sharing.

## Precompiles

| Precompile | Address | Call Type | Purpose |
|---|---|---|---|
| EncryptTE | `0x1D` | `staticcall` | Encrypt with network BLS threshold key |
| EncryptECIES | `0x1C` | `staticcall` | Encrypt for a specific recipient's secp256k1 public key |

## Solidity API

### EncryptTE — network key

Only the consensus committee (2t+1 of 3t+1 validators) can decrypt. Use for private on-chain state.

```solidity
bytes memory encrypted = BITE.encryptTE(
    0x000000000000000000000000000000000000001D,
    abi.encode(value)
);
```

### EncryptECIES — recipient key

Only the holder of the corresponding private key can decrypt off-chain. Use for data sharing.

```solidity
bytes memory encrypted = BITE.encryptECIES(
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

Uncompressed secp256k1 point (without the 0x04 prefix). Recipient generates a keypair off-chain, submits the public key on-chain.

## Patterns

### Private On-chain State (confidential-token pattern)

Store values TE-encrypted. Only consensus can decrypt via CTX callback.

```
setValue(balance) → EncryptTE(0x1D, abi.encode(balance)) → store
revealBalance() → SubmitCTX(0x1B, storedCiphertext) → onDecrypt(plaintext)
```

### Data Sharing (confidential-poker pattern)

Store TE-encrypted, grant access by CTX-decrypting then ECIES-re-encrypting for a viewer.

```
setValue(balance) → EncryptTE(0x1D, value) → store
grantAccess(viewer, pubKey) → SubmitCTX(0x1B, stored, [viewer])
  → onDecrypt(decrypted, plaintext)
    → EncryptECIES(0x1C, decrypted, viewerPubKey) → store for viewer
viewer → getEncryptedValue() → decrypt off-chain with private key
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
