import * as THREE from 'three';

export class DebugScene {
  public readonly group: THREE.Group;
  private testCube!: THREE.Mesh;
  private testSphere!: THREE.Mesh;
  private testTorus!: THREE.Mesh;
  private gridHelper!: THREE.GridHelper;
  private axesHelper!: THREE.AxesHelper;
  private ground!: THREE.Mesh;
  private isDisposed: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.buildGroundAndHelpers();
    this.buildTestObjects();
  }

  private buildGroundAndHelpers(): void {
    const planeGeo = new THREE.PlaneGeometry(60, 60);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.2
    });
    this.ground = new THREE.Mesh(planeGeo, planeMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    this.gridHelper = new THREE.GridHelper(60, 60, 0x38bdf8, 0x334155);
    this.gridHelper.position.y = 0.01;
    this.group.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.position.set(0, 0.02, 0);
    this.group.add(this.axesHelper);
  }

  private buildTestObjects(): void {
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
    // 阶段 1.2 防御：解绑销毁后彻底阻断一切逻辑更新
    if (this.isDisposed) return;

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

  /**
   * 阶段 1.2 增强：采用 Set 集合精确去重释放 Geometry 与 Material，
   * 具备完全的幂等性（重复调用安全），并完成从父级容器彻底解绑。
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        if (child.geometry) {
          geometries.add(child.geometry);
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => materials.add(mat));
          } else {
            materials.add(child.material);
          }
        }
      }
    });

    // 逐一释放去重后的几何体与材质
    for (const geo of geometries) {
      try {
        geo.dispose();
      } catch (err) {
        console.warn('Warning disposing geometry:', err);
      }
    }

    for (const mat of materials) {
      try {
        mat.dispose();
      } catch (err) {
        console.warn('Warning disposing material:', err);
      }
    }

    this.group.clear();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
