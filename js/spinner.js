/**
 * CARDPUNK Authentic Wheel Spinner (Inspired by spinthewheel.io)
 * Uses HTML5 Canvas for real circular pie sectors, rotated labels,
 * ticker needle at 3 o'clock, and smooth physics deceleration.
 */
class TableSpinner {
  constructor(overlayContainerId = 'spinner-overlay') {
    this.container = document.getElementById(overlayContainerId);
    this.audioCtx = null;
    this.colors = [
      '#ef4444', // Red
      '#f97316', // Orange
      '#22c55e', // Green
      '#8b5cf6', // Purple
      '#eab308', // Yellow
      '#06b6d4', // Cyan
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#10b981', // Emerald
      '#6366f1', // Indigo
      '#f43f5e', // Rose
      '#84cc16'  // Lime
    ];
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  playTickSound() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  playFanfareSound() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + i * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(this.audioCtx.currentTime + i * 0.1);
        osc.stop(this.audioCtx.currentTime + i * 0.1 + 0.25);
      });
    } catch (e) {}
  }

  /**
   * Draw circular pie sectors onto canvas
   */
  drawWheel(canvas, slices, width = 520, height = 520) {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const cy = height / 2;
    const radius = cx - 12;
    const N = slices.length;
    const sliceAngle = (2 * Math.PI) / N;

    ctx.clearRect(0, 0, width, height);

    // Draw pie sectors
    slices.forEach((slice, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = (i + 1) * sliceAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = slice.color || this.colors[i % this.colors.length];
      ctx.fill();

      // Bold divider lines
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // Text along the slice radius pointing outwards
      const midAngle = startAngle + sliceAngle / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      const fontSize = N > 8 ? 16 : (N > 5 ? 18 : 22);
      ctx.font = `900 ${fontSize}px "Space Grotesk", -apple-system, sans-serif`;

      const label = slice.label || '';
      // Neo-brutalist text stroke for maximum readability
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(label, radius - 20, 0);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, radius - 20, 0);
      ctx.restore();
    });

    // Outer circle border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Center circular hub
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Center text
    ctx.font = '900 18px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffde59';
    ctx.fillText('CP', cx, cy);
  }

  /**
   * Run full spin sequence:
   * 1. Spin for starting player (landing on targetStarterSeat)
   * 2. Spin for direction (landing on targetDirection)
   */
  startSpinSequence(players, targetStarterSeat, targetDirection, onComplete) {
    if (!this.container) return;

    this.container.style.display = 'flex';
    this.container.innerHTML = '';

    // Step 1: Starter Wheel
    this.renderStarterWheel(players, targetStarterSeat, () => {
      setTimeout(() => {
        // Step 2: Direction Wheel
        this.renderDirectionWheel(targetDirection, () => {
          setTimeout(() => {
            this.container.style.display = 'none';
            if (typeof onComplete === 'function') onComplete();
          }, 1200);
        });
      }, 800);
    });
  }

  renderStarterWheel(players, targetSeat, doneCallback) {
    const starterPlayer = players.find(p => Number(p.seat) === Number(targetSeat)) || {};
    const starterName = starterPlayer.name || `Ghế #${targetSeat}`;

    this.container.innerHTML = `
      <div class="spinner-modal nb-box">
        <div class="spinner-header">
          <span class="nb-badge" style="background: var(--color-yellow)">BƯỚC 1 / 2</span>
          <h2 class="spinner-title">CHỌN NGƯỜI ĐI TRƯỚC</h2>
        </div>

        <div class="wheel-stage">
          <div class="wheel-pointer"></div>
          <canvas id="wheel-canvas" class="wheel-canvas"></canvas>
        </div>

        <div id="spinner-result-text" class="spinner-result">Đang quay tìm người may mắn...</div>
      </div>
    `;

    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;

    const slices = players.map(p => ({
      seat: p.seat,
      label: `#${p.seat} ${p.name ? (p.name.length > 9 ? p.name.substring(0, 8) + '..' : p.name) : ''}`
    }));

    this.drawWheel(canvas, slices);

    // Exact alignment math with pointer at 3 o'clock (0 degrees):
    const rawTargetIdx = players.findIndex(p => Number(p.seat) === Number(targetSeat));
    const targetIdx = rawTargetIdx >= 0 ? rawTargetIdx : 0;
    const N = Math.max(1, players.length);
    const sliceDeg = 360 / N;
    // Target sector center angle in resting canvas:
    const targetMidDeg = (targetIdx + 0.5) * sliceDeg;
    // Rotation required so targetMidDeg lands on 0 degrees (3 o'clock) with 5 full spins:
    const fullSpins = 360 * 5;
    const finalAngle = fullSpins + ((360 - (targetMidDeg % 360)) % 360);

    // Play tick sound effects during spin
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      this.playTickSound();
      tickCount++;
      if (tickCount > 26) clearInterval(tickInterval);
    }, 120);

    setTimeout(() => {
      canvas.style.transition = 'transform 3.5s cubic-bezier(0.12, 0.8, 0.18, 1)';
      canvas.style.transform = `rotate(${finalAngle}deg)`;
    }, 50);

    setTimeout(() => {
      clearInterval(tickInterval);
      this.playFanfareSound();
      const resText = document.getElementById('spinner-result-text');
      if (resText) {
        resText.innerHTML = `<strong>${starterName}</strong> (Ghế #${targetSeat}) ĐI TRƯỚC!`;
        resText.classList.add('winner-announce');
      }
      setTimeout(doneCallback, 1400);
    }, 3800);
  }

  renderDirectionWheel(targetDirection, doneCallback) {
    const isClockwise = targetDirection === 'clockwise';
    const directionLabel = isClockwise ? 'Thuận Kim Đồng Hồ' : 'Ngược Kim Đồng Hồ';

    this.container.innerHTML = `
      <div class="spinner-modal nb-box">
        <div class="spinner-header">
          <span class="nb-badge" style="background: var(--color-cyan)">BƯỚC 2 / 2</span>
          <h2 class="spinner-title">CHỌN CHIỀU VÁN ĐẤU</h2>
        </div>

        <div class="wheel-stage">
          <div class="wheel-pointer"></div>
          <canvas id="wheel-canvas" class="wheel-canvas"></canvas>
        </div>

        <div id="direction-result-text" class="spinner-result">Đang quay chọn chiều...</div>
      </div>
    `;

    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;

    // 2 sectors: Thuận (Clockwise) & Ngược (Counter-Clockwise)
    const slices = [
      { label: 'THUẬN (CW)', color: '#22c55e' },
      { label: 'NGƯỢC (CCW)', color: '#8b5cf6' }
    ];

    this.drawWheel(canvas, slices);

    const targetIdx = isClockwise ? 0 : 1;
    const sliceDeg = 180;
    const targetMidDeg = (targetIdx + 0.5) * sliceDeg;
    const fullSpins = 360 * 5;
    const finalAngle = fullSpins + ((360 - (targetMidDeg % 360)) % 360);

    let tickCount = 0;
    const tickInterval = setInterval(() => {
      this.playTickSound();
      tickCount++;
      if (tickCount > 24) clearInterval(tickInterval);
    }, 120);

    setTimeout(() => {
      canvas.style.transition = 'transform 3.2s cubic-bezier(0.12, 0.8, 0.18, 1)';
      canvas.style.transform = `rotate(${finalAngle}deg)`;
    }, 50);

    setTimeout(() => {
      clearInterval(tickInterval);
      this.playFanfareSound();
      const resText = document.getElementById('direction-result-text');
      if (resText) {
        resText.innerHTML = `Chiều ván: <strong>${directionLabel}</strong>`;
        resText.classList.add('winner-announce');
      }
      setTimeout(doneCallback, 1400);
    }, 3500);
  }
}

window.TableSpinner = TableSpinner;
