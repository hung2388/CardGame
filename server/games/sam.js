/**
 * AUTHORITATIVE SÂM LỐC GAME ENGINE
 * 
 * Rules:
 * 1. 10 cards per player.
 * 2. Rank order: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2
 *    (Suits are not differentiated in standard Sâm Lốc, only rank matters)
 * 3. Combos:
 *    - single (1 card)
 *    - pair (2 cards of same rank)
 *    - triple (3 cards of same rank)
 *    - quad (4 cards of same rank - Tứ Quý)
 *    - straight (dây/sảnh ≥ 3 cards consecutive, e.g. 3-4-5, A-2-3-4-5, 10-J-Q-K-A)
 *    - consecutive_pairs (đôi thông ≥ 3 pairs consecutive)
 * 4. Beating (Chặn bài):
 *    - Normal combo beaten by same type, same length, higher top card rank
 *    - Single 2 beaten by: Tứ Quý or ≥ 3 Đôi Thông
 *    - Tứ Quý beaten by: Higher Tứ Quý or ≥ 3 Đôi Thông
 * 5. Báo Sâm (Call Sâm):
 *    - 30s countdown at start of round. Players can see their 10 cards and optionally click "Báo Sâm".
 *    - Caller goes first. If they empty hand with 0 interrupts -> Thắng Sâm!
 *    - If any combo gets blocked -> Đền Sâm (Bét bảng)!
 *    - If 30s timer expires with no one calling, normal starter goes first.
 * 6. Turn Timer (60 seconds / 1 phút):
 *    - Each player has 60s per turn during normal play (does NOT overlap with the 30s Báo Sâm period).
 *    - If 60s expires without a move:
 *      * If leading new trick: auto-plays lowest single card.
 *      * If responding: auto-passes.
 * 7. Clean Turn Progression:
 *    - Turn moves in room direction (clockwise / counter-clockwise).
 *    - Only stops at active players with cards who have not passed in current trick.
 *    - When all other active players pass, trick resets cleanly and winner starts a new trick.
 * 8. Special losses (Bét bảng):
 *    - Last card(s) played is 2 or quad -> Thối -> Bét!
 *    - Got chopped (bị chặt 2 hoặc chặt tứ quý) -> Bét!
 */

const SAM_RANKS = {
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
  'K': 13,
  'A': 14,
  '2': 15 // 2 is highest in Sâm
};

class SamGame {
  constructor(room) {
    this.room = room;
    this.status = 'idle'; // idle, calling_sam, playing, finished
    
    this.samCalls = new Map(); // socketId -> boolean
    this.samCallerSocketId = null;
    this.samCallTimer = null;
    this.samDeadline = 0;

    this.turnTimer = null;
    this.turnDeadline = 0;

    this.currentTrick = []; // History of cards in current trick / round on table
    this.lastValidCombo = null; // { type, rankValue, length, cards, playerSeat, socketId }
    this.passedSeats = new Set(); // Seats that passed in current trick

    this.roundResults = null;
    this.betBangQueue = []; // Seats that committed special blunder (bét bảng)
    this.onShowdown = null;
  }

  /**
   * Get rank value for Sâm
   */
  static getRankVal(rank) {
    return SAM_RANKS[rank] || 0;
  }

  /**
   * Analyze an array of cards to identify its combo type in Sâm
   * @param {Array} cards 
   * @returns {object|null} { type, rankValue, length, cards } or null if invalid
   */
  static identifyCombo(cards) {
    if (!cards || cards.length === 0) return null;

    const count = cards.length;
    const sorted = [...cards].sort((a, b) => SAM_RANKS[a.rank] - SAM_RANKS[b.rank]);
    const ranks = sorted.map(c => c.rank);
    const vals = sorted.map(c => SAM_RANKS[c.rank]);

    // 1. Single
    if (count === 1) {
      return {
        type: 'single',
        rankValue: vals[0],
        length: 1,
        cards: sorted,
        name: `Lẻ ${ranks[0]}`
      };
    }

    // 2. Pair
    if (count === 2 && vals[0] === vals[1]) {
      return {
        type: 'pair',
        rankValue: vals[0],
        length: 2,
        cards: sorted,
        name: `Đôi ${ranks[0]}`
      };
    }

    // 3. Triple
    if (count === 3 && vals[0] === vals[1] && vals[1] === vals[2]) {
      return {
        type: 'triple',
        rankValue: vals[0],
        length: 3,
        cards: sorted,
        name: `Sám Cô ${ranks[0]}`
      };
    }

    // 4. Quad (Tứ Quý)
    if (count === 4 && vals[0] === vals[1] && vals[1] === vals[2] && vals[2] === vals[3]) {
      return {
        type: 'quad',
        rankValue: vals[0],
        length: 4,
        cards: sorted,
        name: `Tứ Quý ${ranks[0]}`
      };
    }

    // 5. Consecutive Pairs (Đôi Thông: >= 3 pairs consecutive)
    if (count >= 6 && count % 2 === 0) {
      const pairCount = count / 2;
      let isPairs = true;
      const pairVals = [];

      for (let i = 0; i < count; i += 2) {
        if (vals[i] !== vals[i + 1]) {
          isPairs = false;
          break;
        }
        pairVals.push(vals[i]);
      }

      if (isPairs) {
        // Must be strictly consecutive without 2
        let isConsecutive = true;
        for (let i = 1; i < pairVals.length; i++) {
          if (pairVals[i] !== pairVals[i - 1] + 1 || pairVals[i] === SAM_RANKS['2']) {
            isConsecutive = false;
            break;
          }
        }
        if (isConsecutive && pairCount >= 3) {
          return {
            type: 'consecutive_pairs',
            rankValue: pairVals[pairVals.length - 1],
            length: pairCount,
            cards: sorted,
            name: `${pairCount} Đôi Thông (tới ${ranks[count - 1]})`
          };
        }
      }
    }

    // 6. Straight (Sảnh >= 3 cards)
    if (count >= 3) {
      // Standard consecutive check (3 through A, no 2 in middle)
      let isNormalConsecutive = true;
      for (let i = 1; i < count; i++) {
        if (vals[i] !== vals[i - 1] + 1 || vals[i] === SAM_RANKS['2']) {
          isNormalConsecutive = false;
          break;
        }
      }
      if (isNormalConsecutive) {
        return {
          type: 'straight',
          rankValue: vals[count - 1], // top card rank
          length: count,
          cards: sorted,
          name: `Sảnh ${count} lá (tới ${ranks[count - 1]})`
        };
      }

      // Special Sâm Straight: Sảnh A-2-3 (nhỏ nhất)
      if (count === 3 && ranks.includes('A') && ranks.includes('2') && ranks.includes('3')) {
        return {
          type: 'straight',
          rankValue: 3, // In Sâm, A-2-3 has rank value 3 (smallest straight)
          length: 3,
          cards: sorted,
          name: 'Sảnh Min (A-2-3)'
        };
      }
    }

    return null;
  }

  /**
   * Determine if candidate combo can legally beat current combo
   * @param {object} candidate 
   * @param {object|null} current 
   * @returns {object} { canBeat: boolean, reason: string }
   */
  static canBeat(candidate, current) {
    if (!candidate) return { canBeat: false, reason: 'Nước bài không hợp lệ!' };
    if (!current) return { canBeat: true, reason: 'Được phép ra bài (Vòng mới)' };

    // 1. Same combo type and same card length
    if (candidate.type === current.type && candidate.length === current.length) {
      if (candidate.rankValue > current.rankValue) {
        return { canBeat: true, reason: 'Chặn bài thành công!' };
      }
      return { canBeat: false, reason: 'Giá trị bài không lớn hơn bài trước!' };
    }

    // 2. Chặt Heo (Single 2)
    if (current.type === 'single' && current.rankValue === SAM_RANKS['2']) {
      // Tứ quý chặt 2
      if (candidate.type === 'quad') {
        return { canBeat: true, reason: 'Tứ Quý chặt Heo!' };
      }
      // ≥ 3 đôi thông chặt 2
      if (candidate.type === 'consecutive_pairs' && candidate.length >= 3) {
        return { canBeat: true, reason: 'Đôi thông chặt 2 thành công!' };
      }
    }

    // 3. Chặt Tứ Quý
    if (current.type === 'quad') {
      // Tứ quý lớn hơn chặt tứ quý nhỏ hơn
      if (candidate.type === 'quad' && candidate.rankValue > current.rankValue) {
        return { canBeat: true, reason: 'Tứ Quý đè Tứ Quý!' };
      }
      // ≥ 3 đôi thông chặt tứ quý
      if (candidate.type === 'consecutive_pairs' && candidate.length >= 3) {
        return { canBeat: true, reason: 'Đôi thông chặt Tứ Quý!' };
      }
    }

    return { canBeat: false, reason: 'Nước đánh không đúng luật chặn bài của Sâm Lốc!' };
  }

  /**
   * Start Sâm Round:
   * 1. 30s countdown for Báo Sâm. Players see their 10 cards and can optionally click "Báo Sâm".
   * 2. After 30s (or when a player calls Sâm), start playing turns with 60s turn timer.
   */
  startRound(onShowdownCallback) {
    this.onShowdown = onShowdownCallback;
    this.status = 'calling_sam';
    this.samCalls.clear();
    this.samCallerSocketId = null;
    this.currentTrick = [];
    this.lastValidCombo = null;
    this.passedSeats.clear();
    this.betBangQueue = [];
    this.roundResults = null;

    this.clearTurnTimer();

    // 30 seconds for Báo Sâm decision
    this.samDeadline = Date.now() + 30000;
    if (this.samCallTimer) clearTimeout(this.samCallTimer);
    this.samCallTimer = setTimeout(() => {
      this.finalizeSamCalls();
    }, 30000);
  }

  /**
   * Player votes to call Sâm (or decline)
   */
  callSam(socketId, doesCall = true) {
    if (this.status !== 'calling_sam') return false;

    this.samCalls.set(socketId, doesCall);
    if (doesCall && !this.samCallerSocketId) {
      this.samCallerSocketId = socketId;
      // In Sâm, once someone calls Sâm, finalize immediately and let them take the lead!
      if (this.samCallTimer) clearTimeout(this.samCallTimer);
      this.finalizeSamCalls();
      return true;
    }

    // If all players explicitly chose "Không Báo", finalize early
    const players = this.room.playerManager.getAllPlayers();
    if (this.samCalls.size >= players.length) {
      if (this.samCallTimer) clearTimeout(this.samCallTimer);
      this.finalizeSamCalls();
    }

    return true;
  }

  /**
   * Finalize Sâm calls and begin playing phase
   */
  finalizeSamCalls() {
    if (this.status !== 'calling_sam') return;
    if (this.samCallTimer) clearTimeout(this.samCallTimer);
    this.status = 'playing';

    if (this.samCallerSocketId) {
      const callerPlayer = this.room.playerManager.getPlayerBySocketId(this.samCallerSocketId);
      if (callerPlayer) {
        this.room.currentTurnSeat = callerPlayer.seat;
        console.log(`[Sâm] Player ${callerPlayer.name} (Seat #${callerPlayer.seat}) BÁO SÂM! Starts first.`);
      }
    } else {
      // Normal starter chosen by spinner
      this.room.currentTurnSeat = this.room.starterSeat;
      console.log(`[Sâm] Không ai Báo Sâm. Bắt đầu ván với Ghế #${this.room.currentTurnSeat}.`);
    }

    // Start 60s timer for the first turn!
    this.startTurnTimer();

    if (typeof this.room.broadcast === 'function') {
      this.room.broadcast();
    }
  }

  /**
   * Start 60-second turn timer for currentTurnSeat
   */
  startTurnTimer() {
    this.clearTurnTimer();
    if (this.status !== 'playing') return;

    this.turnDeadline = Date.now() + 60000; // 60 seconds
    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout();
    }, 60000);
  }

  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnDeadline = 0;
  }

  /**
   * Turn timeout (1 phút không đánh -> tự động bỏ lượt hoặc ra bài nhỏ nhất)
   */
  handleTurnTimeout() {
    if (this.status !== 'playing') return;

    const currentSeat = this.room.currentTurnSeat;
    const player = this.room.playerManager.getPlayerBySeat(currentSeat);
    if (!player) return;

    console.log(`[Turn Timeout 60s] Player ${player.name} (Seat #${currentSeat}) timed out.`);

    if (this.lastValidCombo === null) {
      // Leading a new trick: cannot pass. Auto-play lowest single card in hand!
      const sortedHand = [...player.hand].sort((a, b) => SAM_RANKS[a.rank] - SAM_RANKS[b.rank]);
      const lowestCard = sortedHand[0];
      if (lowestCard) {
        this.executePlayCards(player.socketId, [lowestCard.id]);
        if (typeof this.room.broadcast === 'function') this.room.broadcast();
      }
    } else {
      // Responding to opponent's trick: auto-pass!
      this.executePass(player.socketId);
      if (typeof this.room.broadcast === 'function') this.room.broadcast();
    }
  }

  /**
   * Execute Play Cards Action (Authoritative)
   */
  executePlayCards(socketId, cardIds) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player) return { success: false, error: 'Người chơi không tồn tại!' };
    if (this.room.currentTurnSeat !== player.seat) return { success: false, error: 'Chưa tới lượt của bạn!' };
    if (this.status !== 'playing') return { success: false, error: 'Ván bài chưa bắt đầu hoặc đang trong giai đoạn Báo Sâm!' };

    // Get card objects from player's authoritative hand
    const selectedCards = player.hand.filter(c => cardIds.includes(c.id));
    if (selectedCards.length !== cardIds.length) {
      return { success: false, error: 'Lá bài không có trong tay bạn!' };
    }

    // Identify combo
    const candidateCombo = SamGame.identifyCombo(selectedCards);
    if (!candidateCombo) {
      return { success: false, error: 'Các lá bài không tạo thành bộ hợp lệ trong Sâm!' };
    }

    // Check if can beat current combo
    const beatCheck = SamGame.canBeat(candidateCombo, this.lastValidCombo);
    if (!beatCheck.canBeat) {
      return { success: false, error: beatCheck.reason };
    }

    // Check special blunder: Chặt 2 or Chặt Tứ Quý -> The one who got chopped goes to Bét Bảng!
    if (this.lastValidCombo) {
      if (this.lastValidCombo.type === 'single' && this.lastValidCombo.rankValue === SAM_RANKS['2']) {
        if (candidateCombo.type === 'quad' || candidateCombo.type === 'consecutive_pairs') {
          this.markBétBảng(this.lastValidCombo.playerSeat, 'Bị chặt Heo');
        }
      }
      if (this.lastValidCombo.type === 'quad' && candidateCombo.type === 'quad') {
        this.markBétBảng(this.lastValidCombo.playerSeat, 'Bị chặt Tứ Quý');
      }
    }

    // Remove cards from player's hand
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));

    // Update table trick
    candidateCombo.playerSeat = player.seat;
    candidateCombo.playerName = player.name;
    candidateCombo.socketId = socketId;
    this.lastValidCombo = candidateCombo;
    this.currentTrick.push(candidateCombo);
    this.room.tableCards = selectedCards;

    // Check if player emptied hand
    if (player.hand.length === 0) {
      // Check special blunder: Leaving 2 or Quad as LAST card -> Bét Bảng!
      if (candidateCombo.type === 'single' && candidateCombo.rankValue === SAM_RANKS['2']) {
        this.markBétBảng(player.seat, 'Về con 2 (thối Heo)');
      } else if (candidateCombo.type === 'quad') {
        this.markBétBảng(player.seat, 'Về Tứ Quý');
      }

      // Check Báo Sâm Win / Failure
      if (this.samCallerSocketId) {
        if (this.samCallerSocketId === socketId) {
          // Sam caller successfully cleared hand without being blocked -> THẮNG SÂM!
          return this.concludeGame(player.seat, true, false);
        } else {
          // Someone else went out -> Sam caller failed and pays all (Đền Sâm)!
          const samCaller = this.room.playerManager.getPlayerBySocketId(this.samCallerSocketId);
          if (samCaller) this.markBétBảng(samCaller.seat, 'Đền Sâm (Bị chặn)');
          return this.concludeGame(player.seat, false, true);
        }
      }

      return this.concludeGame(player.seat, false, false);
    }

    // CRITICAL SÂM RULE: If someone called Sâm, and ANOTHER player plays a valid beat combo:
    // The Sâm caller is immediately defeated ("Đền Sâm / Đền Làng") and the game ends right away!
    if (this.samCallerSocketId && socketId !== this.samCallerSocketId) {
      const samCaller = this.room.playerManager.getPlayerBySocketId(this.samCallerSocketId);
      if (samCaller) {
        this.markBétBảng(samCaller.seat, 'Đền Sâm (Bị chặn bài)');
        console.log(`[Sâm] Người chơi ${player.name} (Ghế #${player.seat}) đã CHẶN SÂM thành công trước ${samCaller.name}! Ván đấu kết thúc ngay lập tức (Đền Sâm).`);
        return this.concludeGame(player.seat, false, true);
      }
    }

    // Advance turn to next active player
    this.advanceToNextPlayer();

    return {
      success: true,
      combo: candidateCombo,
      remainingCards: player.hand.length
    };
  }

  /**
   * Player passes their turn
   */
  executePass(socketId) {
    const player = this.room.playerManager.getPlayerBySocketId(socketId);
    if (!player || this.room.currentTurnSeat !== player.seat) {
      return { success: false, error: 'Chưa tới lượt của bạn!' };
    }
    if (this.status !== 'playing') {
      return { success: false, error: 'Ván bài chưa bắt đầu hoặc đang trong giai đoạn Báo Sâm!' };
    }

    if (!this.lastValidCombo) {
      return { success: false, error: 'Bạn đang dẫn đầu lượt mới, không được bỏ lượt!' };
    }

    this.passedSeats.add(player.seat);
    this.advanceToNextPlayer();

    return { success: true };
  }

  /**
   * Advance turn cleanly in room direction.
   * If all other active players pass, trick resets to the leader!
   */
  advanceToNextPlayer() {
    const allPlayers = this.room.playerManager.getAllPlayers();
    const activeWithCards = allPlayers.filter(p => p.hand.length > 0);
    
    // Check non-passed players in current trick
    const nonPassed = activeWithCards.filter(p => !this.passedSeats.has(p.seat));

    if (nonPassed.length <= 1) {
      // Every other player passed! Trick reset!
      // The leader (last person who played a valid combo) wins the trick!
      const trickWinnerSeat = this.lastValidCombo 
        ? this.lastValidCombo.playerSeat 
        : (nonPassed[0]?.seat || this.room.currentTurnSeat);

      this.lastValidCombo = null;
      this.passedSeats.clear();
      this.room.tableCards = [];
      this.room.currentTurnSeat = trickWinnerSeat;
      this.startTurnTimer();
      return;
    }

    // Find next seat in room direction (clockwise / counter_clockwise)
    const seats = allPlayers.map(p => p.seat);
    const currentIndex = seats.indexOf(this.room.currentTurnSeat);

    for (let step = 1; step <= seats.length; step++) {
      let nextIndex;
      if (this.room.direction === 'clockwise') {
        nextIndex = (currentIndex + step) % seats.length;
      } else {
        nextIndex = (currentIndex - step + seats.length * 10) % seats.length;
      }

      const candidateSeat = seats[nextIndex];
      const candidatePlayer = this.room.playerManager.getPlayerBySeat(candidateSeat);

      // Must have cards AND must not have passed in current trick
      if (candidatePlayer && candidatePlayer.hand.length > 0 && !this.passedSeats.has(candidateSeat)) {
        this.room.currentTurnSeat = candidateSeat;
        this.startTurnTimer();
        return;
      }
    }
  }

  markBétBảng(seat, reason) {
    if (!this.betBangQueue.some(b => b.seat === seat)) {
      this.betBangQueue.push({ seat, reason });
      console.log(`[BÉT BẢNG] Ghế #${seat} rơi vào Bét Bảng vì: ${reason}`);
    }
  }

  /**
   * Conclude game and build complete rankings
   */
  concludeGame(firstPlaceSeat, isThangSam = false, isDenSam = false) {
    this.status = 'finished';
    this.room.status = 'round_end';
    this.clearTurnTimer();
    if (this.samCallTimer) clearTimeout(this.samCallTimer);

    const allPlayers = this.room.playerManager.getAllPlayers();
    const firstPlayer = this.room.playerManager.getPlayerBySeat(firstPlaceSeat);

    // Base ranking: 1st place
    const rankings = [
      {
        seat: firstPlayer.seat,
        name: firstPlayer.name,
        rankPosition: 1,
        isWinner: true,
        remainingCards: firstPlayer.hand.length,
        note: isThangSam ? 'THẮNG SÂM TUYỆT ĐỐI' : (isDenSam ? 'CHẶN SÂM THÀNH CÔNG (ĐỀN SÂM)' : 'VỀ NHẤT')
      }
    ];

    // Other players sorted by remaining hand count (fewer cards = better rank)
    const others = allPlayers
      .filter(p => p.seat !== firstPlaceSeat)
      .sort((a, b) => a.hand.length - b.hand.length);

    // Players in betBangQueue are pushed to the very bottom
    const betSeats = this.betBangQueue.map(b => b.seat);
    const normalOthers = others.filter(p => !betSeats.includes(p.seat));
    const blunderedOthers = others.filter(p => betSeats.includes(p.seat));

    let currentPos = 2;
    normalOthers.forEach(p => {
      rankings.push({
        seat: p.seat,
        name: p.name,
        rankPosition: currentPos++,
        isWinner: false,
        remainingCards: p.hand.length,
        note: p.hand.length === 10 ? 'Cóng (Cháy bài)' : `Còn ${p.hand.length} lá`
      });
    });

    blunderedOthers.forEach(p => {
      const blunder = this.betBangQueue.find(b => b.seat === p.seat);
      rankings.push({
        seat: p.seat,
        name: p.name,
        rankPosition: currentPos++,
        isWinner: false,
        remainingCards: p.hand.length,
        note: `BÉT BẢNG (${blunder?.reason || 'Lỗi'})`
      });
    });

    // Update winner score
    if (firstPlayer) firstPlayer.score += (isThangSam ? 5 : (isDenSam ? 4 : 1));

    this.roundResults = {
      winnerSeat: firstPlaceSeat,
      winnerName: firstPlayer.name,
      isThangSam,
      isDenSam,
      rankings,
      completedAt: Date.now()
    };

    if (typeof this.onShowdown === 'function') {
      this.onShowdown(this.roundResults);
    }

    return {
      success: true,
      finished: true,
      results: this.roundResults
    };
  }
}

module.exports = {
  SamGame,
  SAM_RANKS
};
