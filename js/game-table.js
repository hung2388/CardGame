/**
 * CARDPUNK Game Table Controller
 * Renders the oval felt table, positions players relative to viewer (viewer at 3 o'clock),
 * manages hand interactions, and syncs authoritative game state.
 */
class GameTable {
  constructor() {
    this.tableEl = document.getElementById('poker-oval-table');
    this.seatsLayer = document.getElementById('table-seats-layer');
    this.centerCardsLayer = document.getElementById('table-center-cards');
    this.deckLayer = document.getElementById('table-deck-layer');
    this.myHandLayer = document.getElementById('my-hand-cards');
    this.actionPanel = document.getElementById('player-action-panel');
    
    this.btnPlay = document.getElementById('btn-play-cards');
    this.btnPass = document.getElementById('btn-pass-turn');
    this.btnStart = document.getElementById('btn-start-game');
    this.roomTitle = document.getElementById('room-id-display');
    this.gameTitle = document.getElementById('game-title-display');
    this.turnIndicator = document.getElementById('turn-status-banner');

    this.selectedCardIds = new Set();
    this.currentState = null;
    this.spinner = new TableSpinner('spinner-overlay');
    this.threeCardsClient = new ThreeCardsClient(this);
    this.samClient = new SamClient(this);
    this.tanClient = new TanClient(this);
    this.unoClient = new UnoClient(this);
    this.kittensClient = new ExplodingKittensClient(this);

    this.initEvents();
  }

  initEvents() {
    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', () => this.handlePlayCards());
    }
    if (this.btnPass) {
      this.btnPass.addEventListener('click', () => this.handlePassTurn());
    }
    if (this.btnStart) {
      this.btnStart.addEventListener('click', () => this.handleStartGame());
    }

    // Socket listener for room state
    window.cardpunkClient.on('room_state_update', (state) => {
      this.updateState(state);
    });

    // Audio triggers for deal and showdown
    window.cardpunkClient.on('cards_dealt_notice', () => {
      if (window.soundManager) window.soundManager.playDeal();
    });

    window.cardpunkClient.on('round_showdown', () => {
      if (window.soundManager) window.soundManager.playFanfare();
    });

    // Socket listener for spinner start
    window.cardpunkClient.on('spin_selection_start', (data) => {
      if (this.currentState && this.currentState.players) {
        this.spinner.startSpinSequence(
          this.currentState.players,
          data.starterSeat,
          data.direction,
          () => {
            console.log('Spinner complete, ready to deal.');
          }
        );
      }
    });
  }

  updateState(state) {
    this.currentState = state;
    
    // Header info
    if (this.roomTitle) this.roomTitle.textContent = state.roomId;
    if (this.gameTitle) this.gameTitle.textContent = state.gameName;

    // Render seats around oval
    this.renderSeats(state.players, state.maxPlayers, state.currentTurnSeat);

    // Render center table (played cards + deck)
    this.renderCenter(state);

    // Render viewer's hand
    this.renderMyHand(state.myHand, state.isMyTurn);

    // Update Action Bar buttons
    this.updateControls(state);

    // Game-specific UI updates
    if (this.threeCardsClient) this.threeCardsClient.update(state);
    if (this.samClient) this.samClient.update(state);
    if (this.tanClient) this.tanClient.update(state);
    if (this.unoClient) this.unoClient.update(state);
    if (this.kittensClient) this.kittensClient.update(state);
  }

  /**
   * Render seated players around oval table.
   * Viewer is ALWAYS at 3 o'clock (angle 0 rad).
   * Other seats are distributed clockwise (increasing angle).
   */
  renderSeats(players, maxSeats = 8, currentTurnSeat = null) {
    if (!this.seatsLayer) return;
    this.seatsLayer.innerHTML = '';

    // Ellipse radius percentages (so player boxes sit neatly on the edge of the oval felt)
    const rxPct = 40; // 40% horizontal radius
    const ryPct = 38; // 38% vertical radius

    players.forEach((p) => {
      // visualOffset: 0 is viewer at 3 o'clock (0 radians)
      // visualOffset: 1..maxSeats distributed clockwise
      const angle = (p.visualOffset / maxSeats) * (2 * Math.PI);
      
      // Calculate coordinates on ellipse in percentages
      const xPct = 50 + rxPct * Math.cos(angle);
      const yPct = 50 + ryPct * Math.sin(angle);

      const seatEl = document.createElement('div');
      seatEl.className = `player-seat-pod nb-box ${p.isCurrentTurn ? 'active-turn' : ''} ${p.isSelf ? 'is-self' : ''}`;
      seatEl.style.left = `${xPct}%`;
      seatEl.style.top = `${yPct}%`;

      const crown = p.isHost ? '<span class="seat-crown" title="Chủ phòng">HOST</span>' : '';
      const turnBadge = p.isCurrentTurn ? '<div class="turn-flair">LƯỢT ĐÁNH</div>' : '';
      const revealedBadge = p.hasRevealed && !p.revealedEvaluation ? '<div class="seat-revealed-tag">ĐÃ MỞ</div>' : '';

      seatEl.innerHTML = `
        ${crown}
        <div class="seat-avatar">${(p.name || 'P').charAt(0).toUpperCase()}</div>
        <div class="seat-name">${p.name}</div>
        <div class="seat-tag">Ghế #${p.seat} ${p.isSelf ? '(Bạn)' : ''}</div>
        <div class="seat-score-badge">${p.score || 0} điểm</div>
        ${turnBadge}
        ${revealedBadge}
      `;

      // If opponent revealed hand on showdown
      if (!p.isSelf && p.revealedHand && p.revealedHand.length > 0) {
        const cardsRow = document.createElement('div');
        cardsRow.className = 'opponent-showdown-cards';
        p.revealedHand.forEach(c => {
          const mini = window.CardRenderer.renderCard(c, { size: 'mini' });
          cardsRow.appendChild(mini);
        });
        seatEl.appendChild(cardsRow);
      } else if (!p.isSelf && p.cardCount > 0) {
        const fan = window.CardRenderer.renderOpponentHand(p.cardCount);
        seatEl.appendChild(fan);
      }

      // If player has rank evaluation (showdown)
      if (p.revealedEvaluation) {
        const rankFlair = document.createElement('div');
        rankFlair.className = 'seat-rank-flair nb-badge';
        rankFlair.textContent = p.revealedEvaluation.rankName;
        rankFlair.style.background = p.revealedEvaluation.tier > 1 ? 'var(--color-pink)' : 'var(--color-yellow)';
        rankFlair.style.color = p.revealedEvaluation.tier > 1 ? '#fff' : '#000';
        seatEl.appendChild(rankFlair);
      }

      this.seatsLayer.appendChild(seatEl);
    });
  }

  /**
   * Render table center cards and draw/discard decks
   */
  renderCenter(state) {
    if (this.deckLayer) {
      this.deckLayer.innerHTML = `
        <div class="table-deck-stack nb-box">
          <div class="card-punk-item face-down mini">
            <div class="card-inner card-back-pattern">
              <div class="card-back-badge">CP</div>
            </div>
          </div>
          <span class="deck-count-badge">${state.deckRemainingCount || 0} lá</span>
        </div>
        ${state.topDiscardCard ? `
          <div class="table-discard-stack">
            <span class="discard-label">Bài Đã Đánh</span>
          </div>
        ` : ''}
      `;
    }

    if (this.centerCardsLayer) {
      this.centerCardsLayer.innerHTML = '';
      if (state.tableCards && state.tableCards.length > 0) {
        state.tableCards.forEach((card, idx) => {
          const cardEl = window.CardRenderer.renderCard(card, { size: 'normal' });
          // Slight random scatter effect for authentic felt table feel
          const rot = ((idx * 7) % 15) - 7;
          cardEl.style.transform = `rotate(${rot}deg)`;
          this.centerCardsLayer.appendChild(cardEl);
        });
      } else {
        this.centerCardsLayer.innerHTML = `
          <div class="table-empty-center-msg">
            ${state.status === 'lobby' ? 'Đang đợi chủ phòng bắt đầu...' : 'Bàn chơi sẵn sàng'}
          </div>
        `;
      }
    }
  }

  /**
   * Render only the viewer's cards in hand
   */
  renderMyHand(myCards, isMyTurn) {
    if (!this.myHandLayer) return;
    this.myHandLayer.innerHTML = '';

    if (!myCards || myCards.length === 0) {
      this.myHandLayer.innerHTML = `<span class="empty-hand-hint">Chưa có bài trên tay</span>`;
      return;
    }

    const cardsToRender = (this.currentState?.gameType === 'sam' && this.samClient)
      ? this.samClient.sortHand(myCards)
      : myCards;

    cardsToRender.forEach((card) => {
      const isSelected = this.selectedCardIds.has(card.id);
      const cardEl = window.CardRenderer.renderCard(card, {
        isSelected,
        size: 'large',
        onClick: (c) => this.toggleCardSelect(c.id)
      });
      this.myHandLayer.appendChild(cardEl);
    });
  }

  toggleCardSelect(cardId) {
    if (this.selectedCardIds.has(cardId)) {
      this.selectedCardIds.delete(cardId);
    } else {
      this.selectedCardIds.add(cardId);
    }
    // Re-render my hand to reflect elevation
    if (this.currentState) {
      this.renderMyHand(this.currentState.myHand, this.currentState.isMyTurn);
      this.updatePlayButton();
    }
  }

  updatePlayButton() {
    if (!this.btnPlay) return;
    const count = this.selectedCardIds.size;
    this.btnPlay.textContent = count > 0 ? `Đánh (${count} lá)` : 'Đánh Bài';
    this.btnPlay.disabled = count === 0 || !this.currentState?.isMyTurn;
  }

  updateControls(state) {
    // Start game button: only host can see/click when status is 'lobby'
    if (this.btnStart) {
      if (state.isHost && state.status === 'lobby') {
        this.btnStart.style.display = 'inline-flex';
        this.btnStart.disabled = state.players.length < state.minPlayers;
        this.btnStart.innerHTML = `Bắt Đầu (${state.players.length}/${state.minPlayers} min)`;
      } else {
        this.btnStart.style.display = 'none';
      }
    }

    // Turn indicator
    if (this.turnIndicator) {
      if (state.status === 'lobby') {
        this.turnIndicator.innerHTML = `<strong>Đang chờ người chơi...</strong> (Cần tối thiểu ${state.minPlayers} người)`;
        this.turnIndicator.className = 'turn-banner waiting';
      } else if (state.isMyTurn) {
        this.turnIndicator.innerHTML = `<strong>ĐẾN LƯỢT BẠN!</strong> Hãy chọn lá bài và bấm Đánh.`;
        this.turnIndicator.className = 'turn-banner my-turn pulse';
      } else {
        const turnPlayer = state.players.find(p => p.seat === state.currentTurnSeat);
        const name = turnPlayer ? turnPlayer.name : `Ghế #${state.currentTurnSeat}`;
        this.turnIndicator.innerHTML = `Lượt của <strong>${name}</strong>...`;
        this.turnIndicator.className = 'turn-banner other-turn';
      }
    }

    // Play & Pass buttons
    if (this.btnPass) {
      this.btnPass.disabled = !state.isMyTurn || state.status !== 'playing';
    }
    this.updatePlayButton();
  }

  async handlePlayCards() {
    if (this.selectedCardIds.size === 0) return;
    const cardIds = Array.from(this.selectedCardIds);

    // If UNO and Wild Card, trigger Color Picker Modal first
    if (this.currentState?.gameType === 'uno' && this.unoClient) {
      const myCard = this.currentState.myHand?.find(c => c.id === cardIds[0]);
      if (myCard && (myCard.color === 'wild' || myCard.type === 'wild')) {
        this.unoClient.pendingCardId = cardIds[0];
        if (this.unoClient.colorModal) this.unoClient.colorModal.style.display = 'flex';
        return;
      }
    }

    const res = await window.cardpunkClient.playCards(cardIds);
    if (res && !res.success) {
      alert(res.error || 'Nước đi không hợp lệ!');
    } else {
      if (window.soundManager) window.soundManager.playCardDrop();
      if (res && res.action === 'see_future' && res.top3Cards && this.kittensClient) {
        this.kittensClient.showFutureCards(res.top3Cards);
      }
      this.selectedCardIds.clear();
      this.updatePlayButton();
    }
  }

  async handlePassTurn() {
    const res = await window.cardpunkClient.passTurn();
    if (res && !res.success) {
      alert(res.error || 'Không thể bỏ lượt!');
    }
  }

  async handleStartGame() {
    if (!this.currentState) return;
    const res = await window.cardpunkClient.startGame(this.currentState.roomId);
    if (res && !res.success) {
      alert(res.error || 'Không thể bắt đầu!');
    }
  }
}

window.GameTable = GameTable;
