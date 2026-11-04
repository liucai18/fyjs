import * as THREE from 'three';
import { HoverRacer } from '../vehicle/HoverRacer';

/**
 * 阶段 2 科幻赛车专属展台场景 (Cyber Showroom Stage)
 * 提供 360 度无死角展示原创反重力赛车模型：
 * - 赛博环形发光展台 (Turntable Platform with Neon Bevels)
 * - 科技地网辅助光影 (Tech Grid)
 * - 摄影棚级三点光效 (Key Light, Rim Light, Fill Light)
 * - 彻底清空遮挡车体的初级调试几何体
 */
export class DebugScene {
  public readonly group: THREE.Group;
  public readonly hoverRacer: HoverRacer;

  private platformMesh!: THREE.Mesh;
  private ringMeshInner!: THREE.Mesh;
  private ringMeshOuter!: THREE.Mesh;
  private gridHelper!: THREE.GridHelper;
  private ground!: THREE.Mesh;
  private isDisposed: boolean = false;

  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly lights: THREE.Light[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Showroom_Scene';

    this.buildShowroomFloor();
    this.buildShowroomLighting();

    // 挂载高精原创反重力赛车
    this.hoverRacer = new HoverRacer();
    this.hoverRacer.group.position.set(0, 0, 0);
    this.group.add(this.hoverRacer.group);
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.add(geo);
    return geo;
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.add(mat);
    return mat;
  }

  private buildShowroomFloor(): void {
    // 1. 无边界暗色地面
    const planeGeo = this.trackGeo(new THREE.PlaneGeometry(80, 80));
    const planeMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.45,
      metalness: 0.4
    }));
    this.ground = new THREE.Mesh(planeGeo, planeMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.05;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // 2. 科技网格 (Cyber Grid)
    this.gridHelper = new THREE.GridHelper(80, 80, 0x00f0ff, 0x1e293b);
    this.gridHelper.position.y = 0.0;
    this.group.add(this.gridHelper);

    // 3. 赛车核心圆台 (Circular Pod Platform)
    const platformGeo = this.trackGeo(new THREE.CylinderGeometry(5.2, 5.6, 0.12, 48));
    const platformMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.25
    }));
    this.platformMesh = new THREE.Mesh(platformGeo, platformMat);
    this.platformMesh.position.y = -0.01;
    this.platformMesh.receiveShadow = true;
    this.group.add(this.platformMesh);

    // 4. 展台内圈霓虹电光青发光环
    const ringGeoInner = this.trackGeo(new THREE.RingGeometry(4.7, 4.85, 48));
    const neonCyan = this.trackMat(new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    }));
    this.ringMeshInner = new THREE.Mesh(ringGeoInner, neonCyan);
    this.ringMeshInner.rotation.x = -Math.PI / 2;
    this.ringMeshInner.position.y = 0.06;
    this.group.add(this.ringMeshInner);

    // 5. 展台外圈赛博赤橙发光环
    const ringGeoOuter = this.trackGeo(new THREE.RingGeometry(5.3, 5.42, 48));
    const neonOrange = this.trackMat(new THREE.MeshBasicMaterial({
      color: 0xff4500,
      side: THREE.DoubleSide
    }));
    this.ringMeshOuter = new THREE.Mesh(ringGeoOuter, neonOrange);
    this.ringMeshOuter.rotation.x = -Math.PI / 2;
    this.ringMeshOuter.position.y = 0.06;
    this.group.add(this.ringMeshOuter);
  }

  private buildShowroomLighting(): void {
    // 顶部超宽摄影棚柔光天幕 (Hemisphere Light)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.4);
    this.group.add(hemiLight);
    this.lights.push(hemiLight);

    // 顶部重点聚光灯 (Key Spotlight)
    const topSpot = new THREE.SpotLight(0xffffff, 5.0, 35, Math.PI / 4, 0.5, 1.2);
    topSpot.position.set(0, 16, 2);
    topSpot.target.position.set(0, 0, 0);
    topSpot.castShadow = true;
    topSpot.shadow.mapSize.width = 2048;
    topSpot.shadow.mapSize.height = 2048;
    this.group.add(topSpot);
    this.group.add(topSpot.target);
    this.lights.push(topSpot);

    // 侧方青蓝冷色轮廓光 (Rim Light Cyan)
    const rimCyan = new THREE.PointLight(0x00f0ff, 4.5, 25, 1.5);
    rimCyan.position.set(-6, 3, -4);
    this.group.add(rimCyan);
    this.lights.push(rimCyan);

    // 侧方暖橙高光反射光 (Rim Light Amber)
    const rimOrange = new THREE.PointLight(0xff6600, 4.0, 25, 1.5);
    rimOrange.position.set(6, 3, 4);
    this.group.add(rimOrange);
    this.lights.push(rimOrange);

    // 正前方主立体雕刻光源 (Front Key Light)，照亮前叉翼板与车身反射
    const frontKey = new THREE.DirectionalLight(0xffffff, 3.2);
    frontKey.position.set(-5, 9, 12);
    this.group.add(frontKey);
    this.lights.push(frontKey);
  }

  public update(deltaTime: number, elapsedTime: number): void {
    if (this.isDisposed) return;

    // 原创飞车悬浮、喷火呼吸与动态侧倾展示
    if (this.hoverRacer) {
      // 模拟展台演示：巡航油门微呼吸与规律侧倾
      const demoThrottle = 0.65 + Math.sin(elapsedTime * 2.0) * 0.35;
      const demoSteer = Math.sin(elapsedTime * 1.0) * 0.75;
      this.hoverRacer.setThrottle(demoThrottle);
      this.hoverRacer.setSteering(demoSteer);
      this.hoverRacer.update(deltaTime);
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.hoverRacer) {
      this.hoverRacer.dispose();
    }

    for (const geo of this.geometries) {
      geo.dispose();
    }
    this.geometries.clear();

    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials.clear();

    for (const light of this.lights) {
      light.dispose();
    }
    this.lights.length = 0;

    this.group.clear();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
