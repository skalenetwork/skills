/**
 * MTM Mode - Batch NFT Minting Example
 *
 * This example demonstrates how to use Multi-Transaction Mode (MTM)
 * on SKALE Base chains to mint multiple NFTs in a single batch.
 * MTM allows up to 700 TPS by using incremental nonces per block.
 *
 * Requirements:
 * - SKALE Base chain with MTM enabled
 * - ethers.js v5 or v6
 * - Deployed NFT contract with mint function
 */

const { ethers } = require('ethers');

// Configuration
const CONFIG = {
    // SKALE Base Mainnet
    mainnet: {
        rpc: 'https://skale-base.skalenodes.com/v1/base',
        chainId: 1187947933
    },
    // SKALE Base Sepolia Testnet
    testnet: {
        rpc: 'https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha',
        chainId: 324705682
    }
};

// Simple ERC721 ABI for minting
const NFT_ABI = [
    'function mint(address to, string memory tokenURI) public',
    'function ownerOf(uint256 tokenId) public view returns (address)'
];

/**
 * MTMBatchMinter class for handling high-throughput batch operations
 */
class MTMBatchMinter {
    constructor(privateKey, rpcUrl, contractAddress) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(contractAddress, NFT_ABI, this.wallet);
        this.nonce = null;
    }

    /**
     * Initialize nonce from current transaction count
     * Must be called before starting batch operations
     */
    async initialize() {
        this.nonce = await this.provider.getTransactionCount(this.wallet.address);
        console.log(`Initialized nonce: ${this.nonce}`);
    }

    /**
     * Mint a single NFT with manual nonce incrementation
     * @param {string} recipient - Address to mint the NFT to
     * @param {string} tokenURI - Metadata URI for the NFT
     * @returns {Promise<ethers.ContractTransactionReceipt>}
     */
    async mintNFT(recipient, tokenURI) {
        if (this.nonce === null) {
            throw new Error('Must call initialize() first');
        }

        const currentNonce = this.nonce++;

        try {
            const tx = await this.wallet.sendTransaction({
                to: this.contract.target,
                data: this.contract.interface.encodeFunctionData('mint', [recipient, tokenURI]),
                nonce: currentNonce
            });

            console.log(`Tx sent with nonce ${currentNonce}: ${tx.hash}`);

            // Wait for confirmation (optional, can be disabled for pure fire-and-forget)
            const receipt = await tx.wait();
            console.log(`Tx confirmed: ${receipt.hash}`);
            return receipt;

        } catch (error) {
            // Decrement nonce on failure for potential retry
            this.nonce = currentNonce;
            console.error(`Failed with nonce ${currentNonce}:`, error.message);
            throw error;
        }
    }

    /**
     * Mint multiple NFTs concurrently using MTM
     * @param {Array} recipients - Array of recipient addresses
     * @param {Array} tokenURIs - Array of token URIs (must match recipients length)
     * @param {number} batchSize - Number of concurrent transactions (default: 50)
     * @returns {Promise<Array>} Array of transaction receipts
     */
    async batchMint(recipients, tokenURIs, batchSize = 50) {
        if (recipients.length !== tokenURIs.length) {
            throw new Error('Recipients and tokenURIs arrays must have the same length');
        }

        console.log(`Starting batch mint: ${recipients.length} NFTs`);
        const startTime = Date.now();
        const results = [];

        // Process in batches to avoid overwhelming the network
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batchRecipients = recipients.slice(i, i + batchSize);
            const batchURIs = tokenURIs.slice(i, i + batchSize);

            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recipients.length / batchSize)}`);

            // Fire all transactions in the batch concurrently
            const batchPromises = batchRecipients.map((recipient, idx) =>
                this.mintNFT(recipient, batchURIs[idx]).catch(error => ({ error, recipient }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Optional: Small delay between batches
            if (i + batchSize < recipients.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const duration = Date.now() - startTime;
        const tps = Math.round(recipients.length / (duration / 1000));

        console.log(`Batch complete: ${recipients.length} NFTs in ${duration}ms`);
        console.log(`Throughput: ${tps} TPS`);

        // Report failures
        const failures = results.filter(r => r.error);
        if (failures.length > 0) {
            console.warn(`${failures.length} transactions failed`);
        }

        return results;
    }

    /**
     * Fire-and-forget minting mode for maximum throughput
     * Does not wait for transaction confirmations
     * @param {Array} recipients - Array of recipient addresses
     * @param {Array} tokenURIs - Array of token URIs
     * @returns {Promise<Array>} Array of transaction hashes
     */
    async fireAndForgetMint(recipients, tokenURIs) {
        const txHashes = [];

        for (let i = 0; i < recipients.length; i++) {
            const currentNonce = this.nonce++;

            try {
                const tx = await this.wallet.sendTransaction({
                    to: this.contract.target,
                    data: this.contract.interface.encodeFunctionData('mint', [recipients[i], tokenURIs[i]]),
                    nonce: currentNonce
                });

                txHashes.push(tx.hash);
                console.log(`Sent ${i + 1}/${recipients.length}: ${tx.hash}`);

            } catch (error) {
                this.nonce = currentNonce;
                console.error(`Failed at ${i + 1}:`, error.message);
                throw error;
            }
        }

        return txHashes;
    }
}

/**
 * Usage Example
 */
async function main() {
    // Configuration
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const CONTRACT_ADDRESS = '0x...'; // Your deployed NFT contract
    const NETWORK = 'testnet'; // or 'mainnet'

    // Example: Mint 100 NFTs to 100 different addresses
    const recipients = Array(100).fill(null).map((_, i) =>
        ethers.Wallet.createRandom().address
    );

    const tokenURIs = recipients.map((_, i) =>
        `ipfs://QmExample/${i}.json`
    );

    // Initialize minter
    const minter = new MTMBatchMinter(
        PRIVATE_KEY,
        CONFIG[NETWORK].rpc,
        CONTRACT_ADDRESS
    );

    await minter.initialize();

    // Execute batch mint with MTM
    const results = await minter.batchMint(recipients, tokenURIs, 50);

    console.log('Batch minting complete!');
    console.log(`Success: ${results.filter(r => !r.error).length}`);
    console.log(`Failed: ${results.filter(r => r.error).length}`);
}

/**
 * Performance Testing
 * Run this to test the throughput of your setup
 */
async function performanceTest() {
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const CONTRACT_ADDRESS = '0x...';
    const NETWORK = 'testnet';

    const minter = new MTMBatchMinter(
        PRIVATE_KEY,
        CONFIG[NETWORK].rpc,
        CONTRACT_ADDRESS
    );

    await minter.initialize();

    // Test different batch sizes
    const testCases = [10, 50, 100, 200];

    for (const size of testCases) {
        const recipients = Array(size).fill(null).map(() =>
            ethers.Wallet.createRandom().address
        );
        const tokenURIs = recipients.map((_, i) => `ipfs://test/${i}.json`);

        console.log(`\n=== Testing batch size: ${size} ===`);
        const startTime = Date.now();

        await minter.batchMint(recipients, tokenURIs, size);

        const duration = Date.now() - startTime;
        const tps = Math.round(size / (duration / 1000));
        console.log(`Result: ${tps} TPS`);
    }
}

// Export for use as module
module.exports = { MTMBatchMinter, CONFIG };

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
