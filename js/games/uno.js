/**
 * CARDPUNK UNO Client UI Module
 * Handles Wild Color Chooser, Call UNO button, Draw Card action, and Uno card rendering
 */
class UnoClient {
  constructor(gameTable) {
    this.table = gameTable;
    this.colorModal = null;
    this.initControls();
  }

  initControls() {
    // Wild Color Picker Modal
    let modal = document.getElementById('uno-color-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'uno-color-picker-modal';
      modal.className = 'spinner-overlay';
      modal.innerHTML = `
        <div class="spinner-modal nb-box" style="width: 360px;">
          <div class="spinner-header">
            <span class="nb-badge" style="background: var(--color-yellow)">UNO WILD</span>
            <h2 class="spinner-title">CHỌN MÀU TIẾP THEO</h2>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; margin-top: 10px;">
            <button class="nb-btn lg" style="background:#ef4444; color:#fff;" onclick="window.unoClientInstance.chooseColor('red')">ĐỎ (RED)</button>
            <button class="nb-btn lg" style="background:#eab308; color:#000;" onclick="window.unoClientInstance.chooseColor('yellow')">VÀNG (YELLOW)</button>
            <button class="nb-btn lg" style="background:#22c55e; color:#fff;" onclick="window.unoClientInstance.chooseColor('green')">XANH LÁ (GREEN)</button>
            <button class="nb-btn lg" style="background:#3b82f6; color:#fff;" onclick="window.unoClientInstance.chooseColor('blue')">XANH DƯƠNG (BLUE)</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    this.colorModal = modal;
    window.unoClientInstance = this;

    // Draw Card button
    let btnDraw = document.getElementById('btn-uno-draw');
    if (!btnDraw) {
      btnDraw = document.createElement('button');
      btnDraw.id = 'btn-uno-draw';
      btnDraw.className = 'nb-btn sm white';
      btnDraw.style.display = 'none';
      btnDraw.innerHTML = 'Rút 1 Lá';
      btnDraw.onclick = () => this.handleDraw();

      const actionButtons = document.querySelector('.hand-action-buttons');
      if (actionButtons) actionButtons.appendChild(btnDraw);
    }
    this.btnDraw = btnDraw;

    // Hô UNO button
    let btnCallUno = document.getElementById('btn-uno-shout');
    if (!btnCallUno) {
      btnCallUno = document.createElement('button');
      btnCallUno.id = 'btn-uno-shout';
      btnCallUno.className = 'nb-btn lg pink pulse';
      btnCallUno.style.display = 'none';
      btnCallUno.innerHTML = 'HÔ UNO!';
      btnCallUno.onclick = () => this.handleCallUno();

      const actionButtons = document.querySelector('.hand-action-buttons');
      if (actionButtons) actionButtons.appendChild(btnCallUno);
    }
    this.btnCallUno = btnCallUno;
  }

  update(state) {
    if (state.gameType !== 'uno') {
      if (this.btnDraw) this.btnDraw.style.display = 'none';
      if (this.btnCallUno) this.btnCallUno.style.display = 'none';
      if (this.colorModal) this.colorModal.style.display = 'none';
      return;
    }

    const gameData = state.gameData;
    if (!gameData) return;

    // 1. Active Color & Top Card Indicator
    let colorBadge = document.getElementById('uno-active-color-badge');
    if (!colorBadge) {
      colorBadge = document.createElement('div');
      colorBadge.id = 'uno-active-color-badge';
      colorBadge.className = 'nb-badge';
      const centerCards = document.getElementById('table-center-cards');
      if (centerCards && centerCards.parentNode) {
        centerCards.parentNode.insertBefore(colorBadge, centerCards);
      }
    }

    const colorHex = { red: '#ef4444', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6' }[gameData.activeColor] || '#000';
    colorBadge.style.display = 'inline-flex';
    colorBadge.style.background = colorHex;
    colorBadge.style.color = gameData.activeColor === 'yellow' ? '#000' : '#fff';
    colorBadge.innerHTML = `MÀU ĐANG CHƠI: <strong>${(gameData.activeColor || '').toUpperCase()}</strong>`;

    // 2. Render Uno Top Card on Center
    const centerCardsLayer = document.getElementById('table-center-cards');
    if (centerCardsLayer && gameData.topCard) {
      centerCardsLayer.innerHTML = '';
      const unoCardEl = this.renderUnoCard(gameData.topCard, 'normal');
      centerCardsLayer.appendChild(unoCardEl);
    }

    // 3. Draw & Uno Shout buttons
    if (this.btnDraw) {
      this.btnDraw.style.display = state.isMyTurn && state.status === 'playing' ? 'inline-flex' : 'none';
    }

    if (this.btnCallUno) {
      const myCardCount = state.myHand?.length || 0;
      this.btnCallUno.style.display = (myCardCount <= 2 && myCardCount >= 1 && state.status === 'playing') ? 'inline-flex' : 'none';
    }

    // 4. Showdown
    if (gameData.engineStatus === 'finished' && gameData.roundResults) {
      this.displayShowdown(gameData.roundResults, state.isHost);
    }
  }

  renderUnoCard(card, size = 'normal') {
    const el = document.createElement('div');
    el.className = `card-punk-item ${size}`;
    const bgColors = {
      red: '#ef4444',
      yellow: '#eab308',
      green: '#22c55e',
      blue: '#3b82f6',
      wild: 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)'
    };

    el.style.background = bgColors[card.color] || '#ffffff';
    el.style.color = card.color === 'yellow' ? '#000000' : '#ffffff';
    el.style.border = '3px solid #000';
    el.style.boxShadow = '3px 3px 0 #000';

    el.innerHTML = `
      <div style="font-size:12px; font-weight:900; line-height:1;">${card.label || card.rank}</div>
      <div style="font-size:26px; font-weight:900; text-align:center;">${card.label || card.rank}</div>
      <div style="font-size:12px; font-weight:900; line-height:1; transform:rotate(180deg); text-align:right;">${card.label || card.rank}</div>
    `;
    return el;
  }

  chooseColor(color) {
    if (this.colorModal) this.colorModal.style.display = 'none';
    if (this.pendingCardId) {
      window.cardpunkClient.socket.emit('play_cards', { cardIds: [this.pendingCardId], chosenColor: color }, (res) => {
        if (res && !res.success) alert(res.error);
      });
      this.pendingCardId = null;
    }
  }

  handleDraw() {
    window.cardpunkClient.socket.emit('draw_card', {}, (res) => {
      if (res && !res.success) alert(res.error);
    });
  }

  handleCallUno() {
    window.cardpunkClient.socket.emit('call_uno', {}, (res) => {
      alert(res.message || res.error);
    });
  }

  displayShowdown(results, isHost) {
    const tableInstance = window.gameTableInstance;
    if (tableInstance && tableInstance.threeCardsClient) {
      tableInstance.threeCardsClient.displayShowdown({
        winnerName: results.winnerName,
        winnerRankName: 'VÔ ĐỊCH UNO',
        rankings: results.rankings.map(r => ({
          rankPosition: r.rankPosition,
          name: r.name,
          isWinner: r.isWinner,
          hand: [],
          evaluation: { tier: r.isWinner ? 4 : 1, rankName: r.note }
        }))
      }, isHost);
    }
  }
}

window.UnoClient = UnoClient;
