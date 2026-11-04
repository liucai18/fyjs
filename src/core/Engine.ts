import * as THREE from 'three';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  shadows?: boolean;
  renderer?: THREE.WebGLRenderer;
}

export class Engine {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private resizeHandler: (() => void) | null = null;
  private isDisposed: boolean = false;

  constructor(options: EngineOptions) {
    const { canvas, antialias = true, shadows = true, renderer } = options;

    if (!canvas) {
      throw new Error('Engine requires a valid HTMLCanvasElement');
    }

    let createdRenderer: THREE.WebGLRenderer | null = null;
    let listenerAttached = false;

    try {
      // 1. 初始化场景
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0f172a);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

      // 2. 初始化透视相机
      const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const height = typeof window !== 'undefined' ? window.innerHeight : 720;
      const aspect = width / Math.max(1, height);
      this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
      this.camera.position.set(0, 10, 20);
      this.camera.lookAt(0, 0, 0);

      // 3. 初始化 WebGL 渲染器 (支持测试依赖注入)
      createdRenderer = renderer ?? new THREE.WebGLRenderer({
        canvas,
        antialias,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
      });
      this.renderer = createdRenderer;

      // 4. 配置色彩空间与高质量渲染参数
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.setPixelRatio(typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1);
      this.renderer.setSize(width, height);

      // 5. 阴影系统配置
      if (shadows) {
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }

      // 6. 环境光与主平行光设置
      this.setupLighting();

      // 7. 窗口尺寸自适应
      this.resizeHandler = this.onWindowResize.bind(this);
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.resizeHandler);
        listenerAttached = true;
      }
    } catch (error) {
      // 阶段 1.3 核心增强：构造函数内部自清理与原子回滚
      console.error('❌ Engine 构造函数内部抛错，正在执行原子清理:', error);
      this.isDisposed = true;

      if (listenerAttached && typeof window !== 'undefined' && this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }

      if (createdRenderer) {
        try {
          createdRenderer.dispose();
          if (typeof createdRenderer.forceContextLoss === 'function') {
            createdRenderer.forceContextLoss();
          }
        } catch (cleanupErr) {
          console.warn('Warning during constructor cleanup:', cleanupErr);
        }
      }

      throw error;
    }
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xcfd8dc, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -25;
    dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25;
    dirLight.shadow.camera.bottom = -25;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-15, 10, -15);
    this.scene.add(rimLight);
  }

  private onWindowResize(): void {
    if (this.isDisposed || typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public render(): void {
    if (this.isDisposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  public getRenderInfo(): {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
  } {
    if (this.isDisposed) {
      return { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
    }
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures
    };
  }

  /**
   * 阶段 1.3 幂等安全释放
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (typeof window !== 'undefined' && this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }

    try {
      this.renderer.dispose();
      if (typeof this.renderer.forceContextLoss === 'function') {
        this.renderer.forceContextLoss();
      }
    } catch (err) {
      console.warn('Warning during renderer disposal:', err);
    }
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
