# TypeScript SDK Reference

## Setup

```bash
npm install @skalenetwork/bite@0.8.1
# or
bun add @skalenetwork/bite@0.8.1
```

```typescript
import { BITE } from '@skalenetwork/bite';
const bite = new BITE('https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha');
```

## Method Summary

| Method | Feature | Description |
|--------|---------|-------------|
| `encryptTransaction(tx)` | Encrypted Transactions | Encrypt tx `to` + `data` |
| `getDecryptedTransactionData(hash)` | Encrypted Transactions | Retrieve decrypted tx data (optional) |
| `encryptMessage(data)` | Re-encryption | TE encrypt arbitrary data |
| `encryptMessageForCTX(data, submitter)` | CTX | TE encrypt with AAD for CTX |

## Examples & Patterns

| Topic | Location |
|-------|----------|
| Encrypted transactions (ethers.js) | `rules/encrypted-transactions-ethers.md` |
| Encrypted transactions (viem) | `rules/encrypted-transactions-viem.md` |
| SDK usage (full examples) | `rules/sdk-usage.md` |
| Encrypted transaction flows | `examples/encrypted-transactions.md` |

## Resources

- [npm: @skalenetwork/bite@0.8.1](https://www.npmjs.com/package/@skalenetwork/bite)
- [GitHub: bite-ts](https://github.com/skalenetwork/bite-ts)
