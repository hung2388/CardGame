const { cryptoShuffle } = require('./utils/crypto-shuffle');

const SUITS = [
  { id: 'spades', symbol: '♠', name: 'Bích', color: 'black' },
  { id: 'clubs', symbol: '♣', name: 'Tép', color: 'black' },
  { id: 'diamonds', symbol: '♦', name: 'Rô', color: 'red' },
  { id: 'hearts', symbol: '♥', name: 'Cơ', color: 'red' }
];

const RANKS = [
  { id: '2', label: '2', value: 2 },
  { id: '3', label: '3', value: 3 },
  { id: '4', label: '4', value: 4 },
  { id: '5', label: '5', value: 5 },
  { id: '6', label: '6', value: 6 },
  { id: '7', label: '7', value: 7 },
  { id: '8', label: '8', value: 8 },
  { id: '9', label: '9', value: 9 },
  { id: '10', label: '10', value: 10 },
  { id: 'J', label: 'J', value: 11 },
  { id: 'Q', label: 'Q', value: 12 },
  { id: 'K', label: 'K', value: 13 },
  { id: 'A', label: 'A', value: 14 } // Can be 1 or 14 depending on game
];

class DeckEngine {
  /**
   * Create a standard 52-card deck or multiple decks
   * @param {number} deckCount Number of 52-card decks (default: 1)
   */
  constructor(deckCount = 1) {
    this.deckCount = deckCount;
    this.cards = [];
    this.dealtHistory = [];
    this.reset();
  }

  /**
   * Reset and generate fresh deck
   */
  reset() {
    this.cards = [];
    this.dealtHistory = [];

    for (let d = 0; d < this.deckCount; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          const cardId = this.deckCount === 1 
            ? `${rank.id}_of_${suit.id}` 
            : `${rank.id}_of_${suit.id}_d${d + 1}`;
          
          this.cards.push({
            id: cardId,
            rank: rank.id,
            rankLabel: rank.label,
            rankValue: rank.value,
            suit: suit.id,
            suitSymbol: suit.symbol,
            suitName: suit.name,
            color: suit.color,
            deckIndex: d
          });
        }
      }
    }
  }

  /**
   * Shuffle remaining cards in deck cryptographically
   */
  shuffle() {
    this.cards = cryptoShuffle(this.cards);
    return this.cards;
  }

  /**
   * Draw N cards from the top of the deck.
   * Modifies the deck by removing the drawn cards.
   * @param {number} count 
   * @returns {Array} Drawn cards
   */
  draw(count = 1) {
    if (count > this.cards.length) {
      count = this.cards.length;
    }
    const drawn = this.cards.splice(0, count);
    this.dealtHistory.push(...drawn);
    return drawn;
  }

  /**
   * Number of remaining cards in deck
   */
  get remainingCount() {
    return this.cards.length;
  }

  /**
   * Verify that no duplicates exist in the current deck or dealt cards
   * @returns {{isValid: boolean, duplicates: string[]}}
   */
  verifyIntegrity() {
    const all = [...this.cards, ...this.dealtHistory];
    const seen = new Set();
    const duplicates = [];

    for (const card of all) {
      if (seen.has(card.id)) {
        duplicates.push(card.id);
      }
      seen.add(card.id);
    }

    const expectedTotal = this.deckCount * 52;
    const isValid = duplicates.length === 0 && all.length === expectedTotal;

    return {
      isValid,
      totalCount: all.length,
      expectedTotal,
      duplicates
    };
  }
}

module.exports = {
  DeckEngine,
  SUITS,
  RANKS
};
