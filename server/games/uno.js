/**
 * AUTHORITATIVE UNO GAME ENGINE (MATTEL OFFICIAL RULES)
 * 
 * Rules:
 * 1. 108 cards:
 *    - 4 Colors: Red, Yellow, Green, Blue
 *    - Numbers: 0 (1x each color), 1-9 (2x each color)
 *    - Actions: Skip (2x), Reverse (2x), Draw Two (+2) (2x)
 *    - Wilds: Wild (4x), Wild Draw Four (+4) (4x)
 * 2. 7 cards per player.
 * 3. Matching:
 *    - Match by Color
 *    - Match by Number / Action
 *    - Wild / Wild +4 can be played on any card
 * 4. Action Card Effects:
 *    - Reverse: Inverts play direction (CW <-> CCW)
 *    - Skip: Skips next player's turn
 *    - Draw Two (+2): Next player draws 2 cards and loses their turn
 *    - Wild: Current player sets active color
 *    - Wild Draw Four (+4): Sets active color + next player draws 4 cards and loses turn
 * 5. Call UNO:
 *    - Must call UNO when holding 1 card left.
 * 6. First player to 0 cards wins the round!
 */

const { cryptoShuffle } = require('../utils/crypto-shuffle');

const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];

class UnoDeck {
  static createDeck(playerCount = 4) {
    const deckCount = playerCount > 6 ? 2 : 1;
    const cards = [];

    for (let d = 0; d < deckCount; d++) {
      const suffix = deckCount > 1 ? `_d${d + 1}` : '';
      for (const color of UNO_COLORS) {
        // One 0 card
        cards.push({ id: `uno_${color}_0${suffix}`, color, rank: '0', type: 'number', label: '0' });

        // Two 1-9 cards
        for (let n = 1; n <= 9; n++) {
          cards.push({ id: `uno_${color}_${n}_a${suffix}`, color, rank: `${n}`, type: 'number', label: `${n}` });
          cards.push({ id: `uno_${color}_${n}_b${suffix}`, color, rank: `${n}`, type: 'number', label: `${n}` });
        }

        // Two Skips, Reverses, Draw Twos
        for (const action of ['skip', 'reverse', 'draw_two']) {
          const label = action === 'draw_two' ? '+2' : (action === 'skip' ? 'SKIP' : 'REV');
          cards.push({ id: `uno_${color}_${action}_a${suffix}`, color, rank: action, type: 'action', label });
          cards.push({ id: `uno_${color}_${action}_b${suffix}`, color, rank: action, type: 'action', label });
        }
      }

      // Four Wilds and four Wild Draw Fours
      for (let i = 1; i <= 4; i++) {
        cards.push({ id: `uno_wild_${i}${suffix}`, color: 'wild', rank: 'wild', type: 'wild', label: 'WILD' });
        cards.push({ id: `uno_wild_draw_four_${i}${suffix}`, color: 'wild', rank: 'wild_draw_four', type: 'wild', label: '+4' });
      }
    }

    return cryptoShuffle(cards);
  }
}

class UnoGame {
  constructor(room) {
    this.room = room;
    this.status = 'idle'; // idle, playing, waiting_color, finished
    this.deck = [];
    this.discardPile = [];
    this.activeColor = null;
    
    this.unoCalledPlayers = new Set(); // socketIds that called UNO
    this.pendingWildPlayerId = null;
    this.roundResults = null;
  }

  /**
   * Start Uno Round:
   * Deals 7 cards each, reveals top card on discard pile
   */
  startRound(onComplete) {
    this.status = 'playing';
    const players = this.room.playerManager.getAllPlayers();
    this.deck = UnoDeck.createDeck(players.length);
    this.discardPile = [];
    this.unoCalledPlayers.clear();
    this.roundResults = null;

    for (const p of players) {
      p.hand = this.deck.splice(0, 7);
    }

    // Reveal top card on discard pile (ensure it's not wild draw four to start)
    let top = this.deck.pop();
    while (top.rank === 'wild_draw_four') {
      this.deck.unshift(top);
      top = this.deck.pop();
    }

    this.discardPile.push(top);
    this.activeColor = top.color === 'wild' ? 'red' : top.color;
    this.room.currentTurnSeat = this.room.starterSeat || players[0].seat;

    console.log(`[UNO Started] Top card: ${top.label} (${top.color}) | Active Color: ${this.activeColor}`);

    if (typeof onComplete === 'function') {
      onComplete({
        topCard: top,
        activeColor: this.activeColor,
        starterSeat: this.room.currentTurnSeat
      });
    }
  }

  get topCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  /**
   * Validate if a card can be played on current top card
   */
  canPlayCard(card) {
    if (!card) return false;
    const top = this.topCard;
    if (!top) return true;

    // Wild cards can always be played
    if (card.color === 'wild') return true;

    // Match by active color
    if (card.color === this.activeColor) return true;

    // Match by number or rank
    if (card.rank === top.rank) return true;

    return false;
  }

  /**
   * Execute Play Card Action
   */
  playCard(socketId, cardId, chosenColor = null) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player) return { success: false, error: 'Người chơi không tồn tại!' };
    if (this.room.currentTurnSeat !== player.seat) return { success: false, error: 'Chưa tới lượt của bạn!' };

    const card = player.hand.find(c => c.id === cardId);
    if (!card) return { success: false, error: 'Lá bài không có trong tay bạn!' };

    if (!this.canPlayCard(card)) {
      return { success: false, error: `Lá bài không khớp màu (${this.activeColor}) hoặc số của lá trên bàn!` };
    }

    // Remove from player hand
    player.hand = player.hand.filter(c => c.id !== cardId);
    this.discardPile.push(card);

    // Apply Card Effects
    let skipped = false;

    if (card.type === 'wild') {
      // Choose color
      this.activeColor = chosenColor || 'red';
      if (card.rank === 'wild_draw_four') {
        const victimSeat = this.getNextSeat();
        this.drawCardsForSeat(victimSeat, 4);
        skipped = true;
      }
    } else {
      this.activeColor = card.color;

      if (card.rank === 'reverse') {
        this.room.direction = this.room.direction === 'clockwise' ? 'counter_clockwise' : 'clockwise';
        console.log(`[UNO Reverse] Chiều chơi đổi thành: ${this.room.direction}`);
        if (this.room.playerManager.count === 2) skipped = true; // In 2 players, reverse acts like skip
      } else if (card.rank === 'skip') {
        skipped = true;
      } else if (card.rank === 'draw_two') {
        const victimSeat = this.getNextSeat();
        this.drawCardsForSeat(victimSeat, 2);
        skipped = true;
      }
    }

    // Check Win
    if (player.hand.length === 0) {
      return this.concludeGame(player.seat);
    }

    // Advance turn
    this.advanceTurn();
    if (skipped) {
      console.log(`[UNO Skip] Ghế #${this.room.currentTurnSeat} bị mất lượt!`);
      this.advanceTurn();
    }

    return {
      success: true,
      card,
      activeColor: this.activeColor,
      remainingCards: player.hand.length
    };
  }

  /**
   * Draw card when player has no valid move
   */
  drawCard(socketId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player || this.room.currentTurnSeat !== player.seat) {
      return { success: false, error: 'Chưa tới lượt của bạn!' };
    }

    if (this.deck.length === 0) {
      this.reshuffleDiscardIntoDeck();
    }

    if (this.deck.length === 0) {
      return { success: false, error: 'Bộ bài đã hết hoàn toàn!' };
    }

    const drawn = this.deck.pop();
    player.hand.push(drawn);

    console.log(`[UNO Draw] Player ${player.name} drew 1 card`);
    this.advanceTurn();

    return {
      success: true,
      drawnCard: drawn,
      nextTurnSeat: this.room.currentTurnSeat
    };
  }

  /**
   * Call UNO action
   */
  callUno(socketId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player) return { success: false, error: 'Người chơi không hợp lệ!' };

    if (player.hand.length <= 2) {
      this.unoCalledPlayers.add(socketId);
      console.log(`[HÔ UNO!] ${player.name} đã hô UNO thành công!`);
      return { success: true, message: `${player.name} ĐÃ HÔ UNO!` };
    }

    return { success: false, error: 'Chỉ được hô UNO khi còn 1 hoặc 2 lá bài!' };
  }

  drawCardsForSeat(seat, count) {
    const p = this.room.playerManager.getPlayerBySeat(seat);
    if (!p) return;
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) this.reshuffleDiscardIntoDeck();
      if (this.deck.length > 0) p.hand.push(this.deck.pop());
    }
  }

  reshuffleDiscardIntoDeck() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.deck = cryptoShuffle(this.discardPile);
    this.discardPile = [top];
    console.log(`[UNO Reshuffle] Reshuffled ${this.deck.length} cards into draw pile`);
  }

  getNextSeat() {
    const players = this.room.playerManager.getAllPlayers();
    const seats = players.map(p => p.seat);
    const currentIndex = seats.indexOf(this.room.currentTurnSeat);
    let nextIndex;
    if (this.room.direction === 'clockwise') {
      nextIndex = (currentIndex + 1) % seats.length;
    } else {
      nextIndex = (currentIndex - 1 + seats.length) % seats.length;
    }
    return seats[nextIndex];
  }

  advanceTurn() {
    this.room.currentTurnSeat = this.getNextSeat();
  }

  concludeGame(winnerSeat) {
    this.status = 'finished';
    this.room.status = 'round_end';
    const winner = this.room.playerManager.getPlayerBySeat(winnerSeat);

    const rankings = this.room.playerManager.getAllPlayers()
      .sort((a, b) => a.hand.length - b.hand.length)
      .map((p, idx) => ({
        seat: p.seat,
        name: p.name,
        rankPosition: idx + 1,
        isWinner: p.seat === winnerSeat,
        remainingCards: p.hand.length,
        note: p.seat === winnerSeat ? 'QUÁN QUÂN UNO' : `Còn ${p.hand.length} lá`
      }));

    if (winner) winner.score += 1;

    this.roundResults = {
      winnerSeat,
      winnerName: winner?.name || 'Chiến Thắng',
      rankings,
      completedAt: Date.now()
    };

    return {
      success: true,
      finished: true,
      results: this.roundResults
    };
  }
}

module.exports = {
  UnoGame,
  UnoDeck,
  UNO_COLORS
};
