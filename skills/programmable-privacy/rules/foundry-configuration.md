---
title: Foundry Configuration
impact: high
tags: [bite, foundry, solidity, configuration]
---

# Rule: foundry-configuration

## Why It Matters

BITE precompiles require specific Solidity and EVM version settings. Using the wrong compiler version or EVM target will cause compilation errors or runtime failures.

## Compiler Requirements

See `references/solidity-sdk.md` for version selection. Import the BITE library version matching your project's Solidity compiler.

## Recommended foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.27"
evm_version = "istanbul"

[rpc_endpoints]
skale_base_sepolia = "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha"
skale_base = "https://skale-base.skalenodes.com/v1/base"
```

## Incorrect

```toml
# evm_version defaults to "paris" — breaks BITE precompiles
[profile.default]
solc_version = "0.8.27"
# Missing evm_version = "istanbul"
```

## Correct

```toml
[profile.default]
solc_version = "0.8.27"
evm_version = "istanbul"
```

## Library Version Selection

All versions expose the same 3 precompiles (`0x1B`, `0x1C`, `0x1D`) and `IBiteSupplicant` interface. Pick based on your project's Solidity version:

| Import | Solidity | Error Style |
|--------|----------|-------------|
| `BITE.sol` | >=0.8.27 | Modern `require` with custom errors |
| `LegacyBITE.sol` | >=0.8.5 | Custom errors with `if/revert` |
| `VeryLegacyBITE.sol` | >=0.8.4 | Custom errors with `if/revert` |
| `VeryVeryLegacyBITE.sol` | >=0.8.0 | `LegacyErrors` with string `revert()` |
| `VeryVeryVeryLegacyBITE.sol` | >=0.6.0 | `LegacyErrors` with string `revert()` |
| `VeryVeryVeryVeryLegacyBITE.sol` | >=0.5.0 | String-based errors, `Types.PublicKey` |

## Integration Checklist

- [ ] Set `evm_version = "istanbul"` in foundry.toml
- [ ] Match Solidity version to the correct BITE library import
- [ ] Install: `forge install skalenetwork/bite-solidity@1.0.1-stable.0`
- [ ] Add remapping: `echo "@skalenetwork/bite-solidity/=lib/bite-solidity/contracts/" >> remappings.txt`
