import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Time } from './core/Time';
import { DebugScene } from './scene/DebugScene';
import { DebugOverlay } from './ui/DebugOverlay';

export interface AppInstance {
  engine: Engine;
  time: Time;
  debugScene: DebugScene;
  overlay: DebugOverlay;
  dispose: () => void;
}

export interface InitAppOptions {
  renderer?: THREE.WebGLRenderer;
  throwOnSceneInit?: boolean; // 用于自动化验证中途初始化失败时的原子回滚机制
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

export function initApp(options?: InitAppOptions): AppInstance {
  // 1. 如果已有实例，先完全安全销毁，确保幂等性
  if (currentApp) {
    destroyApp();
  }

  // 跟踪已创建的部分资源，以便在异常时执行完全原子回滚
  let createdEngine: Engine | null = null;
  let createdDebugScene: DebugScene | null = null;
  let createdOverlay: DebugOverlay | null = null;
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

    // 阶段 1.3 测试注入：模拟第 2 步中途初始化抛错
    if (options?.throwOnSceneInit) {
      throw new Error('Simulated mid-way failure during DebugScene creation');
    }

    // 2. 阶段 1 调试场景
    createdDebugScene = new DebugScene();
    createdEngine.scene.add(createdDebugScene.group);

    // 3. 性能面板 (150ms 节流)
    createdOverlay = new DebugOverlay('debug-overlay');

    // 4. 时间管理器 (1000 帧滑动窗口)
    createdTime = new Time();

    // 5. 挂载主循环回调
    unregisterUpdate = createdTime.onUpdate((deltaTime, elapsedTime, rawDeltaTime) => {
      if (!createdDebugScene || !createdEngine || !createdTime || !createdOverlay) return;

      createdDebugScene.update(deltaTime, elapsedTime);

      const radius = 22;
      const speed = 0.2;
      createdEngine.camera.position.x = Math.sin(elapsedTime * speed) * radius;
      createdEngine.camera.position.z = Math.cos(elapsedTime * speed) * radius;
      createdEngine.camera.position.y = 10 + Math.sin(elapsedTime * 0.5) * 2;
      createdEngine.camera.lookAt(0, 1.5, 0);

      createdEngine.render();

      const renderInfo = createdEngine.getRenderInfo();
      createdOverlay.update({
        fps: createdTime.currentFps,
        onePercentLowFps: createdTime.onePercentLowFps,
        isWarmingUp: createdTime.isWarmingUp,
        rawFrameTimeMs: rawDeltaTime * 1000,
        gameDeltaMs: deltaTime * 1000,
        width: typeof window !== 'undefined' ? window.innerWidth : 1280,
        height: typeof window !== 'undefined' ? window.innerHeight : 720,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        drawCalls: renderInfo.drawCalls,
        triangles: renderInfo.triangles
      });
    });

    // 6. 启动时间循环
    createdTime.start();

    const dispose = () => {
      if (unregisterUpdate) {
        unregisterUpdate();
        unregisterUpdate = null;
      }
      if (createdTime) {
        createdTime.dispose();
        createdTime = null;
      }
      if (createdDebugScene) {
        createdDebugScene.dispose();
        createdDebugScene = null;
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
      console.log('🧹 《飞跃极速》阶段 1.3 资源生命周期已完全释放！');
    };

    currentApp = {
      engine: createdEngine,
      time: createdTime,
      debugScene: createdDebugScene,
      overlay: createdOverlay,
      dispose
    };

    console.log('🚀 《飞跃极速》阶段 1.3 · 架构健壮性与自动化质检就绪！');
    return currentApp;
  } catch (error) {
    // 阶段 1.3 核心原子回滚：即使是中途抛错，也确保已生成的先驱资源被 100% 释放
    console.error('❌ 初始化失败，正在执行阶段 1.3 异常原子回滚:', error);
    if (unregisterUpdate) unregisterUpdate();
    if (createdTime) createdTime.dispose();
    if (createdDebugScene) createdDebugScene.dispose();
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
    domContentLoadedHandler = () => autoInit();
    window.addEventListener('DOMContentLoaded', domContentLoadedHandler);
  } else {
    autoInit();
  }

  // 阶段 1.3 Vite HMR 严谨热重载清理：销毁实例并强制清理尚未触发的 DOMContentLoaded 监听器
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      console.log('🔥 Vite HMR 热更新触发：执行全局销毁与旧监听器注销...');
      cleanupPageListeners();
      destroyApp();
    });
  }
}
