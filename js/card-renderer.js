/**
 * CARDPUNK Universal Pixel Art Card Renderer
 * Renders 100% sharp Pixel Art cards for all games:
 * 1. UNO (55 pixel cards)
 * 2. Bài Tây (Sâm Lốc, Đánh Tấn, Ba Cào - 54 pixel cards + 2 Jokers)
 * 3. Mèo Nổ (Exploding Kittens - 11 action & cat cards)
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
   * Determine if card belongs to UNO
   */
  isUnoCard(card) {
    if (!card) return false;
    if (card.type === 'uno' || (card.id && card.id.startsWith('uno_'))) return true;
    if (card.color === 'wild') return true;
    if (['red', 'yellow', 'green', 'blue'].includes(card.color) && !card.suit) return true;
    return false;
  },

  /**
   * Get UNO pixel image filename
   */
  getUnoImageName(card) {
    if (!card) return 'card_back.png';
    let color = (card.color || '').toLowerCase();
    let rank = (card.rank || '').toLowerCase();

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

    if (rank === 'draw_two' || rank === 'draw2' || rank === '+2') {
      rank = 'draw2';
    } else if (rank === 'skip') {
      rank = 'skip';
    } else if (rank === 'reverse' || rank === 'rev') {
      rank = 'reverse';
    }

    rank = rank.replace(/_[ab]$/, '').replace(/_d\d+$/, '');
    return `${color}_${rank}.png`;
  },

  /**
   * Determine if card belongs to Exploding Kittens (Mèo Nổ)
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
   * Get Mèo Nổ pixel image filename
   */
  getKittensImageName(card) {
    if (!card) return 'card_back.png';
    let rank = (card.rank || '').toLowerCase();

    // Fallback extract from id
    if (!rank && card.id) {
      if (card.id.startsWith('cat_taco')) rank = 'cat_taco';
      else if (card.id.startsWith('cat_melon')) rank = 'cat_melon';
      else if (card.id.startsWith('cat_potato')) rank = 'cat_potato';
      else if (card.id.startsWith('see_future')) rank = 'see_future';
      else {
        rank = card.id.split('_')[0];
      }
    }

    const validRanks = [
      'exploding_kitten', 'defuse', 'attack', 'skip',
      'see_future', 'shuffle', 'favor', 'nope',
      'cat_taco', 'cat_melon', 'cat_potato'
    ];

    if (validRanks.includes(rank)) {
      return `${rank}.png`;
    }
    return 'exploding_kitten.png';
  },

  /**
   * Get Standard 52-card or Joker pixel image filename
   */
  getStandardImageName(card) {
    if (!card) return 'card_back.png';
    
    // Jokers
    if (card.suit === 'joker' || (card.rank && card.rank.startsWith('joker'))) {
      const isRed = card.color === 'red' || card.rank === 'joker_red';
      return isRed ? 'joker_red.png' : 'joker_black.png';
    }

    const suit = (card.suit || 'spades').toLowerCase();
    let rank = (card.rank || 'A').toUpperCase();

    // Normalize rank (e.g. 10, J, Q, K, A)
    if (rank === '1') rank = 'A';
    return `${suit}_${rank}.png`;
  },

  /**
   * Universal Card Render Method
   * @param {object} card 
   * @param {object} options { isSelected: boolean, isFaceDown: boolean, onClick: function, size: string }
   */
  renderCard(card, options = {}) {
    const { isSelected = false, isFaceDown = false, onClick = null, size = 'normal' } = options;
    const cardEl = document.createElement('div');
    cardEl.dataset.cardId = card ? card.id : '';

    // ==========================================
    // 1. FACE DOWN CARDS (LƯNG BÀI PIXEL CHUẨN)
    // ==========================================
    if (isFaceDown) {
      cardEl.className = `card-punk-item pixel-card ${size} face-down ${isSelected ? 'selected' : ''}`;
      let backSrc = 'pixel_deck_standard/card_back.png';
      if (this.isUnoCard(card)) {
        backSrc = 'pixel_deck_unique/card_back.png';
      } else if (this.isKittensCard(card)) {
        backSrc = 'pixel_deck_kittens/card_back.png';
      }
      cardEl.innerHTML = `<img src="${backSrc}" alt="Card Back" class="pixel-card-img" draggable="false" />`;
      return cardEl;
    }

    if (!card) return cardEl;

    // ==========================================
    // 2. UNO PIXEL ART CARDS
    // ==========================================
    if (this.isUnoCard(card)) {
      const imgName = this.getUnoImageName(card);
      cardEl.className = `card-punk-item pixel-card uno-pixel-card ${size} face-up ${isSelected ? 'selected' : ''}`;
      cardEl.innerHTML = `<img src="pixel_deck_unique/${imgName}" alt="${card.id || imgName}" class="pixel-card-img" draggable="false" />`;

      if (typeof onClick === 'function') {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(card, cardEl);
        });
      }
      return cardEl;
    }

    // ==========================================
    // 3. MÈO NỔ (EXPLODING KITTENS) PIXEL CARDS
    // ==========================================
    if (this.isKittensCard(card)) {
      const imgName = this.getKittensImageName(card);
      cardEl.className = `card-punk-item pixel-card kittens-pixel-card ${size} face-up ${isSelected ? 'selected' : ''}`;
      cardEl.innerHTML = `<img src="pixel_deck_kittens/${imgName}" alt="${card.id || imgName}" class="pixel-card-img" draggable="false" />`;

      if (typeof onClick === 'function') {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(card, cardEl);
        });
      }
      return cardEl;
    }

    // ==========================================
    // 4. BÀI TÂY (SÂM, TẤN, BA CÀO, JOKER) PIXEL CARDS
    // ==========================================
    const imgName = this.getStandardImageName(card);
    cardEl.className = `card-punk-item pixel-card standard-pixel-card ${size} face-up ${isSelected ? 'selected' : ''}`;
    cardEl.innerHTML = `<img src="pixel_deck_standard/${imgName}" alt="${card.id || imgName}" class="pixel-card-img" draggable="false" />`;

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
