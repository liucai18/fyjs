# 《飞跃极速》 (Leap Speed)

> 赛博极速驾驶与空中飞跃 3D Web 游戏。由师父（ChatGPT）负责总体规划与技术把关，徒弟（Antigravity AI）负责落地开发、质量测试与阶段交付。

---

## 阶段 1 · 项目基础与 3D 引擎搭建 (Phase 1)

当前已完成阶段 1 核心基础设施构建：
1. **工程架构**：Vite + TypeScript 现代纯净脚手架，零冗余依赖。
2. **3D 引擎**：基于 Three.js 封装 `Engine`，配置标准 sRGB 色彩空间、ACESFilmic 色调映射、软阴影系统（PCFSoftShadowMap）及多光源照明。
3. **主循环与时间管理**：封装 `Time` 类，采用 `requestAnimationFrame` + `Delta Time` 精准更新，集成页面失焦时间跳跃保护（clamp delta time）。
4. **调试场景与监控**：提供地平面、空间网格（GridHelper）、坐标轴（AxesHelper）以及 PBR 材质高光阴影验证物体；右上角集成轻量实时的帧率（FPS）、单帧耗时（ms）、分辨率及渲染指标监控。

---

## 技术选型

* **构建工具**：[Vite](https://vitejs.dev/)
* **编程语言**：[TypeScript](https://www.typescriptlang.org/)
* **图形渲染**：[Three.js](https://threejs.org/)

---

## 本地启动与构建说明

### 1. 安装依赖
```bash
npm install
```

### 2. 启动本地开发服务
```bash
npm run dev
```
启动后访问 `http://localhost:3000` 即可在浏览器实时体验 3D 场景与调试台。

### 3. 类型检查与生产构建
```bash
npm run build
```
编译产物将生成在 `dist/` 目录下。

### 4. 预览生产构建产物
```bash
npm run preview
```

---

## 项目工程结构

```text
飞跃极速/
├── .agents/                 # AI 对接与上报技能配置
├── docs/
│   └── screenshots/         # 阶段实机运行截图归档
├── src/
│   ├── core/
│   │   ├── Engine.ts        # Three.js 核心引擎封装 (Scene, Camera, Renderer, Light)
│   │   └── Time.ts          # 游戏主循环与失焦保护时间管理器
│   ├── scene/
│   │   └── DebugScene.ts    # 阶段 1 调试场景 (地面、网格、坐标系、测试体)
│   ├── ui/
│   │   └── DebugOverlay.ts  # 实时性能调试数据面板 (FPS, DrawCalls, Triangles)
│   ├── styles/
│   │   └── style.css        # 全局与调试面板样式
│   └── main.ts              # 应用统一启动入口
├── index.html               # 页面入口
├── package.json             # 依赖与脚本定义
├── tsconfig.json            # TypeScript 编译配置
├── vite.config.ts           # Vite 构建与服务配置
└── README.md                # 本文档
```

---

## 阶段交付说明
每次迭代的代码与实机截图均归档在 GitHub 仓库中，供师父查阅与审查。
仓库地址：[https://github.com/liucai18/fyjs](https://github.com/liucai18/fyjs)
