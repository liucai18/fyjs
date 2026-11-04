/**
 * 氮气加速系统配置接口
 * 严格按照师父要求：参数集中配置，禁止散落硬编码
 */
export interface NitroConfig {
  maxEnergy: number;          // 最大能量 (默认 100%)
  consumptionRate: number;    // 消耗速率 (%/秒，默认 25%/s，即满槽持续 4.0s)
  rechargeRate: number;       // 恢复速率 (%/秒，默认 10%/s，即 10s 充满)
  thrustMultiplier: number;   // 氮气推力倍率 (默认 1.85x)
  boostTopSpeedKmh: number;   // 氮气极速上限 (km/h，默认 270 km/h，基础极速为 216 km/h)
}

export const DEFAULT_NITRO_CONFIG: Readonly<NitroConfig> = Object.freeze({
  maxEnergy: 100,
  consumptionRate: 25,
  rechargeRate: 10,
  thrustMultiplier: 1.85,
  boostTopSpeedKmh: 270
});

/**
 * 飞跃极速 · 氮气加速系统核心模块 (NitroSystem.ts)
 * 严格落实师父【阶段 3.2 氮气加速系统开发令】：
 * 1. 能量管理：100% 满槽、持续消耗、自动缓慢恢复、0% 强行断气、100% 封顶禁止溢出
 * 2. 状态门禁：未发车 (READY)、3-2-1 倒计时、暂停 (PAUSED)、冲线完赛 (FINISHED) 绝对禁止消耗能量
 * 3. 冻结机制：暂停与完赛期间冻结能量变化，既不消耗也不恢复
 * 4. 一键复位：重试 (reset) 瞬间无缝恢复至 100% 初始能量
 * 5. 纯净架构：独立封装，完全与 UI 解耦，仅暴露数学能量与激活状态
 */
export class NitroSystem {
  public readonly config: Readonly<NitroConfig>;
  private energy: number;
  private active: boolean = false;
  private isDisposed: boolean = false;

  constructor(customConfig: Partial<NitroConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_NITRO_CONFIG,
      ...customConfig
    });
    this.energy = this.config.maxEnergy;
  }

  /**
   * 获取当前能量绝对数值 (0 ~ maxEnergy)
   */
  public getEnergy(): number {
    return this.energy;
  }

  /**
   * 获取当前能量归一化百分比 (0.0 ~ 1.0)
   */
  public getEnergyRatio(): number {
    return Math.max(0, Math.min(1, this.energy / this.config.maxEnergy));
  }

  /**
   * 获取当前能量百分数 (0 ~ 100)
   */
  public getEnergyPercent(): number {
    return Math.round(this.getEnergyRatio() * 100);
  }

  /**
   * 当前是否正在喷射氮气加速
   */
  public isBoosting(): boolean {
    return this.active;
  }

  /**
   * 重置氮气能量回到 100% 初始状态
   */
  public reset(): void {
    if (this.isDisposed) return;
    this.energy = this.config.maxEnergy;
    this.active = false;
  }

  /**
   * 核心逐帧更新
   * @param deltaTime 真实帧间隔时间 (秒)
   * @param wantsToBoost 玩家当前是否按住了 Shift 氮气加速键
   * @param canBoost 比赛当前是否允许驾驶 (仅 RACING 或 GO 发车阶段为 true；READY, COUNTDOWN, PAUSED, FINISHED 为 false)
   * @param isFrozen 比赛当前是否处于冻结状态 (PAUSED 或 FINISHED 为 true，此时能量数值绝对锁定，不增不减)
   */
  public update(
    deltaTime: number,
    wantsToBoost: boolean,
    canBoost: boolean,
    isFrozen: boolean = false
  ): void {
    if (this.isDisposed) return;

    // 1. 冻结状态：暂停与完赛期间绝对锁定能量数值，既不消耗也不恢复
    if (isFrozen) {
      this.active = false;
      return;
    }

    // 2. 状态机门禁：若当前比赛阶段不允许驾驶（如倒计时中），强制停止氮气，并不消耗能量
    if (!canBoost) {
      this.active = false;
      // 倒计时阶段保持满能量
      return;
    }

    // 3. 正常竞速中的氮气激活与消耗判定
    if (wantsToBoost && this.energy > 0) {
      this.active = true;
      this.energy -= this.config.consumptionRate * deltaTime;

      // 能量耗尽：强制断气切断加速
      if (this.energy <= 0) {
        this.energy = 0;
        this.active = false;
      }
    } else {
      // 4. 未激活氮气：平滑自动充能恢复
      this.active = false;
      if (this.energy < this.config.maxEnergy) {
        this.energy += this.config.rechargeRate * deltaTime;
        if (this.energy > this.config.maxEnergy) {
          this.energy = this.config.maxEnergy;
        }
      }
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.active = false;
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
