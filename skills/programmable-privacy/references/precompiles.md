# BITE Precompiles

Three precompiled contracts power BITE Protocol on SKALE.

## SubmitCTX — `0x1B`

Submits encrypted data for threshold decryption. BITE creates a callback contract that calls `onDecrypt()` on the supplicant after decryption.

| Property | Value |
|----------|-------|
| Address | `0x000000000000000000000000000000000000001B` |
| Call Type | `call` (state-modifying) |
| Gas Payment | 0.06 ETH/SFUEL per CTX |
| Returns | `address payable callbackSender` (20 bytes) |

```solidity
address payable callbackSender = BITE.submitCTX(
    BITE.SUBMIT_CTX_ADDRESS,
    gasLimit,              // gas for onDecrypt callback
    encryptedArguments,    // bytes[] - TE-encrypted data
    plaintextArguments     // bytes[] - unencrypted metadata
);
// Fund the callback
callbackSender.transfer(ctxCallbackValueWei);
```

## EncryptECIES — `0x1C`

Encrypts data for a specific recipient's secp256k1 public key using ECIES (Elliptic Curve Integrated Encryption Scheme). Only the holder of the corresponding private key can decrypt off-chain.

| Property | Value |
|----------|-------|
| Address | `0x000000000000000000000000000000000000001C` |
| Call Type | `staticcall` (view) |
| Min Output Size | 65 bytes (ECIES overhead) |
| Input | `(bytes text, bytes32 pubKeyX, bytes32 pubKeyY)` |

```solidity
bytes memory ciphertext = BITE.encryptECIES(
    0x000000000000000000000000000000000000001C,
    abi.encode(data),
    PublicKey({ x: recipientPubKeyX, y: recipientPubKeyY })
);
```

**Client-side decryption:** The ciphertext format is `IV(16) || ephemeralPubKey(33) || ciphertext`. Decrypt with ECDH shared secret → SHA-256 → AES-256-CBC.

## EncryptTE — `0x1D`

Encrypts data with the network's BLS threshold encryption key. Only the consensus committee (2t+1 of 3t+1 validators) can decrypt — typically via SubmitCTX callback.

| Property | Value |
|----------|-------|
| Address | `0x000000000000000000000000000000000000001D` |
| Call Type | `staticcall` (view) |
| Min Output Size | 293 bytes (292 TE overhead + 1) |
| Input | `(bytes text)` |

```solidity
bytes memory ciphertext = BITE.encryptTE(
    0x000000000000000000000000000000000000001D,
    abi.encode(data)
);
```

## Comparison

| Precompile | Encrypts For | Decryptable By | Use Case |
|---|---|---|---|
| `0x1C` (ECIES) | Specific recipient key | Recipient's private key | Data sharing, viewer access |
| `0x1D` (TE) | Network threshold key | BITE consensus (2t+1) | Private onchain state |
| `0x1B` (CTX) | N/A (triggers decryption) | N/A (initiates callback) | Conditional reveal |
