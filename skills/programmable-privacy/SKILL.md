---
name: programmable-privacy
description: Encrypted transactions, conditional transactions (CTX), re-encryption, and confidential tokens on SKALE. Use for privacy dApps, confidential voting, sealed-bid auctions, encrypted state, and data sharing.
license: MIT
metadata:
  author: thegreataxios
  version: "2.0.0"
---

# Programmable Privacy

Threshold encryption primitives on SKALE Network. Encrypt transaction data, decrypt conditionally onchain, and re-encrypt data for specific recipients or network-level privacy.

## When to Apply

- Implementing encrypted transactions
- Building CTX-enabled contracts
- Re-encrypting onchain state for data sharing or private storage
- Building confidential tokens
- Using `@skalenetwork/bite-solidity@1.0.1` or `@skalenetwork/bite@0.8.1`
- Private games (RPS, poker), voting, auctions

## Features

| Feature | Description | Precompile | Status | Chains |
|---------|-------------|------------|--------|--------|
| Encrypted Transactions | Encrypt `to` + `calldata` in mempool | Magic Address `0x4249...5044` | Live | SKALE Base, SKALE Base Sepolia |
| CTX | Conditional Transactions — decrypt onchain when triggered | `0x1B` (SubmitCTX) | Beta | SKALE Base, SKALE Base Sepolia |
| Re-encryption & Encrypted Storage | Encrypt data onchain with network key or recipient key | `0x1D` / `0x1C` | Beta | SKALE Base, SKALE Base Sepolia |
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

`@skalenetwork/bite-solidity@1.0.1` ships versions for Solidity 0.5.0 through 0.8.27+. All expose the same precompiles. See `references/solidity-sdk.md` for the version table and `rules/foundry-configuration.md` for foundry config.

## Key Constants

```solidity
// Encrypted Transactions
address constant BITE_MAGIC_ADDRESS = 0x42495445204D452049274d20454E435259505444;

// CTX, Re-encryption, Confidential Tokens
address constant SUBMIT_CTX = 0x000000000000000000000000000000000000001B;
address constant ENCRYPT_ECIES = 0x000000000000000000000000000000000000001C;
address constant ENCRYPT_TE = 0x000000000000000000000000000000000000001D;
```

## Rules

| Rule | Feature | Topic |
|------|---------|-------|
| `encrypted-transactions-ethers` | Encrypted Transactions | Encrypted txs with ethers.js |
| `encrypted-transactions-viem` | Encrypted Transactions | Encrypted txs with viem |
| `foundry-configuration` | All | Foundry setup, compiler versions |
| `sdk-usage` | All | TypeScript SDK reference |
| `solidity-helpers` | CTX, Re-encryption | Solidity library, imports, IBiteSupplicant |
| `conditional-transactions` | CTX | CTX contract patterns, RPS example |
| `re-encryption` | Re-encryption | EncryptECIES, EncryptTE, data sharing |

## References

| Reference | Feature | Content |
|-----------|---------|---------|
| `encrypted-transactions` | Encrypted Transactions | Gas table, what's encrypted |
| `conditional-transactions` | CTX | IBiteSupplicant, SubmitCTX, callback model |
| `re-encryption` | Re-encryption | EncryptTE, EncryptECIES, PublicKey, error codes |
| `confidential-tokens` | Confidential Tokens | Architecture, dual-encryption model |
| `precompiles` | All | Addresses, call types, comparison |
| `typescript-sdk` | All | TypeScript SDK setup & API |
| `solidity-sdk` | All | Solidity SDK setup, imports & API |

## Visibility Summary

| Data | Encrypted Transactions | CTX | Re-encryption |
|------|------------------------|-----|---------------|
| Recipient (to) | Encrypted in mempool | — | — |
| Calldata | Encrypted in mempool | Encrypted onchain | Encrypted onchain |
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
3. **Pick Library Version**: Match your project's Solidity version (see `references/solidity-sdk.md`)
4. **Implement**: Follow patterns in rules files
5. **Test**: Start on Sepolia, deploy to mainnet when ready
