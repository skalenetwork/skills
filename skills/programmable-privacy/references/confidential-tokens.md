# Confidential Tokens Reference

> **Status: Experimental (testnet only)** — API may change significantly. Only available on SKALE Base Sepolia.

## What It Does

ERC20 token where balances are encrypted onchain. No plaintext balance is ever stored. Two encryption layers:

| Layer | Key | Purpose | Who Can Decrypt |
|-------|-----|---------|-----------------|
| TE (Threshold Encryption) | Network BLS key | On-chain logic (transfers, sufficiency checks) | Consensus via CTX callback |
| ECIES | Recipient's secp256k1 key | Off-chain balance viewing | Token holder's private key |

## Architecture

```
transfer(from, to, amount)
  → TE-encrypt (from_balance, to_balance, amount)
  → SubmitCTX(0x1B, encryptedArgs, [TransferInfo plaintext])
    → Consensus decrypts
      → onDecrypt() callback
        → Validate sufficiency
        → _setBalance():
            → EncryptTE(0x1D, new_balance) → _thresholdBalances
            → EncryptECIES(0x1C, new_balance, viewerPubKey) → _userBalances
```

## Key Contracts

| Contract | Purpose |
|----------|---------|
| `ConfidentialToken` | Core confidential ERC20 |
| `ConfidentialWrapper` | Wraps an existing ERC20 into confidential |
| `MintableConfidentialToken` | ConfidentialToken + restricted mint |
| `ConfidentialEIP3009` | EIP-3009 with encrypted value parameters |

## Roles

| Role | Can Do | Can See Balance |
|------|--------|-----------------|
| Holder | Transfer, approve | Only via registered viewer key |
| Viewer | Decrypt ECIES balance off-chain | Yes (if granted access) |
| Anyone | View encrypted ciphertext onchain | Encrypted only |

A holder registers a viewer public key via `setViewerPublicKey()`. The holder can be their own viewer.

## Key Behaviors

- **Staleness detection**: If another CTX modified a balance between submission and execution, `onDecrypt` detects it (compares `_lastChanged` vs `submittedBlockNumber`) and resubmits with fresh encrypted balances.
- **Callback funding**: Contract holds ETH/SFUEL for CTX callback gas. Each CTX submission transfers gas to the callback sender.
- **Zero balances**: Also TE-encrypted (not empty bytes) to prevent information leakage via ciphertext length.

## Library

```
forge install skalenetwork/confidential-token
```

## Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| SKALE Base Sepolia | 324705682 | Experimental |

## Resources

- **GitHub**: `github.com/skalenetwork/confidential-token`
