class PlayerManager {
  /**
   * @param {number} maxSeats Maximum players allowed for room
   */
  constructor(maxSeats = 8) {
    this.maxSeats = maxSeats;
    // Map from seat number (1-based) to player object
    this.seats = new Map();
    // Map from socketId to seat number
    this.socketToSeat = new Map();
  }

  /**
   * Add a player to the first available seat (clockwise order: 1, 2, 3...)
   * @param {string} socketId 
   * @param {string} name 
   * @param {boolean} isHost 
   * @returns {object|null} The player object or null if room is full
   */
  addPlayer(socketId, name, isHost = false) {
    // Check if player is already seated
    if (this.socketToSeat.has(socketId)) {
      const seat = this.socketToSeat.get(socketId);
      return this.seats.get(seat);
    }

    // Find smallest available seat 1..maxSeats
    let chosenSeat = null;
    for (let seat = 1; seat <= this.maxSeats; seat++) {
      if (!this.seats.has(seat)) {
        chosenSeat = seat;
        break;
      }
    }

    if (chosenSeat === null) {
      return null; // Room is full
    }

    const player = {
      socketId,
      name: name || `Người chơi ${chosenSeat}`,
      seat: chosenSeat,
      isHost,
      isReady: isHost, // Host is ready by default
      isOnline: true,
      hand: [],
      score: 0,
      joinedAt: Date.now()
    };

    this.seats.set(chosenSeat, player);
    this.socketToSeat.set(socketId, chosenSeat);

    return player;
  }

  /**
   * Remove player by socket ID
   * @param {string} socketId 
   * @returns {object|null} Removed player
   */
  removePlayer(socketId) {
    const seat = this.socketToSeat.get(socketId);
    if (!seat) return null;

    const player = this.seats.get(seat);
    this.seats.delete(seat);
    this.socketToSeat.delete(socketId);

    // If host left, assign host to lowest seat remaining
    if (player.isHost && this.seats.size > 0) {
      const remainingSeats = Array.from(this.seats.keys()).sort((a, b) => a - b);
      const newHost = this.seats.get(remainingSeats[0]);
      if (newHost) {
        newHost.isHost = true;
      }
    }

    return player;
  }

  /**
   * Get player by socket ID
   */
  getPlayerBySocketId(socketId) {
    const seat = this.socketToSeat.get(socketId);
    return seat ? this.seats.get(seat) : null;
  }

  /**
   * Get player by seat number (1-based)
   */
  getPlayerBySeat(seat) {
    return this.seats.get(seat) || null;
  }

  /**
   * Get all players sorted by seat number
   */
  getAllPlayers() {
    return Array.from(this.seats.values()).sort((a, b) => a.seat - b.seat);
  }

  /**
   * Total number of connected players
   */
  get count() {
    return this.seats.size;
  }

  /**
   * Get host player
   */
  getHost() {
    for (const player of this.seats.values()) {
      if (player.isHost) return player;
    }
    return null;
  }

  /**
   * Mark player online / offline (e.g. temporary disconnect)
   */
  setOnlineStatus(socketId, isOnline) {
    const player = this.getPlayerBySocketId(socketId);
    if (player) {
      player.isOnline = isOnline;
    }
    return player;
  }

  /**
   * Calculate visual relative positions for a specific viewer.
   * User sees themselves at 3 o'clock (Position 0).
   * Other seats are distributed clockwise around the table.
   * 
   * @param {number} viewerSeat Absolute seat of the viewing player (1-based)
   * @returns {Array} Array of players with visualSeatOffset (0 = self at 3 o'clock)
   */
  getRelativeSeatingFor(viewerSeat) {
    const all = this.getAllPlayers();
    return all.map(p => {
      // Calculate clockwise offset from viewer
      // If viewerSeat is 1 and maxSeats is 8:
      // seat 1 -> offset 0 (viewer, 3 o'clock)
      // seat 2 -> offset 1
      // seat 8 -> offset 7
      let visualOffset = (p.seat - viewerSeat);
      if (visualOffset < 0) {
        visualOffset += this.maxSeats;
      }

      return {
        seat: p.seat,
        visualOffset, // 0 means at 3 o'clock (self)
        name: p.name,
        isHost: p.isHost,
        isOnline: p.isOnline,
        isReady: p.isReady,
        cardCount: p.hand.length,
        isSelf: p.seat === viewerSeat
      };
    });
  }
}

module.exports = { PlayerManager };
