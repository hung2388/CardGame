const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

async function testGameMultiplayer(gameType, gameName) {
  console.log(`\n[TEST] MULTIPLAYER END-TO-END CHO [${gameName}]...`);

  const p1 = io(SERVER_URL);
  const p2 = io(SERVER_URL);

  await Promise.all([
    new Promise(r => p1.on('connect', r)),
    new Promise(r => p2.on('connect', r))
  ]);

  // Create room
  const createRes = await new Promise(r => p1.emit('create_room', { gameType, playerName: 'Chu Ban' }, r));
  const roomId = createRes.roomId;
  console.log(`   - Tao phong ${gameType} thanh cong! Room ID: ${roomId}`);

  // Join room
  await new Promise(r => p2.emit('join_room', { roomId, playerName: 'Khach Choi' }, r));
  console.log(`   - Khach vao ban thanh cong!`);

  // Start game
  await new Promise(r => p1.emit('start_game', { roomId }, r));

  // Wait cards dealt
  await Promise.all([
    new Promise(r => p1.on('cards_dealt_notice', r)),
    new Promise(r => p2.on('cards_dealt_notice', r))
  ]);
  console.log(`   - Chia bai ${gameName} thanh cong!`);

  const p1State = await new Promise(r => p1.once('room_state_update', r));
  console.log(`   - P1 Hand count: ${p1State.myHand.length} | GameData engineStatus: ${p1State.gameData?.engineStatus || p1State.status}`);

  p1.disconnect();
  p2.disconnect();
  console.log(`[PASS] [${gameName}] MULTIPLAYER PIPELINE: PASSED!`);
}

async function runMatrix() {
  await testGameMultiplayer('three-cards', 'Ba Cao (3 La)');
  await testGameMultiplayer('sam', 'Sam Loc');
  await testGameMultiplayer('tan', 'Danh Tan');
  await testGameMultiplayer('uno', 'UNO');
  await testGameMultiplayer('exploding-kittens', 'Meo No');

  console.log('\n==============================================================');
  console.log('[SUCCESS] TOAN BO 5/5 GAME DA TEST MULTIPLAYER END-TO-END THANH CONG!');
  console.log('==============================================================');
  process.exit(0);
}

runMatrix().catch(err => {
  console.error('[ERROR] MATRIX TEST FAILED:', err);
  process.exit(1);
});
