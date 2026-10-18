/**
 * CARDPUNK Socket.IO Client Wrapper
 * Handles server connection, status monitoring, and anti-cheat event emission
 */
class SocketClient {
  constructor() {
    // Priority: custom window override -> localStorage -> current host or localhost
    const savedUrl = localStorage.getItem('cardpunk_server_url');
    this.serverUrl = window.CARDPUNK_SERVER_URL || savedUrl || (
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : 'https://cardpunk-backend-production.up.railway.app' // Example Railway fallback
    );

    this.socket = null;
    this.isConnected = false;
    this.healthCheckTimer = null;
    this.callbacks = new Map();
  }

  /**
   * Set custom backend URL (e.g. user's Railway instance)
   */
  setServerUrl(url) {
    this.serverUrl = url;
    localStorage.setItem('cardpunk_server_url', url);
    if (this.socket) {
      this.socket.disconnect();
      this.init();
    }
  }

  /**
   * Initialize Socket.IO connection and banner monitoring
   */
  init() {
    this.updateStatusBanner('checking', 'Đang kiểm tra kết nối tới Server...');

    // Load socket.io client script if not already present
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
      script.onload = () => this.connectSocket();
      script.onerror = () => {
        this.updateStatusBanner('offline', 'Không tải được thư viện Socket.IO! Kiểm tra mạng.');
      };
      document.head.appendChild(script);
    } else {
      this.connectSocket();
    }
  }

  connectSocket() {
    try {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.updateStatusBanner('online', 'Server online! Sẵn sàng tham chiến.');
        console.log('[Socket] Connected to backend:', this.serverUrl, 'ID:', this.socket.id);
        this.trigger('connect', this.socket.id);
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.updateStatusBanner('offline', 'Server đang tắt hoặc mất kết nối. Đang tự động thử lại...');
        console.warn('[Socket] Disconnected:', reason);
        this.trigger('disconnect', reason);
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        this.updateStatusBanner('offline', 'Server backend đang tắt. Hãy bật service trên Railway rồi đợi ~10s...');
        console.warn('[Socket] Connect error:', error.message);
        this.trigger('connect_error', error);
      });

      // Global game events
      this.socket.on('room_state_update', (state) => {
        this.trigger('room_state_update', state);
      });

      this.socket.on('spin_selection_start', (data) => {
        this.trigger('spin_selection_start', data);
      });

      this.socket.on('cards_dealt_notice', (data) => {
        this.trigger('cards_dealt_notice', data);
      });

      this.socket.on('round_showdown', (data) => {
        this.trigger('round_showdown', data);
      });

    } catch (err) {
      console.error('[Socket Init Exception]:', err);
      this.updateStatusBanner('offline', 'Lỗi khởi tạo socket: ' + err.message);
    }
  }

  updateStatusBanner(status, message) {
    let banner = document.getElementById('cardpunk-server-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'cardpunk-server-banner';
      banner.className = 'server-status-banner';
      document.body.prepend(banner);
    }

    banner.className = `server-status-banner ${status}`;
    banner.innerHTML = `
      <div class="pulse-dot"></div>
      <span>${message}</span>
      <button class="nb-btn sm white" style="margin-left:auto; font-size:11px; padding:4px 8px;" onclick="window.cardpunkClient.promptCustomUrl()">
        Đổi URL Server
      </button>
    `;

    // Auto hide green online banner after 4 seconds
    if (status === 'online') {
      setTimeout(() => {
        if (this.isConnected && banner) {
          banner.style.display = 'none';
        }
      }, 4000);
    } else {
      banner.style.display = 'flex';
    }
  }

  promptCustomUrl() {
    const current = this.serverUrl;
    const url = prompt('Nhập URL Backend của bạn (ví dụ http://localhost:3001 hoặc link Railway):', current);
    if (url && url.trim() !== '') {
      this.setServerUrl(url.trim());
    }
  }

  /**
   * Action methods
   */
  createRoom(gameType, playerName) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        return resolve({ success: false, error: 'Chưa kết nối được tới server!' });
      }
      this.socket.emit('create_room', { gameType, playerName }, resolve);
    });
  }

  joinRoom(roomId, playerName) {
    return new Promise((resolve) => {
      if (!this.socket || !this.isConnected) {
        return resolve({ success: false, error: 'Chưa kết nối được tới server!' });
      }
      this.socket.emit('join_room', { roomId, playerName }, resolve);
    });
  }

  startGame(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('start_game', { roomId }, resolve);
    });
  }

  playCards(cardIds) {
    return new Promise((resolve) => {
      this.socket.emit('play_cards', { cardIds }, resolve);
    });
  }

  revealCards() {
    return new Promise((resolve) => {
      this.socket.emit('reveal_cards', {}, resolve);
    });
  }

  newRound() {
    return new Promise((resolve) => {
      this.socket.emit('new_round', {}, resolve);
    });
  }

  passTurn() {
    return new Promise((resolve) => {
      this.socket.emit('pass_turn', {}, resolve);
    });
  }

  leaveRoom() {
    if (this.socket) this.socket.emit('leave_room');
  }

  on(event, fn) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(fn);
  }

  trigger(event, data) {
    const handlers = this.callbacks.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }
}

// Global singleton instance
window.cardpunkClient = new SocketClient();
