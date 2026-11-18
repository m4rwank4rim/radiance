const ProvablyFair = require('../utils/provablyFair');

class TowerLogic {
    constructor(bet, serverSeed, clientSeed, nonce) {
        this.bet = bet;
        this.serverSeed = serverSeed;
        this.clientSeed = clientSeed;
        this.nonce = nonce;
        this.totalLevels = 8; // Matching the UI rows
        this.pathsPerLevel = 3;
        this.currentLevel = 0;
        this.isGameOver = false;
        this.isWon = false;
        this.currentMultiplier = 1.0;
        this.levelOutcomes = this.generateOutcomes();
        this.multipliers = this.generateMultipliers();
        this.pathHistory = []; // Track paths chosen
    }

    /**
     * Generate multipliers for each level.
     */
    generateMultipliers() {
        const multipliers = [];
        for (let i = 1; i <= this.totalLevels; i++) {
            multipliers.push(this.calculateMultiplier(i));
        }
        return multipliers;
    }

    /**
     * Generate outcomes for each level using the provably fair seed.
     */
    generateOutcomes() {
        const hash = ProvablyFair.generateOutcomeBuffer(this.serverSeed, this.clientSeed, this.nonce);
        const outcomes = [];
        for (let i = 0; i < this.totalLevels; i++) {
            // For each level, determine which path is the bust (0, 1, or 2)
            const byte = hash[i % hash.length];
            outcomes.push(byte % this.pathsPerLevel);
        }
        return outcomes;
    }

    /**
     * Calculate multiplier for the current level.
     * Each level multiplies by (Paths / SafePaths) * HouseEdge
     */
    calculateMultiplier(level) {
        if (level === 0) return 1.0;
        
        const safePaths = this.pathsPerLevel - 1;
        let multiplier = 1.0;
        for (let i = 0; i < level; i++) {
            multiplier *= (this.pathsPerLevel / safePaths);
        }
        
        // 1% house edge
        return Math.floor(multiplier * 0.99 * 100) / 100;
    }

    /**
     * Make a move on the current level.
     * @param {number} pathIndex - 0, 1, or 2
     * @returns {Object}
     */
    move(pathIndex) {
        if (this.isGameOver || this.currentLevel >= this.totalLevels) return { success: false };

        this.pathHistory[this.currentLevel] = pathIndex;
        const bustPath = this.levelOutcomes[this.currentLevel];
        
        if (pathIndex === bustPath) {
            this.isGameOver = true;
            this.isWon = false;
            return { success: true, state: 'bust', multiplier: 0 };
        }

        this.currentLevel += 1;
        this.currentMultiplier = this.calculateMultiplier(this.currentLevel);

        if (this.currentLevel === this.totalLevels) {
            this.isGameOver = true;
            this.isWon = true;
            return { success: true, state: 'win', multiplier: this.currentMultiplier };
        }

        return { success: true, state: 'safe', multiplier: this.currentMultiplier };
    }
}

module.exports = TowerLogic;
