import * as THREE from 'three';
import { VehicleController } from '../vehicle/VehicleController';

/**
 * 比赛核心状态枚举
 */
export enum RaceState {
  READY = 'READY',
  COUNTDOWN = 'COUNTDOWN',
  RACING = 'RACING',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
  FAILED = 'FAILED'
}

export interface RaceManagerOptions {
  countdownDuration?: number; // 倒计时总时长 (秒)，默认 3.0s
  startPosition?: THREE.Vector3;
  startYaw?: number;
}

export interface Checkpoint {
  id: number;
  name: string;
  x: number;
  z: number;
  radius: number;
}

/**
 * 飞跃极速 · 核心竞速流程与状态机管理 (RaceManager.ts)
 * 严格落实师父【阶段 3.1 开发任务书：核心竞速闭环】：
 * 1. 完整状态机流转 (READY -> COUNTDOWN -> RACING -> PAUSED -> FINISHED)
 * 2. 3-2-1-GO 倒计时系统，倒计时阶段物理锁死油门，严禁偷跑抢跑
 * 3. 工业级前后帧扫掠连续跨线检测 (Continuous Swept-Segment Crossing)，杜绝高速穿透漏检
 * 4. 三道核心分段检查点门禁机制 (Checkpoint Gating)，杜绝倒车冲线、原地反复穿线作弊
 * 5. 高精度毫秒级单调时钟计时，暂停精确冻结，恢复不跳秒
 * 6. 一键重试干净重置赛车位置、朝向、动力、时间与状态
 */
export class RaceManager {
  private state: RaceState = RaceState.READY;
  private previousState: RaceState = RaceState.READY; // 用于暂停恢复

  // 计时核心
  private raceTime: number = 0; // 真实比赛用时 (秒)
  private countdownTimer: number = 3.0; // 倒计时剩余秒数 (正数: 3/2/1, 负数: GO 展示窗口)
  private readonly countdownTotal: number = 3.0;
  public readonly goDisplayDuration: number = 0.5; // GO! 显式展示时长 (秒)
  private topSpeedKmh: number = 0; // 本局极速记录

  // 起跑位置参数 (东直道起跑线后方 25m)
  public readonly startPosition: THREE.Vector3;
  public readonly startYaw: number;

  // 终点检测线段参数 (东直道起点龙门架处：z = 0, x in [55, 75])
  public readonly finishLineZ: number = 0;
  public readonly finishLineMinX: number = 55;
  public readonly finishLineMaxX: number = 75;

  // 前一帧车辆坐标 (用于前后两帧跨线扫掠求交)
  private prevVehiclePos: THREE.Vector3 = new THREE.Vector3();
  private hasPrevPos: boolean = false;

  // 赛道隐形顺序检查点 (北弯顶、西直道中、南弯顶)
  public readonly checkpoints: Checkpoint[] = [
    { id: 1, name: 'North Curve Apex', x: 0, z: 175, radius: 25 },
    { id: 2, name: 'West Straight Mid', x: -65, z: 0, radius: 25 },
    { id: 3, name: 'South Curve Apex', x: 0, z: -175, radius: 25 }
  ];
  private passedCheckpoints: Set<number> = new Set<number>();

  private isDisposed: boolean = false;

  constructor(options: RaceManagerOptions = {}) {
    this.countdownTotal = options.countdownDuration ?? 3.0;
    this.countdownTimer = this.countdownTotal;
    this.startPosition = options.startPosition ?? new THREE.Vector3(65, 0.45, -25);
    this.startYaw = options.startYaw ?? 0;
  }

  public getState(): RaceState {
    return this.state;
  }

  public getRaceTime(): number {
    return this.raceTime;
  }

  public getCountdownTimer(): number {
    return this.countdownTimer;
  }

  public getTopSpeedKmh(): number {
    return this.topSpeedKmh;
  }

  public getPassedCheckpointsCount(): number {
    return this.passedCheckpoints.size;
  }

  public getTotalCheckpointsCount(): number {
    return this.checkpoints.length;
  }

  /**
   * 是否正处于 GO! 显示窗口
   */
  public isGoPhase(): boolean {
    return this.state === RaceState.COUNTDOWN && this.countdownTimer <= 0 && this.countdownTimer > -this.goDisplayDuration;
  }

  /**
   * 当前是否处于输入控制锁定阶段 (未发车、3-2-1阶段、暂停或完赛状态)
   * 在 GO! 阶段，发车信号已出，车辆控制完全解锁并可行驶，计时同步启动
   */
  public isControlLocked(): boolean {
    if (this.state === RaceState.READY || this.state === RaceState.PAUSED || this.state === RaceState.FINISHED) {
      return true;
    }
    if (this.state === RaceState.COUNTDOWN) {
      return this.countdownTimer > 0;
    }
    return false;
  }

  /**
   * 倒计时展示文本与缩放进度
   * 严格保证 3 -> 2 -> 1 -> GO! 每一个阶段都具备真实展示窗口
   */
  public getCountdownDisplay(): { text: string; progress: number } {
    if (this.state !== RaceState.COUNTDOWN) {
      return { text: '', progress: 0 };
    }
    const t = this.countdownTimer;
    if (t > 2.0) {
      return { text: '3', progress: t - 2.0 };
    } else if (t > 1.0) {
      return { text: '2', progress: t - 1.0 };
    } else if (t > 0.0) {
      return { text: '1', progress: t };
    } else if (t > -this.goDisplayDuration) {
      // GO! 阶段：展示窗口持续 goDisplayDuration (500ms)
      const progress = Math.max(0, (t + this.goDisplayDuration) / this.goDisplayDuration);
      return { text: 'GO!', progress };
    } else {
      return { text: '', progress: 0 };
    }
  }

  /**
   * 启动起跑倒计时流程 (严密状态守卫，只允许从 READY 状态启动)
   */
  public startCountdown(): void {
    if (this.isDisposed) return;
    if (this.state !== RaceState.READY) {
      return;
    }
    this.state = RaceState.COUNTDOWN;
    this.countdownTimer = this.countdownTotal;
    this.raceTime = 0;
    this.topSpeedKmh = 0;
    this.passedCheckpoints.clear();
    this.hasPrevPos = false;
  }

  /**
   * 暂停比赛 (时间与物理冻结)
   */
  public pause(): void {
    if (this.isDisposed) return;
    if (this.state === RaceState.RACING || this.state === RaceState.COUNTDOWN) {
      this.previousState = this.state;
      this.state = RaceState.PAUSED;
    }
  }

  /**
   * 恢复比赛
   */
  public resume(): void {
    if (this.isDisposed) return;
    if (this.state === RaceState.PAUSED) {
      this.state = this.previousState;
    }
  }

  public togglePause(): void {
    if (this.state === RaceState.PAUSED) {
      this.resume();
    } else if (this.state === RaceState.RACING || this.state === RaceState.COUNTDOWN) {
      this.pause();
    }
  }

  /**
   * 一键重置比赛回到起跑线干净初始状态
   */
  public reset(controller?: VehicleController): void {
    if (this.isDisposed) return;
    this.state = RaceState.READY;
    this.raceTime = 0;
    this.countdownTimer = this.countdownTotal;
    this.topSpeedKmh = 0;
    this.passedCheckpoints.clear();
    this.hasPrevPos = false;

    if (controller) {
      controller.setTransform(this.startPosition.x, this.startPosition.y, this.startPosition.z, this.startYaw);
      controller.resetDynamics();
    }

    // 默认自动开启新一轮倒计时
    this.startCountdown();
  }

  /**
   * 核心逐帧更新
   * @param deltaTime 真实帧间隔时间
   * @param controller 赛车控制器
   */
  public update(deltaTime: number, controller: VehicleController): void {
    if (this.isDisposed) return;

    // 1. 暂停状态：绝对不累加时间，不更新进度
    if (this.state === RaceState.PAUSED) {
      return;
    }

    const currentPos = controller.group.position;
    const currentSpeedKmh = controller.getSpeedKmh();

    // 2. 倒计时状态流转
    if (this.state === RaceState.COUNTDOWN) {
      this.countdownTimer -= deltaTime;

      if (this.countdownTimer > 0) {
        // 3-2-1 阶段强制刹车锁死在起跑线，杜绝抢跑偷跑
        controller.resetDynamics();
        controller.setTransform(this.startPosition.x, this.startPosition.y, this.startPosition.z, this.startYaw);
        return;
      }

      // 进入 GO! 阶段 (持续 goDisplayDuration，例如 0.5s)
      // 正式计时起点必须与 GO 的竞速开始时刻一致
      this.raceTime = -this.countdownTimer;

      if (currentSpeedKmh > this.topSpeedKmh) {
        this.topSpeedKmh = currentSpeedKmh;
      }

      // GO 阶段允许驾驶，检测检查点与终点线
      this.updateCheckpointsAndFinishLine(currentPos);

      if (this.countdownTimer <= -this.goDisplayDuration) {
        // GO 展示阶段结束，平滑进入正式 RACING 状态
        this.state = RaceState.RACING;
      }
      return;
    }

    // 3. 正式竞速状态
    if (this.state === RaceState.RACING) {
      this.raceTime += deltaTime;
      if (currentSpeedKmh > this.topSpeedKmh) {
        this.topSpeedKmh = currentSpeedKmh;
      }

      this.updateCheckpointsAndFinishLine(currentPos);
    }
  }

  /**
   * 检查点激活判定与终点线跨线判定
   */
  private updateCheckpointsAndFinishLine(currentPos: THREE.Vector3): void {
    // 检查点激活判定 (必须按顺序依次收集 1 -> 2 -> 3)
    for (const cp of this.checkpoints) {
      if (!this.passedCheckpoints.has(cp.id)) {
        const dist = Math.hypot(currentPos.x - cp.x, currentPos.z - cp.z);
        // 仅当前序检查点都已点亮时才允许点亮下一个检查点
        const isNextInOrder = cp.id === 1 || this.passedCheckpoints.has(cp.id - 1);
        if (dist <= cp.radius && isNextInOrder) {
          this.passedCheckpoints.add(cp.id);
        }
      }
    }

    // 终点线正向跨线检测 (Continuous Swept-Segment Crossing)
    if (this.hasPrevPos) {
      const crossed = this.checkFinishLineCrossing(this.prevVehiclePos, currentPos);
      if (crossed) {
        // 严格门禁：只有点亮所有 3 个检查点，才算正向有效跑完一圈！
        if (this.passedCheckpoints.size === this.checkpoints.length) {
          this.state = RaceState.FINISHED;
        }
      }
    }

    this.prevVehiclePos.copy(currentPos);
    this.hasPrevPos = true;
  }

  /**
   * 工业级线段相交算法：检测从 p1 到 p2 是否正向穿过终点线 (z=0, x in [55, 75])
   * 正向行驶定义：从 z < 0 穿越到 z >= 0 (朝向 +Z 前进)
   */
  public checkFinishLineCrossing(p1: THREE.Vector3, p2: THREE.Vector3): boolean {
    const zLine = this.finishLineZ;

    // 必须是由负 Z 跨越至正 Z (严格正向单向跨线，杜绝倒车或原地抖动)
    if (p1.z < zLine && p2.z >= zLine) {
      // 计算穿线瞬间的 X 坐标 (线性插值)
      const dz = p2.z - p1.z;
      if (Math.abs(dz) < 1e-6) return false;

      const t = (zLine - p1.z) / dz;
      const intersectX = p1.x + t * (p2.x - p1.x);

      // 检查交点是否在终点线门架路宽有效范围内
      if (intersectX >= this.finishLineMinX && intersectX <= this.finishLineMaxX) {
        return true;
      }
    }

    return false;
  }

  /**
   * 时间格式化实用工具：将秒数转换为 MM:SS.mmm
   */
  public static formatTime(seconds: number): string {
    const totalMs = Math.max(0, Math.floor(seconds * 1000));
    const mins = Math.floor(totalMs / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    const pad = (n: number, width: number = 2) => String(n).padStart(width, '0');
    return `${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.passedCheckpoints.clear();
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
