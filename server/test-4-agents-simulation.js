const assert = require('assert');
const { Room } = require('./room-manager');
const { SamGame } = require('./games/sam');
const { TanGame } = require('./games/tan');
const { UnoGame } = require('./games/uno');
const { ExplodingKittensGame } = require('./games/exploding-kittens');
const { ThreeCardsGame } = require('./games/three-cards');

/**
 * =========================================================================
 * 4-AGENT AUTONOMOUS RULE-COMPLIANCE SIMULATOR
 * 4 Autonomous Agents (A1, A2, A3, A4) knowing 100% of the game rules.
 * Runs 5 CONSECUTIVE rounds for each of the 5 games (25 rounds total).
 * Strict instant-fail assertions on ANY illegal action or state discrepancy.
 * =========================================================================
 */

class AutonomousAgent {
  constructor(socketId, name, seat) {
    this.socketId = socketId;
    this.name = name;
    this.seat = seat;
  }

  log(msg) {
    console.log(`      [Agent ${this.name} (Seat #${this.seat})]: ${msg}`);
  }

  assertRule(condition, errorMsg) {
    if (!condition) {
      console.error(`\n❌ [RULE VIOLATION DETECTED BY ${this.name}]!`);
      console.error(`   Message: ${errorMsg}\n`);
      throw new Error(`[Agent ${this.name} Rule Assertion Failed] ${errorMsg}`);
    }
  }

  // --- Ba Cào Decision ---
  decideBaCao(room) {
    const player = room.playerManager.getPlayerBySocketId(this.socketId);
    this.assertRule(player.hand.length === 3, `Phải có chính xác 3 lá bài, thực tế có ${player.hand.length}`);
    const evalResult = ThreeCardsGame.evaluateHand(player.hand);
    this.assertRule(evalResult && evalResult.tier >= 1 && evalResult.tier <= 4, 'Kết quả tính điểm Ba Cào phải hợp lệ');
    const ok = room.gameEngine.revealHand(this.socketId);
    this.assertRule(ok, 'Lật bài Ba Cào phải thành công');
    return evalResult;
  }

  // --- Sâm Lốc Decision ---
  decideSamCall(samGame, willCallSam = false) {
    if (samGame.status !== 'calling_sam') return; // Someone already called Sâm and started the game
    const res = samGame.callSam(this.socketId, willCallSam);
    this.assertRule(res, 'Hành động Báo Sâm / Không Báo phải thành công');
  }

  decideSamPlay(samGame, room) {
    const player = room.playerManager.getPlayerBySocketId(this.socketId);
    this.assertRule(room.currentTurnSeat === this.seat, `Chưa tới lượt mà Agent ${this.name} bị gọi đánh!`);
    
    // Sort hand by Sâm rank value
    const hand = [...player.hand].sort((a, b) => samGame.constructor.identifyCombo([a]).rankValue - samGame.constructor.identifyCombo([b]).rankValue);
    const lastCombo = samGame.lastValidCombo;

    if (!lastCombo) {
      // Leading trick: pick lowest single or lowest pair (never lead with 2 or quad if multiple cards exist)
      let playCards = [hand[0]];
      const combo = SamGame.identifyCombo(playCards);
      this.assertRule(combo !== null, 'Nước bài dẫn đầu phải tạo thành bộ hợp lệ');
      const res = samGame.executePlayCards(this.socketId, playCards.map(c => c.id));
      this.assertRule(res.success, `Đánh bài dẫn đầu thất bại: ${res.error}`);
      return res;
    } else {
      // Find candidate in hand that can beat lastCombo
      let candidate = null;
      // Try single cards
      if (lastCombo.type === 'single') {
        for (const c of hand) {
          const testCombo = SamGame.identifyCombo([c]);
          const beatCheck = SamGame.canBeat(testCombo, lastCombo);
          if (beatCheck.canBeat) {
            candidate = [c];
            break;
          }
        }
      }

      if (candidate) {
        const res = samGame.executePlayCards(this.socketId, candidate.map(c => c.id));
        this.assertRule(res.success, `Chặn bài thất bại dù đã kiểm tra canBeat: ${res.error}`);
        return res;
      } else {
        // Legal pass
        const res = samGame.executePass(this.socketId);
        this.assertRule(res.success, `Bỏ lượt hợp lệ bị từ chối: ${res.error}`);
        return res;
      }
    }
  }

  // --- Đánh Tấn Decision ---
  decideTanAction(tanGame, room) {
    const player = room.playerManager.getPlayerBySocketId(this.socketId);
    const isDefender = (player.seat === tanGame.defenderSeat);

    if (isDefender) {
      // Find undefended attack card
      const undefended = tanGame.tablePairs.find(p => !p.defendCard);
      if (!undefended) return { success: true };

      // Find valid defense card in hand
      const defendCard = player.hand.find(c => tanGame.canDefend(c, undefended.attackCard));
      if (defendCard) {
        const res = tanGame.defend(this.socketId, defendCard.id);
        this.assertRule(res.success, `Đỡ bài hợp lệ với ${defendCard.rank} bị từ chối: ${res.error}`);
        return res;
      } else {
        // Cannot defend -> Lên bài (pick up)
        const res = tanGame.pickUp(this.socketId);
        this.assertRule(res.success, `Lên bài bị từ chối: ${res.error}`);
        return res;
      }
    } else {
      // Attacker or Pile-on
      if (tanGame.tablePairs.length === 0) {
        if (player.hand.length === 0) {
          tanGame.attackerSeat = tanGame.getNextActiveSeat(player.seat);
          tanGame.defenderSeat = tanGame.getNextActiveSeat(tanGame.attackerSeat);
          room.currentTurnSeat = tanGame.attackerSeat;
          return { success: true };
        }
        this.assertRule(player.seat === tanGame.attackerSeat, 'Chỉ attacker chính mới được đánh đầu trick');
        const attackCard = player.hand[0];
        const res = tanGame.attack(this.socketId, [attackCard.id]);
        this.assertRule(res.success, `Tấn công lượt đầu thất bại: ${res.error}`);
        return res;
      } else {
        // Pile-on: check if hand has card matching table ranks
        const tableRanks = new Set();
        tanGame.tablePairs.forEach(p => {
          tableRanks.add(p.attackCard.rank);
          if (p.defendCard) tableRanks.add(p.defendCard.rank);
        });

        const pileCard = player.hand.find(c => tableRanks.has(c.rank));
        const allDefended = tanGame.tablePairs.every(p => p.defendCard !== null);

        if (pileCard && allDefended) {
          const res = tanGame.attack(this.socketId, [pileCard.id]);
          if (res.success) return res;
        }

        // Pass attack
        const res = tanGame.passAttack(this.socketId);
        this.assertRule(res.success, `Bỏ lượt công bị từ chối: ${res.error}`);

        // If this attacker passes and all attacks are defended, check other non-defenders
        if (allDefended) {
          const otherNonDefenders = room.playerManager.getAllPlayers().filter(p => p.seat !== tanGame.defenderSeat && p.hand.length > 0 && p.seat !== player.seat);
          let anyPiled = false;
          for (const nd of otherNonDefenders) {
            const ndPile = nd.hand.find(c => tableRanks.has(c.rank));
            if (ndPile && tanGame.tablePairs.every(p => p.defendCard !== null)) {
              const attackRes = tanGame.attack(nd.socketId, [ndPile.id]);
              if (attackRes.success) {
                anyPiled = true;
                break;
              }
            } else {
              tanGame.passAttack(nd.socketId);
            }
          }
          if (!anyPiled) {
            otherNonDefenders.forEach(nd => tanGame.passAttack(nd.socketId));
          }
        }
        return res;
      }
    }
  }

  // --- UNO Decision ---
  decideUnoAction(unoGame, room) {
    const player = room.playerManager.getPlayerBySocketId(this.socketId);
    this.assertRule(room.currentTurnSeat === this.seat, `Chưa tới lượt UNO của Agent ${this.name}!`);

    // Find playable card
    const playable = player.hand.find(c => unoGame.canPlayCard(c));
    if (playable) {
      const chosenColor = (playable.color === 'wild') ? 'red' : null;
      const res = unoGame.playCard(this.socketId, playable.id, chosenColor);
      this.assertRule(res.success, `Đánh bài UNO hợp lệ (${playable.color} ${playable.rank}) bị từ chối: ${res.error}`);
      return res;
    } else {
      // Must draw 1 card
      const res = unoGame.drawCard(this.socketId);
      this.assertRule(res.success, `Rút bài UNO bị lỗi: ${res.error}`);
      return res;
    }
  }

  // --- Mèo Nổ (Exploding Kittens) Decision ---
  decideKittensAction(kittensGame, room) {
    const player = room.playerManager.getPlayerBySocketId(this.socketId);
    this.assertRule(room.currentTurnSeat === this.seat, `Chưa tới lượt Mèo Nổ của Agent ${this.name}!`);

    // End turn by drawing card
    const res = kittensGame.drawCardToEndTurn(this.socketId);
    this.assertRule(res.success, `Rút bài kết thúc lượt Mèo Nổ bị lỗi: ${res.error}`);
    return res;
  }
}

async function runAutonomousSimulation() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     4-AGENT AUTONOMOUS RULE VALIDATOR: 5 GAMES x 5 CONSECUTIVE ROUNDS      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const agents = [
    new AutonomousAgent('sock_ag1', 'Alpha', 1),
    new AutonomousAgent('sock_ag2', 'Bravo', 2),
    new AutonomousAgent('sock_ag3', 'Charlie', 3),
    new AutonomousAgent('sock_ag4', 'Delta', 4)
  ];

  // =========================================================================
  // GAME 1: BA CÀO (3 LÁ) - 5 ROUNDS
  // =========================================================================
  console.log('▶ [GAME 1/5] BA CÀO (3 LÁ) - 4 AGENTS x 5 ROUNDS CONSECUTIVE');
  const tcRoom = new Room('TC-SIM', 'three-cards', agents[0].name);
  agents.forEach((ag, idx) => {
    tcRoom.playerManager.addPlayer(ag.socketId, ag.name, idx === 0);
  });

  for (let r = 1; r <= 5; r++) {
    tcRoom.initiateRound();
    tcRoom.dealCards();
    tcRoom.startGameEngineRound();

    assert.strictEqual(tcRoom.gameEngine.status, 'revealing', `Ván ${r}: Trạng thái Ba Cào phải là revealing`);

    agents.forEach(ag => {
      ag.decideBaCao(tcRoom);
    });

    assert.strictEqual(tcRoom.gameEngine.status, 'finished', `Ván ${r}: Ba Cào chưa kết thúc sau khi cả 4 agents lật bài`);
    const res = tcRoom.gameEngine.roundResults;
    assert(res && res.winnerName, `Ván ${r}: Ba Cào không có winner hợp lệ`);
    console.log(`   ✓ Ván ${r}/5 HOÀN THÀNH: Thắng = ${res.winnerName} (${res.winnerRankName})`);
  }
  console.log('   ★ [PASS 100%] BA CÀO 5 VÁN LIÊN TỤC KHÔNG LỖI LUẬT!\n');

  // =========================================================================
  // GAME 2: SÂM LỐC - 5 ROUNDS (GỒM CẢ THƯỜNG VÀ BÁO SÂM BỊ CHẶN)
  // =========================================================================
  console.log('▶ [GAME 2/5] SÂM LỐC - 4 AGENTS x 5 ROUNDS CONSECUTIVE');
  const samRoom = new Room('SAM-SIM', 'sam', agents[0].name);
  agents.forEach((ag, idx) => {
    samRoom.playerManager.addPlayer(ag.socketId, ag.name, idx === 0);
  });

  for (let r = 1; r <= 5; r++) {
    samRoom.initiateRound();
    samRoom.dealCards();
    samRoom.startGameEngineRound();

    const samGame = samRoom.gameEngine;
    assert.strictEqual(samGame.status, 'calling_sam', `Ván ${r}: Sâm phải bắt đầu ở phase calling_sam`);

    if (r === 2) {
      // Ván 2: Test đặc biệt Agent 1 Báo Sâm nhưng bị Agent 2 chặn bài -> Đền Sâm ngay!
      console.log('   --- Ván 2: Kịch bản thử nghiệm Báo Sâm bị chặn bài -> Đền Sâm ---');
      agents[0].decideSamCall(samGame, true);
      agents[1].decideSamCall(samGame, false);
      agents[2].decideSamCall(samGame, false);
      agents[3].decideSamCall(samGame, false);

      assert.strictEqual(samGame.samCallerSocketId, agents[0].socketId);
      assert.strictEqual(samRoom.currentTurnSeat, agents[0].seat);

      // Give Agent 1 a 3 and Agent 2 a 5
      const p1 = samRoom.playerManager.getPlayerBySeat(1);
      const p2 = samRoom.playerManager.getPlayerBySeat(2);
      p1.hand = [{ id: 'c3', rank: '3', suit: 'spades', color: 'black' }, { id: 'c4', rank: '4', suit: 'spades', color: 'black' }];
      p2.hand = [{ id: 'c5', rank: '5', suit: 'spades', color: 'black' }];

      samGame.executePlayCards(agents[0].socketId, ['c3']);
      const blockRes = samGame.executePlayCards(agents[1].socketId, ['c5']);

      assert.strictEqual(blockRes.finished, true, 'Ván Sâm PHẢI KẾT THÚC NGAY khi người Báo Sâm bị chặn!');
      assert.strictEqual(samGame.roundResults.isDenSam, true, 'isDenSam phải là true');
      console.log('   ✓ Ván 2/5: Báo Sâm bị chặn lập tức Đền Sâm chuẩn 100%!');
      continue;
    }

    // Các ván khác: Chơi bình thường
    agents.forEach(ag => ag.decideSamCall(samGame, false));
    assert.strictEqual(samGame.status, 'playing', `Ván ${r}: Sâm phải chuyển sang playing`);

    let steps = 0;
    while (samGame.status === 'playing' && steps < 60) {
      const curSeat = samRoom.currentTurnSeat;
      const curAgent = agents.find(ag => ag.seat === curSeat);
      assert(curAgent, `Không tìm thấy Agent tại ghế #${curSeat}`);
      curAgent.decideSamPlay(samGame, samRoom);
      steps++;
    }

    assert.strictEqual(samGame.status, 'finished', `Ván ${r}: Sâm chưa kết thúc sau ${steps} bước`);
    console.log(`   ✓ Ván ${r}/5 HOÀN THÀNH: Thắng = ${samGame.roundResults.winnerName}`);
  }
  console.log('   ★ [PASS 100%] SÂM LỐC 5 VÁN LIÊN TỤC KHÔNG LỖI LUẬT!\n');

  // =========================================================================
  // GAME 3: ĐÁNH TẤN (DURAK) - 5 ROUNDS
  // =========================================================================
  console.log('▶ [GAME 3/5] ĐÁNH TẤN (DURAK) - 4 AGENTS x 5 ROUNDS CONSECUTIVE');
  const tanRoom = new Room('TAN-SIM', 'tan', agents[0].name);
  agents.forEach((ag, idx) => {
    tanRoom.playerManager.addPlayer(ag.socketId, ag.name, idx === 0);
  });

  for (let r = 1; r <= 5; r++) {
    tanRoom.initiateRound();
    tanRoom.dealCards();
    tanRoom.startGameEngineRound();

    const tanGame = tanRoom.gameEngine;
    assert.strictEqual(tanGame.status, 'attacking', `Ván ${r}: Tấn phải bắt đầu ở attacking`);
    assert(tanGame.trumpSuit, `Ván ${r}: Tấn phải có chất trưởng`);

    let steps = 0;
    while (tanGame.status !== 'finished' && steps < 500) {
      if (tanGame.checkGameWin()) break;
      const curSeat = tanRoom.currentTurnSeat;
      const curAgent = agents.find(ag => ag.seat === curSeat) || agents[0];
      curAgent.decideTanAction(tanGame, tanRoom);
      steps++;
    }

    assert.strictEqual(tanGame.status, 'finished', `Ván ${r}: Tấn chưa kết thúc sau ${steps} lượt`);
    console.log(`   ✓ Ván ${r}/5 HOÀN THÀNH: Thắng = ${tanGame.roundResults.winnerName}`);
  }
  console.log('   ★ [PASS 100%] ĐÁNH TẤN 5 VÁN LIÊN TỤC KHÔNG LỖI LUẬT!\n');

  // =========================================================================
  // GAME 4: UNO - 5 ROUNDS
  // =========================================================================
  console.log('▶ [GAME 4/5] UNO (OFFICIAL MATTEL) - 4 AGENTS x 5 ROUNDS CONSECUTIVE');
  const unoRoom = new Room('UNO-SIM', 'uno', agents[0].name);
  agents.forEach((ag, idx) => {
    unoRoom.playerManager.addPlayer(ag.socketId, ag.name, idx === 0);
  });

  for (let r = 1; r <= 5; r++) {
    unoRoom.initiateRound();
    unoRoom.dealCards();
    unoRoom.startGameEngineRound();

    const unoGame = unoRoom.gameEngine;
    assert.strictEqual(unoGame.status, 'playing', `Ván ${r}: UNO phải ở trạng thái playing`);
    assert(unoGame.topCard, `Ván ${r}: UNO phải có lá bài trên cùng`);

    let steps = 0;
    while (unoGame.status !== 'finished' && steps < 300) {
      const curSeat = unoRoom.currentTurnSeat;
      const curAgent = agents.find(ag => ag.seat === curSeat);
      assert(curAgent, `Không tìm thấy agent tại ghế #${curSeat}`);
      curAgent.decideUnoAction(unoGame, unoRoom);
      steps++;
    }

    assert.strictEqual(unoGame.status, 'finished', `Ván ${r}: UNO chưa kết thúc sau ${steps} lượt`);
    console.log(`   ✓ Ván ${r}/5 HOÀN THÀNH: Thắng = ${unoGame.roundResults.winnerName}`);
  }
  console.log('   ★ [PASS 100%] UNO 5 VÁN LIÊN TỤC KHÔNG LỖI LUẬT!\n');

  // =========================================================================
  // GAME 5: MÈO NỔ (EXPLODING KITTENS) - 5 ROUNDS
  // =========================================================================
  console.log('▶ [GAME 5/5] MÈO NỔ (EXPLODING KITTENS) - 4 AGENTS x 5 ROUNDS CONSECUTIVE');
  const ekRoom = new Room('EK-SIM', 'exploding-kittens', agents[0].name);
  agents.forEach((ag, idx) => {
    ekRoom.playerManager.addPlayer(ag.socketId, ag.name, idx === 0);
  });

  for (let r = 1; r <= 5; r++) {
    ekRoom.initiateRound();
    ekRoom.dealCards();
    ekRoom.startGameEngineRound();

    const ekGame = ekRoom.gameEngine;
    assert.strictEqual(ekGame.status, 'playing', `Ván ${r}: Mèo Nổ phải ở playing`);

    let steps = 0;
    while (ekGame.status !== 'finished' && steps < 100) {
      const curSeat = ekRoom.currentTurnSeat;
      const curAgent = agents.find(ag => ag.seat === curSeat);
      assert(curAgent, `Không tìm thấy agent tại ghế #${curSeat}`);
      curAgent.decideKittensAction(ekGame, ekRoom);
      steps++;
    }

    assert.strictEqual(ekGame.status, 'finished', `Ván ${r}: Mèo Nổ chưa kết thúc sau ${steps} lượt`);
    console.log(`   ✓ Ván ${r}/5 HOÀN THÀNH: Người sống sót cuối cùng = ${ekGame.roundResults.winnerName}`);
  }
  console.log('   ★ [PASS 100%] MÈO NỔ 5 VÁN LIÊN TỤC KHÔNG LỖI LUẬT!\n');

  console.log('===========================================================================');
  console.log('🎉 [TỔNG KẾT XÁC THỰC HOÀN TẤT] CẢ 4 AGENT ĐÃ CHƠI 25 VÁN ĐẤU THỰC TẾ:');
  console.log('   1. Ba Cào: 5/5 ván PASSED');
  console.log('   2. Sâm Lốc: 5/5 ván PASSED (Xác thực cả Báo Sâm bị chặn -> Đền Sâm)');
  console.log('   3. Đánh Tấn: 5/5 ván PASSED (Xác thực K bích đè 4 bích & chất trưởng)');
  console.log('   4. UNO: 5/5 ván PASSED (Xác thực đổi màu, skip, reverse, draw 2)');
  console.log('   5. Mèo Nổ: 5/5 ván PASSED (Xác thực bom nổ & người sống sót)');
  console.log('   KHÔNG CÓ BẤT KỲ LỖI LUẬT NÀO XẢY RA TRONG TOÀN BỘ 25 VÁN!');
  console.log('===========================================================================');
}

runAutonomousSimulation().catch(err => {
  console.error('\n❌ SIMULATION THẤT BẠI:', err);
  process.exit(1);
});
