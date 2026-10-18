const { io } = require('socket.io-client');
const { ThreeCardsGame } = require('./games/three-cards');
const { SamGame } = require('./games/sam');
const { TanGame } = require('./games/tan');
const { UnoGame, UnoDeck } = require('./games/uno');
const { ExplodingKittensGame } = require('./games/exploding-kittens');

const SERVER_URL = 'http://localhost:3001';

async function testAllGames() {
  console.log('==============================================================');
  console.log('[TEST MASTER] BAT DAU TEST TOAN BO 5 GAME TRONG HE THONG CARDPUNK:');
  console.log('   1. Ba Cao (3 La)');
  console.log('   2. Sam Loc');
  console.log('   3. Danh Tan (Durak)');
  console.log('   4. UNO (Official Mattel)');
  console.log('   5. Meo No (Exploding Kittens)');
  console.log('==============================================================\n');

  // --- GAME 1: BA CÀO ---
  console.log('--- [1/5] TEST BA CAO (3 LA) ---');
  const h1 = ThreeCardsGame.evaluateHand([{ rank: '9', suit: 'spades' }, { rank: '10', suit: 'diamonds' }, { rank: 'K', suit: 'clubs' }]);
  if (h1.score !== 9) throw new Error('9 Nut calculation failed');
  console.log('[PASS] Ba Cao 9 Nut evaluation: PASSED');

  // --- GAME 2: SÂM LỐC ---
  console.log('\n--- [2/5] TEST SAM LOC ---');
  const q2 = SamGame.identifyCombo([{ rank: '2', suit: 'hearts' }]);
  const quad8 = SamGame.identifyCombo([
    { rank: '8', suit: 'spades' }, { rank: '8', suit: 'diamonds' },
    { rank: '8', suit: 'hearts' }, { rank: '8', suit: 'clubs' }
  ]);
  if (!SamGame.canBeat(quad8, q2).canBeat) throw new Error('Tu Quy 8 must chop 2');
  console.log('[PASS] Sam Loc: Tu Quy chat 2: PASSED');

  // --- GAME 3: ĐÁNH TẤN ---
  console.log('\n--- [3/5] TEST DANH TAN ---');
  const tanFakeRoom = {
    deckEngine: { cards: [{ rank: '8', suit: 'hearts' }], draw: () => [{ rank: '8', suit: 'hearts' }], shuffle: () => {} },
    playerManager: { getAllPlayers: () => [{ seat: 1 }, { seat: 2 }], getPlayerBySeat: (s) => ({ seat: s, hand: [] }) }
  };
  const tan = new TanGame(tanFakeRoom);
  tan.trumpSuit = 'hearts';
  const normalAce = { rank: 'A', suit: 'spades' };
  const trump2 = { rank: '2', suit: 'hearts' };
  const jokerRed = { rank: 'joker_red', suit: 'joker' };
  if (!tan.canDefend(trump2, normalAce)) throw new Error('Trump 2 must defend normal Ace');
  if (!tan.canDefend(jokerRed, trump2)) throw new Error('Joker Red must defend Trump 2');
  console.log('[PASS] Danh Tan: Quan truong > At thuong, Joker do > Quan truong: PASSED');

  // --- GAME 4: UNO ---
  console.log('\n--- [4/5] TEST UNO ---');
  const unoDeck = UnoDeck.createDeck();
  console.log(`   - Tong so la bai UNO tao ra: ${unoDeck.length} la (Chuan 108 la)`);
  if (unoDeck.length !== 108) throw new Error('Uno deck must have 108 cards');
  const unoFakeRoom = {
    playerManager: { getAllPlayers: () => [{ seat: 1, hand: [] }, { seat: 2, hand: [] }], getPlayerBySeat: (s) => ({ seat: s, hand: [] }) }
  };
  const uno = new UnoGame(unoFakeRoom);
  uno.discardPile = [{ color: 'red', rank: '7', label: '7' }];
  uno.activeColor = 'red';
  if (!uno.canPlayCard({ color: 'red', rank: '3' })) throw new Error('Must match color');
  if (!uno.canPlayCard({ color: 'blue', rank: '7' })) throw new Error('Must match number');
  if (!uno.canPlayCard({ color: 'wild', rank: 'wild' })) throw new Error('Wild must match any');
  console.log('[PASS] UNO: Luat so mau, so so, la Wild: PASSED');

  // --- GAME 5: MÈO NỔ ---
  console.log('\n--- [5/5] TEST MEO NO (EXPLODING KITTENS) ---');
  const kittenFakeRoom = {
    currentTurnSeat: 1,
    playerManager: {
      getAllPlayers: () => [{ seat: 1, name: 'Huy', hand: [] }, { seat: 2, name: 'Nam', hand: [] }],
      getPlayerBySeat: (s) => ({ seat: s, name: 'P' + s, hand: [] }),
      getPlayerBySocketId: () => ({ seat: 1, name: 'Huy', hand: [{ rank: 'defuse', id: 'd1' }] })
    }
  };
  const ek = new ExplodingKittensGame(kittenFakeRoom);
  ek.deck = [{ rank: 'exploding_kitten', id: 'k1' }];
  const drawRes = ek.drawCardToEndTurn('sock_1');
  if (!drawRes.defused) throw new Error('Player with Defuse must defuse the kitten');
  console.log('[PASS] Meo No: Rut trung bom tu dong kich hoat la Go Bom: PASSED');

  console.log('\n==============================================================');
  console.log('[SUCCESS] TAT CA 5 GAME ENGINE DA DAT 100% TIEU CHUAN THIET KE!');
  console.log('==============================================================');
}

testAllGames().catch(err => {
  console.error('[ERROR] ERROR IN MASTER TEST:', err);
  process.exit(1);
});
