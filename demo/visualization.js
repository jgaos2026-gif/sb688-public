const COLORS = {
  bg: "#050505",
  green: "#00ff00",
  red: "#ff0000",
  yellow: "#ffff00",
  blue: "#0080ff",
  cyan: "#00ffff",
  white: "#ffffff",
  gray: "#1f1f1f",
};
const GHOST_CENTER = 0.5;
const GHOST_SPAWN_RADIUS = 0.12;
const GHOST_MAX_VELOCITY = 0.00035;

function calculateCellSize(totalSize, cellCount, padding) {
  return (totalSize - padding * (cellCount + 1)) / cellCount;
}

export class Visualization {
  constructor(canvas, metricEls) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.metricEls = metricEls;
    this.state = this.defaultState();
    this.animationStart = performance.now();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame(() => this.frame());
  }

  defaultState() {
    return {
      health: 100,
      braidStatus: "GREEN",
      phase: "INIT",
      runtimeMs: 0,
      bricks: Array.from({ length: 64 }, () => "operational"),
      ghostNodes: [],
      scanWave: null,
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(600, Math.floor(rect.width * devicePixelRatio));
    this.canvas.height = Math.max(500, Math.floor(rect.height * devicePixelRatio));
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.updateMetrics();
  }

  setBrickState(index, value) {
    const bricks = this.state.bricks.slice();
    bricks[index] = value;
    this.setState({ bricks });
  }

  activateGhostNodes(count = 5, duration = 300) {
    const now = performance.now();
    this.setState({
      ghostNodes: Array.from({ length: count }, (_, i) => ({
        id: i,
        x: GHOST_CENTER + (Math.random() - 0.5) * GHOST_SPAWN_RADIUS,
        y: GHOST_CENTER + (Math.random() - 0.5) * GHOST_SPAWN_RADIUS,
        vx: (Math.random() - 0.5) * GHOST_MAX_VELOCITY,
        vy: (Math.random() - 0.5) * GHOST_MAX_VELOCITY,
        born: now,
        duration,
      })),
    });
  }

  activateScanWave(duration = 500) {
    this.setState({ scanWave: { start: performance.now(), duration } });
  }

  reset() {
    this.state = this.defaultState();
    this.animationStart = performance.now();
    this.updateMetrics();
  }

  updateMetrics() {
    const operational = this.state.bricks.filter((b) => b === "operational").length;
    this.metricEls.health.textContent = `HEALTH: ${this.state.health.toFixed(1)}%`;
    this.metricEls.braid.textContent = `BRAID: ${this.state.braidStatus}`;
    this.metricEls.bricks.textContent = `BRICKS: ${operational}/64 operational`;
    this.metricEls.runtime.textContent = `RUNTIME: ${Math.round(this.state.runtimeMs)}ms`;
  }

  healthColor() {
    if (this.state.health > 50) return COLORS.green;
    if (this.state.health > 1) return COLORS.yellow;
    return COLORS.red;
  }

  frame() {
    this.draw();
    requestAnimationFrame(() => this.frame());
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    this.drawGauge(130, 130, 84);
    this.drawBraid(260, 70, w - 300, 180);
    this.drawBricks(120, 270, Math.min(w - 170, 760), h - 320);
    this.drawGhostNodes();
    this.drawScanWave();
  }

  drawGauge(cx, cy, r) {
    const ctx = this.ctx;
    const pct = Math.max(0, Math.min(1, this.state.health / 100));
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = this.healthColor();
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    ctx.fillStyle = COLORS.white;
    ctx.font = "700 14px Monaco, Courier New, monospace";
    ctx.fillText(`HEALTH: ${this.state.health.toFixed(1)}%`, cx - 70, cy + 4);
    if (this.state.health < 1) ctx.fillText("CRITICAL", cx - 32, cy + 24);
  }

  drawBraid(x, y, w, h) {
    const ctx = this.ctx;
    const color = this.state.braidStatus === "GREEN" ? COLORS.green : this.state.braidStatus === "RED" ? COLORS.red : COLORS.yellow;
    const drawPath = (phaseShift) => {
      ctx.beginPath();
      for (let i = 0; i <= 80; i += 1) {
        const t = i / 80;
        const px = x + t * w;
        const py = y + h * 0.5 + Math.sin(t * Math.PI * 6 + phaseShift) * 22;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    drawPath(0);
    drawPath(Math.PI);
    const phase = this.state.phase;
    let pulseProgress = null;
    let fromRight = false;
    if (phase === "CORRUPT" || phase === "DETECT" || phase === "ISOLATE") pulseProgress = Math.min(1, this.state.runtimeMs / 500);
    if (phase === "HEAL" || phase === "ROLLBACK" || phase === "VERIFY" || phase === "COMPLETE") {
      pulseProgress = Math.max(0, Math.min(1, (this.state.health - 0.2) / 99.8));
      fromRight = true;
    }
    if (pulseProgress !== null) {
      ctx.strokeStyle = phase === "CORRUPT" || phase === "DETECT" || phase === "ISOLATE" ? COLORS.red : COLORS.green;
      ctx.lineWidth = 6;
      const progress = fromRight ? 1 - pulseProgress : pulseProgress;
      const pulseX = x + progress * w;
      ctx.beginPath();
      ctx.moveTo(pulseX, y + 18);
      ctx.lineTo(pulseX, y + h - 18);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.white;
    ctx.font = "12px Monaco, Courier New, monospace";
    ctx.fillText(`PATH A/B: ${this.state.braidStatus}`, x, y - 12);
  }

  drawBricks(x, y, w, h) {
    const ctx = this.ctx;
    const cols = 8;
    const rows = 8;
    const pad = 5;
    const brickW = calculateCellSize(w, cols, pad);
    const brickH = calculateCellSize(h, rows, pad);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const state = this.state.bricks[index];
        ctx.fillStyle = state === "corrupted" ? COLORS.red : state === "healing" ? COLORS.yellow : COLORS.green;
        const bx = x + pad + col * (brickW + pad);
        const by = y + pad + row * (brickH + pad);
        ctx.fillRect(bx, by, brickW, brickH);
      }
    }
  }

  drawGhostNodes() {
    const ctx = this.ctx;
    const now = performance.now();
    this.state.ghostNodes = this.state.ghostNodes.filter((node) => now - node.born < node.duration);
    this.state.ghostNodes.forEach((node) => {
      const t = (now - node.born) / node.duration;
      const x = this.canvas.clientWidth * (node.x + node.vx * (now - node.born));
      const y = this.canvas.clientHeight * (node.y + node.vy * (now - node.born));
      const alpha = Math.max(0, 0.7 - t * 0.7);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, 12 + t * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.canvas.clientWidth * 0.5, this.canvas.clientHeight * 0.5);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
  }

  drawScanWave() {
    if (!this.state.scanWave) return;
    const ctx = this.ctx;
    const now = performance.now();
    const progress = (now - this.state.scanWave.start) / this.state.scanWave.duration;
    if (progress >= 1) {
      this.state.scanWave = null;
      return;
    }
    const x = 115 + progress * (this.canvas.clientWidth - 190);
    ctx.fillStyle = "rgba(0,255,255,0.2)";
    ctx.fillRect(x, 260, 30, this.canvas.clientHeight - 300);
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 260);
    ctx.lineTo(x, this.canvas.clientHeight - 40);
    ctx.stroke();
  }
}
