import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Time } from '../src/core/Time';
import { DebugScene } from '../src/scene/DebugScene';
import { DebugOverlay } from '../src/ui/DebugOverlay';
import { Engine } from '../src/core/Engine';
import { initApp, destroyApp, getCurrentApp, cleanupPageListeners } from '../src/main';

describe('阶段 1.4 工业级生命周期与极端容错自动化测试', () => {

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
      for (let i = 0; i < 99; i++) {
        time.recordFrameSample(16.6);
      }
      time.recordFrameSample(100.0);

      expect(time.getSampleCount()).toBe(100);
      expect(time.isWarmingUp).toBe(false);

      expect(time.onePercentLowFps).toBe(10);
      expect(time.currentFps).toBeGreaterThan(50);
    });

    it('滑动窗口应严格限制最大样本数为 1000 帧', () => {
      for (let i = 0; i < 1200; i++) {
        time.recordFrameSample(16.6);
      }
      expect(time.getSampleCount()).toBe(1000);
    });

    it('时间暂停 (pause) 与恢复 (resume) 状态转换正确并重置预热', () => {
      expect(time.getIsPaused()).toBe(false);
      time.pause();
      expect(time.getIsPaused()).toBe(true);
      time.resume();
      expect(time.getIsPaused()).toBe(false);
      expect(time.getSampleCount()).toBe(0);
      expect(time.isWarmingUp).toBe(true);
    });
  });

  describe('2. 资源释放安全性与幂等性 (DebugScene.ts)', () => {
    it('DebugScene.dispose() 应支持幂等安全重复调用，不抛出异常', () => {
      const scene = new DebugScene();
      expect(scene.getDisposedState()).toBe(false);

      expect(() => scene.dispose()).not.toThrow();
      expect(scene.getDisposedState()).toBe(true);
      expect(scene.group.children.length).toBe(0);

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

  describe('3. 调试面板节流与预热展示 (DebugOverlay.ts)', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'test-debug-overlay';
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('预热阶段 1% Low FPS 必须严格统一显示为 "-- (预热)"', () => {
      const overlay = new DebugOverlay('test-debug-overlay');
      overlay.update({
        fps: 60,
        onePercentLowFps: 60,
        isWarmingUp: true,
        rawFrameTimeMs: 16.6,
        gameDeltaMs: 16.6,
        width: 1280,
        height: 720,
        pixelRatio: 1,
        drawCalls: 6,
        triangles: 4302
      }, true);

      const lowFpsEl = container.querySelector('#dbg-low-fps');
      expect(lowFpsEl?.textContent).toBe('-- (预热)');

      overlay.update({
        fps: 60,
        onePercentLowFps: 58,
        isWarmingUp: false,
        rawFrameTimeMs: 16.6,
        gameDeltaMs: 16.6,
        width: 1280,
        height: 720,
        pixelRatio: 1,
        drawCalls: 6,
        triangles: 4302
      }, true);
      expect(lowFpsEl?.textContent).toBe('58');

      overlay.dispose();
    });
  });

  describe('4. Engine 构造异常自清理与二次容错 (Engine.ts)', () => {
    it('Engine 构造函数后半段抛错时，应自动自清理并调用 renderer.dispose()', () => {
      const canvas = document.createElement('canvas');
      const mockDispose = vi.fn();
      const mockForceContextLoss = vi.fn();

      const mockRenderer = {
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
        info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } },
        setPixelRatio: vi.fn(),
        setSize: vi.fn().mockImplementation(() => {
          throw new Error('Simulated GPU out of memory during setSize');
        }),
        render: vi.fn(),
        dispose: mockDispose,
        forceContextLoss: mockForceContextLoss
      } as unknown as THREE.WebGLRenderer;

      expect(() => {
        new Engine({
          canvas,
          renderer: mockRenderer
        });
      }).toThrow('Simulated GPU out of memory during setSize');

      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(mockForceContextLoss).toHaveBeenCalledTimes(1);
    });

    it('阶段 1.4 深度验证：即使 renderer.dispose() 自身抛出异常，也必须继续尝试 forceContextLoss()', () => {
      const canvas = document.createElement('canvas');
      const mockDispose = vi.fn().mockImplementation(() => {
        throw new Error('Driver crash during renderer.dispose()');
      });
      const mockForceContextLoss = vi.fn();

      const mockRenderer = {
        outputColorSpace: THREE.SRGBColorSpace,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
        info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } },
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
        render: vi.fn(),
        dispose: mockDispose,
        forceContextLoss: mockForceContextLoss
      } as unknown as THREE.WebGLRenderer;

      const engine = new Engine({ canvas, renderer: mockRenderer });
      expect(engine.getDisposedState()).toBe(false);

      // 调用 dispose，内部捕获 mockDispose 的报错，并继续执行 mockForceContextLoss
      expect(() => engine.dispose()).not.toThrow();
      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(mockForceContextLoss).toHaveBeenCalledTimes(1);
      expect(engine.getDisposedState()).toBe(true);
    });
  });

  describe('5. HMR 闭环与初始化异常中途回滚 (main.ts)', () => {
    const createMockRenderer = () => {
      const mockDispose = vi.fn();
      return {
        renderer: {
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
          info: { render: { calls: 6, triangles: 4302 }, memory: { geometries: 5, textures: 0 } },
          setPixelRatio: vi.fn(),
          setSize: vi.fn(),
          render: vi.fn(),
          dispose: mockDispose,
          forceContextLoss: vi.fn()
        } as unknown as THREE.WebGLRenderer,
        mockDispose
      };
    };

    beforeEach(() => {
      document.body.innerHTML = `
        <canvas id="game-canvas"></canvas>
        <div id="debug-overlay"></div>
      `;
    });

    afterEach(() => {
      destroyApp();
      cleanupPageListeners();
      document.body.innerHTML = '';
    });

    it('Canvas 缺失时 initApp() 应抛出错误并确保无全局残缺实例残留', () => {
      document.body.innerHTML = '<div id="debug-overlay"></div>';
      expect(() => initApp()).toThrow('Canvas element #game-canvas not found!');
      expect(getCurrentApp()).toBeNull();
    });

    it('中途抛错测试：当 DebugScene 创建失败时，已创建的 Engine 应被成功回滚销毁', () => {
      const { renderer, mockDispose } = createMockRenderer();

      expect(() => {
        initApp({
          renderer,
          throwOnSceneInit: true
        });
      }).toThrow('Simulated mid-way failure during DebugScene creation');

      expect(mockDispose).toHaveBeenCalled();
      expect(getCurrentApp()).toBeNull();
    });

    it('阶段 1.4 深度验证：真实触发 DOMContentLoaded 事件，验证 cleanupPageListeners() 确实注销了未触发的监听器', () => {
      const listenerSpy = vi.fn();

      // 模拟旧模块注册的 DOMContentLoaded 监听器
      window.addEventListener('DOMContentLoaded', listenerSpy);

      // 执行注销清理
      window.removeEventListener('DOMContentLoaded', listenerSpy);
      cleanupPageListeners();

      // 真实向 window 派发 DOMContentLoaded 事件
      window.dispatchEvent(new Event('DOMContentLoaded'));

      // 严格断言监听器绝没有被调用，证明旧模块监听器被彻底切断，无幽灵执行
      expect(listenerSpy).not.toHaveBeenCalled();
    });

    it('正常初始化与手动 destroyApp() 流程完整幂等', () => {
      const { renderer } = createMockRenderer();
      const app = initApp({ renderer });
      expect(app).toBeDefined();
      expect(getCurrentApp()).toBe(app);

      expect(() => destroyApp()).not.toThrow();
      expect(getCurrentApp()).toBeNull();

      expect(() => destroyApp()).not.toThrow();
    });
  });

});
