const { PlayerManager } = require('./player-manager');
const { DeckEngine } = require('./deck-engine');
const { secureRandomInt } = require('./utils/crypto-shuffle');
const { ThreeCardsGame } = require('./games/three-cards');
const { SamGame } = require('./games/sam');
const { TanGame } = require('./games/tan');
const { UnoGame } = require('./games/uno');
const { ExplodingKittensGame } = require('./games/exploding-kittens');

const GAME_CONFIGS = {
  'three-cards': {
    name: 'Ba Cào (3 Lá)',
    minPlayers: 2,
    maxPlayers: 12,
    deckCount: 1,
    cardsPerPlayer: 3
  },
  'sam': {
    name: 'Sâm Lốc',
    minPlayers: 2,
    maxPlayers: 12,
    deckCount: 1,
    cardsPerPlayer: 10
  },
  'tan': {
    name: 'Đánh Tấn',
    minPlayers: 2,
    maxPlayers: 12,
    deckCount: 1,
    cardsPerPlayer: 8
  },
  'uno': {
    name: 'UNO',
    minPlayers: 2,
    maxPlayers: 12,
    deckCount: 1,
    cardsPerPlayer: 7
  },
  'exploding-kittens': {
    name: 'Mèo Nổ',
    minPlayers: 2,
    maxPlayers: 12,
    deckCount: 1,
    cardsPerPlayer: 5
  }
};

class Room {
  constructor(roomId, gameType = 'three-cards', hostName = 'Chủ Phòng') {
    this.id = roomId;
    this.gameType = gameType;
    this.config = GAME_CONFIGS[gameType] || GAME_CONFIGS['three-cards'];
    
    this.playerManager = new PlayerManager(this.config.maxPlayers || 12);
    this.deckEngine = new DeckEngine(this.config.deckCount);
    
    this.status = 'lobby'; // lobby, spinning_starter, spinning_direction, dealing, playing, round_end
    this.direction = 'clockwise'; // clockwise | counter_clockwise
    this.starterSeat = null;
    this.currentTurnSeat = null;
    this.roundNumber = 0;
    
    this.tableCards = [];
    this.discardPile = [];
    this.history = [];
    this.createdAt = Date.now();

    // Instantiate game-specific engine
    if (this.gameType === 'three-cards') {
      this.gameEngine = new ThreeCardsGame(this);
    } else if (this.gameType === 'sam') {
      this.gameEngine = new SamGame(this);
    } else if (this.gameType === 'tan') {
      this.gameEngine = new TanGame(this);
    } else if (this.gameType === 'uno') {
      this.gameEngine = new UnoGame(this);
    } else if (this.gameType === 'exploding-kittens') {
      this.gameEngine = new ExplodingKittensGame(this);
    } else {
      this.gameEngine = null;
    }
  }

  /**
   * Start game cycle:
   * 1. Pick starter seat randomly via secure random
   * 2. Pick direction randomly (clockwise vs counter_clockwise)
   * 3. Prepare deck and deal
   */
  initiateRound() {
    const players = this.playerManager.getAllPlayers();
    if (players.length < this.config.minPlayers) {
      throw new Error(`Cần tối thiểu ${this.config.minPlayers} người chơi để bắt đầu!`);
    }

    this.roundNumber += 1;
    this.status = 'spinning_starter';
    this.tableCards = [];
    this.discardPile = [];

    // Clear previous hands
    for (const p of players) {
      p.hand = [];
    }

    // Pick starter randomly from currently seated players
    // Anti-repeat: if >= 2 players, avoid picking the exact same starter seat consecutively
    let candidatePlayers = players;
    if (players.length >= 2 && this.starterSeat) {
      const otherPlayers = players.filter(p => p.seat !== this.starterSeat);
      if (otherPlayers.length > 0) {
        candidatePlayers = otherPlayers;
      }
    }
    const randomPlayerIndex = secureRandomInt(0, candidatePlayers.length - 1);
    this.starterSeat = candidatePlayers[randomPlayerIndex].seat;

    // Pick direction randomly (50% clockwise, 50% counter_clockwise)
    this.direction = secureRandomInt(0, 1) === 0 ? 'clockwise' : 'counter_clockwise';

    // Dynamically scale decks based on player count (e.g. Sâm with 12 players = 3 decks = 156 cards)
    let deckCount = this.config.deckCount || 1;
    if (this.gameType === 'sam') {
      deckCount = Math.max(1, Math.ceil((players.length * 10 + 10) / 52));
    } else if (this.gameType === 'tan') {
      deckCount = Math.max(1, Math.ceil((players.length * 8 + 20) / 52));
    } else if (this.gameType === 'three-cards') {
      deckCount = Math.max(1, Math.ceil((players.length * 3 + 10) / 52));
    }

    // Reset and shuffle dynamically scaled deck
    this.deckEngine = new DeckEngine(deckCount);
    this.deckEngine.shuffle();

    return {
      starterSeat: this.starterSeat,
      direction: this.direction
    };
  }

  /**
   * Authoritative card deal: each player receives specified number of cards
   */
  dealCards() {
    const players = this.playerManager.getAllPlayers();
    const count = this.config.cardsPerPlayer;

    // Deal one card at a time in play direction, simulating physical dealing
    for (let round = 0; round < count; round++) {
      for (const p of players) {
        const drawn = this.deckEngine.draw(1);
        if (drawn.length > 0) {
          p.hand.push(drawn[0]);
        }
      }
    }

    this.status = 'playing';
    this.currentTurnSeat = this.starterSeat;

    return {
      dealt: true,
      remainingInDeck: this.deckEngine.remainingCount
    };
  }

  /**
   * Start game engine round logic
   */
  startGameEngineRound(onShowdownCallback) {
    if (this.gameEngine && typeof this.gameEngine.startRound === 'function') {
      this.gameEngine.startRound(onShowdownCallback);
    }
  }

  /**
   * Move turn to next player in current direction
   */
  advanceTurn() {
    const players = this.playerManager.getAllPlayers();
    if (players.length === 0) return null;

    const seats = players.map(p => p.seat);
    const currentIndex = seats.indexOf(this.currentTurnSeat);

    let nextIndex;
    if (this.direction === 'clockwise') {
      nextIndex = (currentIndex + 1) % seats.length;
    } else {
      nextIndex = (currentIndex - 1 + seats.length) % seats.length;
    }

    this.currentTurnSeat = seats[nextIndex];
    return this.currentTurnSeat;
  }

  /**
   * CRITICAL ANTI-CHEAT:
   * Build scoped state specifically for one socketId.
   * Client NEVER receives other players' hand cards or deck order!
   */
  getScopedState(socketId) {
    const viewer = this.playerManager.getPlayerBySocketId(socketId);
    const viewerSeat = viewer ? viewer.seat : 1;
    const allPlayers = this.playerManager.getAllPlayers();

    // Game specific data computation
    let gameData = null;
    if (this.gameType === 'three-cards' && this.gameEngine) {
      const viewerHand = viewer ? viewer.hand : [];
      const myEval = viewerHand.length === 3 ? ThreeCardsGame.evaluateHand(viewerHand) : null;
      const revealedSeats = [];
      for (const p of allPlayers) {
        if (this.gameEngine.playerReveals.get(p.socketId)) {
          revealedSeats.push(p.seat);
        }
      }

      gameData = {
        engineStatus: this.gameEngine.status, // revealing, finished
        myEvaluation: myEval,
        hasRevealed: viewer ? (this.gameEngine.playerReveals.get(viewer.socketId) || false) : false,
        revealedSeats,
        roundResults: this.gameEngine.status === 'finished' ? this.gameEngine.roundResults : null
      };
    } else if (this.gameType === 'sam' && this.gameEngine) {
      const hasCalled = this.gameEngine.samCalls.get(socketId);
      gameData = {
        engineStatus: this.gameEngine.status, // calling_sam, playing, finished
        hasSamCaller: Boolean(this.gameEngine.samCallerSocketId),
        samCallerSeat: this.gameEngine.samCallerSocketId ? this.playerManager.getPlayerBySocketId(this.gameEngine.samCallerSocketId)?.seat : null,
        hasCalledSam: hasCalled !== undefined,
        didCallSam: Boolean(hasCalled),
        samDeadline: this.gameEngine.samDeadline || 0,
        turnDeadline: this.gameEngine.turnDeadline || 0,
        lastValidCombo: this.gameEngine.lastValidCombo,
        passedSeats: Array.from(this.gameEngine.passedSeats),
        roundResults: this.gameEngine.roundResults
      };
    } else if (this.gameType === 'tan' && this.gameEngine) {
      gameData = {
        engineStatus: this.gameEngine.status,
        trumpSuit: this.gameEngine.trumpSuit,
        trumpCard: this.gameEngine.trumpCard,
        tablePairs: this.gameEngine.tablePairs,
        attackerSeat: this.gameEngine.attackerSeat,
        defenderSeat: this.gameEngine.defenderSeat,
        roundResults: this.gameEngine.roundResults
      };
    } else if (this.gameType === 'uno' && this.gameEngine) {
      gameData = {
        engineStatus: this.gameEngine.status,
        activeColor: this.gameEngine.activeColor,
        topCard: this.gameEngine.topCard,
        hasCalledUno: this.gameEngine.unoCalledPlayers.has(socketId),
        roundResults: this.gameEngine.roundResults
      };
    } else if (this.gameType === 'exploding-kittens' && this.gameEngine) {
      gameData = {
        engineStatus: this.gameEngine.status,
        turnsRemaining: this.gameEngine.turnsRemainingForCurrentPlayer,
        eliminatedSeats: Array.from(this.gameEngine.eliminatedSeats),
        roundResults: this.gameEngine.roundResults
      };
    }

    // Map players list for viewer:
    // Relative visual positions calculated so viewer is ALWAYS at 3 o'clock (visualOffset: 0)
    const relativeSeating = this.playerManager.getRelativeSeatingFor(viewerSeat);

    // Sanitize players info (hide other players' cards, only show count)
    // If finished / showdown, reveal cards
    const isShowdown = this.gameEngine && this.gameEngine.status === 'finished';

    const sanitizedPlayers = relativeSeating.map(rp => {
      const isSelf = rp.seat === viewerSeat;
      const playerObj = this.playerManager.getPlayerBySeat(rp.seat);
      const isRevealed = this.gameEngine?.playerReveals?.get(playerObj ? playerObj.socketId : '');

      return {
        seat: rp.seat,
        visualOffset: rp.visualOffset,
        name: rp.name,
        isHost: rp.isHost,
        isOnline: rp.isOnline,
        isReady: rp.isReady,
        cardCount: rp.cardCount,
        score: playerObj ? playerObj.score : 0,
        isSelf,
        isCurrentTurn: rp.seat === this.currentTurnSeat,
        isStarter: rp.seat === this.starterSeat,
        hasRevealed: Boolean(isRevealed),
        // Reveal cards ONLY on showdown or for oneself
        revealedHand: (isShowdown || isSelf) && playerObj ? playerObj.hand : null,
        revealedEvaluation: isShowdown && playerObj && this.gameEngine?.evaluations ? (this.gameEngine.evaluations.get(playerObj.socketId) || null) : null
      };
    });

    return {
      roomId: this.id,
      gameType: this.gameType,
      gameName: this.config.name,
      status: this.status,
      direction: this.direction,
      starterSeat: this.starterSeat,
      currentTurnSeat: this.currentTurnSeat,
      roundNumber: this.roundNumber,
      
      // Viewer specific
      mySeat: viewerSeat,
      myHand: viewer ? viewer.hand : [], // ONLY own cards!
      isMyTurn: viewer ? viewer.seat === this.currentTurnSeat : false,
      isHost: viewer ? viewer.isHost : false,

      // Game engine state
      gameData,

      // Public table state
      players: sanitizedPlayers,
      tableCards: this.tableCards,
      discardCount: this.discardPile.length,
      topDiscardCard: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      deckRemainingCount: this.deckEngine.remainingCount,
      
      // Config limits
      minPlayers: this.config.minPlayers,
      maxPlayers: this.config.maxPlayers,
      
      timestamp: Date.now()
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  /**
   * Generate 6-digit random room code
   */
  generateRoomId() {
    let id;
    do {
      id = secureRandomInt(100000, 999999).toString();
    } while (this.rooms.has(id));
    return id;
  }

  /**
   * Create a new room
   */
  createRoom(gameType, hostSocketId, hostName) {
    const roomId = this.generateRoomId();
    const room = new Room(roomId, gameType, hostName);
    
    // Add host as seat 1
    const hostPlayer = room.playerManager.addPlayer(hostSocketId, hostName, true);
    this.rooms.set(roomId, room);

    return { room, hostPlayer };
  }

  /**
   * Join an existing room
   */
  joinRoom(roomId, socketId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: 'Phòng không tồn tại!' };
    }

    // Check if player is reconnecting with same name
    const existingPlayer = room.playerManager.getAllPlayers().find(p => p.name === playerName);
    if (existingPlayer) {
      room.playerManager.socketToSeat.delete(existingPlayer.socketId);
      existingPlayer.socketId = socketId;
      existingPlayer.isOnline = true;
      room.playerManager.socketToSeat.set(socketId, existingPlayer.seat);
      return { room, player: existingPlayer, reconnected: true };
    }

    if (room.status !== 'lobby') {
      return { error: 'Trò chơi đang diễn ra, không thể tham gia!' };
    }

    if (room.playerManager.count >= room.config.maxPlayers) {
      return { error: `Phòng đã đầy (tối đa ${room.config.maxPlayers} người)!` };
    }

    const player = room.playerManager.addPlayer(socketId, playerName, false);
    if (!player) {
      return { error: 'Không thể xếp chỗ ngồi!' };
    }

    return { room, player };
  }

  /**
   * Leave room (distinguish explicit departure from transient disconnect)
   */
  leaveRoom(socketId, isExplicitLeave = false) {
    for (const [roomId, room] of this.rooms.entries()) {
      const player = room.playerManager.getPlayerBySocketId(socketId);
      if (player) {
        if (!isExplicitLeave && room.status !== 'lobby') {
          // Transient network drop during active game: keep hand/seat, mark offline
          player.isOnline = false;
          return { roomId, room, leftPlayer: player, isOfflineOnly: true };
        }
        room.playerManager.removePlayer(socketId);
        // If room is empty, clean it up
        if (room.playerManager.count === 0) {
          this.rooms.delete(roomId);
          return { roomId, roomDeleted: true };
        }
        return { roomId, room, leftPlayer: player };
      }
    }
    return null;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Find room containing socketId
   */
  getRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.playerManager.getPlayerBySocketId(socketId)) {
        return room;
      }
    }
    return null;
  }
}

module.exports = {
  Room,
  RoomManager,
  GAME_CONFIGS
};
