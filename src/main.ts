import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Time } from './core/Time';
import { Input } from './core/Input';
import { TrackScene } from './scene/TrackScene';
import { HoverRacer } from './vehicle/HoverRacer';
import { VehicleController } from './vehicle/VehicleController';
import { FollowCamera } from './camera/FollowCamera';
import { DebugOverlay } from './ui/DebugOverlay';
import { RaceManager, RaceState } from './race/RaceManager';
import { RaceHUD } from './ui/RaceHUD';
import { NitroSystem } from './vehicle/NitroSystem';

export interface AppInstance {
  engine: Engine;
  time: Time;
  input: Input;
  trackScene: TrackScene;
  hoverRacer: HoverRacer;
  vehicleController: VehicleController;
  followCamera: FollowCamera;
  overlay: DebugOverlay;
  raceManager: RaceManager;
  raceHUD: RaceHUD;
  nitroSystem: NitroSystem;
  dispose: () => void;
}

export interface InitAppOptions {
  renderer?: THREE.WebGLRenderer;
  throwOnSceneInit?: boolean; // 用于单元测试验证中途初始化失败时的原子回滚机制
}

let currentApp: AppInstance | null = null;
let domContentLoadedHandler: (() => void) | null = null;

export function cleanupPageListeners(): void {
  if (domContentLoadedHandler && typeof window !== 'undefined') {
    window.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    domContentLoadedHandler = null;
    console.log('🧹 已安全注销 DOMContentLoaded 页面监听器');
  }
}

export function getDOMContentLoadedHandler(): (() => void) | null {
  return domContentLoadedHandler;
}

export function setupPageListeners(): (() => void) | null {
  cleanupPageListeners();
  if (typeof window !== 'undefined') {
    domContentLoadedHandler = () => {
      cleanupPageListeners();
      if (document.getElementById('game-canvas')) {
        initApp();
      }
    };
    window.addEventListener('DOMContentLoaded', domContentLoadedHandler);
  }
  return domContentLoadedHandler;
}

export function initApp(options?: InitAppOptions): AppInstance {
  // 1. 如果已有实例，先完全安全销毁，确保幂等性
  if (currentApp) {
    destroyApp();
  }

  // 跟踪已创建的部分资源，以便在异常时执行完全原子回滚
  let createdEngine: Engine | null = null;
  let createdTrackScene: TrackScene | null = null;
  let createdRacer: HoverRacer | null = null;
  let createdVehicle: VehicleController | null = null;
  let createdFollowCamera: FollowCamera | null = null;
  let createdInput: Input | null = null;
  let createdOverlay: DebugOverlay | null = null;
  let createdRaceManager: RaceManager | null = null;
  let createdRaceHUD: RaceHUD | null = null;
  let createdNitro: NitroSystem | null = null;
  let createdTime: Time | null = null;
  let unregisterUpdate: (() => void) | null = null;

  try {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element #game-canvas not found!');
    }

    // 1. 核心渲染引擎
    createdEngine = new Engine({
      canvas,
      antialias: true,
      shadows: true,
      renderer: options?.renderer
    });

    // 自动化测试注入点：模拟第 2 步中途初始化抛错
    if (options?.throwOnSceneInit) {
      throw new Error('Simulated mid-way failure during TrackScene creation');
    }

    // 2. 阶段 2 真实可驾驶科幻赛道 (600m 环形赛道 + 霓虹护栏)
    createdTrackScene = new TrackScene();
    createdEngine.scene.add(createdTrackScene.group);

    // 3. 原创科幻反重力飞车 (Prototype X-1)
    createdRacer = new HoverRacer();
    createdEngine.scene.add(createdRacer.group);

    // 4. 车辆物理动力学控制器 (出生在东直道起跑线前方)
    createdVehicle = new VehicleController(createdRacer);
    createdVehicle.setTransform(createdTrackScene.radius, 0.45, -25, 0);

    // 5. 阶段 3.2 氮气加速系统 (独立封装，100% 初始能量，25%/s 消耗，10%/s 充能)
    createdNitro = new NitroSystem();

    // 6. 第三人称智能平滑追踪摄像机 (平滑跟随飞车)
    createdFollowCamera = new FollowCamera(createdEngine.camera);
    createdFollowCamera.follow(createdRacer.group);

    // 7. 键盘输入管理
    createdInput = new Input();

    // 8. 实时仪表盘面板 (150ms 节流更新)
    createdOverlay = new DebugOverlay('debug-overlay');

    // 9. 比赛核心管理器 (状态机、3-2-1-GO倒计时、三道检查点门禁与前后帧连续冲线检测)
    createdRaceManager = new RaceManager({
      countdownDuration: 3.0,
      startPosition: new THREE.Vector3(createdTrackScene.radius, 0.45, -25),
      startYaw: 0
    });
    createdRaceManager.startCountdown();

    // 10. 竞速专属 HUD (倒计时横幅、毫秒计时器与完赛结算弹窗)
    createdRaceHUD = new RaceHUD('race-hud');

    // 绑定全局动作热键 (R 键重试起跑，P / Esc 键暂停切换)
    createdInput.onAction('reset', () => {
      if (createdVehicle) {
        createdRaceManager?.reset(createdVehicle);
        createdNitro?.reset();
        createdFollowCamera?.snap();
      }
    });

    createdInput.onAction('pause', () => {
      createdRaceManager?.togglePause();
    });

    // 11. 高精时间管理器 (1000 帧滑动窗口)
    createdTime = new Time();

    // 12. 挂载主游戏循环
    unregisterUpdate = createdTime.onUpdate((deltaTime, _elapsedTime, rawDeltaTime) => {
      if (!createdTrackScene || !createdEngine || !createdTime || !createdOverlay || !createdVehicle || !createdFollowCamera || !createdInput || !createdRaceManager || !createdRaceHUD || !createdNitro) {
        return;
      }

      // 1. 比赛状态机更新 (倒计时递减、计时累加、检查点拾取与冲线检测)
      createdRaceManager.update(deltaTime, createdVehicle);

      const isControlLocked = createdRaceManager.isControlLocked();
      const raceState = createdRaceManager.getState();
      const canDrive = !isControlLocked && (raceState === RaceState.RACING || createdRaceManager.isGoPhase());
      const isFrozen = raceState === RaceState.PAUSED || raceState === RaceState.FINISHED;

      // 2. 读取驾驶输入并驱动车辆物理
      let inputState = createdInput.getState();

      // 3. 氮气加速系统更新 (仅在允许驾驶时生效，暂停与完赛期间绝对冻结)
      createdNitro.update(deltaTime, !!inputState.nitro, canDrive, isFrozen);
      const isBoosting = createdNitro.isBoosting();

      // 处于控制锁定阶段 (未发车、3-2-1倒计时、暂停或冲线完赛) 强制清空驾驶输入
      if (isControlLocked) {
        inputState = { forward: false, backward: false, left: false, right: false, brake: true, nitro: false };
      } else {
        inputState = { ...inputState, nitro: isBoosting };
      }

      // 非暂停状态下处理车辆物理动力学与摄像机追踪
      if (raceState !== RaceState.PAUSED) {
        if (raceState === RaceState.FINISHED) {
          // 冲线完赛状态：锁死车辆动力学与驾驶输入，刹车冻结，保持最终结算成绩不变
          createdVehicle.resetDynamics();
          createdFollowCamera.update(deltaTime, 0);
        } else {
          createdVehicle.update(deltaTime, inputState);
          createdTrackScene.checkBoundaryCollision(createdVehicle);
          createdFollowCamera.update(deltaTime, createdVehicle.getSpeed());
        }
      }

      // 3. 执行渲染
      createdEngine.render();

      // 4. 刷新竞速 HUD 与性能监控面板
      createdRaceHUD.update(createdRaceManager);
      const renderInfo = createdEngine.getRenderInfo();
      createdOverlay.update({
        fps: createdTime.currentFps,
        onePercentLowFps: createdTime.onePercentLowFps,
        isWarmingUp: createdTime.isWarmingUp,
        speedKmh: createdVehicle.getSpeedKmh(),
        rawFrameTimeMs: rawDeltaTime * 1000,
        gameDeltaMs: deltaTime * 1000,
        width: typeof window !== 'undefined' ? window.innerWidth : 1280,
        height: typeof window !== 'undefined' ? window.innerHeight : 720,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        drawCalls: renderInfo.drawCalls,
        triangles: renderInfo.triangles
      });
    });

    // 12. 启动时间循环
    createdTime.start();

    const dispose = () => {
      if (unregisterUpdate) {
        unregisterUpdate();
        unregisterUpdate = null;
      }
      if (createdInput) {
        createdInput.dispose();
        createdInput = null;
      }
      if (createdFollowCamera) {
        createdFollowCamera.dispose();
        createdFollowCamera = null;
      }
      if (createdVehicle) {
        createdVehicle.dispose();
        createdVehicle = null;
      }
      if (createdRacer) {
        createdRacer.dispose();
        createdRacer = null;
      }
      if (createdTrackScene) {
        createdTrackScene.dispose();
        createdTrackScene = null;
      }
      if (createdRaceHUD) {
        createdRaceHUD.dispose();
        createdRaceHUD = null;
      }
      if (createdRaceManager) {
        createdRaceManager.dispose();
        createdRaceManager = null;
      }
      if (createdNitro) {
        createdNitro.dispose();
        createdNitro = null;
      }
      if (createdTime) {
        createdTime.dispose();
        createdTime = null;
      }
      if (createdEngine) {
        createdEngine.dispose();
        createdEngine = null;
      }
      if (createdOverlay) {
        createdOverlay.dispose();
        createdOverlay = null;
      }
      currentApp = null;
      if (typeof window !== 'undefined') {
        (window as any).__LEAP_SPEED_APP__ = null;
      }
      console.log('🧹 《飞跃极速》阶段 3.2 竞速与氮气系统资源已完全释放！');
    };

    currentApp = {
      engine: createdEngine,
      time: createdTime,
      input: createdInput,
      trackScene: createdTrackScene,
      hoverRacer: createdRacer,
      vehicleController: createdVehicle,
      followCamera: createdFollowCamera,
      overlay: createdOverlay,
      raceManager: createdRaceManager,
      raceHUD: createdRaceHUD,
      nitroSystem: createdNitro,
      dispose
    };

    if (typeof window !== 'undefined') {
      (window as any).__LEAP_SPEED_APP__ = currentApp;
    }

    console.log('🚀 《飞跃极速》阶段 3.2 · 氮气加速竞速系统就绪！');
    return currentApp;
  } catch (error) {
    console.error('❌ 初始化失败，正在执行阶段 3.2 异常原子回滚:', error);
    if (unregisterUpdate) unregisterUpdate();
    if (createdInput) createdInput.dispose();
    if (createdFollowCamera) createdFollowCamera.dispose();
    if (createdVehicle) createdVehicle.dispose();
    if (createdRacer) createdRacer.dispose();
    if (createdTrackScene) createdTrackScene.dispose();
    if (createdRaceHUD) createdRaceHUD.dispose();
    if (createdRaceManager) createdRaceManager.dispose();
    if (createdNitro) createdNitro.dispose();
    if (createdTime) createdTime.dispose();
    if (createdEngine) createdEngine.dispose();
    if (createdOverlay) createdOverlay.dispose();
    currentApp = null;
    throw error;
  }
}

export function destroyApp(): void {
  if (currentApp) {
    currentApp.dispose();
    currentApp = null;
  }
}

export function getCurrentApp(): AppInstance | null {
  return currentApp;
}

// 页面加载完成后自启动
if (typeof window !== 'undefined') {
  const autoInit = () => {
    cleanupPageListeners();
    if (document.getElementById('game-canvas')) {
      initApp();
    }
  };

  if (document.readyState === 'loading') {
    setupPageListeners();
  } else {
    autoInit();
  }

  // Vite HMR 热更新安全清理
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      console.log('🔥 Vite HMR 热更新触发：执行全局销毁与旧监听器注销...');
      cleanupPageListeners();
      destroyApp();
    });
  }
}
