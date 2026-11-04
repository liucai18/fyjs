export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

/**
 * 飞跃极速 · 键盘输入管理模块 (Input.ts)
 * 工业级规范：
 * - 支持 WASD 与方向键 (Arrow Keys) 双套键位绑定
 * - 窗口失焦 (window.blur) 自动重置所有按键状态，杜绝卡键/粘键
 * - 幂等安全注销事件监听器 (dispose)，防止 HMR 内存泄漏
 */
export class Input {
  private readonly keys = new Set<string>();
  private readonly keydownHandler: (e: KeyboardEvent) => void;
  private readonly keyupHandler: (e: KeyboardEvent) => void;
  private readonly blurHandler: () => void;
  private isDisposed: boolean = false;

  constructor() {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (this.isDisposed) return;
      // 阻止方向键与空格键触发浏览器窗口默认滚动行为
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
      }
      this.keys.add(e.code);
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      if (this.isDisposed) return;
      this.keys.delete(e.code);
    };

    this.blurHandler = () => {
      this.keys.clear();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keydownHandler);
      window.addEventListener('keyup', this.keyupHandler);
      window.addEventListener('blur', this.blurHandler);
    }
  }

  /**
   * 获取当前归一化的驾驶输入状态
   */
  public getState(): InputState {
    const forward = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const backward = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const brake = this.keys.has('Space');

    return {
      forward,
      backward,
      left,
      right,
      brake
    };
  }

  /**
   * 模拟外部测试注入按键（用于单元测试）
   */
  public triggerKeyDown(code: string): void {
    this.keys.add(code);
  }

  public triggerKeyUp(code: string): void {
    this.keys.delete(code);
  }

  /**
   * 彻底安全销毁所有全局事件监听
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      window.removeEventListener('keyup', this.keyupHandler);
      window.removeEventListener('blur', this.blurHandler);
    }
    this.keys.clear();
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
