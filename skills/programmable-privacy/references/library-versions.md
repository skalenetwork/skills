# Library Versions

## TypeScript SDK

```bash
npm install @skalenetwork/bite@0.8.1
# or
bun add @skalenetwork/bite@0.8.1
```

## Solidity Library

```bash
forge install skalenetwork/bite-solidity@1.0.1-stable.0
echo "@skalenetwork/bite-solidity/=lib/bite-solidity/contracts/" >> remappings.txt
```

### Version Selection

All versions expose the same 3 precompiles (`0x1B`, `0x1C`, `0x1D`) and `IBiteSupplicant` interface. Pick based on your project's Solidity version:

| Import | Solidity | Error Style |
|---|---|---|
| `BITE.sol` | >=0.8.27 | Modern `require` with custom errors, `evm_version = "istanbul"` |
| `LegacyBITE.sol` | >=0.8.5 | Custom errors with `if/revert` |
| `VeryLegacyBITE.sol` | >=0.8.4 | Custom errors with `if/revert` |
| `VeryVeryLegacyBITE.sol` | >=0.8.0 | `LegacyErrors` with string `revert()` |
| `VeryVeryVeryLegacyBITE.sol` | >=0.6.0 | `LegacyErrors` with string `revert()` |
| `VeryVeryVeryVeryLegacyBITE.sol` | >=0.5.0 | String-based errors, `Types.PublicKey` |

```toml
# foundry.toml — recommended (BITE.sol)
[profile.default]
solc_version = "0.8.27"
evm_version = "istanbul"

[dependencies]
bite-solidity = { git = "https://github.com/skalenetwork/bite-solidity", tag = "1.0.1-stable.0" }
```
