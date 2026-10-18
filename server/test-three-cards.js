const { io } = require('socket.io-client');
const { ThreeCardsGame } = require('./games/three-cards');

const SERVER_URL = 'http://localhost:3001';

function runUnitTests() {
  console.log('[UNIT TEST] BAT DAU UNIT TESTS LUAT BA CAO (3 LA)...');

  // 1. Sáp
  const sapHand = [
    { rank: '7', suit: 'spades' },
    { rank: '7', suit: 'diamonds' },
    { rank: '7', suit: 'clubs' }
  ];
  const sapEval = ThreeCardsGame.evaluateHand(sapHand);
  console.log('   - Sap 7 evaluation:', sapEval.rankName, '| Tier:', sapEval.tier);
  if (sapEval.tier !== 4) throw new Error('Sap tier must be 4');

  // 2. Liêng
  const liengHand = [
    { rank: '4', suit: 'spades' },
    { rank: '5', suit: 'diamonds' },
    { rank: '6', suit: 'hearts' }
  ];
  const liengEval = ThreeCardsGame.evaluateHand(liengHand);
  console.log('   - Lieng 4-5-6 evaluation:', liengEval.rankName, '| Tier:', liengEval.tier);
  if (liengEval.tier !== 3) throw new Error('Lieng tier must be 3');

  // 3. Ba Tây (3 lá hình nhưng không phải sảnh và không phải sáp)
  const baTayHand = [
    { rank: 'J', suit: 'spades' },
    { rank: 'J', suit: 'diamonds' },
    { rank: 'K', suit: 'clubs' }
  ];
  const baTayEval = ThreeCardsGame.evaluateHand(baTayHand);
  console.log('   - Ba Tay evaluation:', baTayEval.rankName, '| Tier:', baTayEval.tier);
  if (baTayEval.tier !== 2) throw new Error('Ba Tay tier must be 2');

  // 4. 9 Nút
  const chinNutHand = [
    { rank: '4', suit: 'spades' },
    { rank: '5', suit: 'diamonds' },
    { rank: 'K', suit: 'clubs' }
  ];
  const chinNutEval = ThreeCardsGame.evaluateHand(chinNutHand);
  console.log('   - 9 Nut evaluation:', chinNutEval.rankName, '| Score:', chinNutEval.score);
  if (chinNutEval.score !== 9) throw new Error('Score must be 9');

  // 5. Bù (0 Nút)
  const buHand = [
    { rank: '10', suit: 'spades' },
    { rank: 'J', suit: 'diamonds' },
    { rank: 'K', suit: 'clubs' }
  ];
  const buEval = ThreeCardsGame.evaluateHand(buHand);
  console.log('   - Bu evaluation:', buEval.rankName, '| Score:', buEval.score);
  if (buEval.score !== 0) throw new Error('Score must be 0 (Bu)');

  // 6. Compare Sáp > Liêng > Ba Tây > 9 Nút > Bù
  if (ThreeCardsGame.compareHands(sapEval, liengEval) <= 0) throw new Error('Sap must beat Lieng');
  if (ThreeCardsGame.compareHands(liengEval, baTayEval) <= 0) throw new Error('Lieng must beat Ba Tay');
  if (ThreeCardsGame.compareHands(baTayEval, chinNutEval) <= 0) throw new Error('Ba Tay must beat 9 Nut');
  if (ThreeCardsGame.compareHands(chinNutEval, buEval) <= 0) throw new Error('9 Nut must beat Bu');

  console.log('[PASS] TOAN BO 6/6 UNIT TESTS LUAT CHOI DAT 100%!\n');
}

async function runMultiplayerTest() {
  console.log('[TEST] BAT DAU TEST MULTIPLAYER REAL-TIME BA CAO (3 NGUOI CHOI)...');

  const p1 = io(SERVER_URL);
  const p2 = io(SERVER_URL);
  const p3 = io(SERVER_URL);

  await Promise.all([
    new Promise(r => p1.on('connect', r)),
    new Promise(r => p2.on('connect', r)),
    new Promise(r => p3.on('connect', r))
  ]);
  console.log('[PASS] 1. Ca 3 nguoi choi ket noi Socket thanh cong!');

  // P1 creates room
  const createRes = await new Promise(r => p1.emit('create_room', { gameType: 'three-cards', playerName: 'Chu Ban (Tuan)' }, r));
  const roomId = createRes.roomId;
  console.log('[PASS] 2. Tao phong Ba Cao thanh cong! Ma:', roomId);

  // P2 & P3 join
  await new Promise(r => p2.emit('join_room', { roomId, playerName: 'Nguoi Choi 2 (Lan)' }, r));
  await new Promise(r => p3.emit('join_room', { roomId, playerName: 'Nguoi Choi 3 (Huy)' }, r));
  console.log('[PASS] 3. Lan va Huy vao ban thanh cong! Du 3 nguoi.');

  // Host starts game
  console.log('[INFO] 4. Bat dau van Ba Cao...');
  await new Promise(r => p1.emit('start_game', { roomId }, r));

  // Wait for deal notice
  console.log('[INFO] 5. Doi authoritative deal cards (sau spinner)...');
  await Promise.all([
    new Promise(r => p1.on('cards_dealt_notice', r)),
    new Promise(r => p2.on('cards_dealt_notice', r)),
    new Promise(r => p3.on('cards_dealt_notice', r))
  ]);
  console.log('[PASS] 6. Ca 3 nguoi da nhan du 3 la bai!');

  // Check state update with gameData
  const p1State = await new Promise(r => p1.once('room_state_update', r));
  console.log(`   - Tuan bai: ${p1State.myHand.map(c => c.rank + c.suitSymbol).join(' ')} => ${p1State.gameData.myEvaluation.rankName}`);

  // Test reveal cards
  console.log('[INFO] 7. Nguoi choi mo bai...');
  const showdownPromise = new Promise(r => p1.on('round_showdown', r));

  await new Promise(r => p1.emit('reveal_cards', {}, r));
  await new Promise(r => p2.emit('reveal_cards', {}, r));
  await new Promise(r => p3.emit('reveal_cards', {}, r));

  const showdownResult = await showdownPromise;
  console.log('\n[SHOWDOWN] KET QUA SHOWDOWN:');
  console.log(`- Nguoi chien thang: ${showdownResult.winnerName} (${showdownResult.winnerRankName})`);
  console.log('BANG XEP HANG TOAN VAN:');
  showdownResult.rankings.forEach(r => {
    const cards = r.hand.map(c => c.rank + c.suitSymbol).join(' ');
    console.log(`   #${r.rankPosition} - ${r.name.padEnd(16)} | Bai: ${cards} | ${r.evaluation.rankName}`);
  });

  if (!showdownResult.winnerName || showdownResult.rankings.length !== 3) {
    throw new Error('Showdown result invalid');
  }

  // Test new round
  console.log('\n[INFO] 8. Chu ban bam Van Moi...');
  const resetStatePromise = new Promise(r => p1.once('room_state_update', r));
  const newRoundRes = await new Promise(r => p1.emit('new_round', {}, r));
  if (!newRoundRes.success) throw new Error('New round failed');

  const resetState = await resetStatePromise;
  console.log(`[PASS] 9. Reset ve trang thai sanh thanh cong! Status: ${resetState.status}, Cards in hand: ${resetState.myHand.length}`);

  console.log('\n===============================================');
  console.log('[SUCCESS] TOAN BO TEST PHASE 2: BA CAO (3 LA) DAT 100%!');
  console.log('===============================================');

  p1.disconnect();
  p2.disconnect();
  p3.disconnect();
  process.exit(0);
}

try {
  runUnitTests();
  runMultiplayerTest().catch(err => {
    console.error('[ERROR] MULTIPLAYER TEST ERROR:', err);
    process.exit(1);
  });
} catch (e) {
  console.error('[ERROR] UNIT TEST ERROR:', e);
  process.exit(1);
}
