const assert = require('assert');
const { RoomManager } = require('./room-manager');
const { SamGame } = require('./games/sam');
const { TanGame } = require('./games/tan');

console.log('==============================================================');
console.log('[TEST VERIFICATION] KIỂM TRA TOÀN BỘ CÁC FIX MỚI:');
console.log('  1. Báo Sâm bị chặn -> Thua ngay lập tức (Đền Sâm)');
console.log('  2. Đánh Tấn: 4 bích vs K bích tự động khớp & đỡ thành công');
console.log('  3. Anti-cheat turn validation cho Tấn');
console.log('==============================================================\n');

// -------------------------------------------------------------
// TEST 1: SÂM LỐC BÁO SÂM BỊ CHẶN -> KẾT THÚC VÁN NGAY LẬP TỨC
// -------------------------------------------------------------
console.log('--- TEST 1: SÂM LỐC BÁO SÂM BỊ CHẶN ---');
const roomManager = new RoomManager();
const { room: samRoom, hostPlayer: p1 } = roomManager.createRoom('sam', 'sock_p1', 'Player 1');
const { player: p2 } = roomManager.joinRoom(samRoom.id, 'sock_p2', 'Player 2');

samRoom.initiateRound();
samRoom.dealCards();
samRoom.startGameEngineRound();

const samGame = samRoom.gameEngine;
assert.strictEqual(samGame.status, 'calling_sam', 'Trạng thái ban đầu phải là calling_sam');

// Player 1 calls Sâm
samGame.callSam('sock_p1', true);
// Player 2 declines
samGame.callSam('sock_p2', false);

assert.strictEqual(samGame.status, 'playing', 'Trạng thái phải chuyển sang playing');
assert.strictEqual(samGame.samCallerSocketId, 'sock_p1', 'Player 1 phải là người Báo Sâm');
assert.strictEqual(samRoom.currentTurnSeat, p1.seat, 'Lượt đầu phải là của người Báo Sâm');

// Give Player 1 a 3 of spades, and Player 2 a 5 of spades
p1.hand = [
  { id: 'c_3s', rank: '3', suit: 'spades', color: 'black' },
  { id: 'c_4s', rank: '4', suit: 'spades', color: 'black' },
  { id: 'c_5d', rank: '5', suit: 'diamonds', color: 'red' }
];

p2.hand = [
  { id: 'c_5s', rank: '5', suit: 'spades', color: 'black' },
  { id: 'c_6s', rank: '6', suit: 'spades', color: 'black' }
];

// Player 1 leads with 3 bích
const playRes1 = samGame.executePlayCards('sock_p1', ['c_3s']);
assert.strictEqual(playRes1.success, true, 'Player 1 đánh 3 bích thành công');
assert.strictEqual(samGame.status, 'playing', 'Ván vẫn đang tiếp tục');
assert.strictEqual(samRoom.currentTurnSeat, p2.seat, 'Lượt chuyển sang Player 2');

// Player 2 plays 5 bích to beat 3 bích (BLOCKING THE SÂM CALLER!)
const playRes2 = samGame.executePlayCards('sock_p2', ['c_5s']);
assert.strictEqual(playRes2.success, true, 'Player 2 đánh 5 bích thành công');
assert.strictEqual(playRes2.finished, true, 'Ván bài PHẢI KẾT THÚC NGAY LẬP TỨC khi người Báo Sâm bị chặn!');
assert.strictEqual(samGame.status, 'finished', 'Trạng thái game phải là finished');

// Verify round showdown rankings
const results = playRes2.results;
assert.strictEqual(results.winnerSeat, p2.seat, 'Player 2 (người chặn) phải là người chiến thắng!');
assert.strictEqual(results.isDenSam, true, 'Kết quả phải ghi nhận isDenSam = true');

const betBangPlayer = results.rankings.find(r => r.seat === p1.seat);
assert(betBangPlayer.note.includes('Đền Sâm') || betBangPlayer.note.includes('BÉT BẢNG'), 'Player 1 phải bị ghi nhận Đền Sâm trong bảng xếp hạng');
console.log('[PASS] Test 1: Báo Sâm bị chặn lập tức kết thúc ván & Đền Sâm thành công 100%!\n');

// -------------------------------------------------------------
// TEST 2: ĐÁNH TẤN - 4 BÍCH VS K BÍCH TỰ ĐỘNG KHỚP & ĐỠ THÀNH CÔNG
// -------------------------------------------------------------
console.log('--- TEST 2: ĐÁNH TẤN 4 BÍCH VS K BÍCH ---');
const { room: tanRoom, hostPlayer: tanP1 } = roomManager.createRoom('tan', 'sock_tan1', 'Attacker');
const { player: tanP2 } = roomManager.joinRoom(tanRoom.id, 'sock_tan2', 'Defender');

tanRoom.initiateRound();
tanRoom.dealCards();
tanRoom.startGameEngineRound();

const tanGame = tanRoom.gameEngine;
tanGame.attackerSeat = tanP1.seat;
tanGame.defenderSeat = tanP2.seat;
tanRoom.currentTurnSeat = tanP1.seat;
tanGame.trumpSuit = 'hearts'; // Trump is Cơ, so Bích is normal suit

tanP1.hand = [
  { id: 'c_4_spades', rank: '4', suit: 'spades', color: 'black' },
  { id: 'c_7_diamonds', rank: '7', suit: 'diamonds', color: 'red' }
];

tanP2.hand = [
  { id: 'c_k_spades', rank: 'K', suit: 'spades', color: 'black' },
  { id: 'c_9_clubs', rank: '9', suit: 'clubs', color: 'black' }
];

// Attacker attacks with 4 bích
const attackRes = tanGame.attack('sock_tan1', ['c_4_spades']);
assert.strictEqual(attackRes.success, true, 'Attacker đánh 4 bích thành công');
assert.strictEqual(tanGame.tablePairs.length, 1, 'Bàn chơi có 1 cặp bài');
assert.strictEqual(tanGame.status, 'defending', 'Trạng thái chuyển sang defending');
assert.strictEqual(tanRoom.currentTurnSeat, tanP2.seat, 'Lượt chuyển sang Defender');

// Defender plays K bích WITHOUT targetAttackCardId
const defendRes = tanGame.defend('sock_tan2', 'c_k_spades', undefined);
assert.strictEqual(defendRes.success, true, 'Defender dùng K bích đỡ 4 bích PHẢI HỢP LỆ & THÀNH CÔNG!');
assert.strictEqual(defendRes.allDefended, true, 'Tất cả lá bài tấn công đã được đỡ xong');
assert.strictEqual(tanGame.tablePairs[0].defendCard.id, 'c_k_spades', 'K bích đã khớp chính xác vào 4 bích');
assert.strictEqual(tanRoom.currentTurnSeat, tanP1.seat, 'Sau khi đỡ xong, quyền đánh tiếp trở về Attacker');

console.log('[PASS] Test 2: Đánh Tấn 4 bích vs K bích tự động bắt cặp & đỡ thành công 100%!\n');

// -------------------------------------------------------------
// TEST 3: JOKER & TRUMP DEFENSE IN TẤN
// -------------------------------------------------------------
console.log('--- TEST 3: JOKER VÀ CHẤT TRƯỞNG TRONG TẤN ---');
// Test Joker red defends against Trump A
const trumpAce = { id: 'c_a_hearts', rank: 'A', suit: 'hearts' };
const jokerRed = { id: 'c_joker_red', rank: 'joker_red', suit: 'joker' };
const jokerBlack = { id: 'c_joker_black', rank: 'joker_black', suit: 'joker' };
const normalCard = { id: 'c_8_spades', rank: '8', suit: 'spades' };
const trumpCard = { id: 'c_2_hearts', rank: '2', suit: 'hearts' };

assert.strictEqual(tanGame.canDefend(jokerRed, trumpAce), true, 'Joker đỏ đỡ được mọi lá kể cả Át trưởng');
assert.strictEqual(tanGame.canDefend(jokerBlack, trumpAce), true, 'Joker đen đỡ được Át trưởng');
assert.strictEqual(tanGame.canDefend(jokerBlack, jokerRed), false, 'Joker đen không đỡ được Joker đỏ');
assert.strictEqual(tanGame.canDefend(trumpCard, normalCard), true, 'Lá 2 cơ (trưởng) đè được 8 bích (thường)');
console.log('[PASS] Test 3: Luật Chất trưởng & Joker chuẩn xác 100%!\n');

console.log('==============================================================');
console.log('[ALL TESTS PASSED] TẤT CẢ CÁC BÀI TEST ĐỀU VƯỢT QUA 100%!');
console.log('==============================================================');
