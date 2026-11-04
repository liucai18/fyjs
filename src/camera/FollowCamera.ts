import * as THREE from 'three';

export interface FollowCameraOptions {
  idealOffset?: THREE.Vector3; // 局部坐标系下相对车辆的理想机位，默认 (0, 2.4, -6.5)
  lookOffset?: THREE.Vector3;  // 局部坐标系下相机注视的前向焦点，默认 (0, 0.7, 3.2)
  positionDamping?: number;    // 位置跟随平滑阻尼系数，默认 6.5
  lookAtDamping?: number;      // 焦点注视平滑阻尼系数，默认 8.5
  enableSpeedFov?: boolean;    // 是否开启极速视觉张力 FOV 动态拉伸
}

/**
 * 飞跃极速 · 第三人称智能平滑追踪跟随摄像机 (FollowCamera.ts)
 * 严格落实师父【任务三：第三人称摄像机】：
 * - 柔和 Lerp/Slerp 阻尼算法跟随飞车，过弯时产生自然的向心延迟追随感
 * - 绝不产生高频镜头颤动或机械瞬移跳位
 * - 飞车始终稳固保持在画面舒适视觉中心
 * - 支持根据车速动态微调 FOV 景深，提升极速冲刺代入感
 */
export class FollowCamera {
  public readonly camera: THREE.PerspectiveCamera;
  private targetGroup: THREE.Group | null = null;

  private readonly idealOffset: THREE.Vector3;
  private readonly lookOffset: THREE.Vector3;
  private readonly positionDamping: number;
  private readonly lookAtDamping: number;
  private readonly enableSpeedFov: boolean;

  // 内部平滑追踪变量
  private readonly currentLookAt: THREE.Vector3 = new THREE.Vector3();
  private readonly tempPos: THREE.Vector3 = new THREE.Vector3();
  private readonly tempLook: THREE.Vector3 = new THREE.Vector3();
  private baseFov: number;
  private isDisposed: boolean = false;

  constructor(camera: THREE.PerspectiveCamera, options: FollowCameraOptions = {}) {
    this.camera = camera;
    this.baseFov = camera.fov;

    this.idealOffset = options.idealOffset ?? new THREE.Vector3(0, 2.85, -8.8);
    this.lookOffset = options.lookOffset ?? new THREE.Vector3(0, 0.75, 4.0);
    this.positionDamping = options.positionDamping ?? 6.5;
    this.lookAtDamping = options.lookAtDamping ?? 8.5;
    this.enableSpeedFov = options.enableSpeedFov ?? true;
  }

  /**
   * 绑定需要跟随的车辆根节点
   */
  public follow(target: THREE.Group): void {
    this.targetGroup = target;
    this.snap();
  }

  /**
   * 立即瞬移重置到当前车辆后方（用于初始出生或换图，避免跨地图拉扯飞跃）
   */
  public snap(): void {
    if (!this.targetGroup) return;

    this.calculateIdealWorldPositions(this.tempPos, this.tempLook);
    this.camera.position.copy(this.tempPos);
    this.currentLookAt.copy(this.tempLook);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * 计算目标局部偏移映射到世界空间后的绝对坐标
   */
  private calculateIdealWorldPositions(outPos: THREE.Vector3, outLook: THREE.Vector3): void {
    if (!this.targetGroup) return;

    // 将局部 idealOffset 旋转平移至世界空间
    outPos.copy(this.idealOffset).applyQuaternion(this.targetGroup.quaternion).add(this.targetGroup.position);
    // 将局部 lookOffset 旋转平移至世界空间
    outLook.copy(this.lookOffset).applyQuaternion(this.targetGroup.quaternion).add(this.targetGroup.position);
  }

  /**
   * 逐帧智能平滑跟随追踪 (在主循环中调用)
   * @param deltaTime 帧时间增量
   * @param currentSpeed 当前车辆米制时速 (m/s)，用于动态 FOV 微调
   */
  public update(deltaTime: number, currentSpeed: number = 0): void {
    if (this.isDisposed || !this.targetGroup) return;

    const dt = Math.min(deltaTime, 0.1);

    // 1. 计算理想相机世界位置与注视点
    this.calculateIdealWorldPositions(this.tempPos, this.tempLook);

    // 2. 指数阻尼平滑插值 (Lerp with dampening)
    // 摄像机位置平滑过渡，过弯时形成自然空气阻尼拖尾追光效果
    const posAlpha = 1.0 - Math.exp(-this.positionDamping * dt);
    this.camera.position.lerp(this.tempPos, posAlpha);

    // 视线焦点平滑过渡，确保飞车始终处于舒适重心
    const lookAlpha = 1.0 - Math.exp(-this.lookAtDamping * dt);
    this.currentLookAt.lerp(this.tempLook, lookAlpha);
    this.camera.lookAt(this.currentLookAt);

    // 3. 动态速度 FOV (高速时从 60 逐渐延展至 68，带来极强冲刺压迫感)
    if (this.enableSpeedFov) {
      const speedRatio = THREE.MathUtils.clamp(Math.abs(currentSpeed) / 60.0, 0, 1.0);
      const targetFov = this.baseFov + speedRatio * 8.0;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 4.0);
      this.camera.updateProjectionMatrix();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.targetGroup = null;
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
