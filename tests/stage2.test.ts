import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Input } from '../src/core/Input';
import { HoverRacer } from '../src/vehicle/HoverRacer';
import { VehicleController } from '../src/vehicle/VehicleController';
import { FollowCamera } from '../src/camera/FollowCamera';
import { TrackScene } from '../src/scene/TrackScene';

describe('阶段 2 原创科幻飞车与基础驾驶动力学自动化测试', () => {

  describe('1. 键盘输入系统 (Input.ts)', () => {
    let input: Input;

    beforeEach(() => {
      input = new Input();
    });

    afterEach(() => {
      input.dispose();
    });

    it('默认初始状态下所有按键均为 false', () => {
      const state = input.getState();
      expect(state.forward).toBe(false);
      expect(state.backward).toBe(false);
      expect(state.left).toBe(false);
      expect(state.right).toBe(false);
      expect(state.brake).toBe(false);
    });

    it('支持 WASD 键位正确响应', () => {
      input.triggerKeyDown('KeyW');
      expect(input.getState().forward).toBe(true);
      input.triggerKeyUp('KeyW');
      expect(input.getState().forward).toBe(false);

      input.triggerKeyDown('KeyA');
      expect(input.getState().left).toBe(true);
      input.triggerKeyUp('KeyA');

      input.triggerKeyDown('KeyD');
      expect(input.getState().right).toBe(true);
      input.triggerKeyUp('KeyD');

      input.triggerKeyDown('KeyS');
      expect(input.getState().backward).toBe(true);
      input.triggerKeyUp('KeyS');
    });

    it('支持方向键 (Arrow Keys) 备用键位响应', () => {
      input.triggerKeyDown('ArrowUp');
      expect(input.getState().forward).toBe(true);
      input.triggerKeyDown('ArrowLeft');
      expect(input.getState().left).toBe(true);
      input.triggerKeyUp('ArrowUp');
      expect(input.getState().forward).toBe(false);
    });

    it('窗口失焦 (window.blur) 应自动清空所有按键，杜绝卡键', () => {
      input.triggerKeyDown('KeyW');
      input.triggerKeyDown('KeyD');
      expect(input.getState().forward).toBe(true);

      window.dispatchEvent(new Event('blur'));

      expect(input.getState().forward).toBe(false);
      expect(input.getState().right).toBe(false);
    });

    it('dispose() 应正确解绑所有事件', () => {
      expect(input.getDisposedState()).toBe(false);
      input.dispose();
      expect(input.getDisposedState()).toBe(true);

      // 再次调用幂等安全
      expect(() => input.dispose()).not.toThrow();
    });
  });

  describe('2. 反重力飞车模型与材质 (HoverRacer.ts)', () => {
    let racer: HoverRacer;

    beforeEach(() => {
      racer = new HoverRacer();
    });

    afterEach(() => {
      racer.dispose();
    });

    it('飞车模型应包含车身、导流翼、座舱和双推进器节点', () => {
      expect(racer.group).toBeDefined();
      expect(racer.bodyGroup).toBeDefined();
      expect(racer.bodyGroup.children.length).toBeGreaterThan(10);
    });

    it('setThrottle() 能够动态响应并保持在 [0, 1] 安全区间', () => {
      expect(() => racer.setThrottle(0)).not.toThrow();
      expect(() => racer.setThrottle(1.0)).not.toThrow();
      expect(() => racer.setThrottle(2.5)).not.toThrow(); // 超界自动 clamp
      expect(() => racer.setThrottle(-0.5)).not.toThrow();
    });

    it('setSteering() 能够动态设置侧倾偏角并保持在 [-1, 1]', () => {
      expect(() => racer.setSteering(0.8)).not.toThrow();
      expect(() => racer.setSteering(-1.5)).not.toThrow();
    });

    it('update() 执行悬浮微运动不产生 NaN 或异常', () => {
      racer.update(0.016);
      expect(racer.bodyGroup.position.y).toBeGreaterThan(0.2);
      expect(Number.isNaN(racer.bodyGroup.position.y)).toBe(false);
    });

    it('dispose() 具备完全幂等性并清空几何体与材质', () => {
      expect(racer.getDisposedState()).toBe(false);
      racer.dispose();
      expect(racer.getDisposedState()).toBe(true);
      expect(racer.bodyGroup.children.length).toBe(0);

      // 重复调用不报错
      expect(() => racer.dispose()).not.toThrow();
    });
  });

  describe('3. 车辆驾驶动力学控制器 (VehicleController.ts)', () => {
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      racer = new HoverRacer();
      controller = new VehicleController(racer, {
        maxSpeed: 60,
        acceleration: 30,
        brakeDeceleration: 40,
        dragDeceleration: 10,
        steerSpeed: 2.0
      });
    });

    afterEach(() => {
      controller.dispose();
    });

    it('前进加速逻辑：按 W 键速度连续递增，不超过 maxSpeed', () => {
      const input = { forward: true, backward: false, left: false, right: false, brake: false };

      expect(controller.getSpeed()).toBe(0);
      // 模拟前进加速 10 帧 (每帧 0.05s)
      for (let i = 0; i < 10; i++) {
        controller.update(0.05, input);
      }

      expect(controller.getSpeed()).toBeGreaterThan(10);
      expect(controller.getSpeedKmh()).toBeGreaterThan(36);

      // 持续加速到达极速
      for (let i = 0; i < 40; i++) {
        controller.update(0.05, input);
      }
      expect(controller.getSpeed()).toBeLessThanOrEqual(60);
    });

    it('倒车与刹车逻辑：前进时按 S 减速刹车，归零后倒车', () => {
      controller.setTransform(0, 0, 0, 0);
      // 先加速多帧到较高速度
      for (let i = 0; i < 20; i++) {
        controller.update(0.05, { forward: true, backward: false, left: false, right: false, brake: false });
      }
      const initialSpeed = controller.getSpeed();
      expect(initialSpeed).toBeGreaterThan(20);

      // 按 S 刹车
      for (let i = 0; i < 5; i++) {
        controller.update(0.05, { forward: false, backward: true, left: false, right: false, brake: false });
      }
      expect(controller.getSpeed()).toBeLessThan(initialSpeed);
    });

    it('自然阻尼滑行：无输入时车速平稳衰减', () => {
      for (let i = 0; i < 20; i++) {
        controller.update(0.05, { forward: true, backward: false, left: false, right: false, brake: false });
      }
      const peakSpeed = controller.getSpeed();

      // 无输入滑行
      for (let i = 0; i < 10; i++) {
        controller.update(0.05, { forward: false, backward: false, left: false, right: false, brake: false });
      }
      expect(controller.getSpeed()).toBeLessThan(peakSpeed);
      expect(controller.getSpeed()).toBeGreaterThan(0);
    });

    it('转向逻辑：有速度时按 A/D 产生连续航向角 (Yaw) 变化', () => {
      // 先赋予前进初速度
      controller.update(0.5, { forward: true, backward: false, left: false, right: false, brake: false });

      const initialYaw = controller.getYaw();
      // 向左转向
      controller.update(0.5, { forward: true, backward: false, left: true, right: false, brake: false });

      expect(controller.getYaw()).not.toBe(initialYaw);
    });

    it('applyBounce() 碰撞反弹能够位移车辆并施加减速惩罚', () => {
      controller.update(1.0, { forward: true, backward: false, left: false, right: false, brake: false });
      const speedBefore = controller.getSpeed();
      const posBeforeX = controller.group.position.x;

      controller.applyBounce(-2.0, 0);

      expect(controller.group.position.x).toBe(posBeforeX - 2.0);
      expect(controller.getSpeed()).toBeLessThan(speedBefore);
    });
  });

  describe('4. 第三人称平滑智能跟随相机 (FollowCamera.ts)', () => {
    let camera: THREE.PerspectiveCamera;
    let targetGroup: THREE.Group;
    let followCam: FollowCamera;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
      targetGroup = new THREE.Group();
      targetGroup.position.set(0, 0, 0);
      followCam = new FollowCamera(camera);
    });

    afterEach(() => {
      followCam.dispose();
    });

    it('follow() 与 snap() 能够使摄像机立即就位在车辆后上方', () => {
      followCam.follow(targetGroup);
      expect(camera.position.z).toBeLessThan(0); // 位于车辆后方 (-Z)
      expect(camera.position.y).toBeGreaterThan(1.5); // 位于车辆上方 (+Y)
    });

    it('update() 执行平滑阻尼追随，绝无 NaN 或位置失控', () => {
      followCam.follow(targetGroup);

      // 模拟车辆向前移动
      targetGroup.position.z += 10;
      targetGroup.rotation.y = 0.5;

      followCam.update(0.016, 30);

      expect(Number.isNaN(camera.position.x)).toBe(false);
      expect(Number.isNaN(camera.position.y)).toBe(false);
      expect(Number.isNaN(camera.position.z)).toBe(false);
    });

    it('极速状态下动态拉伸 FOV，低速时恢复基准视野', () => {
      followCam.follow(targetGroup);
      const initialFov = camera.fov;

      // 极速 60 m/s 狂飙
      for (let i = 0; i < 10; i++) {
        followCam.update(0.1, 60);
      }
      expect(camera.fov).toBeGreaterThan(initialFov);

      // 静止怠速
      for (let i = 0; i < 20; i++) {
        followCam.update(0.1, 0);
      }
      expect(camera.fov).toBeCloseTo(initialFov, 0);
    });
  });

  describe('5. 可驾驶赛道与物理护栏碰撞约束 (TrackScene.ts)', () => {
    let track: TrackScene;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      track = new TrackScene();
      racer = new HoverRacer();
      controller = new VehicleController(racer);
    });

    afterEach(() => {
      track.dispose();
      controller.dispose();
    });

    it('赛道应包含直道、弯道护栏、起跑线门架与环境光', () => {
      expect(track.group).toBeDefined();
      expect(track.straightLength).toBe(220);
      expect(track.radius).toBe(65);
      expect(track.trackWidth).toBe(20);
    });

    it('直道边界碰撞：当飞车企图冲破东直道右侧护栏时，自动被反弹阻断', () => {
      // 东直道中心为 x = 65, 赛道宽 20 (半宽 10)
      // 将飞车放置在超越右护栏的位置 x = 76 (> 75)
      controller.setTransform(76.5, 0.45, 10, 0);
      controller.update(0.016, { forward: true, backward: false, left: false, right: false, brake: false });

      track.checkBoundaryCollision(controller);

      // 应被反弹回赛道内侧 (< 75)
      expect(controller.group.position.x).toBeLessThan(76.0);
    });

    it('弯道边界碰撞：当飞车企图冲破大弯道外圈护栏时，自动被反弹阻断', () => {
      // 北半圆中心为 (0, straightLength/2 = 110)
      // 弯道半径 65，外护栏半径为 65 + 10 = 75
      // 放置在距离中心 78 的越界位置
      controller.setTransform(0, 0.45, 110 + 78, 0);

      track.checkBoundaryCollision(controller);

      // 应当被沿法线推回赛道内
      expect(controller.group.position.z).toBeLessThan(110 + 78);
    });

    it('dispose() 支持幂等安全释放', () => {
      expect(track.getDisposedState()).toBe(false);
      track.dispose();
      expect(track.getDisposedState()).toBe(true);
      expect(() => track.dispose()).not.toThrow();
    });
  });

});
