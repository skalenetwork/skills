# Confidential Poker — CTX + Re-encryption Combined

A Texas Hold'em poker game where each player's hole cards are encrypted with two layers: threshold encryption (TE) for fair showdown, and ECIES encryption so only the card holder can view their own hand.

## Architecture

```
Deal:
  encryptTE(deck)                    → stored for showdown (consensus decrypts)
  encryptTE(playerHoleCards)         → stored for showdown
  encryptECIES(playerHoleCards, viewerKey) → stored for player viewing

Player views cards:
  getMyEncryptedCards()              → ECIES ciphertext
  decrypt offline with private key   → plaintext cards

Showdown:
  SubmitCTX(teEncryptedHoleCards)    → consensus decrypts
    → onDecrypt(revealedCards)
      → evaluate hands, award pot
```

## Key Insight

Two encryption layers serve different purposes:

| Layer | Who Decrypts | When | Why |
|-------|-------------|------|-----|
| TE (EncryptTE `0x1D`) | Consensus (2t+1 nodes) | Showdown via CTX | Fair game — no single party controls reveal |
| ECIES (EncryptECIES `0x1C`) | Card holder's private key | Anytime, client-side | Player can see their own hand privately |

## Contract Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";

struct Player {
    PublicKey viewerKey;
    bytes teEncryptedHoleCards;   // for showdown
    bytes eciesEncryptedHoleCards; // for client-side viewing
    uint8[2] holeCards;            // plaintext only during onDecrypt
    bool cardsRevealed;
}

contract PokerTable is IBiteSupplicant {
    mapping(uint256 => Player) public players;
    bytes public teEncryptedDeck;
    uint256 public playerCount;

    /// @notice Player joins with their ECIES viewer key
    function sitDown(PublicKey calldata viewerKey) external {
        uint256 playerId = playerCount++;
        players[playerId].viewerKey = viewerKey;
    }

    /// @notice Deal cards — dual encrypt each player's hand
    function dealCards(
        uint8[2][] calldata hands,
        uint8[] calldata deck
    ) external {
        // TE-encrypt the full deck (stored for community card dealing)
        teEncryptedDeck = BITE.encryptTE(
            0x000000000000000000000000000000000000001D,
            abi.encode(deck)
        );

        for (uint256 i = 0; i < hands.length; i++) {
            // Layer 1: TE — for showdown, only consensus can decrypt
            bytes memory teCards = BITE.encryptTE(
                0x000000000000000000000000000000000000001D,
                abi.encode(hands[i][0], hands[i][1])
            );
            require(teCards.length > 0, "TE encrypt failed");

            // Layer 2: ECIES — for this player's eyes only
            bytes memory eciesCards = BITE.encryptECIES(
                0x000000000000000000000000000000000000001C,
                abi.encode(hands[i][0], hands[i][1]),
                players[i].viewerKey
            );
            require(eciesCards.length > 0, "ECIES encrypt failed");

            players[i].teEncryptedHoleCards = teCards;
            players[i].eciesEncryptedHoleCards = eciesCards;
        }
    }

    /// @notice Player retrieves their ECIES-encrypted cards for client-side decryption
    function getMyEncryptedCards(uint256 playerId) external view returns (bytes memory) {
        return players[playerId].eciesEncryptedHoleCards;
    }

    /// @notice Showdown — submit TE-encrypted cards for consensus decryption
    function showdown() external payable {
        require(msg.value >= 0.06 ether, "CTX payment");

        uint256 activeCount = 0;
        for (uint256 i = 0; i < playerCount; i++) {
            if (players[i].teEncryptedHoleCards.length > 0) activeCount++;
        }

        bytes[] memory encryptedArgs = new bytes[](activeCount);
        bytes[] memory plaintextArgs = new bytes[](activeCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < playerCount; i++) {
            if (players[i].teEncryptedHoleCards.length > 0) {
                encryptedArgs[idx] = players[i].teEncryptedHoleCards;
                plaintextArgs[idx] = abi.encode(i); // player index unencrypted
                idx++;
            }
        }

        BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedArgs,
            plaintextArgs
        );
    }

    /// @notice BITE calls this after threshold decryption
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");

        for (uint256 i = 0; i < decryptedArguments.length; i++) {
            uint256 playerId = abi.decode(plaintextArguments[i], (uint256));
            (uint8 card1, uint8 card2) = abi.decode(
                decryptedArguments[i], (uint8, uint8)
            );

            players[playerId].holeCards = [card1, card2];
            players[playerId].cardsRevealed = true;
        }

        // Evaluate hands and distribute pot
        _evaluateAndDistribute();
    }

    function _evaluateAndDistribute() internal {
        // ... hand evaluation logic ...
    }
}
```

## Client-Side Card Viewing (TypeScript)

```typescript
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

async function decryptMyCards(
    privateKey: `0x${string}`,
    eciesCiphertext: `0x${string}`
): Promise<[number, number]> {
    const payload = hexToBytes(eciesCiphertext);
    const iv = payload.slice(0, 16);
    const ephemeralPubKey = payload.slice(16, 49);
    const ciphertext = payload.slice(49);

    // ECDH → shared secret → AES key
    const sharedSecret = secp256k1
        .getSharedSecret(hexToBytes(privateKey), ephemeralPubKey, true)
        .slice(1);
    const aesKey = sha256(sharedSecret);

    // AES-256-CBC decrypt
    const cryptoKey = await crypto.subtle.importKey(
        'raw', aesKey, { name: 'AES-CBC' }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv }, cryptoKey, ciphertext
    );

    const [card1, card2] = decodeAbiParameters(
        [{ type: "uint8" }, { type: "uint8" }],
        bytesToHex(new Uint8Array(decrypted))
    );
    return [Number(card1), Number(card2)];
}
```

## Privacy Guarantees

- No plaintext cards stored onchain (only inside `onDecrypt` callback)
- TE layer ensures fair showdown — no single party controls decryption
- ECIES layer lets each player view only their own cards
- After showdown, `_resetState()` zeroes all card data

## Resources

- **Full project**: `github.com/thegreataxios/confidential-poker`
- **BITE-solidity**: `github.com/skalenetwork/bite-solidity`
