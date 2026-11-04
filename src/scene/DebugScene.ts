import * as THREE from 'three';

export class DebugScene {
  public readonly group: THREE.Group;
  private testCube!: THREE.Mesh;
  private testSphere!: THREE.Mesh;
  private testTorus!: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    this.buildGroundAndHelpers();
    this.buildTestObjects();
  }

  private buildGroundAndHelpers(): void {
    // 1. 引擎测试用地平面（深灰微反射材质，接收柔和阴影）
    const planeGeo = new THREE.PlaneGeometry(60, 60);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(planeGeo, planeMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // 2. 空间网格辅助线 (GridHelper)，60x60格，主副轴颜色区分
    const gridHelper = new THREE.GridHelper(60, 60, 0x38bdf8, 0x334155);
    gridHelper.position.y = 0.01; // 略微抬高避免 Z-fighting
    this.group.add(gridHelper);

    // 3. 坐标轴辅助线 (AxesHelper)，红 X, 绿 Y, 蓝 Z
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.position.set(0, 0.02, 0);
    this.group.add(axesHelper);
  }

  private buildTestObjects(): void {
    // 1. 测试立方体：验证 PBR 高光、法线以及投射阴影
    const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.8
    });
    this.testCube = new THREE.Mesh(cubeGeo, cubeMat);
    this.testCube.position.set(-4, 2, 0);
    this.testCube.castShadow = true;
    this.testCube.receiveShadow = true;
    this.group.add(this.testCube);

    // 2. 测试球体：验证曲面光照反射与环境渐变
    const sphereGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.2,
      metalness: 0.5
    });
    this.testSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.testSphere.position.set(4, 1.5, 0);
    this.testSphere.castShadow = true;
    this.testSphere.receiveShadow = true;
    this.group.add(this.testSphere);

    // 3. 悬浮环体（Torus）：验证空心复杂结构的深度缓冲与自阴影
    const torusGeo = new THREE.TorusGeometry(1.5, 0.4, 24, 48);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
      metalness: 0.6
    });
    this.testTorus = new THREE.Mesh(torusGeo, torusMat);
    this.testTorus.position.set(0, 3, -4);
    this.testTorus.castShadow = true;
    this.testTorus.receiveShadow = true;
    this.group.add(this.testTorus);
  }

  public update(deltaTime: number, elapsedTime: number): void {
    // 旋转与浮动动画，用于验证连续帧更新的平滑度
    if (this.testCube) {
      this.testCube.rotation.x += deltaTime * 0.8;
      this.testCube.rotation.y += deltaTime * 1.0;
      this.testCube.position.y = 2 + Math.sin(elapsedTime * 2) * 0.4;
    }

    if (this.testSphere) {
      this.testSphere.position.y = 1.5 + Math.abs(Math.sin(elapsedTime * 3)) * 1.2;
    }

    if (this.testTorus) {
      this.testTorus.rotation.x += deltaTime * 0.5;
      this.testTorus.rotation.y += deltaTime * 0.7;
      this.testTorus.rotation.z += deltaTime * 0.3;
    }
  }

  public dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
