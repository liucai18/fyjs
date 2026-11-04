import * as THREE from 'three';

export interface HoverRacerOptions {
  primaryColor?: number;
  secondaryColor?: number;
  accentColor?: number;
  glowColor?: number;
}

/**
 * 飞跃极速 · 原创科幻反重力赛车 (Hover Racer - Prototype X-1)
 * 深度对齐《Redout 2》、《Formula Fusion / PACER》与《Distance》硬核科幻设计标杆：
 * 
 * 1. 结构与几何轮廓：
 *    - 扁平楔形机体 + 双分叉前铲空气动力学前鼻锥 (Twin-Fork Aero Nose)
 *    - 赛车级全景水滴型座舱罩 (Cockpit Canopy) + 环形霓虹密封光带
 *    - 双层复合后掠导流翼 + 下折翼尖端板 (Winglets)
 *    - 尾部双联重型离子矢量推进器 (Twin Vector Thrusters) + 四联导流扰流鳍 (Diffusers)
 *    - 随油门深度动态伸缩拉长的高温等离子尾焰 (Dual Ion Jet Flames)
 *    - 双侧前置高能 LED 鹰眼大灯 + 底盘四向反重力磁悬浮发生器
 * 
 * 2. 材质与视觉细节 (PBR Materials)：
 *    - 主体：战术哑光钛合金/深灰碳纤高光金属漆
 *    - 配色：烈焰竞速赤橙 (Racing Orange) 与 离子电光青蓝 (Electric Cyan)
 *    - 舱盖：高反射深色镀膜合成玻璃
 *    - 发光：高强度 Emissive 霓虹光带与动态照地光
 */
export class HoverRacer {
  public readonly group: THREE.Group;
  public readonly bodyGroup: THREE.Group;

  // 材质与几何体生命周期全追踪，支持 100% 幂等安全释放
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly lights: THREE.Light[] = [];

  // 动态联动部件引用
  private leftFlameMesh!: THREE.Mesh;
  private rightFlameMesh!: THREE.Mesh;
  private leftFlameCore!: THREE.Mesh;
  private rightFlameCore!: THREE.Mesh;
  private flameMaterial!: THREE.MeshBasicMaterial;
  private flameCoreMaterial!: THREE.MeshBasicMaterial;
  private underGlowLight!: THREE.PointLight;
  private headLightL!: THREE.SpotLight;
  private headLightR!: THREE.SpotLight;

  // 动态物理状态
  private currentThrottle: number = 0; // 0 ~ 1
  private currentSteer: number = 0;    // -1 ~ 1
  private hoverTimer: number = 0;
  private isDisposed: boolean = false;

  // 配色参数
  private readonly primaryColor: number;
  private readonly secondaryColor: number;
  private readonly accentColor: number;
  private readonly glowColor: number;

  constructor(options: HoverRacerOptions = {}) {
    this.primaryColor = options.primaryColor ?? 0xf8fafc;     // 纯粹极光珍珠白 (主车体甲板，高光反光，动感十足)
    this.secondaryColor = options.secondaryColor ?? 0x0055ff; // 赛博竞速钴蓝 (进气导流与分色色块)
    this.accentColor = options.accentColor ?? 0xff3800;       // 极速烈焰赤橙 (前铲、尾翼与破风尖兵)
    this.glowColor = options.glowColor ?? 0x00f0ff;           // 离子电光青蓝 (高能发光灯条与推进器)

    this.group = new THREE.Group();
    this.group.name = 'HoverRacer_Root';

    // 默认比例设定为 1.35x，使其在场景中视觉比例更雄伟霸气
    this.group.scale.set(1.35, 1.35, 1.35);

    this.bodyGroup = new THREE.Group();
    this.bodyGroup.name = 'HoverRacer_Body';
    this.bodyGroup.position.y = 0.48; // 初始就位在基准悬浮高度
    this.group.add(this.bodyGroup);

    this.buildVehicle();
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.add(geo);
    return geo;
  }

  private trackMaterial<T extends THREE.Material>(mat: T): T {
    this.materials.add(mat);
    return mat;
  }

  /**
   * 模块化组装极致工业美感的科幻飞车模型
   */
  private buildVehicle(): void {
    // ==========================================
    // 1. 高精物理材质库 (PBR Materials - 动感超跑级)
    // ==========================================
    // 主车壳：极光珍珠白金属漆面 (告别黑沉，光洁夺目)
    const primaryMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: this.primaryColor,
      metalness: 0.65,
      roughness: 0.15,
      envMapIntensity: 2.2
    }));

    // 导流与进气涂装：赛博竞速钴蓝
    const secondaryMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: this.secondaryColor,
      metalness: 0.75,
      roughness: 0.22,
      envMapIntensity: 1.8
    }));

    // 空气动力学翼片与车头涂装：高饱和极速赤橙 (高能对比色)
    const accentMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: this.accentColor,
      metalness: 0.60,
      roughness: 0.20,
      envMapIntensity: 1.6
    }));

    // 钛合金机械底盘
    const darkMetalMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: 0x242d3d,
      metalness: 0.90,
      roughness: 0.35
    }));

    // 驾驶舱盖：全景双曲面电镀电光青高光反光座舱 (Iridescent Mirror Canopy)
    const canopyMat = this.trackMaterial(new THREE.MeshPhysicalMaterial({
      color: 0x00e5ff,
      emissive: 0x003355,
      emissiveIntensity: 0.5,
      metalness: 0.95,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 1.0
    }));

    // 霓虹发光材质 (Cyan Glow)
    const neonCyanMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: this.glowColor,
      emissive: this.glowColor,
      emissiveIntensity: 4.2,
      roughness: 0.1,
      metalness: 0.2
    }));

    // 霓虹发光材质 (Orange Glow)
    const neonOrangeMat = this.trackMaterial(new THREE.MeshStandardMaterial({
      color: this.accentColor,
      emissive: this.accentColor,
      emissiveIntensity: 4.0,
      roughness: 0.1,
      metalness: 0.2
    }));

    // 等离子尾焰材质 (外层青色 + 内核高亮白)
    this.flameMaterial = this.trackMaterial(new THREE.MeshBasicMaterial({
      color: this.glowColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    }));

    this.flameCoreMaterial = this.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    }));

    // ==========================================
    // 2. 主车身底盘与核心骨架 (Fuselage Core)
    // ==========================================
    // 中央低伏流线主梁 (长 3.8m, 宽 1.05m, 厚 0.36m)
    const mainHullGeo = this.trackGeometry(new THREE.BoxGeometry(1.05, 0.34, 3.6));
    const mainHull = new THREE.Mesh(mainHullGeo, primaryMat);
    mainHull.position.set(0, 0.32, 0);
    mainHull.castShadow = true;
    mainHull.receiveShadow = true;
    this.bodyGroup.add(mainHull);

    // 车顶动感赛车双色拉花条纹 (Dynamic Racing Speed Stripes)
    const stripeGeo = this.trackGeometry(new THREE.BoxGeometry(0.12, 0.02, 3.4));
    const stripeL = new THREE.Mesh(stripeGeo, accentMat); // 极速烈焰橙
    stripeL.position.set(-0.24, 0.50, 0);
    this.bodyGroup.add(stripeL);

    const stripeR = new THREE.Mesh(stripeGeo, secondaryMat); // 赛博竞速钴蓝
    stripeR.position.set(0.24, 0.50, 0);
    this.bodyGroup.add(stripeR);

    // 底部装甲衬板 (保护底盘)
    const bellyGeo = this.trackGeometry(new THREE.BoxGeometry(0.85, 0.12, 3.2));
    const belly = new THREE.Mesh(bellyGeo, darkMetalMat);
    belly.position.set(0, 0.16, 0.1);
    this.bodyGroup.add(belly);

    // 车身侧面进气腹鳍 (Side Pods / Air Intakes)
    const sidePodGeo = this.trackGeometry(new THREE.BoxGeometry(0.35, 0.28, 2.2));
    const sidePodL = new THREE.Mesh(sidePodGeo, secondaryMat);
    sidePodL.position.set(-0.65, 0.32, 0.2);
    sidePodL.rotation.y = -0.06;
    sidePodL.castShadow = true;
    this.bodyGroup.add(sidePodL);

    const sidePodR = new THREE.Mesh(sidePodGeo, secondaryMat);
    sidePodR.position.set(0.65, 0.32, 0.2);
    sidePodR.rotation.y = 0.06;
    sidePodR.castShadow = true;
    this.bodyGroup.add(sidePodR);

    // 进气道前口发光环 (Intake Glowing Bezels)
    const intakeBezelGeo = this.trackGeometry(new THREE.BoxGeometry(0.36, 0.04, 0.06));
    const intakeGlowL = new THREE.Mesh(intakeBezelGeo, neonCyanMat);
    intakeGlowL.position.set(-0.65, 0.32, 1.32);
    this.bodyGroup.add(intakeGlowL);

    const intakeGlowR = new THREE.Mesh(intakeBezelGeo, neonCyanMat);
    intakeGlowR.position.set(0.65, 0.32, 1.32);
    this.bodyGroup.add(intakeGlowR);

    // ==========================================
    // 3. F1 / Redout 风格分叉空气动力学前铲 (Twin-Fork Aero Nose)
    // ==========================================
    // 两个向前探出的锋利破风长戟
    const noseForkGeo = this.trackGeometry(new THREE.ConeGeometry(0.24, 1.6, 4));
    
    // 左破风戟
    const noseForkL = new THREE.Mesh(noseForkGeo, primaryMat);
    noseForkL.rotation.x = Math.PI / 2;
    noseForkL.rotation.y = Math.PI / 4;
    noseForkL.scale.set(1.0, 1.0, 0.45);
    noseForkL.position.set(-0.4, 0.28, 2.45);
    noseForkL.castShadow = true;
    this.bodyGroup.add(noseForkL);

    // 右破风戟
    const noseForkR = new THREE.Mesh(noseForkGeo, primaryMat);
    noseForkR.rotation.x = Math.PI / 2;
    noseForkR.rotation.y = Math.PI / 4;
    noseForkR.scale.set(1.0, 1.0, 0.45);
    noseForkR.position.set(0.4, 0.28, 2.45);
    noseForkR.castShadow = true;
    this.bodyGroup.add(noseForkR);

    // 前扰流下分流器 (Aero Splitter Plate)
    const splitterGeo = this.trackGeometry(new THREE.BoxGeometry(1.3, 0.05, 1.0));
    const splitter = new THREE.Mesh(splitterGeo, accentMat);
    splitter.position.set(0, 0.18, 2.1);
    splitter.castShadow = true;
    this.bodyGroup.add(splitter);

    // 前鼻翼发光刃线 (Nose Leading-Edge Glow)
    const noseGlowGeo = this.trackGeometry(new THREE.BoxGeometry(1.28, 0.03, 0.04));
    const noseGlow = new THREE.Mesh(noseGlowGeo, neonOrangeMat);
    noseGlow.position.set(0, 0.20, 2.6);
    this.bodyGroup.add(noseGlow);

    // ==========================================
    // 4. 水滴型战机座舱 (Cockpit Canopy & Avionics)
    // ==========================================
    // 聚合物多面体舱盖
    const canopyGeo = this.trackGeometry(new THREE.CylinderGeometry(0.24, 0.44, 1.7, 8));
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, 0.54, 0.65);
    canopy.castShadow = true;
    this.bodyGroup.add(canopy);

    // 舱盖后脊背导流脊 (Spine Cowling)
    const spineGeo = this.trackGeometry(new THREE.BoxGeometry(0.28, 0.16, 1.6));
    const spine = new THREE.Mesh(spineGeo, accentMat);
    spine.position.set(0, 0.58, -0.6);
    spine.castShadow = true;
    this.bodyGroup.add(spine);

    // 脊背中心发光赛车纹线
    const spineGlowGeo = this.trackGeometry(new THREE.BoxGeometry(0.06, 0.04, 1.8));
    const spineGlow = new THREE.Mesh(spineGlowGeo, neonCyanMat);
    spineGlow.position.set(0, 0.67, -0.5);
    this.bodyGroup.add(spineGlow);

    // ==========================================
    // 5. 复合后掠主飞翼与下折翼端板 (Swept Wings & Down-turned Winglets)
    // ==========================================
    const wingGeo = this.trackGeometry(new THREE.BoxGeometry(1.05, 0.06, 2.0));
    
    // 左后掠翼
    const wingL = new THREE.Mesh(wingGeo, primaryMat);
    wingL.position.set(-1.08, 0.34, -0.1);
    wingL.rotation.z = -0.10; // 掠角下垂
    wingL.rotation.y = -0.16; // 后掠角度
    wingL.castShadow = true;
    this.bodyGroup.add(wingL);

    // 左翼前缘橙色高光板
    const wingEdgeGeo = this.trackGeometry(new THREE.BoxGeometry(1.06, 0.04, 0.14));
    const wingEdgeL = new THREE.Mesh(wingEdgeGeo, accentMat);
    wingEdgeL.position.set(-1.08, 0.35, 0.85);
    wingEdgeL.rotation.z = -0.10;
    wingEdgeL.rotation.y = -0.16;
    this.bodyGroup.add(wingEdgeL);

    // 左下折翼端板 (Winglet)
    const wingletGeo = this.trackGeometry(new THREE.BoxGeometry(0.08, 0.48, 1.6));
    const wingletL = new THREE.Mesh(wingletGeo, accentMat);
    wingletL.position.set(-1.62, 0.22, -0.15);
    wingletL.castShadow = true;
    this.bodyGroup.add(wingletL);

    // 左翼端板外侧霓虹光带
    const wingletGlowGeo = this.trackGeometry(new THREE.BoxGeometry(0.03, 0.04, 1.4));
    const wingletGlowL = new THREE.Mesh(wingletGlowGeo, neonCyanMat);
    wingletGlowL.position.set(-1.67, 0.22, -0.15);
    this.bodyGroup.add(wingletGlowL);

    // 右侧翼板（镜像对称）
    const wingR = new THREE.Mesh(wingGeo, primaryMat);
    wingR.position.set(1.08, 0.34, -0.1);
    wingR.rotation.z = 0.10;
    wingR.rotation.y = 0.16;
    wingR.castShadow = true;
    this.bodyGroup.add(wingR);

    const wingEdgeR = new THREE.Mesh(wingEdgeGeo, accentMat);
    wingEdgeR.position.set(1.08, 0.35, 0.85);
    wingEdgeR.rotation.z = 0.10;
    wingEdgeR.rotation.y = 0.16;
    this.bodyGroup.add(wingEdgeR);

    const wingletR = new THREE.Mesh(wingletGeo, accentMat);
    wingletR.position.set(1.62, 0.22, -0.15);
    wingletR.castShadow = true;
    this.bodyGroup.add(wingletR);

    const wingletGlowR = new THREE.Mesh(wingletGlowGeo, neonCyanMat);
    wingletGlowR.position.set(1.67, 0.22, -0.15);
    this.bodyGroup.add(wingletGlowR);

    // ==========================================
    // 6. 双联重型离子矢量引擎 (Twin Heavy Ion Thruster Pods)
    // ==========================================
    const thrusterCylinderGeo = this.trackGeometry(new THREE.CylinderGeometry(0.28, 0.34, 1.9, 16));
    
    // 左推进舱 (纯净极光白机匣)
    const thrusterL = new THREE.Mesh(thrusterCylinderGeo, primaryMat);
    thrusterL.rotation.x = Math.PI / 2;
    thrusterL.position.set(-0.52, 0.42, -1.25);
    thrusterL.castShadow = true;
    this.bodyGroup.add(thrusterL);

    // 右推进舱 (纯净极光白机匣)
    const thrusterR = new THREE.Mesh(thrusterCylinderGeo, primaryMat);
    thrusterR.rotation.x = Math.PI / 2;
    thrusterR.position.set(0.52, 0.42, -1.25);
    thrusterR.castShadow = true;
    this.bodyGroup.add(thrusterR);

    // 推进舱外置竞速隔热环带 (Hyper Orange Heat Shields)
    const shieldGeo = this.trackGeometry(new THREE.CylinderGeometry(0.32, 0.35, 0.6, 16));
    const shieldL = new THREE.Mesh(shieldGeo, accentMat);
    shieldL.rotation.x = Math.PI / 2;
    shieldL.position.set(-0.52, 0.42, -1.2);
    this.bodyGroup.add(shieldL);

    const shieldR = new THREE.Mesh(shieldGeo, accentMat);
    shieldR.rotation.x = Math.PI / 2;
    shieldR.position.set(0.52, 0.42, -1.2);
    this.bodyGroup.add(shieldR);

    // 引擎尾喷口矢量金属环 (Vector Nozzles)
    const nozzleGeo = this.trackGeometry(new THREE.TorusGeometry(0.30, 0.05, 8, 20));
    
    const nozzleL = new THREE.Mesh(nozzleGeo, neonCyanMat);
    nozzleL.position.set(-0.52, 0.42, -2.2);
    this.bodyGroup.add(nozzleL);

    const nozzleR = new THREE.Mesh(nozzleGeo, neonCyanMat);
    nozzleR.position.set(0.52, 0.42, -2.2);
    this.bodyGroup.add(nozzleR);

    // ==========================================
    // 7. 动态等离子超燃喷射尾焰 (Dynamic Plasma Afterburners)
    // ==========================================
    const flameGeo = this.trackGeometry(new THREE.ConeGeometry(0.28, 1.7, 10));
    const flameCoreGeo = this.trackGeometry(new THREE.ConeGeometry(0.14, 1.0, 10));

    // 左推进尾焰
    this.leftFlameMesh = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.leftFlameMesh.rotation.x = -Math.PI / 2;
    this.leftFlameMesh.position.set(-0.52, 0.42, -3.05);
    this.bodyGroup.add(this.leftFlameMesh);

    this.leftFlameCore = new THREE.Mesh(flameCoreGeo, this.flameCoreMaterial);
    this.leftFlameCore.rotation.x = -Math.PI / 2;
    this.leftFlameCore.position.set(-0.52, 0.42, -2.68);
    this.bodyGroup.add(this.leftFlameCore);

    // 右推进尾焰
    this.rightFlameMesh = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.rightFlameMesh.rotation.x = -Math.PI / 2;
    this.rightFlameMesh.position.set(0.52, 0.42, -3.05);
    this.bodyGroup.add(this.rightFlameMesh);

    this.rightFlameCore = new THREE.Mesh(flameCoreGeo, this.flameCoreMaterial);
    this.rightFlameCore.rotation.x = -Math.PI / 2;
    this.rightFlameCore.position.set(0.52, 0.42, -2.68);
    this.bodyGroup.add(this.rightFlameCore);

    // ==========================================
    // 8. V型双立尾与尾翼空气制动鳍 (V-Tail Stabilizers)
    // ==========================================
    const finGeo = this.trackGeometry(new THREE.BoxGeometry(0.06, 0.75, 1.0));
    
    const finL = new THREE.Mesh(finGeo, accentMat);
    finL.position.set(-0.62, 0.85, -1.35);
    finL.rotation.z = -0.32; // 外倾角
    finL.castShadow = true;
    this.bodyGroup.add(finL);

    const finR = new THREE.Mesh(finGeo, accentMat);
    finR.position.set(0.62, 0.85, -1.35);
    finR.rotation.z = 0.32;
    finR.castShadow = true;
    this.bodyGroup.add(finR);

    // 尾翼外缘发光指示条
    const finGlowGeo = this.trackGeometry(new THREE.BoxGeometry(0.03, 0.72, 0.04));
    const finGlowL = new THREE.Mesh(finGlowGeo, neonCyanMat);
    finGlowL.position.set(-0.76, 0.88, -1.82);
    finGlowL.rotation.z = -0.32;
    this.bodyGroup.add(finGlowL);

    const finGlowR = new THREE.Mesh(finGlowGeo, neonCyanMat);
    finGlowR.position.set(0.76, 0.88, -1.82);
    finGlowR.rotation.z = 0.32;
    this.bodyGroup.add(finGlowR);

    // ==========================================
    // 9. 智能前向鹰眼大灯 (Dual Forward Headlights)
    // ==========================================
    // 左车灯聚光
    this.headLightL = new THREE.SpotLight(0xe0f7ff, 3.5, 30, Math.PI / 7, 0.4, 1.2);
    this.headLightL.position.set(-0.4, 0.32, 2.2);
    this.headLightL.target.position.set(-0.4, 0.0, 15);
    this.bodyGroup.add(this.headLightL);
    this.bodyGroup.add(this.headLightL.target);
    this.lights.push(this.headLightL);

    // 右车灯聚光
    this.headLightR = new THREE.SpotLight(0xe0f7ff, 3.5, 30, Math.PI / 7, 0.4, 1.2);
    this.headLightR.position.set(0.4, 0.32, 2.2);
    this.headLightR.target.position.set(0.4, 0.0, 15);
    this.bodyGroup.add(this.headLightR);
    this.bodyGroup.add(this.headLightR.target);
    this.lights.push(this.headLightR);

    // ==========================================
    // 10. 底盘四角反重力发生器与强力地面投光 (Anti-Grav Emitting Nodes)
    // ==========================================
    const emitterGeo = this.trackGeometry(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16));
    const emitterPositions = [
      [-0.52, 0.12, 1.1],
      [0.52, 0.12, 1.1],
      [-0.52, 0.12, -1.0],
      [0.52, 0.12, -1.0]
    ];

    emitterPositions.forEach(([x, y, z]) => {
      const emitter = new THREE.Mesh(emitterGeo, neonCyanMat);
      emitter.position.set(x, y, z);
      this.bodyGroup.add(emitter);
    });

    // 底盘主反重力青蓝霓虹投光 (Point Light Illuminating Floor)
    this.underGlowLight = new THREE.PointLight(this.glowColor, 3.8, 6.0, 1.5);
    this.underGlowLight.position.set(0, 0.06, 0);
    this.bodyGroup.add(this.underGlowLight);
    this.lights.push(this.underGlowLight);

    // 默认初始待机状态
    this.setThrottle(0);
  }

  /**
   * 动态设置油门输入 (0 ~ 1)，动态驱动推进尾焰喷射长短与高亮发光
   */
  public setThrottle(throttle: number): void {
    if (this.isDisposed) return;
    this.currentThrottle = THREE.MathUtils.clamp(throttle, 0, 1.5);

    // 尾焰根据油门进行伸缩，并叠加高频燃烧抖动模拟
    const baseZ = 0.45 + this.currentThrottle * 2.1;
    const coreZ = 0.5 + this.currentThrottle * 1.8;
    const flicker = 0.94 + Math.random() * 0.12;

    this.leftFlameMesh.scale.set(1.0, 1.0, baseZ * flicker);
    this.rightFlameMesh.scale.set(1.0, 1.0, baseZ * flicker);
    this.leftFlameCore.scale.set(1.0, 1.0, coreZ * flicker);
    this.rightFlameCore.scale.set(1.0, 1.0, coreZ * flicker);

    this.flameMaterial.opacity = 0.45 + this.currentThrottle * 0.55;
    this.flameCoreMaterial.opacity = 0.6 + this.currentThrottle * 0.4;

    if (this.underGlowLight) {
      this.underGlowLight.intensity = 2.5 + this.currentThrottle * 2.5;
    }
  }

  /**
   * 设置转向输入 (-1 ~ 1)，驱动空气动力学侧倾倾角
   */
  public setSteering(steer: number): void {
    if (this.isDisposed) return;
    this.currentSteer = THREE.MathUtils.clamp(steer, -1, 1);
  }

  /**
   * 飞车逐帧悬浮与动态姿态更新
   */
  public update(deltaTime: number): void {
    if (this.isDisposed) return;

    this.hoverTimer += deltaTime;

    // 1. 反重力悬浮浮动计算 (复合正弦波，周期漂浮)
    const hoverY = 0.48 + Math.sin(this.hoverTimer * 3.2) * 0.05 + Math.sin(this.hoverTimer * 1.6) * 0.02;
    const hoverPitch = Math.sin(this.hoverTimer * 2.0) * 0.018;

    // 2. 转向侧倾物理模拟 (最大约 24 度下倾，具有速度感)
    const targetRoll = -this.currentSteer * 0.42;
    this.bodyGroup.rotation.z = THREE.MathUtils.lerp(this.bodyGroup.rotation.z, targetRoll, deltaTime * 8.5);
    this.bodyGroup.rotation.x = THREE.MathUtils.lerp(this.bodyGroup.rotation.x, hoverPitch, deltaTime * 5.0);
    this.bodyGroup.position.y = THREE.MathUtils.lerp(this.bodyGroup.position.y, hoverY, deltaTime * 6.5);

    // 3. 喷火抖动刷新
    this.setThrottle(this.currentThrottle);
  }

  /**
   * 100% 幂等安全彻底释放所有 GPU 显存
   */
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

    while (this.bodyGroup.children.length > 0) {
      this.bodyGroup.remove(this.bodyGroup.children[0]);
    }
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }

  public getDisposedState(): boolean {
    return this.isDisposed;
  }
}
