const ProvablyFair = require('../utils/provablyFair');

class MinesLogic {
    constructor(bet, minesCount, serverSeed, clientSeed, nonce) {
        this.bet = bet;
        this.minesCount = minesCount;
        this.serverSeed = serverSeed;
        this.clientSeed = clientSeed;
        this.nonce = nonce;
        this.gridSize = 24; // 24 tiles + 1 Cash Out button = 25 components
        this.mines = this.generateMines();
        this.revealed = new Array(this.gridSize).fill(false);
        this.revealedOrder = []; // Track order of reveals
        this.isGameOver = false;
        this.isWon = false;
        this.currentMultiplier = 1.0;
    }

    /**
     * Generate mine positions based on provably fair seeds.
     */
    generateMines() {
        const outcome = ProvablyFair.generateMinesOutcome(this.serverSeed, this.clientSeed, this.nonce, this.gridSize);
        return outcome.slice(0, this.minesCount);
    }

    /**
     * Calculate current multiplier based on revealed safe tiles.
     * Formula: (Total! / (Total - Mines)!) / ((Total - Revealed)! / (Total - Revealed - Mines)!)
     * This is a simplified version of the standard Mines multiplier formula.
     */
    calculateMultiplier(revealedCount) {
        if (revealedCount === 0) return 1.0;
        
        let multiplier = 1.0;
        for (let i = 0; i < revealedCount; i++) {
            multiplier *= (this.gridSize - i) / (this.gridSize - this.minesCount - i);
        }
        
        // 1% house edge
        return Math.floor(multiplier * 0.99 * 100) / 100;
    }

    /**
     * Reveal a tile.
     * @param {number} index - 0 to 24
     * @returns {Object} - Result of the move
     */
    reveal(index) {
        if (this.isGameOver || this.revealed[index]) return { success: false };

        this.revealed[index] = true;
        this.revealedOrder.push(index);

        if (this.mines.includes(index)) {
            this.isGameOver = true;
            this.isWon = false;
            return { success: true, state: 'bust', multiplier: 0 };
        }

        const revealedCount = this.revealed.filter(v => v).length;
        this.currentMultiplier = this.calculateMultiplier(revealedCount);

        // Check if all safe tiles are revealed
        if (revealedCount === this.gridSize - this.minesCount) {
            this.isGameOver = true;
            this.isWon = true;
            return { success: true, state: 'win', multiplier: this.currentMultiplier };
        }

        return { success: true, state: 'safe', multiplier: this.currentMultiplier };
    }

    /**
     * Get the current grid state for rendering.
     * 0: hidden, 1: gem, 2: mine, 3: empty (for the 25th slot)
     */
    getGridState() {
        const grid = Array.from({ length: 5 }, () => new Array(5).fill(0));
        for (let i = 0; i < 25; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;
            
            if (i === 24) {
                grid[row][col] = 3; // The Cash Out slot is always empty in the grid image
                continue;
            }

            if (this.revealed[i]) {
                grid[row][col] = this.mines.includes(i) ? 2 : 1;
            } else if (this.isGameOver) {
                // Show all mines when game is over
                grid[row][col] = this.mines.includes(i) ? 2 : 0;
            }
        }
        return grid;
    }
}

module.exports = MinesLogic;
