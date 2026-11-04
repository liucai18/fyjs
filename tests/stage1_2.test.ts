import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Time } from '../src/core/Time';
import { DebugScene } from '../src/scene/DebugScene';
import { DebugOverlay } from '../src/ui/DebugOverlay';
import { initApp, destroyApp, getCurrentApp } from '../src/main';

describe('阶段 1.2 自动化质量工程测试', () => {

  describe('1. 1% Low FPS 与时间管理 (Time.ts)', () => {
    let time: Time;

    beforeEach(() => {
      time = new Time();
    });

    afterEach(() => {
      time.dispose();
    });

    it('样本不足 60 帧时应处于预热状态 (isWarmingUp = true)', () => {
      for (let i = 0; i < 30; i++) {
        time.recordFrameSample(16.6);
      }
      expect(time.getSampleCount()).toBe(30);
      expect(time.isWarmingUp).toBe(true);
      expect(time.currentFps).toBe(60);
      expect(time.onePercentLowFps).toBe(60);
    });

    it('达到充足样本后应解除预热，并正确计算 1% Low FPS', () => {
      // 模拟 100 帧：其中 99 帧为流畅 16.6ms (60 FPS)，1 帧严重卡顿 100ms (10 FPS)
      for (let i = 0; i < 99; i++) {
        time.recordFrameSample(16.6);
      }
      time.recordFrameSample(100.0);

      expect(time.getSampleCount()).toBe(100);
      expect(time.isWarmingUp).toBe(false);

      // 100 帧的 1% 即为最差的 1 帧 (100ms)，换算帧率应为 10 FPS
      expect(time.onePercentLowFps).toBe(10);
      // 平均帧率仍在 57~58 FPS 左右
      expect(time.currentFps).toBeGreaterThan(50);
    });

    it('滑动窗口应严格限制最大样本数为 1000 帧', () => {
      for (let i = 0; i < 1200; i++) {
        time.recordFrameSample(16.6);
      }
      expect(time.getSampleCount()).toBe(1000);
    });

    it('时间暂停 (pause) 与恢复 (resume) 状态转换正确', () => {
      expect(time.getIsPaused()).toBe(false);
      time.pause();
      expect(time.getIsPaused()).toBe(true);
      time.resume();
      expect(time.getIsPaused()).toBe(false);
      // 恢复后历史窗口应被重置以避免脏数据污染
      expect(time.getSampleCount()).toBe(0);
      expect(time.isWarmingUp).toBe(true);
    });
  });

  describe('2. 资源释放安全性与幂等性 (DebugScene.ts)', () => {
    it('DebugScene.dispose() 应支持幂等安全重复调用，不抛出异常', () => {
      const scene = new DebugScene();
      expect(scene.getDisposedState()).toBe(false);

      // 第一次正常销毁
      expect(() => scene.dispose()).not.toThrow();
      expect(scene.getDisposedState()).toBe(true);
      expect(scene.group.children.length).toBe(0);

      // 第二次、第三次重复调用（测试幂等性）
      expect(() => scene.dispose()).not.toThrow();
      expect(() => scene.dispose()).not.toThrow();
      expect(scene.getDisposedState()).toBe(true);
    });

    it('销毁后调用 update() 应被安全阻断，不产生异常与状态变更', () => {
      const scene = new DebugScene();
      scene.dispose();
      expect(() => scene.update(0.016, 1.0)).not.toThrow();
    });
  });

  describe('3. 调试面板与节流 (DebugOverlay.ts)', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'test-debug-overlay';
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('DebugOverlay 应正确初始化并在 dispose 时清理内容', () => {
      const overlay = new DebugOverlay('test-debug-overlay');
      expect(container.innerHTML).toContain('⚡ 飞跃极速 · 引擎调试台');

      overlay.dispose();
      expect(container.innerHTML).toBe('');

      // 重复 dispose 幂等安全
      expect(() => overlay.dispose()).not.toThrow();
    });
  });

  describe('4. 初始化异常原子回滚 (main.ts)', () => {
    const createMockRenderer = () => ({
      outputColorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0,
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
      info: {
        render: { calls: 6, triangles: 4302 },
        memory: { geometries: 5, textures: 0 }
      },
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      forceContextLoss: vi.fn()
    } as unknown as THREE.WebGLRenderer);

    afterEach(() => {
      destroyApp();
      document.body.innerHTML = '';
    });

    it('Canvas 缺失时 initApp() 应抛出错误并确保无全局残缺实例残留', () => {
      document.body.innerHTML = '<div id="debug-overlay"></div>'; // 故意不给 #game-canvas
      expect(() => initApp({ renderer: createMockRenderer() })).toThrow('Canvas element #game-canvas not found!');
      expect(getCurrentApp()).toBeNull();
    });

    it('正常初始化与手动 destroyApp() 流程完整幂等', () => {
      document.body.innerHTML = `
        <canvas id="game-canvas"></canvas>
        <div id="debug-overlay"></div>
      `;

      // 正常初始化（通过依赖注入传入 Headless 模拟 WebGLRenderer）
      const mockRenderer = createMockRenderer();
      const app = initApp({ renderer: mockRenderer });
      expect(app).toBeDefined();
      expect(getCurrentApp()).toBe(app);

      // 正常销毁
      expect(() => destroyApp()).not.toThrow();
      expect(getCurrentApp()).toBeNull();

      // 重复销毁幂等性
      expect(() => destroyApp()).not.toThrow();
    });
  });

});
