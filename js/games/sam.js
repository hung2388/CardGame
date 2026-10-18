/**
 * CARDPUNK Sâm Lốc Client UI Module
 * Handles 10-card hand sorting, 30s bottom-bar Báo Sâm decision, 60s turn timer, and Sâm showdown
 */
class SamClient {
  constructor(gameTable) {
    this.table = gameTable;
    this.state = null;
    this.samRanks = {
      '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15
    };

    this.btnCallSam = null;
    this.btnSkipSam = null;
    this.timerInterval = null;

    this.initElements();
    this.startClock();
  }

  initElements() {
    const actionButtons = document.querySelector('.hand-action-buttons');
    if (!actionButtons) return;

    // Normal bottom "Báo Sâm" Button (optional, only in first round / 30s window)
    let btnCall = document.getElementById('btn-call-sam');
    if (!btnCall) {
      btnCall = document.createElement('button');
      btnCall.id = 'btn-call-sam';
      btnCall.className = 'nb-btn pink lg';
      btnCall.style.display = 'none';
      btnCall.textContent = 'BÁO SÂM (30s)';
      btnCall.title = 'Báo Sâm để giành quyền đi trước. Đánh hết bài không ai chặn = Thắng Sâm!';
      btnCall.addEventListener('click', () => this.handleCallSam(true));
      actionButtons.insertBefore(btnCall, actionButtons.firstChild);
    }
    this.btnCallSam = btnCall;

    // Optional "Không Báo" Button
    let btnSkip = document.getElementById('btn-skip-sam');
    if (!btnSkip) {
      btnSkip = document.createElement('button');
      btnSkip.id = 'btn-skip-sam';
      btnSkip.className = 'nb-btn white sm';
      btnSkip.style.display = 'none';
      btnSkip.textContent = 'Đánh Thường';
      btnSkip.title = 'Bỏ qua không báo Sâm';
      btnSkip.addEventListener('click', () => this.handleCallSam(false));
      actionButtons.insertBefore(btnSkip, btnCall.nextSibling);
    }
    this.btnSkipSam = btnSkip;
  }

  startClock() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.updateTimerDisplay();
    }, 500);
  }

  /**
   * Sort player hand cards in Sâm hierarchy (3 -> 2)
   */
  sortHand(cards) {
    if (!cards || !Array.isArray(cards)) return [];
    return [...cards].sort((a, b) => (this.samRanks[a.rank] || 0) - (this.samRanks[b.rank] || 0));
  }

  async handleCallSam(doesCall) {
    if (doesCall) {
      if (this.btnCallSam) {
        this.btnCallSam.disabled = true;
        this.btnCallSam.textContent = 'ĐÃ BÁO SÂM!';
      }
      if (this.btnSkipSam) this.btnSkipSam.style.display = 'none';
    } else {
      if (this.btnCallSam) this.btnCallSam.style.display = 'none';
      if (this.btnSkipSam) this.btnSkipSam.style.display = 'none';
    }

    try {
      await window.cardpunkClient.socket.emit('call_sam', { doesCall });
    } catch (err) {
      console.error('Call sam error:', err);
    }
  }

  update(state) {
    this.state = state;

    if (state.gameType !== 'sam') {
      if (this.btnCallSam) this.btnCallSam.style.display = 'none';
      if (this.btnSkipSam) this.btnSkipSam.style.display = 'none';
      return;
    }

    const gameData = state.gameData;
    if (!gameData) return;

    // 1. Manage Báo Sâm Buttons in action console
    if (gameData.engineStatus === 'calling_sam') {
      if (!gameData.hasCalledSam) {
        if (this.btnCallSam) {
          this.btnCallSam.style.display = 'inline-flex';
          this.btnCallSam.disabled = false;
        }
        if (this.btnSkipSam) this.btnSkipSam.style.display = 'inline-flex';
      } else {
        if (gameData.didCallSam) {
          if (this.btnCallSam) {
            this.btnCallSam.style.display = 'inline-flex';
            this.btnCallSam.disabled = true;
            this.btnCallSam.textContent = 'BẠN ĐÃ BÁO SÂM!';
          }
        } else {
          if (this.btnCallSam) this.btnCallSam.style.display = 'none';
        }
        if (this.btnSkipSam) this.btnSkipSam.style.display = 'none';
      }

      // In calling_sam phase, hide normal play buttons so only Báo Sâm actions appear
      if (this.table.btnPlay) this.table.btnPlay.style.display = 'none';
      if (this.table.btnPass) this.table.btnPass.style.display = 'none';
    } else {
      // Normal playing phase: restore play buttons and hide Báo Sâm buttons
      if (this.table.btnPlay) this.table.btnPlay.style.display = '';
      if (this.table.btnPass) this.table.btnPass.style.display = '';
      if (this.btnCallSam) this.btnCallSam.style.display = 'none';
      if (this.btnSkipSam) this.btnSkipSam.style.display = 'none';
    }

    // 2. Current Table Combo Info Banner
    let comboBanner = document.getElementById('sam-table-combo-banner');
    if (!comboBanner) {
      comboBanner = document.createElement('div');
      comboBanner.id = 'sam-table-combo-banner';
      comboBanner.className = 'nb-badge';
      comboBanner.style.background = 'var(--color-yellow)';
      comboBanner.style.display = 'none';
      const centerCards = document.getElementById('table-center-cards');
      if (centerCards && centerCards.parentNode) {
        centerCards.parentNode.insertBefore(comboBanner, centerCards);
      }
    }

    if (gameData.lastValidCombo) {
      comboBanner.style.display = 'inline-flex';
      comboBanner.innerHTML = `BÀN ĐANG ĐÁNH: <strong>${gameData.lastValidCombo.name}</strong> (${gameData.lastValidCombo.playerName})`;
    } else {
      comboBanner.style.display = 'none';
    }

    // 3. Update timer & banner
    this.updateTimerDisplay();

    // 4. Showdown Modal for Sâm
    if (gameData.engineStatus === 'finished' && gameData.roundResults) {
      this.displayShowdown(gameData.roundResults, state.isHost);
    }
  }

  updateTimerDisplay() {
    if (!this.state || this.state.gameType !== 'sam' || !this.table.turnIndicator) return;
    const gameData = this.state.gameData;
    if (!gameData) return;

    // Phase 1: Calling Sâm (30s countdown)
    if (gameData.engineStatus === 'calling_sam') {
      const remainingSec = Math.max(0, Math.ceil((gameData.samDeadline - Date.now()) / 1000));
      
      if (this.btnCallSam && !gameData.hasCalledSam) {
        this.btnCallSam.textContent = `BÁO SÂM (${remainingSec}s)`;
      }

      this.table.turnIndicator.innerHTML = `<strong>GIAI ĐOẠN BÁO SÂM (${remainingSec}s):</strong> Xem bài và bấm nút "BÁO SÂM" ở góc dưới nếu muốn cướp cái!`;
      this.table.turnIndicator.className = 'turn-banner my-turn';
      return;
    }

    // Phase 2: Normal Playing (60s turn timer)
    if (gameData.engineStatus === 'playing') {
      const turnSec = Math.max(0, Math.ceil((gameData.turnDeadline - Date.now()) / 1000));

      if (this.state.isMyTurn) {
        this.table.turnIndicator.innerHTML = `<strong>ĐẾN LƯỢT BẠN (${turnSec}s)!</strong> Chọn bài để đánh hoặc bấm Bỏ Lượt.`;
        this.table.turnIndicator.className = 'turn-banner my-turn pulse';

        // Enable Pass button only if there is a trick on table
        if (this.table.btnPass) {
          this.table.btnPass.disabled = !gameData.lastValidCombo;
        }
      } else {
        const turnPlayer = this.state.players.find(p => p.seat === this.state.currentTurnSeat);
        const pName = turnPlayer ? turnPlayer.name : `Ghế #${this.state.currentTurnSeat}`;
        this.table.turnIndicator.innerHTML = `Lượt của <strong>${pName}</strong> (${turnSec}s)...`;
        this.table.turnIndicator.className = 'turn-banner other-turn';

        if (this.table.btnPlay) this.table.btnPlay.disabled = true;
        if (this.table.btnPass) this.table.btnPass.disabled = true;
      }
    }
  }

  displayShowdown(results, isHost) {
    const tableInstance = window.gameTableInstance;
    if (tableInstance && tableInstance.threeCardsClient) {
      tableInstance.threeCardsClient.displayShowdown({
        winnerName: results.winnerName,
        winnerRankName: results.isThangSam ? 'THẮNG SÂM TUYỆT ĐỐI' : 'VỀ NHẤT',
        rankings: results.rankings.map(r => ({
          rankPosition: r.rankPosition,
          name: r.name,
          isWinner: r.isWinner,
          hand: [],
          evaluation: {
            tier: r.isWinner ? 4 : 1,
            rankName: r.note
          }
        }))
      }, isHost);
    }
  }
}

window.SamClient = SamClient;
