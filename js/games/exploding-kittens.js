/**
 * CARDPUNK Exploding Kittens (Mèo Nổ) Client UI Module
 * Handles Draw-to-End-Turn tension button, See The Future modal, and Bomb Defused / Exploded FX
 */
class ExplodingKittensClient {
  constructor(gameTable) {
    this.table = gameTable;
    this.seeFutureModal = null;
    this.initControls();
  }

  initControls() {
    // See Future Modal
    let modal = document.getElementById('kittens-see-future-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'kittens-see-future-modal';
      modal.className = 'spinner-overlay';
      modal.innerHTML = `
        <div class="spinner-modal nb-box" style="width: 440px;">
          <div class="spinner-header">
            <span class="nb-badge" style="background: var(--color-cyan)">SEE THE FUTURE</span>
            <h2 class="spinner-title">3 LÁ TRÊN CÙNG BỘ BÀI</h2>
          </div>
          <div id="future-cards-row" style="display: flex; gap: 10px; justify-content: center; width: 100%; margin: 16px 0;"></div>
          <button class="nb-btn yellow lg" onclick="document.getElementById('kittens-see-future-modal').style.display='none'">Đã Hiểu</button>
        </div>
      `;
      document.body.appendChild(modal);
    }
    this.seeFutureModal = modal;

    // Draw to End Turn Button
    let btnDraw = document.getElementById('btn-kittens-draw');
    if (!btnDraw) {
      btnDraw = document.createElement('button');
      btnDraw.id = 'btn-kittens-draw';
      btnDraw.className = 'nb-btn lg pink pulse';
      btnDraw.style.display = 'none';
      btnDraw.innerHTML = 'RÚT BÀI ĐỂ QUA LƯỢT';
      btnDraw.onclick = () => this.handleDrawToEndTurn();

      const actionButtons = document.querySelector('.hand-action-buttons');
      if (actionButtons) actionButtons.appendChild(btnDraw);
    }
    this.btnDraw = btnDraw;
  }

  update(state) {
    if (state.gameType !== 'exploding-kittens') {
      if (this.btnDraw) this.btnDraw.style.display = 'none';
      if (this.seeFutureModal) this.seeFutureModal.style.display = 'none';
      return;
    }

    const gameData = state.gameData;
    if (!gameData) return;

    // 1. Draw to End Turn Button
    if (this.btnDraw) {
      this.btnDraw.style.display = (state.isMyTurn && state.status === 'playing') ? 'inline-flex' : 'none';
      this.btnDraw.innerHTML = `RÚT BÀI (Còn ${gameData.turnsRemaining || 1} lượt)`;
    }

    // 2. Showdown
    if (gameData.engineStatus === 'finished' && gameData.roundResults) {
      this.displayShowdown(gameData.roundResults, state.isHost);
    }
  }

  handleDrawToEndTurn() {
    window.cardpunkClient.socket.emit('draw_card', {}, (res) => {
      if (res && res.message) {
        alert(res.message);
      }
    });
  }

  showFutureCards(cards) {
    if (!this.seeFutureModal) return;
    this.seeFutureModal.style.display = 'flex';
    const row = document.getElementById('future-cards-row');
    if (row) {
      row.innerHTML = '';
      cards.forEach(c => {
        const el = document.createElement('div');
        el.className = 'card-punk-item normal';
        el.style.border = '2.5px solid #000';
        el.style.background = c.rank === 'exploding_kitten' ? '#ef4444' : '#ffffff';
        el.style.color = c.rank === 'exploding_kitten' ? '#ffffff' : '#000000';
        el.innerHTML = `
          <div style="font-size:11px; font-weight:800;">${c.label || c.rank}</div>
          <div style="font-size:16px; font-weight:900; text-align:center;">${c.label || c.rank}</div>
        `;
        row.appendChild(el);
      });
    }
  }

  displayShowdown(results, isHost) {
    const tableInstance = window.gameTableInstance;
    if (tableInstance && tableInstance.threeCardsClient) {
      tableInstance.threeCardsClient.displayShowdown({
        winnerName: results.winnerName,
        winnerRankName: 'NGƯỜI SỐNG SÓT CUỐI CÙNG',
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

window.ExplodingKittensClient = ExplodingKittensClient;
