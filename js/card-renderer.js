/**
 * CARDPUNK Card Renderer (Neo-Brutalism & Uno Pixel Art Style)
 * Renders standard 52-card playing cards, Jokers, Exploding Kittens, and authentic Uno Pixel Art
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
   * Determine if card is an UNO card
   */
  isUnoCard(card) {
    if (!card) return false;
    if (card.type === 'uno' || (card.id && card.id.startsWith('uno_'))) return true;
    if (card.color === 'wild') return true;
    if (['red', 'yellow', 'green', 'blue'].includes(card.color) && !card.suit) return true;
    return false;
  },

  /**
   * Map UNO card object to its pixel art filename in pixel_deck_unique/
   */
  getUnoImageName(card) {
    if (!card) return 'card_back.png';
    let color = (card.color || '').toLowerCase();
    let rank = (card.rank || '').toLowerCase();

    // Fallback extract from id (e.g. uno_red_0, uno_blue_draw_two_a, uno_wild_1, uno_wild_draw_four_2)
    if ((!color || !rank) && card.id && card.id.startsWith('uno_')) {
      const parts = card.id.split('_');
      color = parts[1];
      rank = parts.slice(2).join('_');
    }

    if (color === 'wild' || rank.startsWith('wild')) {
      if (rank.includes('four') || rank.includes('draw4') || rank.includes('+4') || (card.id && card.id.includes('wild_draw_four'))) {
        return 'wild_draw4.png';
      }
      return 'wild.png';
    }

    // Normalize action ranks
    if (rank === 'draw_two' || rank === 'draw2' || rank === '+2') {
      rank = 'draw2';
    } else if (rank === 'skip') {
      rank = 'skip';
    } else if (rank === 'reverse' || rank === 'rev') {
      rank = 'reverse';
    }

    // Strip clone suffix (_a, _b, _d1, etc.)
    rank = rank.replace(/_[ab]$/, '').replace(/_d\d+$/, '');

    return `${color}_${rank}.png`;
  },

  /**
   * Determine if card is an Exploding Kittens card
   */
  isKittensCard(card) {
    if (!card) return false;
    if (card.rank === 'exploding_kitten' || card.rank === 'defuse') return true;
    if (card.id && (
      card.id.startsWith('attack_') || card.id.startsWith('skip_') ||
      card.id.startsWith('see_future_') || card.id.startsWith('shuffle_') ||
      card.id.startsWith('favor_') || card.id.startsWith('nope_') ||
      card.id.startsWith('cat_')
    )) return true;
    return false;
  },

  /**
   * Render single playing card element
   * @param {object} card { id, rank, suit, rankLabel, color }
   * @param {object} options { isSelected: boolean, isFaceDown: boolean, onClick: function, size: string }
   */
  renderCard(card, options = {}) {
    const { isSelected = false, isFaceDown = false, onClick = null, size = 'normal' } = options;
    const cardEl = document.createElement('div');
    cardEl.dataset.cardId = card ? card.id : '';

    // 1. Face Down State
    if (isFaceDown) {
      if (this.isUnoCard(card)) {
        cardEl.className = `card-punk-item uno-pixel-card ${size} face-down ${isSelected ? 'selected' : ''}`;
        cardEl.innerHTML = `<img src="pixel_deck_unique/card_back.png" alt="Card Back" class="uno-pixel-card-img" draggable="false" />`;
      } else {
        cardEl.className = `card-punk-item ${size} face-down ${isSelected ? 'selected' : ''}`;
        cardEl.innerHTML = `
          <div class="card-inner card-back-pattern">
            <div class="card-back-badge">CP</div>
          </div>
        `;
      }
      return cardEl;
    }

    if (!card) return cardEl;

    // 2. UNO PIXEL ART CARD
    if (this.isUnoCard(card)) {
      const imgName = this.getUnoImageName(card);
      cardEl.className = `card-punk-item uno-pixel-card ${size} face-up ${isSelected ? 'selected' : ''}`;
      cardEl.innerHTML = `<img src="pixel_deck_unique/${imgName}" alt="${card.id || imgName}" class="uno-pixel-card-img" draggable="false" />`;

      if (typeof onClick === 'function') {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(card, cardEl);
        });
      }
      return cardEl;
    }

    // 3. EXPLODING KITTENS CARD
    if (this.isKittensCard(card)) {
      cardEl.className = `card-punk-item kittens-card ${size} face-up ${isSelected ? 'selected' : ''}`;
      const meta = this.getKittensMeta(card);
      cardEl.style.background = meta.bg;
      cardEl.style.color = meta.color;
      cardEl.style.borderColor = '#000000';

      cardEl.innerHTML = `
        <div class="card-corner top-left" style="font-size:10px; font-weight:900;">
          <span>${meta.icon}</span>
        </div>
        <div class="card-center" style="text-align:center; display:flex; flex-direction:column; align-items:center; gap:2px;">
          <span style="font-size:22px;">${meta.icon}</span>
          <span style="font-size:11px; font-weight:900; text-transform:uppercase; line-height:1.1;">${meta.name}</span>
        </div>
        <div class="card-corner bottom-right" style="font-size:10px; font-weight:900;">
          <span>${meta.icon}</span>
        </div>
      `;

      if (typeof onClick === 'function') {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(card, cardEl);
        });
      }
      return cardEl;
    }

    // 4. JOKER CARD (ĐÁNH TẤN)
    if (card.suit === 'joker' || (card.rank && card.rank.startsWith('joker'))) {
      const isRed = card.color === 'red' || card.rank === 'joker_red';
      cardEl.className = `card-punk-item joker-card ${size} face-up ${isSelected ? 'selected' : ''}`;
      cardEl.style.color = isRed ? '#dc2626' : '#000000';

      cardEl.innerHTML = `
        <div class="card-corner top-left">
          <span class="card-rank">JK</span>
          <span class="card-suit">🃏</span>
        </div>
        <div class="card-center" style="display:flex; flex-direction:column; align-items:center;">
          <span style="font-size:26px;">🃏</span>
          <span style="font-size:11px; font-weight:900; letter-spacing:1px;">JOKER</span>
        </div>
        <div class="card-corner bottom-right">
          <span class="card-rank">JK</span>
          <span class="card-suit">🃏</span>
        </div>
      `;

      if (typeof onClick === 'function') {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(card, cardEl);
        });
      }
      return cardEl;
    }

    // 5. STANDARD 52-CARD PLAYING CARD (SÂM, TẤN, BA CÀO)
    cardEl.className = `card-punk-item ${size} face-up ${isSelected ? 'selected' : ''}`;
    const symbol = this.suitSymbols[card.suit] || (card.suit ? card.suit : '');
    const color = this.suitColors[card.suit] || (card.color === 'red' ? '#dc2626' : '#000000');
    const label = card.rankLabel || card.rank || '';

    cardEl.style.color = color;
    cardEl.innerHTML = `
      <div class="card-corner top-left">
        <span class="card-rank">${label}</span>
        ${symbol ? `<span class="card-suit">${symbol}</span>` : ''}
      </div>
      <div class="card-center">
        ${symbol ? `<span class="card-center-symbol">${symbol}</span>` : `<span class="card-rank" style="font-size:24px;">${label}</span>`}
      </div>
      <div class="card-corner bottom-right">
        <span class="card-rank">${label}</span>
        ${symbol ? `<span class="card-suit">${symbol}</span>` : ''}
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
   * Helper metadata for Exploding Kittens cards
   */
  getKittensMeta(card) {
    const rank = (card.rank || '').toLowerCase();
    if (rank === 'exploding_kitten') {
      return { icon: '💣', name: 'MÈO NỔ', bg: '#ef4444', color: '#ffffff' };
    }
    if (rank === 'defuse') {
      return { icon: '🔧', name: 'GỠ BOM', bg: '#22c55e', color: '#ffffff' };
    }
    if (rank === 'attack') {
      return { icon: '⚔️', name: 'TẤN CÔNG', bg: '#f97316', color: '#ffffff' };
    }
    if (rank === 'skip') {
      return { icon: '⏩', name: 'QUA LƯỢT', bg: '#06b6d4', color: '#000000' };
    }
    if (rank === 'see_future') {
      return { icon: '🔮', name: 'XEM TƯƠNG LAI', bg: '#a855f7', color: '#ffffff' };
    }
    if (rank === 'shuffle') {
      return { icon: '🔀', name: 'XÁO BÀI', bg: '#eab308', color: '#000000' };
    }
    if (rank === 'favor') {
      return { icon: '🤝', name: 'XIN XỎ', bg: '#ec4899', color: '#ffffff' };
    }
    if (rank === 'nope') {
      return { icon: '🚫', name: 'CHẶN ĐỨNG', bg: '#f43f5e', color: '#ffffff' };
    }
    if (rank === 'cat_taco') {
      return { icon: '🌮', name: 'MÈO TACO', bg: '#fef08a', color: '#000000' };
    }
    if (rank === 'cat_melon') {
      return { icon: '🍉', name: 'MÈO DƯA', bg: '#bbf7d0', color: '#000000' };
    }
    if (rank === 'cat_potato') {
      return { icon: '🥔', name: 'MÈO KHOAI', bg: '#fed7aa', color: '#000000' };
    }
    return { icon: '🐱', name: card.label || 'MÈO', bg: '#ffffff', color: '#000000' };
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
