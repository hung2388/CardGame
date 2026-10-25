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

    // Audio & Visual Animation Triggers
    window.cardpunkClient.on('cards_shuffling_notice', (data) => {
      this.animateShuffle();
    });

    window.cardpunkClient.on('cards_dealt_notice', (data) => {
      if (window.soundManager) window.soundManager.playDeal();
      this.animateDeal(data);
    });

    window.cardpunkClient.on('card_played_action', (data) => {
      this.animatePlayCard(data);
    });

    window.cardpunkClient.on('card_drawn_action', (data) => {
      this.animateDrawCard(data);
    });

    window.cardpunkClient.on('tan_pickup_action', (data) => {
      this.animateTanPickUp(data);
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

    // Re-fan hand cards on window resize or orientation rotation
    window.addEventListener('resize', () => {
      if (this.currentState && this.currentState.myHand) {
        this.renderMyHand(this.currentState.myHand, this.currentState.isMyTurn);
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
   * Viewer is ALWAYS at bottom center (angle PI / 2 rad).
   * Other seats are distributed clockwise with MAXIMUM EVEN DISTANCE (2*PI / N).
   */
  renderSeats(players, maxSeats = 8, currentTurnSeat = null) {
    if (!this.seatsLayer || !players || players.length === 0) return;
    this.seatsLayer.innerHTML = '';

    // Ellipse radius percentages: pushed outward onto the wooden rail perimeter
    // leaving the central green felt completely open for played cards
    const rxPct = 46.5; // 46.5% horizontal radius
    const ryPct = 43.5; // 43.5% vertical radius

    // Sort players in visual clockwise order starting with self (viewer at index 0)
    const sorted = [...players].sort((a, b) => (a.visualOffset || 0) - (b.visualOffset || 0));
    const N = sorted.length;

    sorted.forEach((p, index) => {
      // Viewer (index 0) is at bottom center: angle = PI / 2 (90 deg)
      // Other players are distributed clockwise with MAXIMUM distance: (2 * PI / N)
      let angle;
      if (N === 1) {
        angle = Math.PI / 2;
      } else {
        angle = (Math.PI / 2) + index * ((2 * Math.PI) / N);
      }
      
      // Calculate coordinates on ellipse in percentages
      const xPct = 50 + rxPct * Math.cos(angle);
      const yPct = 50 + ryPct * Math.sin(angle);

      // Determine positional quadrant to position opponent cards away from table center
      let posClass = '';
      if (yPct < 44) {
        posClass += ' pos-top';
      } else if (yPct > 60) {
        posClass += ' pos-bottom';
      } else {
        posClass += ' pos-middle';
      }

      if (xPct < 38) {
        posClass += ' pos-left';
      } else if (xPct > 62) {
        posClass += ' pos-right';
      }

      const seatEl = document.createElement('div');
      seatEl.className = `player-seat-pod nb-box ${p.isCurrentTurn ? 'active-turn' : ''} ${p.isSelf ? 'is-self' : ''} ${posClass}`;
      seatEl.id = `seat-pod-${p.seat}`;
      seatEl.dataset.seat = p.seat;
      seatEl.style.left = `${xPct}%`;
      seatEl.style.top = `${yPct}%`;

      const crown = p.isHost ? '<span class="seat-crown" title="Chủ phòng">HOST</span>' : '';
      const turnBadge = p.isCurrentTurn ? '<div class="turn-flair">LƯỢT ĐÁNH</div>' : '';
      const revealedBadge = p.hasRevealed && !p.revealedEvaluation ? '<div class="seat-revealed-tag">ĐÃ MỞ</div>' : '';

      const nameLen = (p.name || '').length;
      const nameFontSize = nameLen > 18 ? '10px' : (nameLen > 12 ? '11px' : '12px');
      seatEl.innerHTML = `
        ${crown}
        <div class="seat-avatar">${(p.name || 'P').charAt(0).toUpperCase()}</div>
        <div class="seat-name" title="${p.name}" style="font-size: ${nameFontSize};">${p.name}</div>
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
   * Render only the viewer's cards in hand with dynamic fanning / overlapping
   * so all cards are visible at a glance without horizontal scroll cutting them off
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

    const count = cardsToRender.length;
    // Calculate hand container width
    const containerWidth = this.myHandLayer.getBoundingClientRect().width || (window.innerWidth - 180);
    const isCompact = window.innerHeight <= 550 || window.innerWidth <= 768;
    const cardSize = isCompact ? 'normal' : 'large';
    const cardBaseWidth = isCompact ? 54 : 72;

    // Calculate dynamic negative margin (fanning) so all cards fit without scrolling
    let overlapMargin = 0;
    const naturalWidth = count * (cardBaseWidth + 6);
    const maxAvailable = Math.max(280, containerWidth - 20);

    if (count > 1 && naturalWidth > maxAvailable) {
      const excess = naturalWidth - maxAvailable;
      overlapMargin = -Math.min(cardBaseWidth * 0.72, Math.ceil(excess / (count - 1)) + 2);
    }

    cardsToRender.forEach((card, idx) => {
      const isSelected = this.selectedCardIds.has(card.id);
      const cardEl = window.CardRenderer.renderCard(card, {
        isSelected,
        size: cardSize,
        onClick: (c) => this.toggleCardSelect(c.id)
      });

      if (idx > 0 && overlapMargin < 0) {
        cardEl.style.marginLeft = `${overlapMargin}px`;
      }
      cardEl.style.zIndex = isSelected ? 80 : (idx + 1);

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

  /**
   * ===================================================
   * DYNAMIC FLUID CARD ANIMATION ENGINE
   * ===================================================
   */

  /**
   * Helper: Animate a floating clone card from start element to target element
   */
  animateFlyingCard(fromEl, toEl, cardData = null, options = {}) {
    if (!fromEl || !toEl) return;
    const startRect = fromEl.getBoundingClientRect();
    const endRect = toEl.getBoundingClientRect();

    if (startRect.width === 0 && startRect.height === 0) return;
    if (endRect.width === 0 && endRect.height === 0) return;

    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    const flyer = document.createElement('div');
    flyer.className = 'flying-card-anim';
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;

    // Render card face if provided, else dummy card back
    if (cardData) {
      const cardClone = window.CardRenderer.renderCard(cardData, { size: 'normal' });
      flyer.appendChild(cardClone);
    } else {
      const back = document.createElement('div');
      back.className = 'card-punk-item normal face-down';
      back.innerHTML = '<div class="card-inner card-back-pattern"><div class="card-back-badge">CP</div></div>';
      flyer.appendChild(back);
    }

    const startRot = (Math.random() * 20) - 10;
    const endRot = (Math.random() * 24) - 12;
    flyer.style.transform = `translate(-50%, -50%) rotate(${startRot}deg) scale(0.85)`;

    document.body.appendChild(flyer);

    // Trigger transition on next animation frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flyer.style.left = `${endX}px`;
        flyer.style.top = `${endY}px`;
        flyer.style.transform = `translate(-50%, -50%) rotate(${endRot}deg) scale(1)`;
      });
    });

    const duration = options.duration || 380;
    setTimeout(() => {
      if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
      if (typeof options.onComplete === 'function') options.onComplete();
    }, duration);
  }

  /**
   * 1. Shuffle Animation
   */
  animateShuffle() {
    if (window.soundManager) window.soundManager.playShuffle();
    const deck = document.querySelector('.table-deck-stack');
    if (deck) {
      deck.classList.add('shuffling');
      setTimeout(() => {
        deck.classList.remove('shuffling');
      }, 850);
    }
  }

  /**
   * 2. Deal Animation
   */
  animateDeal(data) {
    const deckEl = document.querySelector('.table-deck-stack') || this.deckLayer;
    if (!deckEl || !this.currentState || !this.currentState.players) return;

    const players = this.currentState.players;
    const cardsPerPlayer = data?.cardsPerPlayer || 3;
    const visualDeals = Math.min(cardsPerPlayer, 4);

    let step = 0;
    for (let r = 0; r < visualDeals; r++) {
      players.forEach((p) => {
        const delay = step * 65;
        step++;
        setTimeout(() => {
          let targetEl = p.isSelf ? this.myHandLayer : document.getElementById(`seat-pod-${p.seat}`);
          if (targetEl && deckEl) {
            this.animateFlyingCard(deckEl, targetEl, null, {
              duration: 360,
              onComplete: () => {
                targetEl.classList.add('card-just-landed');
                setTimeout(() => targetEl.classList.remove('card-just-landed'), 300);
              }
            });
            if (window.soundManager) window.soundManager.playDeal();
          }
        }, delay);
      });
    }
  }

  /**
   * 3. Play Card Animation (Fly from hand/seat to table center)
   */
  animatePlayCard(actionData) {
    const { seat, cards = [] } = actionData || {};
    const centerEl = this.centerCardsLayer || document.getElementById('table-center-cards');
    if (!centerEl) return;

    let fromEl = null;
    if (this.currentState && seat === this.currentState.mySeat) {
      fromEl = this.myHandLayer;
    } else {
      fromEl = document.getElementById(`seat-pod-${seat}`);
    }
    if (!fromEl) fromEl = this.deckLayer;

    cards.forEach((card, idx) => {
      setTimeout(() => {
        this.animateFlyingCard(fromEl, centerEl, card, {
          duration: 340,
          onComplete: () => {
            if (window.soundManager) window.soundManager.playCardDrop();
          }
        });
      }, idx * 60);
    });
  }

  /**
   * 4. Draw Card Animation (Fly from deck to hand/seat)
   */
  animateDrawCard(actionData) {
    const { seat, count = 1 } = actionData || {};
    const deckEl = document.querySelector('.table-deck-stack') || this.deckLayer;
    if (!deckEl) return;

    let toEl = null;
    if (this.currentState && seat === this.currentState.mySeat) {
      toEl = this.myHandLayer;
    } else {
      toEl = document.getElementById(`seat-pod-${seat}`);
    }
    if (!toEl) return;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.animateFlyingCard(deckEl, toEl, null, {
          duration: 380,
          onComplete: () => {
            if (window.soundManager) window.soundManager.playDraw();
            toEl.classList.add('card-just-landed');
            setTimeout(() => toEl.classList.remove('card-just-landed'), 300);
          }
        });
      }, i * 100);
    }
  }

  /**
   * 5. Tấn Pick Up Animation (All table cards fly into defender's hand)
   */
  animateTanPickUp(actionData) {
    const { seat } = actionData || {};
    let toEl = null;
    if (this.currentState && seat === this.currentState.mySeat) {
      toEl = this.myHandLayer;
    } else {
      toEl = document.getElementById(`seat-pod-${seat}`);
    }
    if (!toEl) return;

    const tableCards = document.querySelectorAll('#table-center-cards .card-punk-item');
    tableCards.forEach((cEl, idx) => {
      setTimeout(() => {
        this.animateFlyingCard(cEl, toEl, null, {
          duration: 350,
          onComplete: () => {
            if (idx === 0 && window.soundManager) window.soundManager.playDraw();
          }
        });
      }, idx * 45);
    });
  }
}

window.GameTable = GameTable;
