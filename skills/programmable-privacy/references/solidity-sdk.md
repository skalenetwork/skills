# Solidity SDK Reference

## Setup

See `rules/foundry-configuration.md` for foundry.toml settings and compiler version selection.

```bash
forge install skalenetwork/bite-solidity@1.0.1-stable.0
echo "@skalenetwork/bite-solidity/=lib/bite-solidity/contracts/" >> remappings.txt
```

## Core Imports

```solidity
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";
```

## API Summary

| Method | Precompile | Purpose |
|--------|------------|---------|
| `BITE.submitCTX(address, gasLimit, encryptedArgs, plaintextArgs)` | `0x1B` | Submit encrypted data for threshold decryption + callback |
| `BITE.encryptTE(address, data)` | `0x1D` | Encrypt with network BLS threshold key |
| `BITE.encryptECIES(address, data, publicKey)` | `0x1C` | Encrypt for a specific recipient's secp256k1 key |

## Library Versions

| Import | Solidity | Error Style |
|--------|----------|-------------|
| `BITE.sol` | >=0.8.27 | Modern `require` with custom errors |
| `LegacyBITE.sol` | >=0.8.5 | Custom errors with `if/revert` |
| `VeryLegacyBITE.sol` | >=0.8.4 | Custom errors with `if/revert` |
| `VeryVeryLegacyBITE.sol` | >=0.8.0 | `LegacyErrors` with string `revert()` |
| `VeryVeryVeryLegacyBITE.sol` | >=0.6.0 | `LegacyErrors` with string `revert()` |
| `VeryVeryVeryVeryLegacyBITE.sol` | >=0.5.0 | String-based errors, `Types.PublicKey` |

## Examples & Patterns

| Topic | Location |
|-------|----------|
| Solidity helpers & IBiteSupplicant patterns | `rules/solidity-helpers.md` |
| Conditional transactions (CTX) | `rules/conditional-transactions.md` |
| Re-encryption (TE + ECIES) | `rules/re-encryption.md` |
| Confidential poker (end-to-end) | `examples/confidential-poker.md` |

## Resources

- [GitHub: bite-solidity](https://github.com/skalenetwork/bite-solidity)
