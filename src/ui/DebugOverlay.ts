export interface DebugMetrics {
  fps: number;
  onePercentLowFps: number;
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

  // 阶段 1.1 优化：构造阶段一次性缓存 DOM 节点引用，消除每一帧多次 getElementById 查询开销
  private fpsEl!: HTMLElement;
  private lowFpsEl!: HTMLElement;
  private rawFtEl!: HTMLElement;
  private gameDtEl!: HTMLElement;
  private resEl!: HTMLElement;
  private dprEl!: HTMLElement;
  private dcEl!: HTMLElement;
  private triEl!: HTMLElement;

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
        <span id="dbg-status" style="color: #4ade80; font-size: 11px;">RUNNING (v1.1)</span>
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
        <span class="val" style="color: #38bdf8;">阶段 1.1 完善</span>
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

  public update(metrics: DebugMetrics): void {
    if (this.fpsEl) this.fpsEl.textContent = `${metrics.fps}`;
    if (this.lowFpsEl) this.lowFpsEl.textContent = `${metrics.onePercentLowFps}`;
    if (this.rawFtEl) this.rawFtEl.textContent = `${metrics.rawFrameTimeMs.toFixed(2)} ms`;
    if (this.gameDtEl) this.gameDtEl.textContent = `${metrics.gameDeltaMs.toFixed(2)} ms`;
    if (this.resEl) this.resEl.textContent = `${metrics.width} × ${metrics.height}`;
    if (this.dprEl) this.dprEl.textContent = `${metrics.pixelRatio.toFixed(2)}`;
    if (this.dcEl) this.dcEl.textContent = `${metrics.drawCalls}`;
    if (this.triEl) this.triEl.textContent = `${metrics.triangles}`;
  }

  public dispose(): void {
    this.container.innerHTML = '';
  }
}
