export interface DebugMetrics {
  fps: number;
  frameTimeMs: number;
  width: number;
  height: number;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
}

export class DebugOverlay {
  private container: HTMLElement;

  constructor(containerId: string = 'debug-overlay') {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`DebugOverlay container #${containerId} not found`);
    }
    this.container = el;
    this.initStructure();
  }

  private initStructure(): void {
    this.container.innerHTML = `
      <div class="title">
        <span>⚡ 飞跃极速 · 引擎调试台</span>
        <span id="dbg-status" style="color: #4ade80; font-size: 11px;">RUNNING</span>
      </div>
      <div class="item">
        <span class="label">帧率 (FPS):</span>
        <span class="val highlight" id="dbg-fps">--</span>
      </div>
      <div class="item">
        <span class="label">单帧耗时:</span>
        <span class="val" id="dbg-frametime">-- ms</span>
      </div>
      <div class="item">
        <span class="label">视口分辨率:</span>
        <span class="val" id="dbg-resolution">--</span>
      </div>
      <div class="item">
        <span class="label">像素比 (DPR):</span>
        <span class="val" id="dbg-dpr">--</span>
      </div>
      <div class="item">
        <span class="label">Draw Calls:</span>
        <span class="val" id="dbg-drawcalls">--</span>
      </div>
      <div class="item">
        <span class="label">三角面数:</span>
        <span class="val" id="dbg-triangles">--</span>
      </div>
      <div class="item">
        <span class="label">引擎状态:</span>
        <span class="val" style="color: #38bdf8;">阶段 1 (Phase 1)</span>
      </div>
    `;
  }

  public update(metrics: DebugMetrics): void {
    const fpsEl = document.getElementById('dbg-fps');
    const ftEl = document.getElementById('dbg-frametime');
    const resEl = document.getElementById('dbg-resolution');
    const dprEl = document.getElementById('dbg-dpr');
    const dcEl = document.getElementById('dbg-drawcalls');
    const triEl = document.getElementById('dbg-triangles');

    if (fpsEl) fpsEl.textContent = `${metrics.fps}`;
    if (ftEl) ftEl.textContent = `${metrics.frameTimeMs.toFixed(2)} ms`;
    if (resEl) resEl.textContent = `${metrics.width} × ${metrics.height}`;
    if (dprEl) dprEl.textContent = `${metrics.pixelRatio.toFixed(2)}`;
    if (dcEl) dcEl.textContent = `${metrics.drawCalls}`;
    if (triEl) triEl.textContent = `${metrics.triangles}`;
  }
}
