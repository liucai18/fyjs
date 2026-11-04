import { RaceManager, RaceState } from '../race/RaceManager';
import { NitroSystem } from '../vehicle/NitroSystem';

/**
 * 飞跃极速 · 竞速核心 UI 交互与结算面板 (RaceHUD.ts)
 * 严格落实师父【阶段 3.2 氮气加速系统】：
 * 1. 3-2-1-GO 超大科幻霓虹动态倒计时横幅
 * 2. 实时毫秒级单圈用时 HUD (MM:SS.mmm)
 * 3. 赛道分段检查点进度指示 (Checkpoints: X/3)
 * 4. 底部中央独立赛博霓虹氮气加速能量槽 (Nitro Boost Gauge)
 * 5. 暂停遮罩指示 (PAUSED)
 * 6. 完赛结算面板 (Final Results Modal)，展示成绩与极速，提示按 R 键重试
 * 7. 100% 幂等安全销毁 (dispose)，杜绝 DOM 孤儿节点与内存泄漏
 */
export class RaceHUD {
  private readonly container: HTMLElement;
  private countdownEl: HTMLElement | null = null;
  private timerEl: HTMLElement | null = null;
  private checkpointEl: HTMLElement | null = null;
  private pauseModalEl: HTMLElement | null = null;
  private resultModalEl: HTMLElement | null = null;

  // 阶段 3.2 氮气加速 HUD DOM 元素
  private nitroContainerEl: HTMLElement | null = null;
  private nitroLabelEl: HTMLElement | null = null;
  private nitroValEl: HTMLElement | null = null;
  private nitroFillEl: HTMLElement | null = null;

  private lastTimeStr: string = '';
  private lastCountdownText: string = '';
  private isDisposed: boolean = false;

  constructor(containerId: string = 'race-hud') {
    let existing = document.getElementById(containerId);
    if (!existing) {
      existing = document.createElement('div');
      existing.id = containerId;
      document.body.appendChild(existing);
    }
    this.container = existing;
    this.setupDOM();
  }

  private setupDOM(): void {
    this.container.innerHTML = `
      <style>
        #race-hud {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          user-select: none;
          z-index: 100;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        }

        /* 顶部中央比赛用时与检查点信息栏 */
        .race-top-bar {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(6, 10, 20, 0.75);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 240, 255, 0.35);
          border-radius: 8px;
          padding: 8px 24px;
          box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
        }

        .race-timer-display {
          font-size: 26px;
          font-weight: 800;
          color: #00f0ff;
          letter-spacing: 2px;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
        }

        .race-checkpoint-badge {
          font-size: 14px;
          font-weight: 700;
          color: #ff3b00;
          letter-spacing: 1px;
          border-left: 1px solid rgba(255, 255, 255, 0.15);
          padding-left: 16px;
          text-shadow: 0 0 8px rgba(255, 59, 0, 0.5);
        }

        /* 居中大号倒计时 */
        .race-countdown-banner {
          position: absolute;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 110px;
          font-weight: 900;
          letter-spacing: 4px;
          color: #00f0ff;
          text-shadow: 0 0 40px rgba(0, 240, 255, 0.8), 0 0 80px rgba(0, 240, 255, 0.4);
          transition: transform 0.08s ease-out, opacity 0.08s ease-out;
          display: none;
        }

        .race-countdown-go {
          color: #39ff14;
          text-shadow: 0 0 40px rgba(57, 255, 20, 0.9), 0 0 80px rgba(57, 255, 20, 0.5);
        }

        /* 暂停弹窗 */
        .race-pause-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(5, 8, 16, 0.65);
          backdrop-filter: blur(8px);
          display: none;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }

        .race-pause-title {
          font-size: 42px;
          font-weight: 900;
          color: #fff;
          letter-spacing: 4px;
          margin-bottom: 12px;
          text-shadow: 0 0 20px rgba(0, 240, 255, 0.8);
        }

        .race-pause-hint {
          font-size: 18px;
          color: #94a3b8;
          letter-spacing: 1px;
        }

        /* 完赛结算弹窗 */
        .race-result-modal {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(10, 16, 30, 0.92);
          backdrop-filter: blur(16px);
          border: 2px solid #00f0ff;
          border-radius: 14px;
          padding: 32px 48px;
          box-shadow: 0 0 40px rgba(0, 240, 255, 0.4);
          display: none;
          flex-direction: column;
          align-items: center;
          min-width: 380px;
        }

        .race-result-title {
          font-size: 32px;
          font-weight: 900;
          color: #39ff14;
          letter-spacing: 3px;
          margin-bottom: 24px;
          text-shadow: 0 0 20px rgba(57, 255, 20, 0.6);
        }

        .race-result-stat {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin: 8px 0;
          font-size: 18px;
          color: #cbd5e1;
        }

        .race-result-value {
          font-weight: 800;
          color: #00f0ff;
          letter-spacing: 1px;
        }

        .race-result-retry-btn {
          margin-top: 28px;
          background: linear-gradient(135deg, #ff3b00, #ff7700);
          color: #fff;
          border: none;
          padding: 12px 32px;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 2px;
          border-radius: 6px;
          box-shadow: 0 0 20px rgba(255, 59, 0, 0.5);
          cursor: pointer;
        }

        /* 底部中央赛博霓虹氮气加速能量槽 */
        .race-nitro-container {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          background: rgba(6, 10, 20, 0.78);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 240, 255, 0.35);
          border-radius: 8px;
          padding: 8px 16px 10px 16px;
          box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .race-nitro-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .race-nitro-label {
          font-size: 13px;
          font-weight: 800;
          color: #00f0ff;
          letter-spacing: 1.5px;
          text-shadow: 0 0 8px rgba(0, 240, 255, 0.6);
          transition: color 0.15s ease;
        }

        .race-nitro-val {
          font-size: 14px;
          font-weight: 800;
          color: #fff;
          font-variant-numeric: tabular-nums;
          letter-spacing: 1px;
        }

        .race-nitro-bar-track {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }

        .race-nitro-bar-fill {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #00c6ff, #0072ff);
          border-radius: 5px;
          box-shadow: 0 0 10px rgba(0, 198, 255, 0.6);
          transition: width 0.05s linear, background 0.15s ease, box-shadow 0.15s ease;
        }

        /* 喷射激活状态 (Active) */
        .race-nitro-active {
          border-color: #ff5500 !important;
          box-shadow: 0 0 30px rgba(255, 85, 0, 0.6) !important;
        }

        .race-nitro-active .race-nitro-label {
          color: #ff5500 !important;
          text-shadow: 0 0 12px rgba(255, 85, 0, 0.9) !important;
        }

        .race-nitro-active .race-nitro-bar-fill {
          background: linear-gradient(90deg, #ff9900, #ff3b00) !important;
          box-shadow: 0 0 15px rgba(255, 59, 0, 0.9) !important;
        }

        /* 能量耗尽空槽警告 (Empty) */
        .race-nitro-empty {
          border-color: #ff0044 !important;
        }

        .race-nitro-empty .race-nitro-label {
          color: #ff0044 !important;
        }

        .race-nitro-empty .race-nitro-val {
          color: #ff0044 !important;
        }
      </style>

      <div class="race-top-bar">
        <div class="race-timer-display" id="race-timer">00:00.000</div>
        <div class="race-checkpoint-badge" id="race-checkpoints">🚩 检查点: 0 / 3</div>
      </div>

      <div class="race-countdown-banner" id="race-countdown">3</div>

      <!-- 底部中央赛博霓虹氮气加速能量槽 -->
      <div class="race-nitro-container" id="race-nitro-container">
        <div class="race-nitro-header">
          <div class="race-nitro-label" id="race-nitro-label">⚡ NITRO READY [SHIFT]</div>
          <div class="race-nitro-val" id="race-nitro-val">100%</div>
        </div>
        <div class="race-nitro-bar-track">
          <div class="race-nitro-bar-fill" id="race-nitro-fill"></div>
        </div>
      </div>

      <div class="race-pause-overlay" id="race-pause-overlay">
        <div class="race-pause-title">⏸️ 比赛暂停</div>
        <div class="race-pause-hint">按 [P] 或 [Esc] 继续极速飞驰</div>
      </div>

      <div class="race-result-modal" id="race-result-modal">
        <div class="race-result-title">🏁 冲线完赛！</div>
        <div class="race-result-stat">
          <span>单圈用时 (Lap Time):</span>
          <span class="race-result-value" id="race-final-time">00:00.000</span>
        </div>
        <div class="race-result-stat">
          <span>本局最高航速:</span>
          <span class="race-result-value" id="race-final-speed">0 km/h</span>
        </div>
        <div class="race-result-stat">
          <span>完成度:</span>
          <span class="race-result-value" style="color: #39ff14;">100% (3/3 CP)</span>
        </div>
        <div class="race-result-retry-btn" id="race-retry-btn">按 [R] 键重新起跑</div>
      </div>
    `;

    this.timerEl = document.getElementById('race-timer');
    this.checkpointEl = document.getElementById('race-checkpoints');
    this.countdownEl = document.getElementById('race-countdown');
    this.pauseModalEl = document.getElementById('race-pause-overlay');
    this.resultModalEl = document.getElementById('race-result-modal');

    this.nitroContainerEl = document.getElementById('race-nitro-container');
    this.nitroLabelEl = document.getElementById('race-nitro-label');
    this.nitroValEl = document.getElementById('race-nitro-val');
    this.nitroFillEl = document.getElementById('race-nitro-fill');
  }

  /**
   * 逐帧刷新比赛 HUD 与氮气状态
   */
  public update(manager: RaceManager, nitro?: NitroSystem): void {
    if (this.isDisposed) return;

    const state = manager.getState();

    // 1. 更新顶部计时器
    const timeStr = RaceManager.formatTime(manager.getRaceTime());
    if (this.timerEl && timeStr !== this.lastTimeStr) {
      this.timerEl.innerText = `⏱️ ${timeStr}`;
      this.lastTimeStr = timeStr;
    }

    // 2. 更新检查点显示
    if (this.checkpointEl) {
      const passed = manager.getPassedCheckpointsCount();
      const total = manager.getTotalCheckpointsCount();
      this.checkpointEl.innerText = `🚩 检查点: ${passed} / ${total}`;
      this.checkpointEl.style.color = passed === total ? '#39ff14' : '#00f0ff';
    }

    // 3. 倒计时与发车 GO! 动画
    if (this.countdownEl) {
      const { text, progress } = manager.getCountdownDisplay();
      if (text) {
        if (text !== this.lastCountdownText) {
          this.countdownEl.innerText = text;
          this.lastCountdownText = text;
          if (text === 'GO!') {
            this.countdownEl.classList.add('race-countdown-go');
          } else {
            this.countdownEl.classList.remove('race-countdown-go');
          }
        }
        this.countdownEl.style.display = 'block';
        // 动态呼吸跳动缩放效果
        const scale = 1.0 + progress * 0.35;
        this.countdownEl.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
        this.countdownEl.style.opacity = '1.0';
      } else {
        this.countdownEl.style.display = 'none';
        this.lastCountdownText = '';
      }
    }

    // 4. 暂停状态遮罩
    if (this.pauseModalEl) {
      this.pauseModalEl.style.display = state === RaceState.PAUSED ? 'flex' : 'none';
    }

    // 5. 完赛结算弹窗
    if (this.resultModalEl) {
      if (state === RaceState.FINISHED) {
        this.resultModalEl.style.display = 'flex';
        const finalTimeEl = document.getElementById('race-final-time');
        const finalSpeedEl = document.getElementById('race-final-speed');
        if (finalTimeEl) finalTimeEl.innerText = timeStr;
        if (finalSpeedEl) finalSpeedEl.innerText = `${Math.round(manager.getTopSpeedKmh())} km/h`;
      } else {
        this.resultModalEl.style.display = 'none';
      }
    }

    // 6. 阶段 3.2 氮气加速能量条与状态更新
    if (nitro && this.nitroFillEl && this.nitroValEl && this.nitroContainerEl && this.nitroLabelEl) {
      const pct = nitro.getEnergyPercent();
      const isBoosting = nitro.isBoosting();

      this.nitroFillEl.style.width = `${pct}%`;
      this.nitroValEl.innerText = `${pct}%`;

      if (isBoosting) {
        this.nitroContainerEl.classList.add('race-nitro-active');
        this.nitroContainerEl.classList.remove('race-nitro-empty');
        this.nitroLabelEl.innerText = '🔥 NITRO ACTIVE!';
      } else if (pct <= 0) {
        this.nitroContainerEl.classList.remove('race-nitro-active');
        this.nitroContainerEl.classList.add('race-nitro-empty');
        this.nitroLabelEl.innerText = '⚠️ NITRO DEPLETED';
      } else {
        this.nitroContainerEl.classList.remove('race-nitro-active');
        this.nitroContainerEl.classList.remove('race-nitro-empty');
        if (pct < 100) {
          this.nitroLabelEl.innerText = '⚡ RECHARGING... [SHIFT]';
        } else {
          this.nitroLabelEl.innerText = '⚡ NITRO READY [SHIFT]';
        }
      }
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
