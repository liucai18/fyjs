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

let currentApp: AppInstance | null = null;

export function initApp(): AppInstance {
  // 如果已有实例先完全安全销毁，防止热重载或重复调用导致多实例与内存泄漏
  if (currentApp) {
    destroyApp();
  }

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found!');
  }

  // 1. 初始化核心渲染引擎
  const engine = new Engine({
    canvas,
    antialias: true,
    shadows: true
  });

  // 2. 初始化阶段 1 调试场景
  const debugScene = new DebugScene();
  engine.scene.add(debugScene.group);

  // 3. 初始化性能面板 (带缓存 DOM 节点)
  const overlay = new DebugOverlay('debug-overlay');

  // 4. 初始化时间管理器 (带 1% Low FPS 与失焦保护)
  const time = new Time();

  // 5. 挂载主循环回调
  const unregisterUpdate = time.onUpdate((deltaTime, elapsedTime, rawDeltaTime) => {
    // 更新调试几何体动画
    debugScene.update(deltaTime, elapsedTime);

    // 缓动环绕摄像机视角
    const radius = 22;
    const speed = 0.2;
    engine.camera.position.x = Math.sin(elapsedTime * speed) * radius;
    engine.camera.position.z = Math.cos(elapsedTime * speed) * radius;
    engine.camera.position.y = 10 + Math.sin(elapsedTime * 0.5) * 2;
    engine.camera.lookAt(0, 1.5, 0);

    // 提交渲染
    engine.render();

    // 更新性能指标：严格区分真实帧耗时（rawFrameTimeMs）与保护后的游戏时间增量（gameDeltaMs）
    const renderInfo = engine.getRenderInfo();
    overlay.update({
      fps: time.currentFps,
      onePercentLowFps: time.onePercentLowFps,
      rawFrameTimeMs: rawDeltaTime * 1000,
      gameDeltaMs: deltaTime * 1000,
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      drawCalls: renderInfo.drawCalls,
      triangles: renderInfo.triangles
    });
  });

  // 6. 启动时间循环
  time.start();

  const dispose = () => {
    unregisterUpdate();
    time.dispose();
    debugScene.dispose();
    engine.dispose();
    overlay.dispose();
    currentApp = null;
    console.log('🧹 《飞跃极速》阶段 1.1 应用生命周期已安全完全销毁！');
  };

  currentApp = {
    engine,
    time,
    debugScene,
    overlay,
    dispose
  };

  console.log('🚀 《飞跃极速》阶段 1.1 · 完整生命周期管理与高精度监控已就绪！');
  return currentApp;
}

export function destroyApp(): void {
  if (currentApp) {
    currentApp.dispose();
  }
}

// 页面加载完成后启动
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }

  // 阶段 1.1 关键特性：集成 Vite HMR 热重载生命周期清理，热更新时先安全释放上一个实例
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      console.log('🔥 Vite HMR 热更新触发：正在释放旧实例资源...');
      destroyApp();
    });
  }
}
