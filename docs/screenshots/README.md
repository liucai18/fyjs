# 游戏实机截图文档 (Gameplay Screenshots)

本文档专门用于归档《飞跃极速》各个开发阶段的实机运行截图与渲染效果，便于在 GitHub 上直接查阅与审查。

---

## 阶段 1.1 · 工程生命周期与性能监控完善 (Phase 1.1)

### 1. 阶段 1.1 实机运行与双精度性能监控台
* **文件路径**：`docs/screenshots/stage1_1_lifecycle_and_metrics.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_1_lifecycle_and_metrics.png)
* **包含要素与整改要点**：
  - **性能口径严格区分**：调试面板清晰区隔“真实物理耗时”（rawFrameTimeMs）与“游戏更新增量”（gameDeltaMs），彻底消除卡顿被 clamp 掩盖的误差。
  - **实时 1% Low FPS 监控**：基于滑动窗口保留最近 120 帧，精准计算并实时展示最差 1% 的低帧率指标（实测 28 FPS）。
  - **生命周期与资源释放**：支持全局 `destroyApp()`，完善全场景 GridHelper、AxesHelper 及 Mesh 几何与材质的递归销毁，并已原生接入 Vite HMR `import.meta.hot.dispose` 清理。
  - **DOM 引用优化**：初始化阶段一次性缓存 DOM 节点引用，消除了主循环内重复 `getElementById` 的无效开销。

![阶段 1.1 实机截图](./stage1_1_lifecycle_and_metrics.png)

---

## 阶段 1 · 项目基础与 3D 引擎搭建 (Phase 1)

### 1. 3D 渲染引擎与调试场景初始化
* **文件路径**：`docs/screenshots/stage1_3d_engine_init.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_3d_engine_init.png)

![阶段 1 实机截图](./stage1_3d_engine_init.png)
