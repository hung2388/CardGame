/**
 * CARDPUNK Đánh Tấn Client UI Module
 * Handles Trump suit badge, attack/defend pairs visualization, and Pick Up (Lên bài)
 */
class TanClient {
  constructor(gameTable) {
    this.table = gameTable;
    this.initControls();
  }

  initControls() {
    let btnPickUp = document.getElementById('btn-tan-pickup');
    if (!btnPickUp) {
      btnPickUp = document.createElement('button');
      btnPickUp.id = 'btn-tan-pickup';
      btnPickUp.className = 'nb-btn sm white';
      btnPickUp.style.display = 'none';
      btnPickUp.innerHTML = 'Lên Bài (Ăn Bài)';
      btnPickUp.onclick = () => this.handlePickUp();

      const actionButtons = document.querySelector('.hand-action-buttons');
      if (actionButtons) actionButtons.appendChild(btnPickUp);
    }
    this.btnPickUp = btnPickUp;
  }

  update(state) {
    if (state.gameType !== 'tan') {
      if (this.btnPickUp) this.btnPickUp.style.display = 'none';
      return;
    }

    const gameData = state.gameData;
    if (!gameData) return;

    // 1. Trump Suit Badge on table
    let trumpBadge = document.getElementById('tan-trump-badge');
    if (!trumpBadge) {
      trumpBadge = document.createElement('div');
      trumpBadge.id = 'tan-trump-badge';
      trumpBadge.className = 'nb-badge';
      trumpBadge.style.background = 'var(--color-pink)';
      trumpBadge.style.color = '#ffffff';
      trumpBadge.style.boxShadow = '0 0 10px rgba(255, 82, 119, 0.6)';
      const centerCards = document.getElementById('table-center-cards');
      if (centerCards && centerCards.parentNode) {
        centerCards.parentNode.insertBefore(trumpBadge, centerCards);
      }
    }

    if (gameData.trumpCard) {
      const suitName = { spades: 'BÍCH', clubs: 'TÉP', diamonds: 'RÔ', hearts: 'CƠ' }[gameData.trumpSuit] || gameData.trumpSuit;
      trumpBadge.style.display = 'inline-flex';
      trumpBadge.innerHTML = `CHẤT TRƯỞNG: <strong>${suitName}</strong> (Lá đáy: ${gameData.trumpCard.rank})`;
    }

    // 2. Center Attack / Defend Pairs
    const centerCardsLayer = document.getElementById('table-center-cards');
    if (centerCardsLayer && gameData.tablePairs) {
      centerCardsLayer.innerHTML = '';
      if (gameData.tablePairs.length === 0) {
        centerCardsLayer.innerHTML = `<div class="table-empty-center-msg">${state.status === 'playing' ? 'Đang chờ tấn công...' : 'Bàn chơi sẵn sàng'}</div>`;
      } else {
        gameData.tablePairs.forEach(p => {
          const pairBox = document.createElement('div');
          pairBox.className = 'tan-attack-defend-pair';
          pairBox.style.display = 'flex';
          pairBox.style.flexDirection = 'column';
          pairBox.style.alignItems = 'center';
          pairBox.style.gap = '4px';

          // Attack Card
          const atk = window.CardRenderer.renderCard(p.attackCard, { size: 'normal' });
          pairBox.appendChild(atk);

          // Defend Card
          if (p.defendCard) {
            const def = window.CardRenderer.renderCard(p.defendCard, { size: 'normal' });
            def.style.marginTop = '-40px';
            def.style.marginLeft = '16px';
            def.style.zIndex = '5';
            pairBox.appendChild(def);
          } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'tan-defend-placeholder';
            placeholder.textContent = 'Đang chờ thủ...';
            placeholder.style.fontSize = '10px';
            placeholder.style.fontWeight = '800';
            placeholder.style.color = '#ffde59';
            pairBox.appendChild(placeholder);
          }
          centerCardsLayer.appendChild(pairBox);
        });
      }
    }

    // 3. Pick Up Button Visibility (Only for defender)
    if (this.btnPickUp) {
      const isDefender = state.mySeat === gameData.defenderSeat;
      this.btnPickUp.style.display = (state.status === 'playing' && isDefender && gameData.tablePairs?.length > 0) ? 'inline-flex' : 'none';
    }

    // 4. Showdown Modal
    if (gameData.engineStatus === 'finished' && gameData.roundResults) {
      this.displayShowdown(gameData.roundResults, state.isHost);
    }
  }

  async handlePickUp() {
    window.cardpunkClient.socket.emit('pick_up', {}, (res) => {
      if (res && !res.success) alert(res.error);
    });
  }

  displayShowdown(results, isHost) {
    const tableInstance = window.gameTableInstance;
    if (tableInstance && tableInstance.threeCardsClient) {
      tableInstance.threeCardsClient.displayShowdown({
        winnerName: results.winnerName,
        winnerRankName: 'CHIẾN THẮNG TRẬN TẤN',
        rankings: [
          { rankPosition: 1, name: results.winnerName, isWinner: true, hand: [], evaluation: { tier: 4, rankName: 'Thắng' } },
          { rankPosition: 2, name: results.loserName, isWinner: false, hand: [], evaluation: { tier: 1, rankName: 'Thua (Thối bài)' } }
        ]
      }, isHost);
    }
  }
}

window.TanClient = TanClient;
