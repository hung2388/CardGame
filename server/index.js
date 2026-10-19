const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { RoomManager, GAME_CONFIGS } = require('./room-manager');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

/**
 * Broadcast scoped state to every player in a room.
 * Each player receives their tailored view:
 * - Hand: Only their cards
 * - Opponents: Card counts only
 * - Relative Seating: View positioned with self at 3 o'clock
 */
function broadcastScopedRoom(room) {
  try {
    if (!room || !room.playerManager) return;
    const players = room.playerManager.getAllPlayers();
    for (const player of players) {
      const scopedState = room.getScopedState(player.socketId);
      io.to(player.socketId).emit('room_state_update', scopedState);
    }
  } catch (err) {
    console.error('[Broadcast Scoped Room Error]:', err);
  }
}

// Health check endpoint for Railway & Frontend status banner
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    activeRooms: roomManager.rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Info endpoint for available games
app.get('/games', (req, res) => {
  res.json(GAME_CONFIGS);
});

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  /**
   * CREATE ROOM
   */
  socket.on('create_room', (data, callback) => {
    try {
      const { gameType = 'three-cards', playerName = 'Chủ Phòng' } = data || {};
      const { room, hostPlayer } = roomManager.createRoom(gameType, socket.id, playerName);
      room.broadcast = () => broadcastScopedRoom(room);

      socket.join(room.id);
      console.log(`[Room Created] ID: ${room.id} | Game: ${gameType} | Host: ${hostPlayer.name} (Seat 1)`);

      const scopedState = room.getScopedState(socket.id);
      if (typeof callback === 'function') {
        callback({ success: true, roomId: room.id, state: scopedState });
      }

      broadcastScopedRoom(room);
    } catch (err) {
      console.error('[Create Room Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * JOIN ROOM
   */
  socket.on('join_room', (data, callback) => {
    try {
      const { roomId, playerName } = data || {};
      if (!roomId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Thiếu mã phòng!' });
        return;
      }

      const result = roomManager.joinRoom(roomId.toString().trim(), socket.id, playerName);
      if (result.error) {
        if (typeof callback === 'function') callback({ success: false, error: result.error });
        return;
      }

      const { room, player } = result;
      socket.join(room.id);
      console.log(`[Player Joined] Room: ${room.id} | Player: ${player.name} (Seat ${player.seat})`);

      const scopedState = room.getScopedState(socket.id);
      if (typeof callback === 'function') {
        callback({ success: true, roomId: room.id, state: scopedState });
      }

      broadcastScopedRoom(room);
    } catch (err) {
      console.error('[Join Room Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * START GAME (HOST ONLY)
   */
  socket.on('start_game', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Không tìm thấy phòng!' });
        return;
      }

      const player = room.playerManager.getPlayerBySocketId(socket.id);
      if (!player || !player.isHost) {
        if (typeof callback === 'function') callback({ success: false, error: 'Chỉ chủ phòng mới có quyền bắt đầu ván!' });
        return;
      }

      // Step 1: Initiate round (Crypto random selection of starter & direction)
      const roundMeta = room.initiateRound();
      console.log(`[Round Started] Room: ${room.id} | Starter Seat: ${roundMeta.starterSeat} | Direction: ${roundMeta.direction}`);

      // Notify clients to run synchronized spinner animation
      io.to(room.id).emit('spin_selection_start', {
        starterSeat: roundMeta.starterSeat,
        direction: roundMeta.direction,
        spinDurationMs: 4000
      });

      broadcastScopedRoom(room);

      if (typeof callback === 'function') {
        callback({ success: true, starterSeat: roundMeta.starterSeat, direction: roundMeta.direction });
      }

      // Step 2: Trigger Shuffle animation right as spinner ends (3.4s)
      setTimeout(() => {
        if (roomManager.getRoom(room.id)) {
          io.to(room.id).emit('cards_shuffling_notice', {
            roomId: room.id,
            deckCount: room.deckEngine?.remainingCount || 52
          });
        }
      }, 3400);

      // Step 3: Deal cards authoritatively at 4.4s
      setTimeout(() => {
        if (roomManager.getRoom(room.id)) {
          room.dealCards();
          console.log(`[Cards Dealt] Room: ${room.id} | Round: ${room.roundNumber}`);
          
          io.to(room.id).emit('cards_dealt_notice', {
            cardsPerPlayer: room.config.cardsPerPlayer,
            currentTurnSeat: room.currentTurnSeat
          });

          // Start game engine round (e.g. 3-cards countdown & reveal phase)
          room.startGameEngineRound((showdownResults) => {
            if (!showdownResults) return;
            console.log(`[Showdown Completed] Room: ${room.id} | Winner: ${showdownResults.winnerName} (${showdownResults.winnerRankName})`);
            broadcastScopedRoom(room);
            io.to(room.id).emit('round_showdown', showdownResults);
          });

          broadcastScopedRoom(room);
        }
      }, 4400);

    } catch (err) {
      console.error('[Start Game Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * REVEAL CARDS (LẬT BÀI / MỞ BÀI)
   */
  socket.on('reveal_cards', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || !room.gameEngine) {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không tồn tại!' });
        return;
      }

      room.gameEngine.revealHand(socket.id, (showdownResults) => {
        console.log(`[Showdown Completed] Room: ${room.id} | Winner: ${showdownResults.winnerName}`);
        broadcastScopedRoom(room);
        io.to(room.id).emit('round_showdown', showdownResults);
      });

      broadcastScopedRoom(room);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Reveal Cards Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * NEW ROUND (VÁN MỚI)
   */
  socket.on('new_round', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không tồn tại!' });
        return;
      }

      const player = room.playerManager.getPlayerBySocketId(socket.id);
      if (!player || !player.isHost) {
        if (typeof callback === 'function') callback({ success: false, error: 'Chỉ chủ phòng mới có thể bắt đầu ván mới!' });
        return;
      }

      room.status = 'lobby';
      room.tableCards = [];
      if (room.gameEngine) {
        room.gameEngine.status = 'idle';
      }
      for (const p of room.playerManager.getAllPlayers()) {
        p.hand = [];
      }

      broadcastScopedRoom(room);
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[New Round Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * CALL SÂM (BÁO SÂM)
   */
  socket.on('call_sam', (data, callback) => {
    try {
      const { doesCall = true } = data || {};
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || !room.gameEngine || room.gameType !== 'sam') {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không hợp lệ!' });
        return;
      }

      room.gameEngine.callSam(socket.id, doesCall);
      if (room.gameEngine.status === 'calling_sam') {
        broadcastScopedRoom(room);
      }
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[Call Sam Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * CHALLENGE ("MÁY SAI" NÚT)
   */
  socket.on('challenge', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || !room.gameEngine || room.gameType !== 'sam') {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không hợp lệ!' });
        return;
      }

      const res = room.gameEngine.challengeAutoPass(socket.id);
      broadcastScopedRoom(room);
      if (typeof callback === 'function') callback(res);
    } catch (err) {
      console.error('[Challenge Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * PLAY CARDS (ANTI-CHEAT VALIDATED ACTION)
   */
  socket.on('play_cards', (data, callback) => {
    try {
      const { cardIds } = data || {};
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) return callback && callback({ success: false, error: 'Phòng không tồn tại!' });

      const player = room.playerManager.getPlayerBySocketId(socket.id);
      if (!player) return callback && callback({ success: false, error: 'Người chơi không hợp lệ!' });

      // Anti-Cheat: Validate Turn & Allowed Actions
      let isAllowedTurn = (room.currentTurnSeat === player.seat);
      if (room.gameType === 'tan' && room.gameEngine) {
        if (player.seat === room.gameEngine.defenderSeat) {
          // Defender can defend if there are undefended cards on table
          isAllowedTurn = room.gameEngine.tablePairs.some(p => !p.defendCard);
        } else {
          // Attacker can lead, or any non-defender can pile on once attack cards exist
          if (room.gameEngine.tablePairs.length === 0) {
            isAllowedTurn = (player.seat === room.gameEngine.attackerSeat);
          } else {
            isAllowedTurn = true; // Pile-on allowed for all non-defenders
          }
        }
      }

      if (!isAllowedTurn) {
        return callback && callback({ success: false, error: 'Chưa đến lượt hoặc hành động không được phép!' });
      }

      // Anti-Cheat: Validate Card Ownership
      if (!Array.isArray(cardIds) || cardIds.length === 0) {
        return callback && callback({ success: false, error: 'Vui lòng chọn lá bài hợp lệ!' });
      }

      const playerHandIds = player.hand.map(c => c.id);
      const ownsAll = cardIds.every(id => playerHandIds.includes(id));
      if (!ownsAll) {
        console.warn(`[CHEAT ATTEMPT] Player ${player.name} tried playing cards they don't own:`, cardIds);
        return callback && callback({ success: false, error: 'Lá bài không hợp lệ trong tay của bạn!' });
      }

      // Route to Sâm game engine
      if (room.gameType === 'sam' && room.gameEngine) {
        const playRes = room.gameEngine.executePlayCards(socket.id, cardIds);
        if (!playRes.success) return callback && callback(playRes);

        // Notify all clients to animate card played
        io.to(room.id).emit('card_played_action', {
          seat: player.seat,
          playerName: player.name,
          cards: playRes.combo?.cards || []
        });

        if (playRes.finished) {
          console.log(`[Sâm Finished] Winner: ${playRes.results.winnerName}`);
          broadcastScopedRoom(room);
          io.to(room.id).emit('round_showdown', playRes.results);
          return callback && callback({ success: true, finished: true });
        }

        broadcastScopedRoom(room);
        return callback && callback({ success: true });
      }

      // Route to Đánh Tấn game engine
      if (room.gameType === 'tan' && room.gameEngine) {
        let res;
        const isDefender = (player.seat === room.gameEngine.defenderSeat);
        if (isDefender) {
          const { targetAttackCardId } = data || {};
          res = room.gameEngine.defend(socket.id, cardIds[0], targetAttackCardId);
        } else {
          res = room.gameEngine.attack(socket.id, cardIds);
        }
        if (!res.success) return callback && callback(res);

        // Notify all clients to animate card played
        io.to(room.id).emit('card_played_action', {
          seat: player.seat,
          playerName: player.name,
          cards: isDefender ? [res.defendCard || res.pair?.defendCard] : (res.attackCards || []),
          actionType: isDefender ? 'defend' : 'attack'
        });

        if (room.gameEngine.status === 'finished') {
          broadcastScopedRoom(room);
          io.to(room.id).emit('round_showdown', room.gameEngine.roundResults);
          return callback && callback({ success: true, finished: true });
        }
        broadcastScopedRoom(room);
        return callback && callback({ success: true });
      }

      // Route to UNO game engine
      if (room.gameType === 'uno' && room.gameEngine) {
        const { chosenColor } = data || {};
        const playRes = room.gameEngine.playCard(socket.id, cardIds[0], chosenColor);
        if (!playRes.success) return callback && callback(playRes);

        io.to(room.id).emit('card_played_action', {
          seat: player.seat,
          playerName: player.name,
          cards: [playRes.card],
          chosenColor: playRes.activeColor
        });

        if (playRes.finished) {
          console.log(`[UNO Finished] Winner: ${playRes.results.winnerName}`);
          broadcastScopedRoom(room);
          io.to(room.id).emit('round_showdown', playRes.results);
          return callback && callback({ success: true, finished: true });
        }
        broadcastScopedRoom(room);
        return callback && callback({ success: true });
      }

      // Route to Exploding Kittens game engine
      if (room.gameType === 'exploding-kittens' && room.gameEngine) {
        const { targetSeat } = data || {};
        const playRes = room.gameEngine.playCard(socket.id, cardIds[0], targetSeat);
        if (!playRes.success) return callback && callback(playRes);

        io.to(room.id).emit('card_played_action', {
          seat: player.seat,
          playerName: player.name,
          cards: [playRes.card]
        });

        broadcastScopedRoom(room);
        return callback && callback(playRes);
      }

      // Default generic card play logic (e.g. for testing / generic modes)
      const playedCards = player.hand.filter(c => cardIds.includes(c.id));
      player.hand = player.hand.filter(c => !cardIds.includes(c.id));
      room.tableCards.push(...playedCards);
      room.advanceTurn();

      io.to(room.id).emit('card_played_action', {
        seat: player.seat,
        playerName: player.name,
        cards: playedCards
      });

      console.log(`[Card Played] Player: ${player.name} (Seat ${player.seat}) | Cards: ${cardIds.join(', ')}`);
      if (typeof callback === 'function') callback({ success: true });
      broadcastScopedRoom(room);

    } catch (err) {
      console.error('[Play Cards Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * PASS TURN
   */
  socket.on('pass_turn', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) return callback && callback({ success: false, error: 'Phòng không tồn tại!' });

      const player = room.playerManager.getPlayerBySocketId(socket.id);
      if (!player) return callback && callback({ success: false, error: 'Người chơi không hợp lệ!' });

      // Route to Đánh Tấn game engine (Attackers pass / done attacking)
      if (room.gameType === 'tan' && room.gameEngine) {
        if (player.seat === room.gameEngine.defenderSeat) {
          return callback && callback({ success: false, error: 'Người phòng thủ không thể bỏ lượt, phải đỡ bài hoặc Lên Bài!' });
        }
        const passRes = room.gameEngine.passAttack(socket.id);
        if (!passRes.success) return callback && callback(passRes);
        broadcastScopedRoom(room);
        return callback && callback(passRes);
      }

      if (room.currentTurnSeat !== player.seat) {
        return callback && callback({ success: false, error: 'Chưa đến lượt của bạn!' });
      }

      // Route to Sâm game engine
      if (room.gameType === 'sam' && room.gameEngine) {
        const passRes = room.gameEngine.executePass(socket.id);
        if (!passRes.success) return callback && callback(passRes);
        broadcastScopedRoom(room);
        return callback && callback({ success: true });
      }

      room.advanceTurn();
      console.log(`[Pass Turn] Player: ${player.name} passed. Next seat: ${room.currentTurnSeat}`);

      if (typeof callback === 'function') callback({ success: true });
      broadcastScopedRoom(room);
    } catch (err) {
      console.error('[Pass Turn Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * DRAW CARD (UNO & EXPLODING KITTENS)
   */
  socket.on('draw_card', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || !room.gameEngine) {
        if (typeof callback === 'function') callback({ success: false, error: 'Phòng không tồn tại!' });
        return;
      }

      const player = room.playerManager.getPlayerBySocketId(socket.id);
      let drawRes;
      if (room.gameType === 'uno') {
        drawRes = room.gameEngine.drawCard(socket.id);
      } else if (room.gameType === 'exploding-kittens') {
        drawRes = room.gameEngine.drawCardToEndTurn(socket.id);
        if (drawRes.finished) {
          console.log(`[Exploding Kittens Finished] Winner: ${drawRes.results.winnerName}`);
          broadcastScopedRoom(room);
          io.to(room.id).emit('round_showdown', drawRes.results);
          if (typeof callback === 'function') callback(drawRes);
          return;
        }
      } else {
        drawRes = { success: false, error: 'Trò chơi này không cho phép tự do bốc bài!' };
      }

      if (drawRes.success && player) {
        io.to(room.id).emit('card_drawn_action', {
          seat: player.seat,
          playerName: player.name,
          count: 1
        });
      }

      broadcastScopedRoom(room);
      if (typeof callback === 'function') callback(drawRes);
    } catch (err) {
      console.error('[Draw Card Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * PICK UP CARDS (LÊN BÀI TRONG ĐÁNH TẤN)
   */
  socket.on('pick_up', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || !room.gameEngine || room.gameType !== 'tan') {
        if (typeof callback === 'function') callback({ success: false, error: 'Không phải ván Đánh Tấn!' });
        return;
      }

      const player = room.playerManager.getPlayerBySocketId(socket.id);
      const res = room.gameEngine.pickUp(socket.id);
      if (res.success && player) {
        io.to(room.id).emit('tan_pickup_action', {
          seat: player.seat,
          playerName: player.name,
          count: res.pickedUpCardsCount || 0
        });
      }

      broadcastScopedRoom(room);
      if (typeof callback === 'function') callback(res);
    } catch (err) {
      console.error('[Pick Up Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * CALL UNO (HÔ UNO)
   */
  socket.on('call_uno', (data, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room || !room.gameEngine || room.gameType !== 'uno') {
        if (typeof callback === 'function') callback({ success: false, error: 'Không phải ván đấu UNO!' });
        return;
      }

      const res = room.gameEngine.callUno(socket.id);
      broadcastScopedRoom(room);
      if (res.success) {
        io.to(room.id).emit('uno_call_shout', { message: res.message });
      }
      if (typeof callback === 'function') callback(res);
    } catch (err) {
      console.error('[Call Uno Error]:', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * DISCONNECT / LEAVE
   */
  const handleLeave = (isExplicit = false) => {
    const result = roomManager.leaveRoom(socket.id, isExplicit);
    if (result) {
      const { roomId, room, roomDeleted, leftPlayer, isOfflineOnly } = result;
      if (roomDeleted) {
        console.log(`[Room Deleted] ID: ${roomId} (all players left)`);
      } else if (room) {
        if (isOfflineOnly) {
          console.log(`[Player Offline (Saved)] Room: ${roomId} | Player: ${leftPlayer.name}`);
        } else {
          console.log(`[Player Left] Room: ${roomId} | Player: ${leftPlayer.name}`);
        }
        broadcastScopedRoom(room);
      }
    }
  };

  socket.on('leave_room', () => handleLeave(true));
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    handleLeave(false);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`CARDPUNK Backend Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`===============================================`);
});
