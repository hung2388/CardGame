/**
 * CARDPUNK Card Renderer (Neo-Brutalism Style)
 * Renders standard 52-card playing cards, card backs, and card animations
 */
const CardRenderer = {
  suitSymbols: {
    spades: '♠',
    clubs: '♣',
    diamonds: '♦',
    hearts: '♥'
  },

  suitColors: {
    spades: '#000000',
    clubs: '#000000',
    diamonds: '#dc2626',
    hearts: '#dc2626'
  },

  /**
   * Render single playing card element
   * @param {object} card { id, rank, suit, rankLabel, color }
   * @param {object} options { isSelected: boolean, isFaceDown: boolean, onClick: function }
   */
  renderCard(card, options = {}) {
    const { isSelected = false, isFaceDown = false, onClick = null, size = 'normal' } = options;
    const cardEl = document.createElement('div');
    cardEl.className = `card-punk-item ${size} ${isFaceDown ? 'face-down' : 'face-up'} ${isSelected ? 'selected' : ''}`;
    cardEl.dataset.cardId = card ? card.id : '';

    if (isFaceDown) {
      cardEl.innerHTML = `
        <div class="card-inner card-back-pattern">
          <div class="card-back-badge">CP</div>
        </div>
      `;
      return cardEl;
    }

    if (!card) return cardEl;

    const symbol = this.suitSymbols[card.suit] || card.suit;
    const color = this.suitColors[card.suit] || (card.color === 'red' ? '#dc2626' : '#000000');
    const label = card.rankLabel || card.rank;

    cardEl.style.color = color;
    cardEl.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-rank">${label}</span>
        <span class="card-suit">${symbol}</span>
      </div>
      <div class="card-center">
        <span class="card-center-symbol">${symbol}</span>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-rank">${label}</span>
        <span class="card-suit">${symbol}</span>
      </div>
    `;

    if (typeof onClick === 'function') {
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick(card, cardEl);
      });
    }

    return cardEl;
  },

  /**
   * Render stacked card backs to represent opponents' hand count
   * @param {number} count Number of cards
   */
  renderOpponentHand(count = 0) {
    const container = document.createElement('div');
    container.className = 'opponent-hand-fan';

    const maxDisplay = Math.min(count, 12);
    for (let i = 0; i < maxDisplay; i++) {
      const card = document.createElement('div');
      card.className = 'opponent-mini-card face-down';
      const rot = (i - (maxDisplay - 1) / 2) * 5;
      card.style.transform = `rotate(${rot}deg) translateX(${i * 6}px)`;
      container.appendChild(card);
    }

    return container;
  }
};

window.CardRenderer = CardRenderer;
