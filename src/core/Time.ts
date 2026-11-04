export type UpdateCallback = (deltaTime: number, elapsedTime: number) => void;

export class Time {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private maxDeltaTime: number = 0.1; // 防止失焦或卡顿后时间爆发性突增
  private animationFrameId: number = 0;
  private updateCallbacks: Set<UpdateCallback> = new Set();

  // 性能统计
  public currentFps: number = 60;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      // 页面失焦或切换到后台时临时暂停计时器
      this.isPaused = true;
    } else {
      // 页面切回前台时重置基准时间，避免 delta 巨大
      this.lastTime = performance.now();
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
    this.fpsUpdateTime = this.lastTime;
    this.frameCount = 0;

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      this.animationFrameId = requestAnimationFrame(loop);

      if (this.isPaused) {
        this.lastTime = currentTime;
        return;
      }

      // 计算毫秒差并换算为秒
      const rawDelta = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // 关键防御：限制单帧最大 delta time，彻底防止失焦唤醒导致物理/动画瞬移穿墙
      this.deltaTime = Math.min(Math.max(rawDelta, 0), this.maxDeltaTime);
      this.elapsedTime += this.deltaTime;

      // FPS 平滑统计
      this.frameCount++;
      if (currentTime - this.fpsUpdateTime >= 500) {
        this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsUpdateTime));
        this.frameCount = 0;
        this.fpsUpdateTime = currentTime;
      }

      // 分发帧更新
      for (const callback of this.updateCallbacks) {
        callback(this.deltaTime, this.elapsedTime);
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
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

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  public dispose(): void {
    this.stop();
    this.updateCallbacks.clear();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
