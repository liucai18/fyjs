# 游戏实机截图文档 (Gameplay Screenshots)

本文档专门用于归档《飞跃极速》各个开发阶段的实机运行截图与渲染效果，便于在 GitHub 上直接查阅与审查。

---

## 阶段 1 · 项目基础与 3D 引擎搭建 (Phase 1)

### 1. 3D 渲染引擎与调试场景初始化
* **文件路径**：`docs/screenshots/stage1_3d_engine_init.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_3d_engine_init.png)
* **包含要素**：
  - **基础场景**：Three.js Scene + PerspectiveCamera + PCFSoftShadowMap 阴影系统。
  - **调试要素**：深色测试地平面、60×60 空间网格辅助线（GridHelper）、中心 3D 坐标轴（AxesHelper）。
  - **光照与材质**：环境光 + 主平行光 + 侧向冷光补光；包含立方体（金属反射）、球体（漫反射/高光）与环形体（复杂深度与阴影）三个验证实体。
  - **调试面板**：右上角半透明实时性能监视器（FPS、单帧耗时、视口分辨率 1628×768、Retina 2.0 DPR、Draw Calls: 6、三角面数: 4302）。

![阶段 1 实机截图](./stage1_3d_engine_init.png)
