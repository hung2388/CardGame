const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

async function runTest() {
  console.log('[TEST] BAT DAU TEST TOAN DIEN PHASE 1...');

  const hostSocket = io(SERVER_URL);
  const guestSocket = io(SERVER_URL);

  await new Promise(r => hostSocket.on('connect', r));
  await new Promise(r => guestSocket.on('connect', r));
  console.log('[PASS] 1. Ket noi Socket.IO thanh cong (Host & Guest)!');

  // Step 1: Host creates room
  const createRes = await new Promise(resolve => {
    hostSocket.emit('create_room', { gameType: 'three-cards', playerName: 'Chu Ban Dat' }, resolve);
  });
  console.log('[PASS] 2. Tao phong thanh cong! Ma phong:', createRes.roomId);
  console.log('   - Host seat:', createRes.state.mySeat);
  console.log('   - Host relative visualOffset:', createRes.state.players[0].visualOffset);

  // Step 2: Guest joins room
  const joinRes = await new Promise(resolve => {
    guestSocket.emit('join_room', { roomId: createRes.roomId, playerName: 'Khach Hung' }, resolve);
  });
  console.log('[PASS] 3. Khach vao phong thanh cong!');
  console.log('   - Guest seat:', joinRes.state.mySeat);
  console.log('   - Guest view of self offset:', joinRes.state.players.find(p => p.isSelf).visualOffset);

  // Step 3: Host starts game
  console.log('[INFO] 4. Bat dau van (quay so chon nguoi & chieu)...');
  const spinPromise = new Promise(resolve => {
    hostSocket.on('spin_selection_start', resolve);
  });

  const startRes = await new Promise(resolve => {
    hostSocket.emit('start_game', { roomId: createRes.roomId }, resolve);
  });
  const spinData = await spinPromise;
  console.log(`[PASS] 5. Spinner nhan duoc: Nguoi bat dau = Ghe #${spinData.starterSeat}, Chieu = ${spinData.direction}`);

  // Step 4: Wait for deal event
  console.log('[INFO] 6. Doi authoritative deal cards (sau 4.2s delay spinner)...');
  const dealPromiseHost = new Promise(resolve => hostSocket.on('cards_dealt_notice', resolve));
  const dealPromiseGuest = new Promise(resolve => guestSocket.on('cards_dealt_notice', resolve));
  await Promise.all([dealPromiseHost, dealPromiseGuest]);
  console.log('[PASS] 7. Chia bai hoan tat!');

  // Check state updates
  const hostStatePromise = new Promise(resolve => hostSocket.once('room_state_update', resolve));
  const guestStatePromise = new Promise(resolve => guestSocket.once('room_state_update', resolve));
  const [hostState, guestState] = await Promise.all([hostStatePromise, guestStatePromise]);

  console.log('\n[SECURITY] KIEM TRA BAO MAT & ANTI-CHEAT (Server-Authoritative):');
  console.log(`- Host bai tren tay: ${hostState.myHand.length} la (${hostState.myHand.map(c => c.rank + c.suitSymbol).join(' ')})`);
  console.log(`- Host nhin thay doi thu co: ${hostState.players.find(p => !p.isSelf).cardCount} la (KHONG BIET LA GI)`);
  console.log(`- Guest bai tren tay: ${guestState.myHand.length} la (${guestState.myHand.map(c => c.rank + c.suitSymbol).join(' ')})`);
  console.log(`- Guest nhin thay doi thu co: ${guestState.players.find(p => !p.isSelf).cardCount} la (KHONG BIET LA GI)`);

  if (hostState.myHand.length === 3 && guestState.myHand.length === 3) {
    console.log('[PASS] DUNG BAI: Moi nguoi choi nhan dung 3 la bai theo cau hinh Ba Cao!');
  } else {
    throw new Error('So bai khong khop!');
  }

  // Anti-cheat test: try to play card not in hand
  console.log('\n[ANTI-CHEAT] TEST ANTI-CHEAT: Danh la bai khong co trong tay');
  const cheatRes = await new Promise(resolve => {
    hostSocket.emit('play_cards', { cardIds: ['fake_card_999'] }, resolve);
  });
  console.log('   - Server phan hoi khi cheat:', cheatRes);
  if (!cheatRes.success) {
    console.log('[PASS] SERVER CHAN THANH CONG: Gian lan bi tu choi!');
  } else {
    throw new Error('Anti-cheat that bai!');
  }

  console.log('\n===============================================');
  console.log('[SUCCESS] TOAN BO TEST INTEGRATION PHASE 1 DAT 100%!');
  console.log('===============================================');

  hostSocket.disconnect();
  guestSocket.disconnect();
  process.exit(0);
}

runTest().catch(err => {
  console.error('[ERROR] TEST FAILED:', err);
  process.exit(1);
});
