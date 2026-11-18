const ProvablyFair = require('../utils/provablyFair');

class CrashLogic {
    constructor(bet, serverSeed, clientSeed, nonce) {
        this.bet = bet;
        this.serverSeed = serverSeed;
        this.clientSeed = clientSeed;
        this.nonce = nonce;
        this.crashPoint = this.calculateCrashPoint();
        this.currentMultiplier = 1.0;
        this.isGameOver = false;
        this.isWon = false;
    }

    /**
     * Calculate the crash point using provably fair hash.
     * Logic: Take first 4 bytes of HMAC hash, convert to uint32,
     * and apply formula to get a multiplier with a 1% house edge.
     */
    calculateCrashPoint() {
        const hash = ProvablyFair.generateOutcomeBuffer(this.serverSeed, this.clientSeed, this.nonce);
        const randomValue = hash.readUInt32BE(0);
        
        // Formula for crash games with 1% house edge:
        // (100 * total - house_edge * total) / (total - random) / 100
        // Simplified: (0.99 * 0xffffffff) / (0xffffffff - randomValue)
        const total = 0xffffffff;
        const houseEdge = 0.01;
        const crashPoint = (total * (1 - houseEdge)) / (total - randomValue);
        
        return Math.max(1.0, Math.floor(crashPoint * 100) / 100);
    }

    /**
     * Update the current multiplier.
     * @param {number} multiplier 
     */
    updateMultiplier(multiplier) {
        if (this.isGameOver) return { state: this.isWon ? 'win' : 'crashed', multiplier: this.currentMultiplier };

        this.currentMultiplier = multiplier;
        if (this.currentMultiplier >= this.crashPoint) {
            this.isGameOver = true;
            this.isWon = false;
            this.currentMultiplier = this.crashPoint;
            return { state: 'crashed', multiplier: this.crashPoint };
        }
        return { state: 'running', multiplier: this.currentMultiplier };
    }

    /**
     * Cash out at the current multiplier.
     */
    cashOut() {
        if (this.isGameOver) return { success: false };
        this.isGameOver = true;
        this.isWon = true;
        return { success: true, multiplier: this.currentMultiplier };
    }
}

module.exports = CrashLogic;
