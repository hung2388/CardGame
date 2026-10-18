/**
 * CARDPUNK Three-Cards (Ba Cào) Client UI Module
 * Handles card flipping, hand point badge, showdown animations, and winner popup
 */
class ThreeCardsClient {
  constructor(gameTable) {
    this.table = gameTable;
    this.winnerModal = null;
    this.audioCtx = null;
    this.initModal();
  }

  initModal() {
    let modal = document.getElementById('three-cards-showdown-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'three-cards-showdown-modal';
      modal.className = 'spinner-overlay';
      modal.innerHTML = `
        <div class="spinner-modal nb-box" style="width: 520px; max-width: 90vw;">
          <div class="spinner-header">
            <span class="nb-badge" style="background: var(--color-yellow)">KẾT QUẢ VÁN ĐẤU</span>
            <h2 id="tc-winner-title" class="spinner-title" style="color: var(--color-pink)">NGƯỜI THẮNG: ...</h2>
          </div>

          <div id="tc-rankings-list" class="tc-rankings-container" style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
            <!-- Ranked players will be populated here -->
          </div>

          <div style="display: flex; gap: 12px; width: 100%; justify-content: center; margin-top: 10px;">
            <button id="btn-tc-close-modal" class="nb-btn white sm">Đóng</button>
            <button id="btn-tc-new-round" class="nb-btn green sm" style="display: none;">Ván Mới (Chủ Bàn)</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btn-tc-close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
      });

      document.getElementById('btn-tc-new-round').addEventListener('click', async () => {
        modal.style.display = 'none';
        await window.cardpunkClient.newRound();
      });
    }
    this.winnerModal = modal;
  }

  playFlipSound() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (e) {}
  }

  /**
   * Render custom UI elements during Three Cards round
   */
  update(state) {
    if (state.gameType !== 'three-cards') return;
    const gameData = state.gameData;
    if (!gameData) return;

    // Show hand points badge if available
    let pointsBadge = document.getElementById('my-hand-points-badge');
    if (!pointsBadge) {
      pointsBadge = document.createElement('div');
      pointsBadge.id = 'my-hand-points-badge';
      pointsBadge.className = 'my-points-badge nb-box';
      const consoleEl = document.querySelector('.arena-hand-console');
      if (consoleEl) consoleEl.prepend(pointsBadge);
    }

    const myHand = state.myHand || [];
    if (myHand.length === 3 && gameData.myEvaluation) {
      pointsBadge.style.display = 'flex';
      pointsBadge.innerHTML = `
        <span class="badge-label">Bài của bạn:</span>
        <span class="badge-score ${gameData.myEvaluation.tier > 1 ? 'high-tier' : ''}">
          ${gameData.myEvaluation.rankName}
        </span>
        <span class="badge-desc">(${gameData.myEvaluation.description})</span>
      `;
    } else {
      pointsBadge.style.display = 'none';
    }

    // Replace or adapt Action Buttons for Three Cards
    const btnPlay = document.getElementById('btn-play-cards');
    const btnPass = document.getElementById('btn-pass-turn');
    if (btnPass) btnPass.style.display = 'none'; // No pass in Ba Cào

    if (btnPlay) {
      if (state.status === 'playing' && gameData.engineStatus === 'revealing') {
        btnPlay.style.display = 'inline-flex';
        if (gameData.hasRevealed) {
          btnPlay.textContent = 'Đã Mở Bài';
          btnPlay.disabled = true;
          btnPlay.className = 'nb-btn green lg';
        } else {
          btnPlay.textContent = 'Mở Bài Ngay';
          btnPlay.disabled = false;
          btnPlay.className = 'nb-btn yellow lg';
          btnPlay.onclick = async () => {
            this.playFlipSound();
            btnPlay.disabled = true;
            await window.cardpunkClient.revealCards();
          };
        }
      } else {
        btnPlay.onclick = () => this.table.handlePlayCards();
      }
    }

    // Show showdown popup if finished
    if (gameData.engineStatus === 'finished' && gameData.roundResults) {
      this.displayShowdown(gameData.roundResults, state.isHost);
    }
  }

  /**
   * Display leaderboard modal when showdown completes
   */
  displayShowdown(results, isHost) {
    if (!this.winnerModal) return;
    this.winnerModal.style.display = 'flex';

    const winnerTitle = document.getElementById('tc-winner-title');
    if (winnerTitle) {
      winnerTitle.innerHTML = `${results.winnerName} THẮNG! (${results.winnerRankName})`;
    }

    const list = document.getElementById('tc-rankings-list');
    if (list) {
      list.innerHTML = '';
      results.rankings.forEach((p) => {
        const row = document.createElement('div');
        row.className = `tc-rank-row nb-box ${p.isWinner ? 'winner-row' : ''}`;
        row.style.padding = '10px 14px';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.background = p.isWinner ? 'var(--color-yellow)' : '#ffffff';

        // Render miniature card labels
        const cardBadges = (p.hand || []).map(c => {
          const color = ['hearts', 'diamonds'].includes(c.suit) ? '#dc2626' : '#000';
          return `<span style="border:1px solid #000; border-radius:3px; padding:1px 4px; font-weight:800; font-size:11px; background:#fff; color:${color};">${c.rank}${c.suitSymbol}</span>`;
        }).join(' ');

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="nb-badge" style="background:${p.isWinner ? 'var(--color-pink)' : '#e2e8f0'}; color:${p.isWinner ? '#fff' : '#000'}">#${p.rankPosition}</span>
            <strong style="font-size:15px;">${p.name}</strong>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div>${cardBadges}</div>
            <span class="nb-badge" style="background:${p.evaluation.tier > 1 ? 'var(--color-green)' : 'var(--color-cyan)'}; color:#fff;">
              ${p.evaluation.rankName}
            </span>
          </div>
        `;
        list.appendChild(row);
      });
    }

    const btnNewRound = document.getElementById('btn-tc-new-round');
    if (btnNewRound) {
      btnNewRound.style.display = isHost ? 'inline-flex' : 'none';
    }
  }
}

window.ThreeCardsClient = ThreeCardsClient;
