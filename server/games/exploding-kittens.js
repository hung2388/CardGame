/**
 * AUTHORITATIVE EXPLODING KITTENS (MÈO NỔ) GAME ENGINE
 * 
 * Rules:
 * 1. Deck contains:
 *    - Exploding Kittens: (Player Count - 1)
 *    - Defuses: 1 given to each player + remaining in deck
 *    - Actions: Attack, Skip, See The Future (3x), Shuffle, Favor, Nope
 *    - Cat Cards: TacoCat, WatermelonCat, PotatoCat, BeardCat (pairs allow stealing)
 * 2. Hand:
 *    - 1 Defuse + 4 random cards (total 5 cards at start).
 * 3. Turn Structure:
 *    - Play as many cards as you want.
 *    - To END turn: MUST draw 1 card from deck.
 * 4. Drawing an Exploding Kitten:
 *    - Must play Defuse, then place Kitten anywhere in the deck secretly.
 *    - If no Defuse -> EXPLODED (Eliminated)!
 * 5. Last player standing wins!
 */

const { cryptoShuffle, secureRandomInt } = require('../utils/crypto-shuffle');

class ExplodingKittensDeck {
  static createDeck(playerCount = 4) {
    const multiplier = playerCount > 5 ? 2 : 1;
    const actionCards = [
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `attack_${i}`, rank: 'attack', label: 'Attack', name: 'Tấn Công (2 Lượt)' })),
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `skip_${i}`, rank: 'skip', label: 'Skip', name: 'Qua Lượt' })),
      ...Array(5 * multiplier).fill().map((_, i) => ({ id: `see_future_${i}`, rank: 'see_future', label: 'See Future', name: 'Xem Tương Lai' })),
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `shuffle_${i}`, rank: 'shuffle', label: 'Shuffle', name: 'Xáo Bài' })),
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `favor_${i}`, rank: 'favor', label: 'Favor', name: 'Xin Xỏ' })),
      ...Array(5 * multiplier).fill().map((_, i) => ({ id: `nope_${i}`, rank: 'nope', label: 'Nope', name: 'Chặn Đứng' })),
      // Feral Cat Cards (pairs)
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `cat_taco_${i}`, rank: 'cat_taco', label: 'TacoCat', name: 'Mèo Bánh Kẹp' })),
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `cat_melon_${i}`, rank: 'cat_melon', label: 'MelonCat', name: 'Mèo Dưa Hấu' })),
      ...Array(4 * multiplier).fill().map((_, i) => ({ id: `cat_potato_${i}`, rank: 'cat_potato', label: 'PotatoCat', name: 'Mèo Khoai Tây' }))
    ];

    return cryptoShuffle(actionCards);
  }
}

class ExplodingKittensGame {
  constructor(room) {
    this.room = room;
    this.status = 'idle'; // idle, playing, placing_defuse, finished
    this.deck = [];
    this.discardPile = [];
    
    this.turnsRemainingForCurrentPlayer = 1;
    this.defusingSocketId = null;
    this.eliminatedSeats = new Set();
    this.roundResults = null;
  }

  /**
   * Start Exploding Kittens Round
   */
  startRound(onComplete) {
    this.status = 'playing';
    this.turnsRemainingForCurrentPlayer = 1;
    this.eliminatedSeats.clear();
    this.discardPile = [];
    this.defusingSocketId = null;

    const players = this.room.playerManager.getAllPlayers();
    const playerCount = players.length;

    // 1. Give 1 Defuse to each player
    const baseActionDeck = ExplodingKittensDeck.createDeck(playerCount);
    for (const p of players) {
      p.hand = [
        { id: `defuse_${p.seat}`, rank: 'defuse', label: 'Defuse', name: 'Gỡ Bom' },
        ...baseActionDeck.splice(0, 4) // 4 random cards
      ];
    }

    // 2. Add remaining Defuses + (N - 1) Exploding Kittens into the remaining deck
    const kittenCards = Array(playerCount - 1).fill().map((_, i) => ({
      id: `kitten_${i}`,
      rank: 'exploding_kitten',
      label: 'KITTEN',
      name: 'MÈO NỔ CẢM TỬ'
    }));

    const extraDefuses = Array(Math.max(1, 6 - playerCount)).fill().map((_, i) => ({
      id: `defuse_extra_${i}`,
      rank: 'defuse',
      label: 'Defuse',
      name: 'Gỡ Bom'
    }));

    this.deck = cryptoShuffle([...baseActionDeck, ...kittenCards, ...extraDefuses]);
    this.room.currentTurnSeat = this.room.starterSeat || players[0].seat;

    console.log(`[Exploding Kittens Started] ${playerCount} Players | Deck: ${this.deck.length} cards | Kittens: ${kittenCards.length}`);

    if (typeof onComplete === 'function') {
      onComplete({
        deckCount: this.deck.length,
        starterSeat: this.room.currentTurnSeat
      });
    }
  }

  /**
   * Play an Action Card (Before drawing)
   */
  playCard(socketId, cardId, targetSeat = null) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player || this.room.currentTurnSeat !== player.seat) {
      return { success: false, error: 'Chưa tới lượt của bạn!' };
    }

    const card = player.hand.find(c => c.id === cardId);
    if (!card) return { success: false, error: 'Lá bài không có trong tay bạn!' };

    // Cannot voluntarily play Exploding Kitten or Defuse without a bomb
    if (card.rank === 'exploding_kitten' || (card.rank === 'defuse' && this.status !== 'placing_defuse')) {
      return { success: false, error: 'Không thể đánh lá này một cách thông thường!' };
    }

    // Remove from hand
    player.hand = player.hand.filter(c => c.id !== cardId);
    this.discardPile.push(card);

    let actionNotice = '';

    // Apply Actions
    switch (card.rank) {
      case 'skip':
        this.turnsRemainingForCurrentPlayer -= 1;
        actionNotice = `${player.name} đã dùng SKIP để qua lượt an toàn!`;
        if (this.turnsRemainingForCurrentPlayer <= 0) {
          this.advanceTurn();
        }
        break;

      case 'attack':
        const nextSeat = this.getNextSeat();
        this.advanceTurn();
        this.turnsRemainingForCurrentPlayer = 2; // Next player must take 2 turns
        actionNotice = `${player.name} đã TẤN CÔNG Ghế #${nextSeat} (bắt rút 2 lượt)!`;
        break;

      case 'shuffle':
        this.deck = cryptoShuffle(this.deck);
        actionNotice = `${player.name} đã XÁO TRỘN lại bộ bài bí mật!`;
        break;

      case 'see_future':
        const top3 = this.deck.slice(-3).reverse();
        return {
          success: true,
          action: 'see_future',
          top3Cards: top3,
          actionNotice: `${player.name} đang xem trước 3 lá trên cùng của bộ bài!`
        };

      default:
        actionNotice = `${player.name} đã đánh lá ${card.name}!`;
    }

    return {
      success: true,
      card,
      actionNotice,
      remainingCards: player.hand.length,
      nextTurnSeat: this.room.currentTurnSeat
    };
  }

  /**
   * Draw card to END turn (The nail-biting core mechanic)
   */
  drawCardToEndTurn(socketId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player || this.room.currentTurnSeat !== player.seat) {
      return { success: false, error: 'Chưa tới lượt của bạn!' };
    }

    if (this.deck.length === 0) {
      return { success: false, error: 'Bộ bài đã hết!' };
    }

    // Draw top card from deck
    const drawn = this.deck.pop();

    // Check if EXPLODING KITTEN!
    if (drawn.rank === 'exploding_kitten') {
      console.log(`[EXPLODING KITTEN DRAWN] Player ${player.name} drew an Exploding Kitten!`);

      // Check if player has Defuse
      const defuseIndex = player.hand.findIndex(c => c.rank === 'defuse');
      if (defuseIndex !== -1) {
        // Automatically consume 1 Defuse
        const defuseCard = player.hand.splice(defuseIndex, 1)[0];
        this.discardPile.push(defuseCard);

        // Put Kitten into random or specific place in deck
        const randomInsertPos = secureRandomInt(0, this.deck.length);
        this.deck.splice(randomInsertPos, 0, drawn);

        console.log(`[DEFUSED] ${player.name} defused the kitten! Re-inserted into deck at pos ${randomInsertPos}`);

        this.turnsRemainingForCurrentPlayer -= 1;
        if (this.turnsRemainingForCurrentPlayer <= 0) this.advanceTurn();

        return {
          success: true,
          exploded: false,
          defused: true,
          message: `Bạn đã rút phải MÈO NỔ nhưng đã GỠ BOM thành công! Quả bom đã được giấu lại vào bộ bài.`,
          nextTurnSeat: this.room.currentTurnSeat
        };
      } else {
        // BOOM! ELIMINATED!
        console.log(`[EXPLODED] Player ${player.name} has no Defuse -> ELIMINATED!`);
        this.eliminatedSeats.add(player.seat);
        player.hand = []; // Discard all cards

        this.advanceTurn();

        // Check if only 1 survivor left -> Winner!
        const survivors = this.room.playerManager.getAllPlayers().filter(p => !this.eliminatedSeats.has(p.seat));
        if (survivors.length === 1) {
          return this.concludeGame(survivors[0].seat);
        }

        return {
          success: true,
          exploded: true,
          defused: false,
          message: `BÙM!! ${player.name} đã phát nổ và bị LOẠI KHỎI VÁN ĐẤU!`,
          nextTurnSeat: this.room.currentTurnSeat
        };
      }
    }

    // Normal safe card drawn
    player.hand.push(drawn);
    this.turnsRemainingForCurrentPlayer -= 1;
    if (this.turnsRemainingForCurrentPlayer <= 0) {
      this.advanceTurn();
    }

    return {
      success: true,
      exploded: false,
      defused: false,
      drawnCard: drawn,
      nextTurnSeat: this.room.currentTurnSeat
    };
  }

  getNextSeat() {
    const players = this.room.playerManager.getAllPlayers();
    const seats = players.map(p => p.seat);
    let idx = seats.indexOf(this.room.currentTurnSeat);

    do {
      idx = (idx + 1) % seats.length;
    } while (this.eliminatedSeats.has(seats[idx]));

    return seats[idx];
  }

  advanceTurn() {
    this.turnsRemainingForCurrentPlayer = 1;
    this.room.currentTurnSeat = this.getNextSeat();
  }

  concludeGame(winnerSeat) {
    this.status = 'finished';
    this.room.status = 'round_end';
    const winner = this.room.playerManager.getPlayerBySeat(winnerSeat);

    const rankings = [
      {
        seat: winnerSeat,
        name: winner?.name || 'Chiến Binh',
        rankPosition: 1,
        isWinner: true,
        note: 'NGƯỜI DUY NHẤT SỐNG SÓT'
      }
    ];

    let pos = 2;
    this.room.playerManager.getAllPlayers()
      .filter(p => p.seat !== winnerSeat)
      .forEach(p => {
        rankings.push({
          seat: p.seat,
          name: p.name,
          rankPosition: pos++,
          isWinner: false,
          note: 'Đã phát nổ'
        });
      });

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
  ExplodingKittensGame,
  ExplodingKittensDeck
};
