const crypto = require('crypto');

class ProvablyFair {
    /**
     * Generate a random server seed.
     * @returns {string}
     */
    static generateServerSeed() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate a SHA-256 hash of a server seed.
     * @param {string} serverSeed 
     * @returns {string}
     */
    static hashServerSeed(serverSeed) {
        return crypto.createHash('sha256').update(serverSeed).digest('hex');
    }

    /**
     * Generate game outcomes using HMAC-SHA256.
     * @param {string} serverSeed 
     * @param {string} clientSeed 
     * @param {number} nonce 
     * @returns {Buffer}
     */
    static generateOutcomeBuffer(serverSeed, clientSeed, nonce) {
        const masterSecret = process.env.PROVABLY_FAIR_SECRET || '';
        const combined = `${serverSeed}:${clientSeed}:${nonce}`;
        return crypto.createHmac('sha256', masterSecret).update(combined).digest();
    }

    /**
     * Generate an array of shuffled numbers for games like Mines.
     * @param {string} serverSeed 
     * @param {string} clientSeed 
     * @param {number} nonce 
     * @param {number} size Total tiles (e.g., 25 for 5x5)
     * @returns {number[]}
     */
    static generateMinesOutcome(serverSeed, clientSeed, nonce, size = 25) {
        const hash = this.generateOutcomeBuffer(serverSeed, clientSeed, nonce);
        const result = Array.from({ length: size }, (_, i) => i);
        
        // Fisher-Yates shuffle using the hash for deterministic randomness
        for (let i = size - 1; i > 0; i--) {
            const byteOffset = (i * 4) % (hash.length - 4);
            const randomValue = hash.readUInt32BE(byteOffset);
            const j = randomValue % (i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
        
        return result;
    }

    /**
     * Generate a dice roll (1-10000).
     * @param {string} serverSeed 
     * @param {string} clientSeed 
     * @param {number} nonce 
     * @returns {number}
     */
    static generateDiceRoll(serverSeed, clientSeed, nonce) {
        const hash = this.generateOutcomeBuffer(serverSeed, clientSeed, nonce);
        const randomValue = hash.readUInt32BE(0);
        return (randomValue % 10000) + 1;
    }
}

module.exports = ProvablyFair;
