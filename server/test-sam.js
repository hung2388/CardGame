const { io } = require('socket.io-client');
const { SamGame, SAM_RANKS } = require('./games/sam');

const SERVER_URL = 'http://localhost:3001';

function runSamUnitTests() {
  console.log('[UNIT TEST] BAT DAU UNIT TESTS LUAT SAM LOC...');

  // 1. Combo Detection
  const single = SamGame.identifyCombo([{ rank: '5', suit: 'spades' }]);
  console.log('   - Single 5:', single?.name, '| RankVal:', single?.rankValue);
  if (!single || single.type !== 'single' || single.rankValue !== 5) throw new Error('Single detection failed');

  const pair = SamGame.identifyCombo([{ rank: '8', suit: 'spades' }, { rank: '8', suit: 'diamonds' }]);
  console.log('   - Pair 8:', pair?.name);
  if (!pair || pair.type !== 'pair') throw new Error('Pair detection failed');

  const triple = SamGame.identifyCombo([{ rank: 'J', suit: 'spades' }, { rank: 'J', suit: 'diamonds' }, { rank: 'J', suit: 'hearts' }]);
  console.log('   - Triple J:', triple?.name);
  if (!triple || triple.type !== 'triple') throw new Error('Triple detection failed');

  const quad = SamGame.identifyCombo([
    { rank: 'Q', suit: 'spades' }, { rank: 'Q', suit: 'diamonds' },
    { rank: 'Q', suit: 'hearts' }, { rank: 'Q', suit: 'clubs' }
  ]);
  console.log('   - Quad Q (Tu Quy):', quad?.name);
  if (!quad || quad.type !== 'quad') throw new Error('Quad detection failed');

  const straight = SamGame.identifyCombo([
    { rank: '3', suit: 'spades' }, { rank: '4', suit: 'diamonds' },
    { rank: '5', suit: 'hearts' }, { rank: '6', suit: 'clubs' }
  ]);
  console.log('   - Straight 3-6:', straight?.name);
  if (!straight || straight.type !== 'straight' || straight.length !== 4) throw new Error('Straight detection failed');

  const specialStraight = SamGame.identifyCombo([
    { rank: 'A', suit: 'spades' }, { rank: '2', suit: 'diamonds' }, { rank: '3', suit: 'hearts' }
  ]);
  console.log('   - Sanh dac biet A-2-3:', specialStraight?.name);
  if (!specialStraight || specialStraight.type !== 'straight') throw new Error('Special straight detection failed');

  const consecutivePairs = SamGame.identifyCombo([
    { rank: '4', suit: 'spades' }, { rank: '4', suit: 'diamonds' },
    { rank: '5', suit: 'hearts' }, { rank: '5', suit: 'clubs' },
    { rank: '6', suit: 'spades' }, { rank: '6', suit: 'diamonds' }
  ]);
  console.log('   - 3 Doi Thong (4-5-6):', consecutivePairs?.name);
  if (!consecutivePairs || consecutivePairs.type !== 'consecutive_pairs') throw new Error('Consecutive pairs detection failed');

  // Invalid combos
  const invalid1 = SamGame.identifyCombo([
    { rank: 'Q', suit: 'spades' }, { rank: 'K', suit: 'diamonds' },
    { rank: 'A', suit: 'hearts' }, { rank: '2', suit: 'clubs' }
  ]);
  console.log('   - Sanh Q-K-A-2 (cam):', invalid1 === null ? 'Hop le bi chan (NULL)' : 'LOI');
  if (invalid1 !== null) throw new Error('Q-K-A-2 must be invalid in Sam');

  // 2. Beating Rules
  const single5 = SamGame.identifyCombo([{ rank: '5', suit: 'spades' }]);
  const single8 = SamGame.identifyCombo([{ rank: '8', suit: 'diamonds' }]);
  const single2 = SamGame.identifyCombo([{ rank: '2', suit: 'hearts' }]);

  if (!SamGame.canBeat(single8, single5).canBeat) throw new Error('8 must beat 5');
  if (SamGame.canBeat(single5, single8).canBeat) throw new Error('5 cannot beat 8');
  if (!SamGame.canBeat(single2, single8).canBeat) throw new Error('2 must beat 8');

  // Tứ Quý chặt 2
  const quadQ = SamGame.identifyCombo([
    { rank: 'Q', suit: 'spades' }, { rank: 'Q', suit: 'diamonds' },
    { rank: 'Q', suit: 'hearts' }, { rank: 'Q', suit: 'clubs' }
  ]);
  const quadK = SamGame.identifyCombo([
    { rank: 'K', suit: 'spades' }, { rank: 'K', suit: 'diamonds' },
    { rank: 'K', suit: 'hearts' }, { rank: 'K', suit: 'clubs' }
  ]);

  if (!SamGame.canBeat(quadQ, single2).canBeat) throw new Error('Tu Quy must chop single 2');
  if (!SamGame.canBeat(quadK, quadQ).canBeat) throw new Error('Tu Quy K must beat Tu Quy Q');
  if (SamGame.canBeat(quadQ, quadK).canBeat) throw new Error('Tu Quy Q cannot beat Tu Quy K');

  // 3 Đôi Thông chặt 2
  if (!SamGame.canBeat(consecutivePairs, single2).canBeat) throw new Error('3 Doi thong must chop single 2');

  console.log('[PASS] TOAN BO UNIT TESTS SAM LOC DAT 100%!\n');
}

async function runSamMultiplayerTest() {
  console.log('[TEST] BAT DAU TEST MULTIPLAYER SAM LOC (REAL-TIME)...');

  const p1 = io(SERVER_URL);
  const p2 = io(SERVER_URL);

  await Promise.all([
    new Promise(r => p1.on('connect', r)),
    new Promise(r => p2.on('connect', r))
  ]);
  console.log('[PASS] 1. Ket noi Socket.IO thanh cong!');

  // Host creates Sâm room
  const createRes = await new Promise(r => p1.emit('create_room', { gameType: 'sam', playerName: 'Chu Ban (Bach)' }, r));
  const roomId = createRes.roomId;
  console.log('[PASS] 2. Tao phong Sam thanh cong! Ma:', roomId);

  // Player 2 joins
  await new Promise(r => p2.emit('join_room', { roomId, playerName: 'Khach (Duong)' }, r));
  console.log('[PASS] 3. Duong vao phong thanh cong!');

  // Host starts game
  console.log('[INFO] 4. Bat dau van Sam (chon starter & chieu)...');
  await new Promise(r => p1.emit('start_game', { roomId }, r));

  // Wait for deal cards
  console.log('[INFO] 5. Doi authoritative deal 10 la bai...');
  await Promise.all([
    new Promise(r => p1.on('cards_dealt_notice', r)),
    new Promise(r => p2.on('cards_dealt_notice', r))
  ]);
  console.log('[PASS] 6. Ca 2 nguoi da nhan du 10 la bai!');

  const p1State = await new Promise(r => p1.once('room_state_update', r));
  console.log(`   - Bach co: ${p1State.myHand.length} la (Trang thai: ${p1State.gameData.engineStatus})`);
  if (p1State.myHand.length !== 10) throw new Error('Sam player must receive exactly 10 cards');

  // Test Báo Sâm
  console.log('[INFO] 7. Test Bao Sam: Bach bam Bao Sam...');
  const stateAfterSamPromise = new Promise(r => p1.once('room_state_update', r));
  await new Promise(r => p1.emit('call_sam', { doesCall: true }, r));

  const stateAfterSam = await stateAfterSamPromise;
  console.log(`[PASS] 8. Ket qua Bao Sam: Status = ${stateAfterSam.gameData.engineStatus}, CurrentTurn = ${stateAfterSam.currentTurnSeat}`);
  if (stateAfterSam.currentTurnSeat !== 1) throw new Error('Host should have the first turn after calling Sam');

  // Test playing a valid card
  console.log('[INFO] 9. Bach danh la bai dau tien...');
  const cardToPlay = stateAfterSam.myHand[0];
  console.log(`   - Bach chon danh: ${cardToPlay.rank}${cardToPlay.suitSymbol}`);

  const p2StatePromise = new Promise(r => p2.once('room_state_update', r));
  const playRes = await new Promise(r => p1.emit('play_cards', { cardIds: [cardToPlay.id] }, r));
  if (!playRes.success) throw new Error('Play card failed: ' + playRes.error);
  console.log('[PASS] 10. Bach danh bai thanh cong! Luot chuyen sang Duong.');

  const p2State = await p2StatePromise;
  console.log(`   - Duong nhin thay: Luot cua ghe #${p2State.currentTurnSeat}, Ban dang co ${p2State.tableCards.length} la.`);
  if (p2State.currentTurnSeat !== 2) throw new Error('Turn must rotate to player 2');

  // Test player 2 pass
  console.log('[INFO] 11. Duong bam Bo Luot (Pass)...');
  const p1ResetStatePromise = new Promise(r => p1.once('room_state_update', r));
  const passRes = await new Promise(r => p2.emit('pass_turn', {}, r));
  if (!passRes.success) throw new Error('Pass turn failed: ' + passRes.error);

  const p1ResetState = await p1ResetStatePromise;
  console.log(`[PASS] 12. Duong bo luot thanh cong! Trick reset ve cho Bach: Luot cua ghe #${p1ResetState.currentTurnSeat}`);
  if (p1ResetState.currentTurnSeat !== 1) throw new Error('Trick must reset to Bach');

  console.log('\n===============================================');
  console.log('[SUCCESS] TOAN BO TEST PHASE 3: SAM LOC DAT 100%!');
  console.log('===============================================');

  p1.disconnect();
  p2.disconnect();
  process.exit(0);
}

try {
  runSamUnitTests();
  runSamMultiplayerTest().catch(err => {
    console.error('[ERROR] MULTIPLAYER SAM TEST ERROR:', err);
    process.exit(1);
  });
} catch (e) {
  console.error('[ERROR] UNIT TEST ERROR:', e);
  process.exit(1);
}
