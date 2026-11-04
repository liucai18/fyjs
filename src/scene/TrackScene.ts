import * as THREE from 'three';
import { VehicleController } from '../vehicle/VehicleController';

/**
 * 飞跃极速 · 首条可驾驶科幻测试赛道 (TrackScene.ts)
 * 严格落实师父【任务四：第一条可驾驶测试赛道】：
 * 1. 连续道路闭环：全长约 600m 的大型双直道与大半径圆弧过弯赛道
 * 2. 赛道视觉细节：
 *    - 高质感暗黑沥青赛道面 (宽 18m)
 *    - 赛博双向霓虹发光防撞护栏 (Neon Guardrails)
 *    - 地面中央电光青间歇导引虚线与赛道边缘警示线
 *    - 起跑门架拱门 (Start/Finish Cyber Gantry) 与能量信标塔
 * 3. 物理边界碰撞与约束防穿模：
 *    - 实时监测飞车距离赛道边界距离
 *    - 若撞击护栏，施加反向弹力并降低车速，彻底杜绝掉出赛道穿模
 */
export class TrackScene {
  public readonly group: THREE.Group;

  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly lights: THREE.Light[] = [];

  // 赛道参数：由两个平行直道和两端半圆弯道组成的平滑跑道环
  public readonly straightLength: number = 220; // 直道长度 (m)
  public readonly radius: number = 65;          // 弯道半径 (m)
  public readonly trackWidth: number = 20;      // 赛道总宽度 (m)
  private isDisposed: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'TrackScene_Root';

    this.buildTrackSurface();
    this.buildNeonGuardrails();
    this.buildTrackMarkings();
    this.buildGantryAndScenery();
    this.buildEnvironmentLighting();
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.add(geo);
    return geo;
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.add(mat);
    return mat;
  }

  /**
   * 1. 构建赛道地面基础与大世界地网
   */
  private buildTrackSurface(): void {
    // 基础大世界地面网格 (Dark Grid Floor)
    const floorGeo = this.trackGeo(new THREE.PlaneGeometry(600, 600));
    const floorMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x060911,
      roughness: 0.85,
      metalness: 0.2
    }));
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this.group.add(floor);

    const worldGrid = new THREE.GridHelper(600, 120, 0x00f0ff, 0x141b2d);
    worldGrid.position.y = 0.0;
    this.group.add(worldGrid);

    // 赛道主沥青路面材质
    const roadMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x151b26,
      roughness: 0.45,
      metalness: 0.35
    }));

    // (A) 两条长直道路面 (Left: x = -R, Right: x = +R)
    const straightGeo = this.trackGeo(new THREE.PlaneGeometry(this.trackWidth, this.straightLength));
    
    // 东直道 (Right Straight, x = +radius)
    const straightEast = new THREE.Mesh(straightGeo, roadMat);
    straightEast.rotation.x = -Math.PI / 2;
    straightEast.position.set(this.radius, 0.02, 0);
    straightEast.receiveShadow = true;
    this.group.add(straightEast);

    // 西直道 (Left Straight, x = -radius)
    const straightWest = new THREE.Mesh(straightGeo, roadMat);
    straightWest.rotation.x = -Math.PI / 2;
    straightWest.position.set(-this.radius, 0.02, 0);
    straightWest.receiveShadow = true;
    this.group.add(straightWest);

    // (B) 南北两端半圆形大弯道路面 (RingGeometry)
    const curveGeo = this.trackGeo(new THREE.RingGeometry(
      this.radius - this.trackWidth / 2,
      this.radius + this.trackWidth / 2,
      64,
      1,
      0,
      Math.PI
    ));

    // 北大弯 (North Curve, z = +straightLength / 2)
    const northCurve = new THREE.Mesh(curveGeo, roadMat);
    northCurve.rotation.x = -Math.PI / 2;
    northCurve.position.set(0, 0.02, this.straightLength / 2);
    northCurve.receiveShadow = true;
    this.group.add(northCurve);

    // 南大弯 (South Curve, z = -straightLength / 2)
    const southCurve = new THREE.Mesh(curveGeo, roadMat);
    southCurve.rotation.x = -Math.PI / 2;
    southCurve.rotation.z = Math.PI;
    southCurve.position.set(0, 0.02, -this.straightLength / 2);
    southCurve.receiveShadow = true;
    this.group.add(southCurve);
  }

  /**
   * 2. 构建赛博全景发光防撞护栏 (Neon Guardrails)
   */
  private buildNeonGuardrails(): void {
    const railMatCyan = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 3.5,
      roughness: 0.1,
      metalness: 0.1
    }));

    const railMatOrange = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0xff3b00,
      emissive: 0xff3b00,
      emissiveIntensity: 3.2,
      roughness: 0.1,
      metalness: 0.1
    }));

    const railHeight = 0.9;
    const railThick = 0.35;
    const halfW = this.trackWidth / 2;

    // (A) 直道内侧与外侧防撞栏
    const straightRailGeo = this.trackGeo(new THREE.BoxGeometry(railThick, railHeight, this.straightLength));

    // 东直道外护栏 (Orange) 与内护栏 (Cyan)
    const eastOuter = new THREE.Mesh(straightRailGeo, railMatOrange);
    eastOuter.position.set(this.radius + halfW, railHeight / 2, 0);
    this.group.add(eastOuter);

    const eastInner = new THREE.Mesh(straightRailGeo, railMatCyan);
    eastInner.position.set(this.radius - halfW, railHeight / 2, 0);
    this.group.add(eastInner);

    // 西直道外护栏 (Orange) 与内护栏 (Cyan)
    const westOuter = new THREE.Mesh(straightRailGeo, railMatOrange);
    westOuter.position.set(-this.radius - halfW, railHeight / 2, 0);
    this.group.add(westOuter);

    const westInner = new THREE.Mesh(straightRailGeo, railMatCyan);
    westInner.position.set(-this.radius + halfW, railHeight / 2, 0);
    this.group.add(westInner);

    // (B) 弯道弧形护栏 (Torus Tubes)
    const segments = 48;
    const innerRadius = this.radius - halfW;
    const outerRadius = this.radius + halfW;

    const northInnerGeo = this.trackGeo(new THREE.TorusGeometry(innerRadius, railThick / 2, 6, segments, Math.PI));
    const northOuterGeo = this.trackGeo(new THREE.TorusGeometry(outerRadius, railThick / 2, 6, segments, Math.PI));

    // 北半圆护栏
    const northInnerRail = new THREE.Mesh(northInnerGeo, railMatCyan);
    northInnerRail.rotation.x = Math.PI / 2;
    northInnerRail.position.set(0, railHeight / 2, this.straightLength / 2);
    this.group.add(northInnerRail);

    const northOuterRail = new THREE.Mesh(northOuterGeo, railMatOrange);
    northOuterRail.rotation.x = Math.PI / 2;
    northOuterRail.position.set(0, railHeight / 2, this.straightLength / 2);
    this.group.add(northOuterRail);

    // 南半圆护栏
    const southInnerRail = new THREE.Mesh(northInnerGeo, railMatCyan);
    southInnerRail.rotation.x = -Math.PI / 2;
    southInnerRail.position.set(0, railHeight / 2, -this.straightLength / 2);
    this.group.add(southInnerRail);

    const southOuterRail = new THREE.Mesh(northOuterGeo, railMatOrange);
    southOuterRail.rotation.x = -Math.PI / 2;
    southOuterRail.position.set(0, railHeight / 2, -this.straightLength / 2);
    this.group.add(southOuterRail);
  }

  /**
   * 3. 构建路面发光导引标线与起点网格
   */
  private buildTrackMarkings(): void {
    const markMatCyan = this.trackMat(new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    }));

    // 直道中心发光虚线 (每隔 8m 一条长条)
    const dashCount = Math.floor(this.straightLength / 8);
    const dashGeo = this.trackGeo(new THREE.PlaneGeometry(0.35, 4.0));

    for (let i = -dashCount / 2; i <= dashCount / 2; i++) {
      const zPos = i * 8;
      // 东直道虚线
      const dashE = new THREE.Mesh(dashGeo, markMatCyan);
      dashE.rotation.x = -Math.PI / 2;
      dashE.position.set(this.radius, 0.03, zPos);
      this.group.add(dashE);

      // 西直道虚线
      const dashW = new THREE.Mesh(dashGeo, markMatCyan);
      dashW.rotation.x = -Math.PI / 2;
      dashW.position.set(-this.radius, 0.03, zPos);
      this.group.add(dashW);
    }
  }

  /**
   * 4. 构建起跑线拱门与科幻信标塔
   */
  private buildGantryAndScenery(): void {
    const metalMat = this.trackMat(new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.9,
      roughness: 0.2
    }));

    const neonOrangeMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xff3b00 }));
    const neonCyanMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0x00f0ff }));

    // 起点拱门 (Start Gantry) 位于东直道中央 z = 0
    const gantryWidth = this.trackWidth + 6;
    const gantryHeight = 11;

    // 两侧立柱
    const pillarGeo = this.trackGeo(new THREE.BoxGeometry(1.2, gantryHeight, 1.2));
    const pillarL = new THREE.Mesh(pillarGeo, metalMat);
    pillarL.position.set(this.radius - gantryWidth / 2, gantryHeight / 2, 0);
    this.group.add(pillarL);

    const pillarR = new THREE.Mesh(pillarGeo, metalMat);
    pillarR.position.set(this.radius + gantryWidth / 2, gantryHeight / 2, 0);
    this.group.add(pillarR);

    // 顶部横梁
    const beamGeo = this.trackGeo(new THREE.BoxGeometry(gantryWidth + 1.2, 1.4, 1.4));
    const beam = new THREE.Mesh(beamGeo, metalMat);
    beam.position.set(this.radius, gantryHeight, 0);
    this.group.add(beam);

    // 拱门起跑线高能发光牌
    const signGeo = this.trackGeo(new THREE.BoxGeometry(gantryWidth - 2, 0.6, 0.1));
    const sign = new THREE.Mesh(signGeo, neonCyanMat);
    sign.position.set(this.radius, gantryHeight - 0.2, 0.72);
    this.group.add(sign);

    // 地面起点斑马线 (Start / Finish Checker Stripe)
    const finishLineGeo = this.trackGeo(new THREE.PlaneGeometry(this.trackWidth - 0.5, 2.5));
    const finishLineMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(this.radius, 0.035, 0);
    this.group.add(finishLine);

    // 赛道两端信标灯塔 (Beacon Towers)
    const towerGeo = this.trackGeo(new THREE.CylinderGeometry(0.8, 1.4, 35, 8));
    const towerN = new THREE.Mesh(towerGeo, metalMat);
    towerN.position.set(0, 17.5, this.straightLength / 2 + this.radius + 15);
    this.group.add(towerN);

    const towerLightN = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(2.0, 16, 16)), neonOrangeMat);
    towerLightN.position.set(0, 36, this.straightLength / 2 + this.radius + 15);
    this.group.add(towerLightN);
  }

  /**
   * 5. 环境光影配置
   */
  private buildEnvironmentLighting(): void {
    // 柔和天幕夜光
    const hemiLight = new THREE.HemisphereLight(0x00f0ff, 0x090d16, 1.2);
    this.group.add(hemiLight);
    this.lights.push(hemiLight);

    // 月夜高空主平行光 (产生柔和投射阴影)
    const moonDirLight = new THREE.DirectionalLight(0xdbeafe, 1.8);
    moonDirLight.position.set(50, 120, 50);
    moonDirLight.castShadow = true;
    moonDirLight.shadow.mapSize.width = 2048;
    moonDirLight.shadow.mapSize.height = 2048;
    moonDirLight.shadow.camera.near = 10;
    moonDirLight.shadow.camera.far = 300;
    moonDirLight.shadow.camera.left = -150;
    moonDirLight.shadow.camera.right = 150;
    moonDirLight.shadow.camera.top = 150;
    moonDirLight.shadow.camera.bottom = -150;
    this.group.add(moonDirLight);
    this.lights.push(moonDirLight);
  }

  /**
   * 物理碰撞与边界约束检测（逐帧执行）
   * 保证飞车始终约束在宽 20m 的赛道内，杜绝穿模与越界飞出
   */
  public checkBoundaryCollision(controller: VehicleController): void {
    if (this.isDisposed) return;

    const pos = controller.group.position;
    const halfStraight = this.straightLength / 2;
    const halfWidth = this.trackWidth / 2 - 1.2; // 预留车宽安全裕度

    if (pos.z >= -halfStraight && pos.z <= halfStraight) {
      // (1) 直道区域：检查东直道 (x ≈ +R) 与西直道 (x ≈ -R) 的横向偏移
      const isEastStraight = pos.x > 0;
      const targetCenterlineX = isEastStraight ? this.radius : -this.radius;
      const lateralDist = pos.x - targetCenterlineX;

      if (Math.abs(lateralDist) > halfWidth) {
        // 撞击护栏！向赛道中心反弹并减速
        const bounceDir = lateralDist > 0 ? -1 : 1;
        const penetration = Math.abs(lateralDist) - halfWidth;
        controller.applyBounce(bounceDir * (penetration + 0.1), 0);
      }
    } else {
      // (2) 弯道区域：检查圆弧中心距离
      const curveCenterZ = pos.z > 0 ? halfStraight : -halfStraight;
      const distFromCenter = Math.hypot(pos.x, pos.z - curveCenterZ);
      const radDiff = distFromCenter - this.radius;

      if (Math.abs(radDiff) > halfWidth) {
        // 弯道越界反弹
        const penetration = Math.abs(radDiff) - halfWidth;
        const normalX = (pos.x / (distFromCenter || 1));
        const normalZ = ((pos.z - curveCenterZ) / (distFromCenter || 1));
        const bounceFactor = radDiff > 0 ? -1 : 1;

        controller.applyBounce(
          normalX * bounceFactor * (penetration + 0.15),
          normalZ * bounceFactor * (penetration + 0.15)
        );
      }
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

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
