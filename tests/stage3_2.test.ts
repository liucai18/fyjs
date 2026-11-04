import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { NitroSystem, DEFAULT_NITRO_CONFIG } from '../src/vehicle/NitroSystem';
import { VehicleController } from '../src/vehicle/VehicleController';
import { HoverRacer } from '../src/vehicle/HoverRacer';
import { RaceManager, RaceState } from '../src/race/RaceManager';
import { RaceHUD } from '../src/ui/RaceHUD';
import { Input } from '../src/core/Input';

describe('阶段 3.2 · 氮气加速系统自动化测试套件 (stage3_2.test.ts)', () => {

  describe('1. 氮气能量系统核心数学与状态守卫 (NitroSystem.ts)', () => {
    let nitro: NitroSystem;

    beforeEach(() => {
      nitro = new NitroSystem();
    });

    afterEach(() => {
      nitro.dispose();
    });

    it('初始能量必须为 100%，未激活加速', () => {
      expect(nitro.getEnergy()).toBe(100);
      expect(nitro.getEnergyRatio()).toBe(1.0);
      expect(nitro.getEnergyPercent()).toBe(100);
      expect(nitro.isBoosting()).toBe(false);
    });

    it('参数集中配置无硬编码，可自定义覆盖', () => {
      expect(DEFAULT_NITRO_CONFIG.maxEnergy).toBe(100);
      expect(DEFAULT_NITRO_CONFIG.consumptionRate).toBe(25);
      expect(DEFAULT_NITRO_CONFIG.rechargeRate).toBe(10);
      expect(DEFAULT_NITRO_CONFIG.boostTopSpeedKmh).toBe(270);

      const customNitro = new NitroSystem({ consumptionRate: 50, rechargeRate: 20 });
      expect(customNitro.config.consumptionRate).toBe(50);
      expect(customNitro.config.rechargeRate).toBe(20);
      customNitro.dispose();
    });

    it('允许驾驶且按住 Shift 时持续线性消耗能量 (25%/s)', () => {
      // 推进 1 秒 (消耗 25%)
      nitro.update(1.0, true, true, false);
      expect(nitro.isBoosting()).toBe(true);
      expect(nitro.getEnergy()).toBeCloseTo(75, 1);
      expect(nitro.getEnergyPercent()).toBe(75);

      // 再推进 2 秒 (消耗 50%)
      nitro.update(2.0, true, true, false);
      expect(nitro.isBoosting()).toBe(true);
      expect(nitro.getEnergy()).toBeCloseTo(25, 1);
    });

    it('松开 Shift 后立即停止加速并以 10%/s 自动充能', () => {
      // 先消耗到 50%
      nitro.update(2.0, true, true, false);
      expect(nitro.getEnergy()).toBeCloseTo(50, 1);

      // 松开 Shift 1 秒 (恢复 10%)
      nitro.update(1.0, false, true, false);
      expect(nitro.isBoosting()).toBe(false);
      expect(nitro.getEnergy()).toBeCloseTo(60, 1);

      // 再恢复 2 秒 (恢复 20%)
      nitro.update(2.0, false, true, false);
      expect(nitro.getEnergy()).toBeCloseTo(80, 1);
    });

    it('能量耗尽 (0%) 必须自动强制停止氮气加速', () => {
      // 连续消耗 4.5 秒 (4 秒即耗尽 100%)
      nitro.update(4.5, true, true, false);
      expect(nitro.getEnergy()).toBe(0);
      expect(nitro.getEnergyPercent()).toBe(0);
      expect(nitro.isBoosting()).toBe(false); // 强制断气

      // 持续按住 Shift 但由于能量为 0，不能重新激活
      nitro.update(0.5, true, true, false);
      expect(nitro.isBoosting()).toBe(false);
      expect(nitro.getEnergy()).toBe(0);
    });

    it('能量上限封顶，绝对不得超过 100%', () => {
      // 满能量下持续恢复 5 秒
      nitro.update(5.0, false, true, false);
      expect(nitro.getEnergy()).toBe(100);
      expect(nitro.getEnergyRatio()).toBe(1.0);
    });

    it('reset() 能够干净重置能量回到 100% 初始满槽状态', () => {
      nitro.update(3.0, true, true, false);
      expect(nitro.getEnergy()).toBeCloseTo(25, 1);
      expect(nitro.isBoosting()).toBe(true);

      nitro.reset();
      expect(nitro.getEnergy()).toBe(100);
      expect(nitro.isBoosting()).toBe(false);
    });
  });

  describe('2. 比赛状态机与状态门禁约束 (NitroSystem.ts & RaceManager.ts)', () => {
    let race: RaceManager;
    let nitro: NitroSystem;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 3.0 });
      nitro = new NitroSystem();
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      race.reset(controller);
    });

    afterEach(() => {
      race.dispose();
      nitro.dispose();
      controller.dispose();
    });

    it('READY 与 COUNTDOWN 3-2-1 阶段无法消耗氮气，禁止抢跑', () => {
      expect(race.getState()).toBe(RaceState.COUNTDOWN);
      expect(race.isControlLocked()).toBe(true);

      // 模拟玩家在 3-2-1 期间狂按 Shift
      const canDrive = !race.isControlLocked();
      nitro.update(1.0, true, canDrive, false);

      // 能量未被消耗，加速未被激活
      expect(nitro.getEnergy()).toBe(100);
      expect(nitro.isBoosting()).toBe(false);
    });

    it('GO! 发车阶段控制解锁，允许启动氮气加速', () => {
      // 推进 3.0s 走完 3-2-1 进入 GO 阶段
      race.update(3.0, controller);
      expect(race.isGoPhase()).toBe(true);
      expect(race.isControlLocked()).toBe(false);

      const canDrive = !race.isControlLocked();
      nitro.update(0.2, true, canDrive, false);

      expect(nitro.isBoosting()).toBe(true);
      expect(nitro.getEnergy()).toBeLessThan(100);
    });

    it('PAUSED 状态下绝对冻结能量变化，既不消耗也不恢复', () => {
      // 快速进入 RACING
      race.update(3.6, controller);
      expect(race.getState()).toBe(RaceState.RACING);

      // 消耗一部分能量至 75%
      nitro.update(1.0, true, true, false);
      expect(nitro.getEnergy()).toBeCloseTo(75, 1);

      // 触发暂停
      race.pause();
      expect(race.getState()).toBe(RaceState.PAUSED);

      // 暂停状态下按住 Shift 推进 2 秒，能量完全冻结
      nitro.update(2.0, true, false, true);
      expect(nitro.getEnergy()).toBeCloseTo(75, 1);
      expect(nitro.isBoosting()).toBe(false);

      // 暂停状态下松开 Shift 推进 2 秒，亦不恢复
      nitro.update(2.0, false, false, true);
      expect(nitro.getEnergy()).toBeCloseTo(75, 1);

      // 恢复比赛后恢复正常
      race.resume();
      nitro.update(1.0, false, true, false);
      expect(nitro.getEnergy()).toBeCloseTo(85, 1);
    });

    it('FINISHED 完赛状态下绝对冻结能量，并严格禁止继续加速', () => {
      // 模拟跑完全程冲线完赛
      (race as any).state = RaceState.FINISHED;
      expect(race.isControlLocked()).toBe(true);

      const isFrozen = true;
      const canDrive = false;

      // 尝试在完赛弹窗下按住 Shift
      nitro.update(1.0, true, canDrive, isFrozen);
      expect(nitro.isBoosting()).toBe(false);
      expect(nitro.getEnergy()).toBe(100);
    });
  });

  describe('3. 车辆动力学与推进力倍率集成 (VehicleController.ts & Input.ts)', () => {
    let racer: HoverRacer;
    let controller: VehicleController;
    let input: Input;

    beforeEach(() => {
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      input = new Input();
    });

    afterEach(() => {
      racer.dispose();
      controller.dispose();
      input.dispose();
    });

    it('Input 模块正确识别 Shift 键为 nitro 输入', () => {
      expect(input.getState().nitro).toBe(false);

      input.triggerKeyDown('ShiftLeft');
      expect(input.getState().nitro).toBe(true);

      input.triggerKeyUp('ShiftLeft');
      expect(input.getState().nitro).toBe(false);

      input.triggerKeyDown('ShiftRight');
      expect(input.getState().nitro).toBe(true);
    });

    it('氮气激活时具有 1.85x 推力倍率与 270 km/h 极速扩展', () => {
      expect(controller.boostTopSpeed).toBe(75.0); // 75 m/s = 270 km/h
      expect(controller.boostThrustMultiplier).toBe(1.85);

      // 基础前进加速 1 秒
      const baseInput = { forward: true, backward: false, left: false, right: false, brake: false, nitro: false };
      controller.update(1.0, baseInput);
      const normalSpeed = controller.getSpeed();

      // 重置并使用氮气加速 1 秒
      controller.resetDynamics();
      const boostInput = { forward: true, backward: false, left: false, right: false, brake: false, nitro: true };
      controller.update(1.0, boostInput);
      const boostedSpeed = controller.getSpeed();

      // 氮气提速明显快于基础加速
      expect(boostedSpeed).toBeGreaterThan(normalSpeed * 1.5);
    });

    it('持续氮气加速最高航速可突破基础 216 km/h 并达到 270 km/h (75 m/s)', () => {
      const boostInput = { forward: true, backward: false, left: false, right: false, brake: false, nitro: true };
      // 加速 4 秒
      for (let i = 0; i < 40; i++) {
        controller.update(0.1, boostInput);
      }

      expect(controller.getSpeed()).toBeCloseTo(75.0, 1);
      expect(controller.getSpeedKmh()).toBe(270);
    });

    it('松开氮气后当前速度若超过 216 km/h，以阻尼自然平滑回落至基础极速', () => {
      // 先将车速提升至 270 km/h (75 m/s)
      const boostInput = { forward: true, backward: false, left: false, right: false, brake: false, nitro: true };
      for (let i = 0; i < 40; i++) {
        controller.update(0.1, boostInput);
      }
      expect(controller.getSpeed()).toBeCloseTo(75.0, 1);

      // 松开氮气但保持前进
      const normalDriveInput = { forward: true, backward: false, left: false, right: false, brake: false, nitro: false };
      controller.update(0.5, normalDriveInput);
      // 速度应平滑下降，但仍在基础极速 (60 m/s) 之上
      expect(controller.getSpeed()).toBeLessThan(75.0);
      expect(controller.getSpeed()).toBeGreaterThanOrEqual(60.0);

      // 持续正常驾驶 2 秒，速度平滑稳定回落至 60 m/s (216 km/h)
      for (let i = 0; i < 20; i++) {
        controller.update(0.1, normalDriveInput);
      }
      expect(controller.getSpeed()).toBeCloseTo(60.0, 1);
      expect(controller.getSpeedKmh()).toBe(216);
    });

    it('倒车状态禁止激活氮气加速', () => {
      controller.setTransform(0, 0, 0, 0);
      // 倒车
      const reverseInput = { forward: false, backward: true, left: false, right: false, brake: false, nitro: true };
      controller.update(1.0, reverseInput);
      expect(controller.getSpeed()).toBeLessThan(0);
      expect(controller.getSpeed()).toBeGreaterThanOrEqual(-controller.maxReverseSpeed);
    });

    it('刹车与护栏碰撞惩罚在氮气激活状态下依然有效生效', () => {
      controller.resetDynamics();
      const boostInput = { forward: true, backward: false, left: false, right: false, brake: false, nitro: true };
      controller.update(1.0, boostInput);
      const speedBeforeBrake = controller.getSpeed();

      // 手刹制动
      const brakeInput = { forward: false, backward: false, left: false, right: false, brake: true, nitro: true };
      controller.update(0.2, brakeInput);
      expect(controller.getSpeed()).toBeLessThan(speedBeforeBrake);

      // 护栏碰撞反弹惩罚 (30% 速度扣除)
      const speedBeforeBounce = controller.getSpeed();
      controller.applyBounce(1.0, 0);
      expect(controller.getSpeed()).toBeCloseTo(speedBeforeBounce * 0.7, 1);
    });
  });

  describe('4. 赛博氮气 HUD 视觉指示与状态机联动 (RaceHUD.ts)', () => {
    let race: RaceManager;
    let nitro: NitroSystem;
    let hud: RaceHUD;

    beforeEach(() => {
      race = new RaceManager();
      nitro = new NitroSystem();
      hud = new RaceHUD('test-nitro-hud');
    });

    afterEach(() => {
      hud.dispose();
      race.dispose();
      nitro.dispose();
    });

    it('HUD 正确挂载氮气能量条与初始 100% 就绪文本', () => {
      hud.update(race, nitro);

      const valEl = document.getElementById('race-nitro-val');
      const fillEl = document.getElementById('race-nitro-fill');
      const labelEl = document.getElementById('race-nitro-label');

      expect(valEl?.innerText).toBe('100%');
      expect(fillEl?.style.width).toBe('100%');
      expect(labelEl?.innerText).toContain('NITRO READY');
    });

    it('氮气激活时 HUD 添加 .race-nitro-active 类并显示 🔥 NITRO ACTIVE!', () => {
      // 消耗并处于激活状态
      nitro.update(1.0, true, true, false);
      expect(nitro.isBoosting()).toBe(true);

      hud.update(race, nitro);

      const containerEl = document.getElementById('race-nitro-container');
      const labelEl = document.getElementById('race-nitro-label');
      const valEl = document.getElementById('race-nitro-val');

      expect(containerEl?.classList.contains('race-nitro-active')).toBe(true);
      expect(labelEl?.innerText).toBe('🔥 NITRO ACTIVE!');
      expect(valEl?.innerText).toBe('75%');
    });

    it('能量耗尽时 HUD 添加 .race-nitro-empty 类并显示 ⚠️ NITRO DEPLETED', () => {
      // 耗尽能量
      nitro.update(5.0, true, true, false);
      expect(nitro.getEnergy()).toBe(0);

      hud.update(race, nitro);

      const containerEl = document.getElementById('race-nitro-container');
      const labelEl = document.getElementById('race-nitro-label');
      const valEl = document.getElementById('race-nitro-val');

      expect(containerEl?.classList.contains('race-nitro-empty')).toBe(true);
      expect(containerEl?.classList.contains('race-nitro-active')).toBe(false);
      expect(labelEl?.innerText).toBe('⚠️ NITRO DEPLETED');
      expect(valEl?.innerText).toBe('0%');
    });

    it('能量恢复时 HUD 显示 ⚡ RECHARGING... [SHIFT]', () => {
      // 先消耗至 50%
      nitro.update(2.0, true, true, false);
      // 松开后恢复
      nitro.update(0.5, false, true, false);

      hud.update(race, nitro);

      const labelEl = document.getElementById('race-nitro-label');
      expect(labelEl?.innerText).toContain('RECHARGING');
    });
  });

  describe('5. 真实竞速全生命周期集成测试 (Full Nitro Gameplay Lifecycle)', () => {
    let race: RaceManager;
    let nitro: NitroSystem;
    let racer: HoverRacer;
    let controller: VehicleController;

    beforeEach(() => {
      race = new RaceManager({ countdownDuration: 3.0 });
      nitro = new NitroSystem();
      racer = new HoverRacer();
      controller = new VehicleController(racer);
      race.reset(controller);
    });

    afterEach(() => {
      race.dispose();
      nitro.dispose();
      controller.dispose();
    });

    it('完整体验：起跑锁定 -> GO 喷射 -> 极速巡航 -> 能量耗尽 -> 冲线冻结 -> 按 R 满血复原', () => {
      // 1. 起跑倒计时 (3.0s)，玩家狂按 Shift，能量保持 100% 且赛车位置不位移
      for (let i = 0; i < 29; i++) {
        race.update(0.1, controller);
        nitro.update(0.1, true, !race.isControlLocked(), false);
      }
      expect(nitro.getEnergy()).toBe(100);
      expect(controller.getSpeed()).toBe(0);
      expect(controller.group.position.z).toBe(-25);

      // 2. 跨过 0 进入 GO! 阶段，控制解锁，启动氮气冲刺
      race.update(0.1, controller);
      expect(race.isGoPhase()).toBe(true);
      expect(race.isControlLocked()).toBe(false);

      // 喷射加速 2 秒
      for (let i = 0; i < 20; i++) {
        race.update(0.1, controller);
        nitro.update(0.1, true, !race.isControlLocked(), false);
        controller.update(0.1, { forward: true, backward: false, left: false, right: false, brake: false, nitro: nitro.isBoosting() });
      }
      expect(nitro.isBoosting()).toBe(true);
      expect(nitro.getEnergy()).toBeCloseTo(50, 1);
      expect(controller.getSpeedKmh()).toBeGreaterThan(216); // 突破基础极速

      // 3. 跑完 3 个检查点并冲线
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
      const finishedEnergy = nitro.getEnergy();

      // 4. 完赛状态下持续推进，验证能量绝对冻结，且无法加速
      nitro.update(2.0, true, false, true);
      expect(nitro.getEnergy()).toBe(finishedEnergy);
      expect(nitro.isBoosting()).toBe(false);

      // 5. 按 R 键重试复位
      race.reset(controller);
      nitro.reset();

      expect(race.getState()).toBe(RaceState.COUNTDOWN);
      expect(nitro.getEnergy()).toBe(100);
      expect(nitro.isBoosting()).toBe(false);
      expect(controller.getSpeed()).toBe(0);
      expect(controller.group.position.x).toBe(65);
      expect(controller.group.position.z).toBe(-25);
    });
  });

});
