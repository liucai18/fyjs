export interface DebugMetrics {
  fps: number;
  onePercentLowFps: number;
  isWarmingUp: boolean;
  rawFrameTimeMs: number;
  gameDeltaMs: number;
  width: number;
  height: number;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
}

export class DebugOverlay {
  private container: HTMLElement;
  private isDisposed: boolean = false;

  // DOM 节点引用缓存
  private fpsEl!: HTMLElement;
  private lowFpsEl!: HTMLElement;
  private rawFtEl!: HTMLElement;
  private gameDtEl!: HTMLElement;
  private resEl!: HTMLElement;
  private dprEl!: HTMLElement;
  private dcEl!: HTMLElement;
  private triEl!: HTMLElement;

  // 阶段 1.2 建议优化：DOM 更新节流器（150ms），大幅减轻 UI 重绘与样式重排
  private lastDomUpdateTime: number = 0;
  private readonly throttleIntervalMs: number = 150;

  constructor(containerId: string = 'debug-overlay') {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`DebugOverlay container #${containerId} not found`);
    }
    this.container = el;
    this.initStructure();
    this.cacheDomReferences();
  }

  private initStructure(): void {
    this.container.innerHTML = `
      <div class="title">
        <span>⚡ 飞跃极速 · 引擎调试台</span>
        <span id="dbg-status" style="color: #4ade80; font-size: 11px;">RUNNING (v1.2)</span>
      </div>
      <div class="item">
        <span class="label">平均帧率 (FPS):</span>
        <span class="val highlight" id="dbg-fps">--</span>
      </div>
      <div class="item">
        <span class="label">1% Low FPS:</span>
        <span class="val" id="dbg-low-fps" style="color: #facc15;">--</span>
      </div>
      <div class="item">
        <span class="label">真实物理耗时:</span>
        <span class="val" id="dbg-raw-frametime">-- ms</span>
      </div>
      <div class="item">
        <span class="label">游戏更新增量:</span>
        <span class="val" id="dbg-game-delta">-- ms</span>
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
        <span class="label">生命周期状态:</span>
        <span class="val" style="color: #38bdf8;">阶段 1.2 最终版</span>
      </div>
    `;
  }

  private cacheDomReferences(): void {
    this.fpsEl = this.container.querySelector('#dbg-fps') as HTMLElement;
    this.lowFpsEl = this.container.querySelector('#dbg-low-fps') as HTMLElement;
    this.rawFtEl = this.container.querySelector('#dbg-raw-frametime') as HTMLElement;
    this.gameDtEl = this.container.querySelector('#dbg-game-delta') as HTMLElement;
    this.resEl = this.container.querySelector('#dbg-resolution') as HTMLElement;
    this.dprEl = this.container.querySelector('#dbg-dpr') as HTMLElement;
    this.dcEl = this.container.querySelector('#dbg-drawcalls') as HTMLElement;
    this.triEl = this.container.querySelector('#dbg-triangles') as HTMLElement;
  }

  public update(metrics: DebugMetrics, force: boolean = false): void {
    if (this.isDisposed) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - this.lastDomUpdateTime < this.throttleIntervalMs) {
      return;
    }
    this.lastDomUpdateTime = now;

    if (this.fpsEl) this.fpsEl.textContent = `${metrics.fps}`;
    if (this.lowFpsEl) {
      this.lowFpsEl.textContent = metrics.isWarmingUp ? `${metrics.onePercentLowFps} (预热)` : `${metrics.onePercentLowFps}`;
    }
    if (this.rawFtEl) this.rawFtEl.textContent = `${metrics.rawFrameTimeMs.toFixed(2)} ms`;
    if (this.gameDtEl) this.gameDtEl.textContent = `${metrics.gameDeltaMs.toFixed(2)} ms`;
    if (this.resEl) this.resEl.textContent = `${metrics.width} × ${metrics.height}`;
    if (this.dprEl) this.dprEl.textContent = `${metrics.pixelRatio.toFixed(2)}`;
    if (this.dcEl) this.dcEl.textContent = `${metrics.drawCalls}`;
    if (this.triEl) this.triEl.textContent = `${metrics.triangles}`;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.container.innerHTML = '';
  }
}
