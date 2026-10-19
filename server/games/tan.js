/**
 * AUTHORITATIVE ĐÁNH TẤN (DURAK VARIANT) GAME ENGINE
 * 
 * Rules:
 * 1. 52 cards + 2 Jokers (Black & Red).
 * 2. 8 cards per player.
 * 3. Draw 1 card to select Trump Suit (Chất Trưởng). Trump card placed face-up at bottom of deck.
 * 4. Rank hierarchy: 2 < 3 < ... < K < A < Joker Đen < Joker Đỏ.
 *    Any Trump card > Any Non-Trump card.
 * 5. Attack & Defend:
 *    - Attacker attacks with 1 card (or multiple of same rank).
 *    - Defender must defend against each attack card with:
 *      * Higher card of same suit, OR
 *      * Trump card (if attack is non-trump), OR
 *      * Joker.
 *    - Pile-on (Bồi công): Other players can add cards of ranks already on table, up to Defender's hand count.
 * 6. Outcomes:
 *    - Defended successfully: Table cards discarded. Defender becomes next Attacker.
 *    - Pick up (Lên bài): Defender takes all table cards into hand. Loses attack turn.
 * 7. Draw cards: Players refill hand to 8 cards from deck (Attacker first, then others, then Defender).
 *    Last card in deck is the face-up Trump card.
 * 8. Special rule: Leaving Joker as last card -> Lose.
 */

const TAN_RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  'joker_black': 15,
  'joker_red': 16
};

class TanGame {
  constructor(room) {
    this.room = room;
    this.status = 'idle'; // idle, attacking, defending, finished
    this.trumpSuit = null;
    this.trumpCard = null;
    
    this.attackerSeat = null;
    this.defenderSeat = null;
    
    // Array of attack/defense pairs on table: [ { attackCard, defendCard: null | card } ]
    this.tablePairs = [];
    this.passedSeats = new Set();
    this.roundResults = null;
  }

  /**
   * Determine if cardA can defend cardB
   * @param {object} defendCard 
   * @param {object} attackCard 
   * @returns {boolean}
   */
  canDefend(defendCard, attackCard) {
    if (!defendCard || !attackCard) return false;

    // Jokers
    if (defendCard.rank === 'joker_red') return true; // Joker red defends everything
    if (defendCard.rank === 'joker_black') {
      return attackCard.rank !== 'joker_red'; // Joker black defends everything except Joker red
    }
    if (attackCard.rank === 'joker_red' || attackCard.rank === 'joker_black') {
      return false; // Non-joker cannot defend Joker
    }

    const isDefendTrump = defendCard.suit === this.trumpSuit;
    const isAttackTrump = attackCard.suit === this.trumpSuit;

    // Trump vs Non-Trump
    if (isDefendTrump && !isAttackTrump) return true;
    if (!isDefendTrump && isAttackTrump) return false;

    // Same suit -> higher rank wins
    if (defendCard.suit === attackCard.suit) {
      return (TAN_RANKS[defendCard.rank] || 0) > (TAN_RANKS[attackCard.rank] || 0);
    }

    return false;
  }

  /**
   * Start Tấn Round:
   * Sets up 54 cards (52 + 2 Jokers), deals 8 cards, reveals Trump card
   */
  startRound(onComplete) {
    this.status = 'attacking';
    this.tablePairs = [];
    this.passedSeats.clear();
    this.roundResults = null;

    // Add Jokers for each deck if not present (2 Jokers per 52-card deck)
    const hasJokers = this.room.deckEngine.cards.some(c => c.rank.startsWith('joker'));
    if (!hasJokers) {
      const decks = this.room.deckEngine.deckCount || 1;
      for (let d = 0; d < decks; d++) {
        const sfx = decks > 1 ? `_d${d + 1}` : '';
        this.room.deckEngine.cards.push(
          { id: `joker_black${sfx}`, rank: 'joker_black', rankLabel: 'JB', suit: 'joker', color: 'black' },
          { id: `joker_red${sfx}`, rank: 'joker_red', rankLabel: 'JR', suit: 'joker', color: 'red' }
        );
      }
      this.room.deckEngine.shuffle();
    }

    // Determine Trump card (draw 1 from deck, place at bottom)
    const trump = this.room.deckEngine.draw(1)[0];
    this.trumpCard = trump;
    this.trumpSuit = trump.suit === 'joker' ? 'hearts' : trump.suit; // fallback hearts if joker revealed
    // Put trump card back at bottom of deck
    this.room.deckEngine.cards.push(trump);

    // Attacker is starter seat, Defender is next seat in clockwise direction
    this.attackerSeat = this.room.starterSeat || this.room.playerManager.getAllPlayers()[0].seat;
    this.defenderSeat = this.getNextSeat(this.attackerSeat);
    this.room.currentTurnSeat = this.attackerSeat;

    console.log(`[Đánh Tấn Started] Trump: ${this.trumpSuit} (${this.trumpCard.rank}${this.trumpCard.suitSymbol || ''}) | Attacker: #${this.attackerSeat} | Defender: #${this.defenderSeat}`);

    if (typeof onComplete === 'function') {
      onComplete({
        trumpSuit: this.trumpSuit,
        trumpCard: this.trumpCard,
        attackerSeat: this.attackerSeat,
        defenderSeat: this.defenderSeat
      });
    }
  }

  getNextSeat(seat) {
    const players = this.room.playerManager.getAllPlayers();
    const seats = players.map(p => p.seat);
    const idx = seats.indexOf(seat);
    return seats[(idx + 1) % seats.length];
  }

  /**
   * Attacker or Pile-on player plays attack card
   */
  attack(socketId, cardIds) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player) return { success: false, error: 'Không tìm thấy người chơi!' };
    if (player.seat === this.defenderSeat) return { success: false, error: 'Người phòng thủ không thể tấn công chính mình!' };

    const defender = this.room.playerManager.getPlayerBySeat(this.defenderSeat);
    if (!defender) return { success: false, error: 'Không tìm thấy người phòng thủ!' };

    // Cards must belong to player
    const cards = player.hand.filter(c => cardIds.includes(c.id));
    if (cards.length !== cardIds.length) return { success: false, error: 'Lá bài không hợp lệ!' };

    // Maximum attack cards cannot exceed defender's hand count
    const unDefendedCount = this.tablePairs.filter(p => !p.defendCard).length;
    if (unDefendedCount + cards.length > defender.hand.length) {
      return { success: false, error: `Số lượng bài tấn công không được vượt quá số lá của người thủ (${defender.hand.length} lá)!` };
    }

    // If first attack of trick: cards must all have the same rank
    if (this.tablePairs.length === 0) {
      if (player.seat !== this.attackerSeat) return { success: false, error: 'Chỉ người tấn công chính mới được đi đầu!' };
      const firstRank = cards[0].rank;
      if (!cards.every(c => c.rank === firstRank)) {
        return { success: false, error: 'Các lá bài tấn công lượt đầu phải cùng một số!' };
      }
    } else {
      // Pile-on: cards played must match ranks already present on table
      const tableRanks = new Set();
      this.tablePairs.forEach(p => {
        tableRanks.add(p.attackCard.rank);
        if (p.defendCard) tableRanks.add(p.defendCard.rank);
      });

      if (!cards.every(c => tableRanks.has(c.rank))) {
        return { success: false, error: 'Chỉ được bồi công các lá có số đã xuất hiện trên bàn!' };
      }
    }

    // Remove cards from player hand
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));

    // Add to table pairs
    cards.forEach(c => {
      this.tablePairs.push({
        attackCard: c,
        defendCard: null,
        attackerSeat: player.seat
      });
    });

    this.passedSeats.clear(); // Reset passes
    this.status = 'defending';
    this.room.currentTurnSeat = this.defenderSeat; // Pass turn to defender

    this.checkGameWin();
    return { success: true, tablePairs: this.tablePairs, attackCards: cards };
  }

  /**
   * Defender defends against an attack card
   * @param {string} socketId 
   * @param {string} defendCardId 
   * @param {string} attackCardId 
   */
  defend(socketId, defendCardId, attackCardId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player || player.seat !== this.defenderSeat) {
      return { success: false, error: 'Chỉ người phòng thủ mới có thể đỡ bài!' };
    }

    const defendCard = player.hand.find(c => c.id === defendCardId);
    if (!defendCard) return { success: false, error: 'Lá bài không có trong tay bạn!' };

    // Auto-resolve undefended attack card
    let pair = null;
    if (attackCardId) {
      pair = this.tablePairs.find(p => p.attackCard.id === attackCardId && !p.defendCard);
    }
    // If attackCardId wasn't provided or didn't match, auto-find the first undefended card that defendCard CAN legally beat!
    if (!pair) {
      pair = this.tablePairs.find(p => !p.defendCard && this.canDefend(defendCard, p.attackCard));
    }
    // If still not found, check if there are any undefended cards at all
    if (!pair) {
      const anyUndefended = this.tablePairs.some(p => !p.defendCard);
      if (!anyUndefended) {
        return { success: false, error: 'Tất cả các lá tấn công trên bàn đã được đỡ!' };
      }
      return { success: false, error: 'Lá bài này không đủ sức đỡ bất kỳ lá tấn công nào trên bàn!' };
    }

    if (!this.canDefend(defendCard, pair.attackCard)) {
      return { success: false, error: 'Lá bài này không đủ sức đỡ lá tấn công!' };
    }

    // Remove from defender hand
    player.hand = player.hand.filter(c => c.id !== defendCardId);
    pair.defendCard = defendCard;

    // Check if all attack cards are defended
    const allDefended = this.tablePairs.every(p => p.defendCard !== null);
    if (allDefended) {
      // Turn goes back to attacker for more pile-on or pass
      this.room.currentTurnSeat = this.attackerSeat;
      this.status = 'attacking';
    }

    this.checkGameWin();
    return { success: true, tablePairs: this.tablePairs, allDefended, pair, defendCard };
  }

  /**
   * Defender decides to pick up (Lên bài / Ăn bài)
   */
  pickUp(socketId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player || player.seat !== this.defenderSeat) {
      return { success: false, error: 'Chỉ người phòng thủ mới có thể lên bài!' };
    }

    // Take all attack and defend cards on table into defender's hand
    const allTableCards = [];
    this.tablePairs.forEach(p => {
      allTableCards.push(p.attackCard);
      if (p.defendCard) allTableCards.push(p.defendCard);
    });

    player.hand.push(...allTableCards);
    this.tablePairs = [];

    // Refill hands for all players except defender (who just picked up)
    this.refillHands();

    // Defender loses attack turn. Next player clockwise becomes Attacker!
    this.attackerSeat = this.getNextSeat(this.defenderSeat);
    this.defenderSeat = this.getNextSeat(this.attackerSeat);
    this.room.currentTurnSeat = this.attackerSeat;
    this.status = 'attacking';

    this.checkGameWin();
    return { success: true, pickedUpCardsCount: allTableCards.length };
  }

  /**
   * Attackers pass / done with attack ("Đỡ xong")
   */
  passAttack(socketId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player) return { success: false, error: 'Người chơi không hợp lệ!' };

    this.passedSeats.add(player.seat);

    // If all attack cards are defended and all attackers passed -> Successful Defense!
    const allDefended = this.tablePairs.length > 0 && this.tablePairs.every(p => p.defendCard !== null);
    const nonDefenders = this.room.playerManager.getAllPlayers().filter(p => p.seat !== this.defenderSeat && p.hand.length > 0);

    if (allDefended && this.passedSeats.size >= nonDefenders.length) {
      // Clear table (cards to dead pile)
      this.tablePairs = [];
      this.passedSeats.clear();

      // Refill hands
      this.refillHands();

      // Successful defender becomes the NEW attacker!
      this.attackerSeat = this.defenderSeat;
      this.defenderSeat = this.getNextSeat(this.attackerSeat);
      this.room.currentTurnSeat = this.attackerSeat;
      this.status = 'attacking';

      this.checkGameWin();
      return { success: true, defenseSuccess: true };
    }

    return { success: true, defenseSuccess: false };
  }

  /**
   * Refill all players' hands to 8 cards from deck
   */
  refillHands() {
    const players = this.room.playerManager.getAllPlayers();
    // Order: Attacker first, then others, then Defender
    const order = [this.attackerSeat];
    let cur = this.getNextSeat(this.attackerSeat);
    while (cur !== this.attackerSeat) {
      order.push(cur);
      cur = this.getNextSeat(cur);
    }

    for (const seat of order) {
      const p = this.room.playerManager.getPlayerBySeat(seat);
      if (p && p.hand.length < 8 && this.room.deckEngine.remainingCount > 0) {
        const needed = 8 - p.hand.length;
        const drawn = this.room.deckEngine.draw(needed);
        p.hand.push(...drawn);
      }
    }
  }

  checkGameWin() {
    const playersWithCards = this.room.playerManager.getAllPlayers().filter(p => p.hand.length > 0);
    if (this.room.deckEngine.remainingCount === 0 && playersWithCards.length <= 1) {
      // Game ended!
      this.status = 'finished';
      this.room.status = 'round_end';
      const loser = playersWithCards[0] || null;
      const winner = this.room.playerManager.getAllPlayers().find(p => p.seat !== (loser?.seat));

      this.roundResults = {
        winnerSeat: winner ? winner.seat : null,
        winnerName: winner ? winner.name : 'Chiến Thắng',
        loserSeat: loser ? loser.seat : null,
        loserName: loser ? loser.name : 'Thua',
        completedAt: Date.now()
      };
      return true;
    }
    return false;
  }
}

module.exports = {
  TanGame,
  TAN_RANKS
};
