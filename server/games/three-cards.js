/**
 * AUTHORITATIVE THREE-CARDS (BA CÀO) GAME ENGINE
 * 
 * Rules:
 * 1. Each player receives 3 cards.
 * 2. Rank tiers:
 *    - Tier 4: Sáp (Three of a Kind, e.g. 7-7-7, A-A-A)
 *    - Tier 3: Liêng (Straight of 3 cards, e.g. 4-5-6, Q-K-A)
 *    - Tier 2: Ba Tây / Ba Tiên (All 3 face cards J, Q, K)
 *    - Tier 1: Điểm số (Tổng điểm % 10, A=1, 2-9 mặt số, 10/J/Q/K=0)
 * 3. Tie-breaking:
 *    - High card comparison (K > Q > J > 10 > ... > 2 > A)
 *    - Suit comparison (Hearts ♥ > Diamonds ♦ > Clubs ♣ > Spades ♠)
 */

const SUIT_ORDER = {
  hearts: 4,   // Cơ
  diamonds: 3, // Rô
  clubs: 2,    // Tép / Chuồn
  spades: 1    // Bích
};

// Numerical rank order for high-card evaluation
const RANK_ORDER = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13
};

class ThreeCardsGame {
  constructor(room) {
    this.room = room;
    this.status = 'idle'; // idle, revealing, finished
    this.playerReveals = new Map(); // socketId -> boolean
    this.evaluations = new Map();   // socketId -> evalResult
    this.roundResults = null;
    this.revealTimeout = null;
  }

  /**
   * Calculate point value of a single card
   */
  static getCardPoint(card) {
    if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 0;
    if (card.rank === 'A') return 1;
    return parseInt(card.rank, 10);
  }

  /**
   * Evaluate a 3-card hand authoritatively
   * @param {Array} cards 3 cards
   * @returns {object} Evaluation metadata
   */
  static evaluateHand(cards) {
    if (!cards || cards.length !== 3) {
      return { tier: 0, score: 0, rankName: 'Chưa đủ bài', highCard: null };
    }

    const sortedByRank = [...cards].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
    const r1 = sortedByRank[0].rank;
    const r2 = sortedByRank[1].rank;
    const r3 = sortedByRank[2].rank;

    // Highest card by rank, then suit
    const highCard = [...cards].sort((a, b) => {
      const diff = RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
      if (diff !== 0) return diff;
      return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
    })[0];

    // 1. Check SÁP (Three of a Kind)
    if (r1 === r2 && r2 === r3) {
      return {
        tier: 4,
        tierName: 'Sáp',
        score: 100 + RANK_ORDER[r1],
        rankName: `Sáp ${r1}`,
        description: `Bộ ba lá giống nhau (${r1})`,
        highCard
      };
    }

    // 2. Check LIÊNG (Straight of 3)
    const v1 = RANK_ORDER[r1];
    const v2 = RANK_ORDER[r2];
    const v3 = RANK_ORDER[r3];

    // Standard sequence or special A-2-3 / Q-K-A
    const isConsecutive = (v2 === v1 + 1 && v3 === v2 + 1);
    const isSpecialAceStraight = (r1 === 'A' && r2 === '2' && r3 === '3') || (r1 === 'A' && r2 === 'Q' && r3 === 'K');

    if (isConsecutive || isSpecialAceStraight) {
      return {
        tier: 3,
        tierName: 'Liêng',
        score: 50 + RANK_ORDER[r3],
        rankName: `Liêng (${r1}-${r2}-${r3})`,
        description: `Sảnh 3 lá liên tiếp`,
        highCard
      };
    }

    // 3. Check BA TÂY / BA TIÊN (All 3 face cards: J, Q, K)
    const faceCards = ['J', 'Q', 'K'];
    if (faceCards.includes(r1) && faceCards.includes(r2) && faceCards.includes(r3)) {
      return {
        tier: 2,
        tierName: 'Ba Tây',
        score: 30,
        rankName: 'Ba Tây (Ba Cào)',
        description: 'Ba lá hình người (J, Q, K)',
        highCard
      };
    }

    // 4. Regular Points: Sum % 10
    const rawSum = cards.reduce((sum, c) => sum + ThreeCardsGame.getCardPoint(c), 0);
    const score = rawSum % 10;
    const rankName = score === 0 ? 'Bù (0 Nút)' : `${score} Nút`;

    return {
      tier: 1,
      tierName: 'Điểm',
      score,
      rankName,
      description: score === 0 ? 'Bài bù không nút' : `Được ${score} nút`,
      highCard
    };
  }

  /**
   * Compare two evaluated hands
   * Returns: > 0 if A wins, < 0 if B wins, 0 if draw
   */
  static compareHands(evalA, evalB) {
    if (evalA.tier !== evalB.tier) {
      return evalA.tier - evalB.tier;
    }
    if (evalA.score !== evalB.score) {
      return evalA.score - evalB.score;
    }
    // Same tier and score -> Compare highest card rank
    const rankDiff = RANK_ORDER[evalA.highCard.rank] - RANK_ORDER[evalB.highCard.rank];
    if (rankDiff !== 0) return rankDiff;

    // Same rank -> Compare suit (Hearts > Diamonds > Clubs > Spades)
    return SUIT_ORDER[evalA.highCard.suit] - SUIT_ORDER[evalB.highCard.suit];
  }

  /**
   * Start 3-Cards Round:
   * Deals 3 cards each, begins revealing phase with countdown
   */
  startRound(onShowdownCallback) {
    this.status = 'revealing';
    this.playerReveals.clear();
    this.evaluations.clear();
    this.roundResults = null;

    const players = this.room.playerManager.getAllPlayers();
    for (const p of players) {
      this.playerReveals.set(p.socketId, false);
      this.evaluations.set(p.socketId, ThreeCardsGame.evaluateHand(p.hand));
    }

    // Auto showdown after 15 seconds if players don't all manually reveal
    if (this.revealTimeout) clearTimeout(this.revealTimeout);
    this.revealTimeout = setTimeout(() => {
      this.performShowdown(onShowdownCallback);
    }, 15000);
  }

  /**
   * Player marks their hand as revealed
   */
  revealHand(socketId, onShowdownCallback) {
    if (this.status !== 'revealing') return false;

    this.playerReveals.set(socketId, true);

    // Check if all players revealed
    let allRevealed = true;
    for (const revealed of this.playerReveals.values()) {
      if (!revealed) {
        allRevealed = false;
        break;
      }
    }

    if (allRevealed) {
      if (this.revealTimeout) clearTimeout(this.revealTimeout);
      this.performShowdown(onShowdownCallback);
    }

    return true;
  }

  /**
   * Authoritative Showdown:
   * Reveal all players' hands, rank them, determine winner
   */
  performShowdown(onComplete) {
    if (this.status === 'finished') return;
    this.status = 'finished';
    if (this.revealTimeout) clearTimeout(this.revealTimeout);

    const players = this.room.playerManager.getAllPlayers();
    if (players.length === 0) return null;

    const rankedPlayers = players.map(p => {
      const evaluation = this.evaluations.get(p.socketId) || ThreeCardsGame.evaluateHand(p.hand);
      return {
        socketId: p.socketId,
        seat: p.seat,
        name: p.name,
        hand: p.hand, // Public at showdown
        evaluation
      };
    });

    // Sort descending by hand power
    rankedPlayers.sort((a, b) => ThreeCardsGame.compareHands(b.evaluation, a.evaluation));

    // Assign ranking (1st, 2nd, ...)
    rankedPlayers.forEach((p, idx) => {
      p.rankPosition = idx + 1;
      p.isWinner = idx === 0;
    });

    // Update player scores
    const winner = rankedPlayers[0];
    const winningPlayer = this.room.playerManager.getPlayerBySeat(winner.seat);
    if (winningPlayer) {
      winningPlayer.score += 1;
    }

    this.roundResults = {
      winnerSeat: winner.seat,
      winnerName: winner.name,
      winnerRankName: winner.evaluation.rankName,
      rankings: rankedPlayers,
      completedAt: Date.now()
    };

    if (typeof onComplete === 'function') {
      onComplete(this.roundResults);
    }

    return this.roundResults;
  }
}

module.exports = {
  ThreeCardsGame,
  SUIT_ORDER,
  RANK_ORDER
};
