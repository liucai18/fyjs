export type UpdateCallback = (deltaTime: number, elapsedTime: number, rawDeltaTime: number) => void;

export class Time {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isDisposed: boolean = false;
  private lastTime: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private rawDeltaTime: number = 0;
  private maxDeltaTime: number = 0.1; // 防卡顿爆发上限 (100ms)
  private animationFrameId: number = 0;
  private updateCallbacks: Set<UpdateCallback> = new Set();

  // 阶段 1.2 升级：1000 帧大容量历史窗口 + 预热判定状态
  public currentFps: number = 60;
  public onePercentLowFps: number = 60;
  public rawFrameTimeMs: number = 16.6;
  public avgFrameTimeMs: number = 16.6;
  public isWarmingUp: boolean = true;

  public readonly sampleBufferSize: number = 1000;
  public readonly warmupMinSamples: number = 60;
  private frameIntervalHistory: number[] = [];

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
  }

  public resume(): void {
    if (!this.isPaused) return;
    // 切回前台重置时基，并清空历史缓冲区，避免后台节流异常数据污染前台性能统计
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.frameIntervalHistory = [];
    this.isWarmingUp = true;
    this.isPaused = false;
  }

  public onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public start(): void {
    if (this.isRunning || this.isDisposed) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.frameIntervalHistory = [];
    this.isWarmingUp = true;

    const loop = (currentTime: number) => {
      if (!this.isRunning || this.isDisposed) return;

      this.animationFrameId = typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame(loop)
        : (setTimeout(() => loop(Date.now()), 16) as unknown as number);

      if (this.isPaused) {
        this.lastTime = currentTime;
        return;
      }

      // 1. 真实物理帧时间差
      const rawDelta = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // 忽略首帧或负向时钟倒退
      if (rawDelta <= 0) return;

      this.rawDeltaTime = rawDelta;
      this.rawFrameTimeMs = rawDelta * 1000;

      // 2. 游戏更新安全时间增量（严格 Clamp 防跳跃）
      this.deltaTime = Math.min(this.rawDeltaTime, this.maxDeltaTime);
      this.elapsedTime += this.deltaTime;

      // 3. 统计帧数据并放入 1000 帧滑动窗口
      this.recordFrameSample(this.rawFrameTimeMs);

      // 4. 分发帧更新（包含异常隔离防御）
      for (const callback of this.updateCallbacks) {
        try {
          callback(this.deltaTime, this.elapsedTime, this.rawDeltaTime);
        } catch (error) {
          console.error('❌ Time loop update callback error:', error);
        }
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(loop);
    } else {
      this.animationFrameId = setTimeout(() => loop(Date.now()), 16) as unknown as number;
    }
  }

  /**
   * 记录帧样本并根据 1000 帧滑动窗口重新计算平均 FPS 与 1% Low FPS
   */
  public recordFrameSample(frameTimeMs: number): void {
    this.frameIntervalHistory.push(frameTimeMs);
    if (this.frameIntervalHistory.length > this.sampleBufferSize) {
      this.frameIntervalHistory.shift();
    }

    const len = this.frameIntervalHistory.length;
    this.isWarmingUp = len < this.warmupMinSamples;

    // 平均帧耗时与平均 FPS
    const sum = this.frameIntervalHistory.reduce((a, b) => a + b, 0);
    this.avgFrameTimeMs = sum / len;
    this.currentFps = Math.max(1, Math.round(1000 / this.avgFrameTimeMs));

    // 1% Low FPS 严格口径计算：
    // 按帧耗时降序排列（耗时最长即瞬时帧率最低的 1% 样本）
    if (!this.isWarmingUp) {
      const sorted = [...this.frameIntervalHistory].sort((a, b) => b - a);
      const lowCount = Math.max(1, Math.floor(len * 0.01));
      const worstSum = sorted.slice(0, lowCount).reduce((a, b) => a + b, 0);
      const avgWorstMs = worstSum / lowCount;
      this.onePercentLowFps = Math.max(1, Math.round(1000 / avgWorstMs));
    } else {
      // 预热阶段先参考当前平均 FPS
      this.onePercentLowFps = this.currentFps;
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
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

  public getSampleCount(): number {
    return this.frameIntervalHistory.length;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 阶段 1.2 幂等安全释放
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.stop();
    this.updateCallbacks.clear();
    this.frameIntervalHistory = [];

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
}
