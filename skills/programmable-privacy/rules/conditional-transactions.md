---
title: Conditional Transactions (CTX)
impact: high
tags: [bite, ctx, conditional-transactions]
---

# Rule: conditional-transactions

## Why It Matters

CTX (Conditional Transactions) enables transactions that execute based on encrypted conditions. Perfect for Rock-Paper-Scissors, sealed-bid auctions, voting, and multi-party games where all parties must commit before revealing.

## Available Chains

| Chain | Chain ID | CTX Support |
|-------|----------|-------------|
| SKALE Base | 1187947933 | ✅ Beta |
| SKALE Base Sepolia | 324705682 | ✅ Beta |

## Key Constants

```solidity
address constant BITE_SUBMIT_CTX = 0x000000000000000000000000000000000000001B;
uint256 constant CTX_GAS_LIMIT = 2_500_000;
uint256 constant CTX_GAS_PAYMENT = 0.06 ether;
```

## Compiler Requirements

See `references/solidity-sdk.md` for version selection. Import the BITE library version matching your project's Solidity compiler.

## Incorrect

```solidity
pragma solidity ^0.8.24;  // Import LegacyBITE.sol instead — BITE.sol requires >=0.8.27

contract MyCTX {
    function submit(bytes calldata data) external {
        // Missing onDecrypt callback — won't receive decrypted data
    }
}
```

```solidity
// Raw low-level call — use BITE.submitCTX() instead
(bool success, ) = BITE.SUBMIT_CTX_ADDRESS.call{ value: msg.value }(
    abi.encodeWithSelector(BITE.submitCTX.selector, address(this), data)
);
```

## Correct: Basic CTX Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";

contract SimpleSecret is IBiteSupplicant {
    bytes public pendingSecret;
    address public secretOwner;

    event SecretRevealed(address indexed owner, string secret);

    function submitSecret(bytes calldata encryptedData) external payable {
        require(msg.value >= 0.06 ether, "Insufficient CTX payment");

        pendingSecret = encryptedData;
        secretOwner = msg.sender;

        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = encryptedData;

        address payable callbackSender = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedArgs,
            new bytes[](0)
        );
        callbackSender.transfer(msg.value);
    }

    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");

        string memory secret = abi.decode(decryptedArguments[0], (string));
        emit SecretRevealed(secretOwner, secret);

        pendingSecret = "";
        secretOwner = address(0);
    }
}
```

## Correct: Rock-Paper-Scissors

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";

contract RockPaperScissors is IBiteSupplicant {
    enum Move { None, Rock, Paper, Scissors }
    enum GameStatus { Waiting, BothCommitted, Resolved }

    struct Game {
        address player1;
        address player2;
        bytes encryptedMove1;
        bytes encryptedMove2;
        Move move1;
        Move move2;
        GameStatus status;
        address winner;
    }

    mapping(uint256 => Game) public games;
    uint256 public gameCount;

    event GameCreated(uint256 indexed gameId, address player1);
    event GameResolved(uint256 indexed gameId, address winner, Move move1, Move move2);

    function createGame(bytes calldata encryptedMove) external payable {
        require(msg.value >= 0.06 ether, "CTX payment required");

        uint256 gameId = ++gameCount;
        Game storage game = games[gameId];
        game.player1 = msg.sender;
        game.encryptedMove1 = encryptedMove;

        emit GameCreated(gameId, msg.sender);
    }

    function joinGame(uint256 gameId, bytes calldata encryptedMove) external payable {
        require(msg.value >= 0.06 ether, "CTX payment required");
        Game storage game = games[gameId];
        require(game.status == GameStatus.Waiting, "Game not available");

        game.player2 = msg.sender;
        game.encryptedMove2 = encryptedMove;
        game.status = GameStatus.BothCommitted;

        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = abi.encode(
            gameId, game.encryptedMove1, game.encryptedMove2
        );

        address payable callbackSender = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            msg.value / tx.gasprice,
            encryptedArgs,
            new bytes[](0)
        );
        callbackSender.transfer(msg.value);
    }

    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(msg.sender == BITE.SUBMIT_CTX_ADDRESS, "Only BITE");

        (uint256 gameId, Move p1Move, Move p2Move) = abi.decode(
            decryptedArguments[0],
            (uint256, Move, Move)
        );

        Game storage game = games[gameId];
        game.move1 = p1Move;
        game.move2 = p2Move;
        game.winner = _determineWinner(game.player1, game.player2, p1Move, p2Move);
        game.status = GameStatus.Resolved;

        emit GameResolved(gameId, game.winner, p1Move, p2Move);
    }

    function _determineWinner(
        address p1, address p2, Move m1, Move m2
    ) internal pure returns (address) {
        if (m1 == m2) return address(0);
        if ((m1 == Move.Rock && m2 == Move.Scissors) ||
            (m1 == Move.Paper && m2 == Move.Rock) ||
            (m1 == Move.Scissors && m2 == Move.Paper)) {
            return p1;
        }
        return p2;
    }
}
```

## CTX Flow

```
1. User encrypts data locally
       │
       └───> submitSecret(encryptedData) + 0.06 ETH
              │
2. Trigger decryption
       │
       └───> BITE.submitCTX() — library helper handles precompile call
              │    → Returns callbackSender address
              │    → callbackSender.transfer(gasPayment)
              │
3. Consensus decrypts (2t+1 nodes)
       │
       └───> onDecrypt() callback
              │
              └───> Execute logic with revealed data
```

## Payment Requirements

| Item | Value |
|------|-------|
| CTX Gas Limit | 2,500,000 |
| CTX Payment | 0.06 ETH/SFUEL per CTX |

## Integration Checklist

- [ ] Import the BITE library version matching your Solidity compiler
- [ ] Implement `IBiteSupplicant.onDecrypt()`
- [ ] Use `BITE.submitCTX()` (not raw `.call{value:}`)
- [ ] Transfer payment to returned `callbackSender` address
- [ ] Verify `msg.sender == BITE.SUBMIT_CTX_ADDRESS` in `onDecrypt`
- [ ] Test on SKALE Base Sepolia (Chain ID: 324705682)

## Resources

- **Full RPS Demo**: `github.com/TheGreatAxios/ctxs` (thegreataxios/rps branch)
- **Foundry Starter**: `github.com/thegreataxios/skale-ctxs-foundry-starter`
