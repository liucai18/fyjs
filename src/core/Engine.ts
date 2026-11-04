import * as THREE from 'three';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  shadows?: boolean;
}

export class Engine {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private resizeHandler: () => void;

  constructor(options: EngineOptions) {
    const { canvas, antialias = true, shadows = true } = options;

    // 1. 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

    // 2. 初始化透视相机
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // 3. 初始化 WebGL 渲染器
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });

    // 4. 配置色彩空间与高质量渲染参数
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // 5. 阴影系统配置
    if (shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // 6. 环境光与主平行光设置
    this.setupLighting();

    // 7. 窗口尺寸自适应
    this.resizeHandler = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);
  }

  private setupLighting(): void {
    // 环境光：微弱冷色泛光，保留暗部细节
    const ambientLight = new THREE.AmbientLight(0xcfd8dc, 0.6);
    this.scene.add(ambientLight);

    // 主平行光：模拟阳光/高空泛光灯，投射柔和阴影
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

    // 辅助侧向补光（霓虹蓝紫微光，契合赛车与未来极速风格）
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-15, 10, -15);
    this.scene.add(rimLight);
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public getRenderInfo(): {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textures: number;
  } {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures
    };
  }

  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.renderer.dispose();
  }
}
