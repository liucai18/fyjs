import { Engine } from './core/Engine';
import { Time } from './core/Time';
import { DebugScene } from './scene/DebugScene';
import { DebugOverlay } from './ui/DebugOverlay';

function initApp(): void {
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

  // 2. 初始化调试场景 (地面、网格、坐标系、测试体)
  const debugScene = new DebugScene();
  engine.scene.add(debugScene.group);

  // 3. 初始化调试性能面板
  const overlay = new DebugOverlay('debug-overlay');

  // 4. 初始化游戏主循环时间管理器
  const time = new Time();

  // 5. 挂载主循环回调
  time.onUpdate((deltaTime, elapsedTime) => {
    // 更新场景内物体的动画逻辑
    debugScene.update(deltaTime, elapsedTime);

    // 缓动环绕摄像机视角，更全方位观察光影与深度
    const radius = 22;
    const speed = 0.2;
    engine.camera.position.x = Math.sin(elapsedTime * speed) * radius;
    engine.camera.position.z = Math.cos(elapsedTime * speed) * radius;
    engine.camera.position.y = 10 + Math.sin(elapsedTime * 0.5) * 2;
    engine.camera.lookAt(0, 1.5, 0);

    // 提交渲染
    engine.render();

    // 更新性能指标
    const renderInfo = engine.getRenderInfo();
    overlay.update({
      fps: time.currentFps,
      frameTimeMs: deltaTime * 1000,
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      drawCalls: renderInfo.drawCalls,
      triangles: renderInfo.triangles
    });
  });

  // 6. 启动循环
  time.start();

  console.log('🚀 《飞跃极速》阶段 1 · 3D渲染引擎与调试场景初始化成功！');
}

// 页面加载完成后启动
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
