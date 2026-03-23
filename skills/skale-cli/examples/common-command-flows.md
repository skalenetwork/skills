# Common Command Flows

## Read Contract Method
 
**Possible `<chain>` values:**
`calypso`, `europa`, `nebula`, `skale-base`, `calypso-testnet`, `europa-testnet`, `nebula-testnet`, `skale-base-sepolia`
 
**Possible `<network>` values:**
`mainnet`, `sepolia`
 
```bash
skale read <contract> <method> [params...] --chain <chain>
skale read <contract> <method> [params...] --network <network>
```
  
## Whitelist Check
 
**Possible `<chain>` values:**
`calypso`, `europa`, `nebula`

```bash
skale access <address> --chain <chain>
```
  
## Manager Status
 
**Possible `<chain>` values:**
`calypso`, `europa`, `nebula`
 
```bash
skale manager version --chain <chain>
skale manager mtm-status --chain <chain>
skale manager fcd-status --chain <chain>
```
  
## IMA Queries
 
**Possible `<chain>` values:**
`calypso`, `europa`, `nebula`, `skale-base`
 
**Possible `<network>` values:**
`mainnet`, `sepolia`
 
```bash
skale ima chain-id --chain <chain>
skale ima connected-chains --chain <chain>
skale ima chain-id --network <network>
skale ima connected-chains --network <network>
```

## SKL Token Queries
 
**Possible `<network>` values:**
`mainnet`
 
```bash
skale token info --network mainnet
skale token balance <address> --network mainnet
```

 
### Wallet Operations
 
**Possible `<chain>` values:**
`calypso`, `europa`, `nebula`, `skale-base`, `calypso-testnet`, `europa-testnet`, `nebula-testnet`, `skale-base-sepolia`
 
**Possible `<network>` values:**
`mainnet`, `sepolia`

```bash
skale wallet balance <address> --chain <chain>
skale wallet balance <address> --network <network>
```
