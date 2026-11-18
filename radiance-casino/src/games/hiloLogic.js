const ProvablyFair = require('../utils/provablyFair');

class HiloLogic {
    constructor(bet, serverSeed, clientSeed, nonce) {
        this.bet = bet;
        this.serverSeed = serverSeed;
        this.clientSeed = clientSeed;
        this.nonce = nonce;
        this.currentMultiplier = 1.0;
        this.isGameOver = false;
        this.isWon = false;
        this.cardsHistory = [];
        this.currentCard = this.drawCard(0);
        this.cardsHistory.push(this.currentCard);
        this.step = 0;
    }

    /**
     * Draw a card deterministically using the provably fair seed.
     * @param {number} step - The current step in the game
     */
    drawCard(step) {
        const hash = ProvablyFair.generateOutcomeBuffer(this.serverSeed, this.clientSeed, `${this.nonce}-${step}`);
        const randomValue = hash.readUInt32BE(0);
        const cardIndex = randomValue % 52;
        
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        return {
            value: cardIndex % 13, // 0-12 (A-K)
            suit: Math.floor(cardIndex / 13), // 0-3
            label: values[cardIndex % 13],
            suitLabel: suits[Math.floor(cardIndex / 13)]
        };
    }

    /**
     * Calculate multiplier for the next guess.
     * @param {string} type - 'higher' or 'lower'
     */
    calculateNextMultiplier(type) {
        const currentVal = this.currentCard.value;
        let winChance;

        if (type === 'higher') {
            // Cards higher than current (Ace is 0, King is 12)
            // If card is King (12), higher is only possible if same rank? 
            // Let's use Stake-style HiLo: Higher includes same rank, Lower includes same rank.
            const higherCards = 13 - currentVal; 
            winChance = higherCards / 13;
        } else {
            // Cards lower than current
            const lowerCards = currentVal + 1;
            winChance = lowerCards / 13;
        }

        // House edge 1%
        return (1 / winChance) * 0.99;
    }

    /**
     * Make a guess.
     * @param {string} type - 'higher' or 'lower'
     */
    guess(type) {
        if (this.isGameOver) return { success: false };

        this.step++;
        const nextCard = this.drawCard(this.step);
        const prevCard = this.currentCard;
        
        let win = false;
        if (type === 'higher') {
            win = nextCard.value >= prevCard.value;
        } else {
            win = nextCard.value <= prevCard.value;
        }

        if (win) {
            const multiplier = this.calculateNextMultiplier(type);
            this.currentMultiplier *= multiplier;
            this.currentCard = nextCard;
            this.cardsHistory.push(nextCard);
            return { success: true, state: 'safe', card: nextCard, multiplier: this.currentMultiplier };
        } else {
            this.isGameOver = true;
            this.isWon = false;
            this.currentCard = nextCard;
            this.cardsHistory.push(nextCard);
            return { success: true, state: 'bust', card: nextCard, multiplier: 0 };
        }
    }
}

module.exports = HiloLogic;
