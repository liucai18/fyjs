import * as THREE from 'three';
import { HoverRacer } from './HoverRacer';
import { InputState } from '../core/Input';

export interface VehiclePhysicsConfig {
  maxSpeed?: number;        // 最大前进极速 (m/s)，默认 60 m/s (216 km/h)
  maxReverseSpeed?: number; // 最大倒车极速 (m/s)，默认 16 m/s
  acceleration?: number;    // 加速度 (m/s^2)
  brakeDeceleration?: number; // 刹车减速度 (m/s^2)
  dragDeceleration?: number;  // 自然空气/反重力阻尼减速度 (m/s^2)
  steerSpeed?: number;      // 最大转向角速度 (rad/s)
}

/**
 * 飞跃极速 · 科幻反重力赛车驾驶动力学控制器 (VehicleController.ts)
 * 严格落实师父【任务二：基础驾驶系统】：
 * - W / ↑：连续线性加速并提升推进器等离子尾焰与底盘照地光
 * - S / ↓：强效刹车制动并在速度归零后线性倒车
 * - A / ← 与 D / →：平滑连续转向，速度越快抓地力侧倾越强烈
 * - 速度与航向角动力学解耦，无按键时具有平滑自然阻尼滑行
 */
export class VehicleController {
  public readonly racer: HoverRacer;
  public readonly group: THREE.Group;

  // 物理动力学参数
  public readonly maxSpeed: number;
  public readonly maxReverseSpeed: number;
  public readonly acceleration: number;
  public readonly brakeDeceleration: number;
  public readonly dragDeceleration: number;
  public readonly steerSpeed: number;

  // 实时运动状态
  private currentSpeed: number = 0; // 当前前进速度 (m/s)
  private currentYaw: number = 0;   // 当前航向角 (rad)
  private smoothedSteer: number = 0; // 平滑后的转向输入 (-1 ~ 1)
  private isDisposed: boolean = false;

  constructor(racer: HoverRacer, config: VehiclePhysicsConfig = {}) {
    this.racer = racer;
    this.group = racer.group;

    this.maxSpeed = config.maxSpeed ?? 60.0;
    this.maxReverseSpeed = config.maxReverseSpeed ?? 16.0;
    this.acceleration = config.acceleration ?? 30.0;
    this.brakeDeceleration = config.brakeDeceleration ?? 45.0;
    this.dragDeceleration = config.dragDeceleration ?? 12.0;
    this.steerSpeed = config.steerSpeed ?? 2.2;
  }

  /**
   * 逐帧动力学更新 (在 requestAnimationFrame 循环中调用)
   */
  public update(deltaTime: number, input: InputState): void {
    if (this.isDisposed) return;

    const dt = Math.min(deltaTime, 0.1); // 防御大卡顿瞬移

    // ==========================================
    // 1. 加速、刹车与阻尼纵向动力学
    // ==========================================
    let throttleFactor = 0;

    if (input.forward) {
      throttleFactor = 1.0;
      if (this.currentSpeed < 0) {
        // 倒车中按 W：强力刹停
        this.currentSpeed += this.brakeDeceleration * dt;
      } else {
        // 正常前进加速
        this.currentSpeed = Math.min(this.currentSpeed + this.acceleration * dt, this.maxSpeed);
      }
    } else if (input.backward) {
      if (this.currentSpeed > 0) {
        // 前进中按 S：刹车减速
        throttleFactor = 0.15;
        this.currentSpeed = Math.max(this.currentSpeed - this.brakeDeceleration * dt, 0);
      } else {
        // 倒车加速
        throttleFactor = 0.35;
        this.currentSpeed = Math.max(this.currentSpeed - (this.acceleration * 0.6) * dt, -this.maxReverseSpeed);
      }
    } else if (input.brake) {
      // 空格手刹
      if (this.currentSpeed > 0) {
        this.currentSpeed = Math.max(this.currentSpeed - this.brakeDeceleration * 1.5 * dt, 0);
      } else if (this.currentSpeed < 0) {
        this.currentSpeed = Math.min(this.currentSpeed + this.brakeDeceleration * 1.5 * dt, 0);
      }
    } else {
      // 无输入自然空气阻尼滑行 (Drag Deceleration)
      if (this.currentSpeed > 0) {
        this.currentSpeed = Math.max(this.currentSpeed - this.dragDeceleration * dt, 0);
      } else if (this.currentSpeed < 0) {
        this.currentSpeed = Math.min(this.currentSpeed + this.dragDeceleration * dt, 0);
      }
    }

    // ==========================================
    // 2. 转向横向动力学 (带速度敏感性与角加速度平滑)
    // ==========================================
    let targetSteer = 0;
    if (input.left) targetSteer += 1;
    if (input.right) targetSteer -= 1;

    // 平滑输入，避免突变
    this.smoothedSteer = THREE.MathUtils.lerp(this.smoothedSteer, targetSteer, dt * 10.0);

    // 转向角速度随车速非线性变化：静止或微速时转向较小，高速时转向有良好手感
    const speedRatio = Math.abs(this.currentSpeed) / this.maxSpeed;
    const steerAuthority = THREE.MathUtils.clamp(speedRatio * 1.4, 0.25, 1.0);
    const reverseSign = this.currentSpeed < 0 ? -1 : 1; // 倒车转向与前进一致方向

    if (Math.abs(this.smoothedSteer) > 0.01) {
      this.currentYaw += this.smoothedSteer * this.steerSpeed * steerAuthority * reverseSign * dt;
    }

    // ==========================================
    // 3. 位移与航向空间积分
    // ==========================================
    this.group.rotation.y = this.currentYaw;

    // 前进方向为当前航向的正前方 (局部坐标 +Z 轴)
    const moveZ = Math.cos(this.currentYaw) * this.currentSpeed * dt;
    const moveX = Math.sin(this.currentYaw) * this.currentSpeed * dt;

    this.group.position.x += moveX;
    this.group.position.z += moveZ;

    // ==========================================
    // 4. 视觉与特效联动反馈
    // ==========================================
    // 飞车内部物理悬浮微运动与侧倾
    this.racer.setSteering(-this.smoothedSteer);
    this.racer.setThrottle(throttleFactor);
    this.racer.update(dt);
  }

  /**
   * 获取当前绝对时速 (km/h)
   */
  public getSpeedKmh(): number {
    return Math.round(Math.abs(this.currentSpeed) * 3.6);
  }

  /**
   * 获取当前真实米制速度 (m/s)
   */
  public getSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * 获取当前航向角 (rad)
   */
  public getYaw(): number {
    return this.currentYaw;
  }

  /**
   * 手动设置车辆位置与朝向（用于赛道重生或测试）
   */
  public setTransform(x: number, y: number, z: number, yaw: number = 0): void {
    this.group.position.set(x, y, z);
    this.currentYaw = yaw;
    this.group.rotation.y = yaw;
    this.currentSpeed = 0;
  }

  /**
   * 施加边界约束与反弹
   */
  public applyBounce(bounceX: number, bounceZ: number): void {
    this.group.position.x += bounceX;
    this.group.position.z += bounceZ;
    // 碰撞减速惩罚 30%
    this.currentSpeed *= 0.7;
  }

  /**
   * 彻底安全释放
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.racer.dispose();
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
