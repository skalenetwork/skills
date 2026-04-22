---
name: programmable-privacy
description: Encrypted transactions, conditional transactions (CTX), re-encryption, and confidential tokens on SKALE. Use for privacy dApps, confidential voting, sealed-bid auctions, encrypted state, and data sharing.
license: MIT
metadata:
  author: thegreataxios
  version: "2.0.0"
---

# Programmable Privacy

Threshold encryption primitives on SKALE Network. Encrypt transaction data, decrypt conditionally on-chain, and re-encrypt data for specific recipients or network-level privacy.

## When to Apply

- Implementing encrypted transactions
- Building CTX-enabled contracts
- Re-encrypting on-chain state for data sharing or private storage
- Building confidential tokens
- Using `@skalenetwork/bite-solidity@1.0.1` or `@skalenetwork/bite@0.8.1`
- Private games (RPS, poker), voting, auctions

## Features

| Feature | Description | Precompile | Status | Chains |
|---------|-------------|------------|--------|--------|
| Encrypted Transactions | Encrypt `to` + `calldata` in mempool | Magic Address `0x...0401 | Live | SKALE Base, SKALE Base Sepolia |
| CTX | Conditional Transactions — decrypt on-chain when triggered | `0x1B` (SubmitCTX) | Beta | SKALE Base, SKALE Base Sepolia |
| Re-encryption & Encrypted Storage | Encrypt data on-chain with network key or recipient key | `0x1D` / `0x1C` | Beta | SKALE Base, SKALE Base Sepolia |
| Confidential Tokens | ERC20 with encrypted balances using TE + ECIES | All precompiles | Experimental (testnet only) | SKALE Base Sepolia |

**Status key:** Live = production-ready. Beta = fully available, API may evolve. Experimental = testnet only, may change significantly.

## Precompile Addresses

| Precompile | Address | Call Type | Purpose |
|---|---|---|---|
| SubmitCTX | `0x1B` | `call` | Submit encrypted data for threshold decryption + callback |
| EncryptECIES | `0x1C` | `staticcall` | Encrypt data for a specific recipient's secp256k1 public key |
| EncryptTE | `0x1D` | `staticcall` | Encrypt data with the network BLS threshold key |

## Chain Selection

| Feature | Chain | Chain ID |
|---------|-------|----------|
| Encrypted Transactions | SKALE Base | 1187947933 |
| Encrypted Transactions | SKALE Base Sepolia | 324705682 |
| CTX, Re-encryption | SKALE Base | 1187947933 |
| CTX, Re-encryption | SKALE Base Sepolia | 324705682 |
| Confidential Tokens | SKALE Base Sepolia | 324705682 |

## Compiler Requirements

`@skalenetwork/bite-solidity@1.0.1` ships versions for Solidity 0.5.0 through 0.8.27+. All expose the same precompiles. See `references/library-versions.md` for the full version table and foundry config.

## Key Constants

```solidity
// Encrypted Transactions
address constant BITE_MAGIC_ADDRESS = 0x0000000000000000000000000000000000000401;

// CTX, Re-encryption, Confidential Tokens
address constant SUBMIT_CTX = 0x000000000000000000000000000000000000001B;
address constant ENCRYPT_ECIES = 0x000000000000000000000000000000000000001C;
address constant ENCRYPT_TE = 0x000000000000000000000000000000000000001D;
```

## Rules

| Rule | Feature | Topic |
|------|---------|-------|
| `bite-encrypted-transactions` | Encrypted Transactions | Gas, committees, batch encryption |
| `bite-sdk-usage` | All | TypeScript SDK reference |
| `bite-solidity-helpers` | CTX, Re-encryption | Solidity library, imports, IBiteSupplicant |
| `bite-conditional-transactions` | CTX | CTX contract patterns, RPS example |
| `bite-re-encryption` | Re-encryption | EncryptECIES, EncryptTE, data sharing |

## References

| Reference | Feature | Content |
|-----------|---------|---------|
| `encrypted-transactions` | Encrypted Transactions | SDK methods, encryption flow, gas table |
| `ctx` | CTX | IBiteSupplicant, SubmitCTX, error codes |
| `re-encryption` | Re-encryption | EncryptTE, EncryptECIES, PublicKey, patterns |
| `confidential-tokens` | Confidential Tokens | Architecture, dual-encryption model |
| `precompiles` | All | Addresses, call types, comparison |
| `sdk` | All | TypeScript SDK full API |
| `library-versions` | All | Solidity version table, install commands |

## Visibility Summary

| Data | Encrypted Transactions | CTX | Re-encryption |
|------|------------------------|-----|---------------|
| Recipient (to) | Encrypted in mempool | — | — |
| Calldata | Encrypted in mempool | Encrypted on-chain | Encrypted on-chain |
| On-chain state | — | Revealed via callback | Stored encrypted |
| Recipient-specific access | — | — | ECIES for specific key |

## Resources

- **bite-solidity**: `github.com/skalenetwork/bite-solidity`
- **bite-ts**: `github.com/skalenetwork/bite-ts`
- **confidential-token**: `github.com/skalenetwork/confidential-token`
- **Demo (RPS)**: `github.com/TheGreatAxios/ctxs` (rps branch)
- **Starter**: `github.com/thegreataxios/skale-ctxs-foundry-starter`

## How to Work

1. **Identify Feature**: Encrypted Transactions (live), CTX/Re-encryption (beta), or Confidential Tokens (experimental)?
2. **Select Chain**: SKALE Base Sepolia for dev, SKALE Base for production (Confidential Tokens: testnet only)
3. **Pick Library Version**: Match your project's Solidity version (see `references/library-versions.md`)
4. **Implement**: Follow patterns in rules files
5. **Test**: Start on Sepolia, deploy to mainnet when ready
