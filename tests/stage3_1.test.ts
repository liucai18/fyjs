import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { RaceManager, RaceState } from '../src/race/RaceManager';
import { RaceHUD } from '../src/ui/RaceHUD';
import { VehicleController } from '../src/vehicle/VehicleController';
import { HoverRacer } from '../src/vehicle/HoverRacer';
import { Input } from '../src/core/Input';

describe('阶段 3.1 · 核心竞速闭环自动化测试套件 (stage3_1.test.ts)', () => {

  describe('1. 比赛状态机与倒计时油门锁死 (RaceManager.ts)', () => {
    let race: RaceManager;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 3.0 });
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      race.reset(controller);
    });

    afterEach(() => {
      race.dispose();
      controller.dispose();
    });

    it('reset() 能够将赛车重置到起跑线后方并启动倒计时', () => {
      expect(race.getState()).toBe(RaceState.COUNTDOWN);
      expect(race.getCountdownTimer()).toBe(3.0);
      expect(race.getRaceTime()).toBe(0);
      expect(controller.group.position.x).toBe(65);
      expect(controller.group.position.z).toBe(-25);
    });

    it('倒计时期间强制锁死赛车动力，严禁抢跑', () => {
      // 模拟倒计时 1 秒 (剩余 2.0s)
      race.update(1.0, controller);
      expect(race.getState()).toBe(RaceState.COUNTDOWN);
      expect(race.getCountdownTimer()).toBeCloseTo(2.0, 1);
      // 车辆强行处于起跑线，速度为 0
      expect(controller.getSpeed()).toBe(0);
      expect(controller.group.position.z).toBe(-25);

      // 尝试外部施加位移
      controller.group.position.z += 5;
      race.update(0.5, controller);
      // 应被立即拉回起跑线
      expect(controller.group.position.z).toBe(-25);
    });

    it('倒计时与 GO 阶段完整展示并平滑进入 RACING 状态', () => {
      // 推进 3.0s (3-2-1 走完，进入 GO 阶段)
      race.update(3.0, controller);
      expect(race.isGoPhase()).toBe(true);
      expect(race.getCountdownDisplay().text).toBe('GO!');
      expect(race.isControlLocked()).toBe(false); // GO 阶段控制已解锁

      // GO 展示 0.5s 走完，平滑进入 RACING
      race.update(0.55, controller);
      expect(race.getState()).toBe(RaceState.RACING);
      expect(race.isGoPhase()).toBe(false);
      expect(race.getCountdownDisplay().text).toBe('');
    });

    it('getCountdownDisplay() 文本完整流转 3 -> 2 -> 1 -> GO! 且计时起点与 GO 同步', () => {
      race.startCountdown();
      expect(race.getCountdownDisplay().text).toBe('3');
      expect(race.isControlLocked()).toBe(true);

      // 推进 1.1s (剩余 1.9s) -> 显示 2
      race.update(1.1, controller);
      expect(race.getCountdownDisplay().text).toBe('2');
      expect(race.getRaceTime()).toBe(0);

      // 推进 1.0s (剩余 0.9s) -> 显示 1
      race.update(1.0, controller);
      expect(race.getCountdownDisplay().text).toBe('1');
      expect(race.getRaceTime()).toBe(0);

      // 推进 0.95s -> 进入 GO! 阶段 (剩余 -0.05s)
      race.update(0.95, controller);
      expect(race.getCountdownDisplay().text).toBe('GO!');
      expect(race.isGoPhase()).toBe(true);
      // 正式计时起点必须与 GO 的竞速开始时刻一致
      expect(race.getRaceTime()).toBeCloseTo(0.05, 2);
    });

    it('startCountdown() 具备严密状态守卫，非 READY 状态禁止启动', () => {
      // 当前处于 COUNTDOWN 状态
      expect(race.getState()).toBe(RaceState.COUNTDOWN);
      race.startCountdown();
      expect(race.getState()).toBe(RaceState.COUNTDOWN);

      // 推进到 RACING
      race.update(3.6, controller);
      expect(race.getState()).toBe(RaceState.RACING);
      // RACING 状态下调用 startCountdown 应被拒绝
      race.startCountdown();
      expect(race.getState()).toBe(RaceState.RACING);
    });
  });

  describe('2. 高精度单调比赛计时与暂停冻结 (RaceManager.ts)', () => {
    let race: RaceManager;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 0.1 });
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      // 快速进入 RACING (0.1s 倒计时 + 0.5s GO 展示 = 0.6s)
      race.startCountdown();
      race.update(0.65, controller);
    });

    afterEach(() => {
      race.dispose();
      controller.dispose();
    });

    it('RACING 状态下真实比赛时间精确累加', () => {
      expect(race.getState()).toBe(RaceState.RACING);
      const initialTime = race.getRaceTime();
      race.update(0.5, controller);
      expect(race.getRaceTime()).toBeCloseTo(initialTime + 0.5, 2);

      race.update(1.25, controller);
      expect(race.getRaceTime()).toBeCloseTo(initialTime + 1.75, 2);
    });

    it('PAUSED 状态下计时完全冻结，恢复后继续无跳秒', () => {
      race.update(1.0, controller);
      const pausedTime = race.getRaceTime();

      // 触发暂停
      race.pause();
      expect(race.getState()).toBe(RaceState.PAUSED);

      // 暂停期间推进时间
      race.update(2.0, controller);
      expect(race.getRaceTime()).toBe(pausedTime); // 时间绝对不变

      // 恢复比赛
      race.resume();
      expect(race.getState()).toBe(RaceState.RACING);

      race.update(0.5, controller);
      expect(race.getRaceTime()).toBeCloseTo(pausedTime + 0.5, 2);
    });

    it('RaceManager.formatTime() 格式化时间为 MM:SS.mmm', () => {
      expect(RaceManager.formatTime(0)).toBe('00:00.000');
      expect(RaceManager.formatTime(5.421)).toBe('00:05.421');
      expect(RaceManager.formatTime(65.123)).toBe('01:05.123');
      expect(RaceManager.formatTime(3661.045)).toBe('61:01.045');
    });
  });

  describe('3. 前后帧扫掠连续穿线算法与检查点门禁 (RaceManager.ts)', () => {
    let race: RaceManager;

    beforeEach(() => {
      race = new RaceManager();
    });

    afterEach(() => {
      race.dispose();
    });

    it('正向穿线 (z < 0 到 z >= 0) 且在赛道范围内应判定成功', () => {
      const p1 = new THREE.Vector3(65, 0.45, -0.8);
      const p2 = new THREE.Vector3(65, 0.45, 1.2);
      expect(race.checkFinishLineCrossing(p1, p2)).toBe(true);
    });

    it('高速大步长跨线 (单帧 6m 跨越) 不漏检', () => {
      const p1 = new THREE.Vector3(65, 0.45, -3.0);
      const p2 = new THREE.Vector3(65, 0.45, 3.0);
      expect(race.checkFinishLineCrossing(p1, p2)).toBe(true);
    });

    it('反向倒车穿越 (z > 0 到 z < 0) 绝不触发冲线', () => {
      const p1 = new THREE.Vector3(65, 0.45, 1.0);
      const p2 = new THREE.Vector3(65, 0.45, -1.0);
      expect(race.checkFinishLineCrossing(p1, p2)).toBe(false);
    });

    it('赛道外部越界穿线 (x 超出护栏) 不触发冲线', () => {
      const p1 = new THREE.Vector3(85, 0.45, -1.0); // 赛道外
      const p2 = new THREE.Vector3(85, 0.45, 1.0);
      expect(race.checkFinishLineCrossing(p1, p2)).toBe(false);
    });

    it('原地小幅抖动未跨过 z=0 不触发穿线', () => {
      const p1 = new THREE.Vector3(65, 0.45, -2.0);
      const p2 = new THREE.Vector3(65, 0.45, -0.1);
      expect(race.checkFinishLineCrossing(p1, p2)).toBe(false);
    });
  });

  describe('4. 完整单圈比赛循环与作弊拦截 (RaceManager.ts)', () => {
    let race: RaceManager;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 0.1 });
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      race.reset(controller);
      // 快速进入正式比赛 (0.1s 倒计时 + 0.5s GO 展示 = 0.6s)
      race.update(0.65, controller);
    });

    afterEach(() => {
      race.dispose();
      controller.dispose();
    });

    it('刚起步未经检查点跨线不触发 FINISHED 完赛', () => {
      // 车辆从起跑线 (z = -25) 往前开穿过起点线 (z = 0)
      controller.setTransform(65, 0.45, -5, 0);
      race.update(0.016, controller);

      controller.setTransform(65, 0.45, 5, 0);
      race.update(0.016, controller);

      // 因为检查点数量为 0，不能直接算完成比赛
      expect(race.getPassedCheckpointsCount()).toBe(0);
      expect(race.getState()).toBe(RaceState.RACING);
    });

    it('必须按顺序激活 3 处检查点后冲线，才正式结算 FINISHED', () => {
      // 1. 到达检查点 1 (北大弯: x=0, z=175)
      controller.setTransform(0, 0.45, 175, 0);
      race.update(0.016, controller);
      expect(race.getPassedCheckpointsCount()).toBe(1);

      // 2. 到达检查点 2 (西直道: x=-65, z=0)
      controller.setTransform(-65, 0.45, 0, 0);
      race.update(0.016, controller);
      expect(race.getPassedCheckpointsCount()).toBe(2);

      // 3. 到达检查点 3 (南大弯: x=0, z=-175)
      controller.setTransform(0, 0.45, -175, 0);
      race.update(0.016, controller);
      expect(race.getPassedCheckpointsCount()).toBe(3);

      // 4. 正向冲过终点线 (东直道起点龙门架: x=65, z=0)
      controller.setTransform(65, 0.45, -2, 0);
      race.update(0.016, controller);
      controller.setTransform(65, 0.45, 2, 0);
      race.update(0.016, controller);

      expect(race.getState()).toBe(RaceState.FINISHED);
      expect(race.getRaceTime()).toBeGreaterThan(0);
    });
  });

  describe('5. 竞速 HUD 与完赛结算弹窗 (RaceHUD.ts)', () => {
    let race: RaceManager;
    let racer: HoverRacer;
    let controller: VehicleController;
    let hud: RaceHUD;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 3.0 });
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      race.reset(controller);
      hud = new RaceHUD('test-race-hud');
    });

    afterEach(() => {
      hud.dispose();
      race.dispose();
      controller.dispose();
    });

    it('HUD 元素应成功挂载并展示倒计时', () => {
      hud.update(race);
      const countdownEl = document.getElementById('race-countdown');
      expect(countdownEl).not.toBeNull();
      expect(countdownEl?.style.display).toBe('block');
      expect(countdownEl?.innerText).toBe('3');
    });

    it('完赛时应显示结算面板与成绩', () => {
      // 模拟完赛
      (race as any).state = RaceState.FINISHED;
      (race as any).raceTime = 48.765;
      (race as any).topSpeedKmh = 188.5;

      hud.update(race);
      const modal = document.getElementById('race-result-modal');
      const finalTime = document.getElementById('race-final-time');
      const finalSpeed = document.getElementById('race-final-speed');

      expect(modal?.style.display).toBe('flex');
      expect(finalTime?.innerText).toBe('00:48.765');
      expect(finalSpeed?.innerText).toBe('189 km/h');
    });

    it('GO 阶段时 HUD 应展示绿色 GO! 横幅与高亮动效', () => {
      // 推进至 GO 阶段 (3.0s 倒计时走完，进入 GO 阶段)
      race.update(3.05, controller);
      expect(race.isGoPhase()).toBe(true);

      hud.update(race);
      const countdownEl = document.getElementById('race-countdown');
      expect(countdownEl?.style.display).toBe('block');
      expect(countdownEl?.innerText).toBe('GO!');
      expect(countdownEl?.classList.contains('race-countdown-go')).toBe(true);
    });

    it('dispose() 彻底移除 DOM 节点，保证幂等性', () => {
      expect(hud.getDisposedState()).toBe(false);
      hud.dispose();
      expect(hud.getDisposedState()).toBe(true);
      expect(document.getElementById('test-race-hud')).toBeNull();
      expect(() => hud.dispose()).not.toThrow();
    });
  });

  describe('6. 动作键长按防重复过滤 (Input.ts)', () => {
    let input: Input;

    beforeEach(() => {
      input = new Input();
    });

    afterEach(() => {
      input.dispose();
    });

    it('长按 R 键不会反复触发 reset 动作', () => {
      const onReset = vi.fn();
      input.onAction('reset', onReset);

      // 首次按下 (e.repeat = false)
      input.triggerKeyDown('KeyR', false);
      expect(onReset).toHaveBeenCalledTimes(1);

      // 长按产生的重复事件 (e.repeat = true)
      input.triggerKeyDown('KeyR', true);
      input.triggerKeyDown('KeyR', true);
      input.triggerKeyDown('KeyR', true);
      // 仍然只触发 1 次，严禁无限重启
      expect(onReset).toHaveBeenCalledTimes(1);

      // 松开后重新按下，应可再次触发
      input.triggerKeyUp('KeyR');
      input.triggerKeyDown('KeyR', false);
      expect(onReset).toHaveBeenCalledTimes(2);
    });

    it('长按 P 或 Escape 键不会反复切换暂停状态', () => {
      const onPause = vi.fn();
      input.onAction('pause', onPause);

      // 首次按下 KeyP
      input.triggerKeyDown('KeyP', false);
      expect(onPause).toHaveBeenCalledTimes(1);

      // KeyP 长按自动重复 (e.repeat = true)
      input.triggerKeyDown('KeyP', true);
      input.triggerKeyDown('KeyP', true);
      expect(onPause).toHaveBeenCalledTimes(1);

      // 首次按下 Escape
      input.triggerKeyUp('KeyP');
      input.triggerKeyDown('Escape', false);
      expect(onPause).toHaveBeenCalledTimes(2);

      // Escape 长按自动重复
      input.triggerKeyDown('Escape', true);
      expect(onPause).toHaveBeenCalledTimes(2);
    });
  });

  describe('7. 完赛状态车辆锁定与重试完整竞速闭环 (RaceManager.ts & VehicleController.ts)', () => {
    let race: RaceManager;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 0.1 });
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      race.reset(controller);
      race.update(0.65, controller); // 快速进入 RACING
    });

    afterEach(() => {
      race.dispose();
      controller.dispose();
    });

    it('完赛后车辆控制与物理必须完全锁定，成绩冻结不变', () => {
      // 模拟跑完 3 个检查点并冲线
      controller.setTransform(0, 0.45, 175, 0);
      race.update(0.016, controller);
      controller.setTransform(-65, 0.45, 0, 0);
      race.update(0.016, controller);
      controller.setTransform(0, 0.45, -175, 0);
      race.update(0.016, controller);

      controller.setTransform(65, 0.45, -2, 0);
      race.update(0.016, controller);
      controller.setTransform(65, 0.45, 2, 0);
      race.update(0.016, controller);

      expect(race.getState()).toBe(RaceState.FINISHED);
      expect(race.isControlLocked()).toBe(true);
      const finishedTime = race.getRaceTime();

      // 完赛状态下推进时间，成绩绝对不变
      race.update(1.0, controller);
      expect(race.getRaceTime()).toBe(finishedTime);

      // 完赛状态重置赛车动力学，速度归零
      controller.resetDynamics();
      expect(controller.getSpeed()).toBe(0);
    });

    it('重试后赛车复位起跑线并能完整跑完第二圈竞速闭环', () => {
      // 跑完第 1 圈
      controller.setTransform(0, 0.45, 175, 0);
      race.update(0.016, controller);
      controller.setTransform(-65, 0.45, 0, 0);
      race.update(0.016, controller);
      controller.setTransform(0, 0.45, -175, 0);
      race.update(0.016, controller);
      controller.setTransform(65, 0.45, -2, 0);
      race.update(0.016, controller);
      controller.setTransform(65, 0.45, 2, 0);
      race.update(0.016, controller);

      expect(race.getState()).toBe(RaceState.FINISHED);

      // 执行 R 键重试重置
      race.reset(controller);
      expect(race.getState()).toBe(RaceState.COUNTDOWN);
      expect(race.getRaceTime()).toBe(0);
      expect(race.getPassedCheckpointsCount()).toBe(0);
      expect(controller.group.position.x).toBe(65);
      expect(controller.group.position.z).toBe(-25);

      // 走完倒计时与 GO 阶段，进入第 2 圈 RACING
      race.update(0.65, controller);
      expect(race.getState()).toBe(RaceState.RACING);

      // 完整跑完第 2 圈检查点与冲线
      controller.setTransform(0, 0.45, 175, 0);
      race.update(0.016, controller);
      controller.setTransform(-65, 0.45, 0, 0);
      race.update(0.016, controller);
      controller.setTransform(0, 0.45, -175, 0);
      race.update(0.016, controller);
      controller.setTransform(65, 0.45, -2, 0);
      race.update(0.016, controller);
      controller.setTransform(65, 0.45, 2, 0);
      race.update(0.016, controller);

      // 第 2 圈成功结算
      expect(race.getState()).toBe(RaceState.FINISHED);
      expect(race.getRaceTime()).toBeGreaterThan(0);
    });
  });

});
