export type UpdateCallback = (deltaTime: number, elapsedTime: number, rawDeltaTime: number) => void;

export class Time {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private rawDeltaTime: number = 0;
  private maxDeltaTime: number = 0.1; // 防止失焦或卡顿后物理爆发性突增 (100ms)
  private animationFrameId: number = 0;
  private updateCallbacks: Set<UpdateCallback> = new Set();

  // 性能统计与 1% Low FPS 滑动窗口
  public currentFps: number = 60;
  public onePercentLowFps: number = 60;
  public rawFrameTimeMs: number = 16.6;
  public avgFrameTimeMs: number = 16.6;

  private readonly sampleBufferSize: number = 120;
  private frameIntervalHistory: number[] = [];

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      // 页面失焦或切换到后台时临时暂停
      this.isPaused = true;
    } else {
      // 页面切回前台时重置基准时间，并清空历史缓冲区，避免后台节流污染前台真实性能数据
      this.lastTime = performance.now();
      this.frameIntervalHistory = [];
      this.isPaused = false;
    }
  }

  public onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.frameIntervalHistory = [];

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      this.animationFrameId = requestAnimationFrame(loop);

      if (this.isPaused) {
        this.lastTime = currentTime;
        return;
      }

      // 1. 真实物理帧时间差（秒与毫秒）
      const rawDelta = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // 忽略首帧或极端非正时间戳
      if (rawDelta <= 0) return;

      this.rawDeltaTime = rawDelta;
      this.rawFrameTimeMs = rawDelta * 1000;

      // 2. 游戏更新用保护时间增量（Clamp）
      this.deltaTime = Math.min(this.rawDeltaTime, this.maxDeltaTime);
      this.elapsedTime += this.deltaTime;

      // 3. 实时滑动窗口性能统计（保留最近 120 帧）
      this.frameIntervalHistory.push(this.rawFrameTimeMs);
      if (this.frameIntervalHistory.length > this.sampleBufferSize) {
        this.frameIntervalHistory.shift();
      }

      this.calculatePerformanceMetrics();

      // 4. 分发帧更新（包含异常隔离防御，防止单个逻辑崩溃导致渲染主循环彻底死锁）
      for (const callback of this.updateCallbacks) {
        try {
          callback(this.deltaTime, this.elapsedTime, this.rawDeltaTime);
        } catch (error) {
          console.error('❌ Time loop update callback error:', error);
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private calculatePerformanceMetrics(): void {
    const len = this.frameIntervalHistory.length;
    if (len === 0) return;

    // 平均帧耗时与平均 FPS
    const sum = this.frameIntervalHistory.reduce((a, b) => a + b, 0);
    this.avgFrameTimeMs = sum / len;
    this.currentFps = Math.round(1000 / this.avgFrameTimeMs);

    // 1% Low FPS：按耗时降序排列（耗时最长即瞬时帧率最低的 1% 样本）
    if (len >= 30) {
      const sorted = [...this.frameIntervalHistory].sort((a, b) => b - a);
      const lowCount = Math.max(1, Math.floor(len * 0.01));
      const worstSum = sorted.slice(0, lowCount).reduce((a, b) => a + b, 0);
      const avgWorstMs = worstSum / lowCount;
      this.onePercentLowFps = Math.max(1, Math.round(1000 / avgWorstMs));
    } else {
      this.onePercentLowFps = this.currentFps;
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  public getDeltaTime(): number {
    return this.deltaTime;
  }

  public getRawDeltaTime(): number {
    return this.rawDeltaTime;
  }

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  public dispose(): void {
    this.stop();
    this.updateCallbacks.clear();
    this.frameIntervalHistory = [];
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
