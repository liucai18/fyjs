# 游戏实机截图文档 (Gameplay Screenshots)

本文档专门用于归档《飞跃极速》各个开发阶段的实机运行截图与渲染效果，便于在 GitHub 上直接查阅与审查。

---

## 阶段 2 · 原创科幻赛车与基础驾驶系统实机运行 (Phase 2)

### 1. 阶段 2 起跑线待命实机画面 (Starting Grid)
* **文件路径**：`docs/screenshots/stage2_starting_grid.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage2_starting_grid.png)
* **核心内容**：第三人称智能跟随机位、起跑线门架拱门、霓虹赛道护栏与实时航速仪表盘（0 km/h）。

![阶段 2 起跑线实机截图](./stage2_starting_grid.png)

### 2. 阶段 2 极速直线冲刺实机画面 (High Speed Driving)
* **文件路径**：`docs/screenshots/stage2_high_speed_driving.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage2_high_speed_driving.png)
* **核心内容**：W键加速冲刺、双联重型离子矢量引擎满油门拉长超燃等离子尾焰、速度FOV景深自适应拉伸。

![阶段 2 极速冲刺实机截图](./stage2_high_speed_driving.png)

### 3. 阶段 2 弯道极限过弯与侧倾实机画面 (Curve Cornering)
* **文件路径**：`docs/screenshots/stage2_curve_cornering.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage2_curve_cornering.png)
* **核心内容**：127 km/h 高速大弯道转向、飞车物理侧倾倾角、赛道护栏碰撞反弹约束保护。

![阶段 2 极限过弯实机截图](./stage2_curve_cornering.png)

---

## 阶段 1.4 · 终极质量闭环与实机真机运行 (Phase 1.4)

### 1. 阶段 1.4 终极闭环实机运行与监控台
* **文件路径**：`docs/screenshots/stage1_4_verified.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_4_verified.png)
* **核心升级要点**：
  - **渲染器释放双重独立容错**：`renderer.dispose()` 与 `renderer.forceContextLoss()` 独立隔离包裹，杜绝驱动崩溃中断上下文销毁。
  - **HMR 真实事件切断闭环**：通过真机向 window 派发真实 `DOMContentLoaded` 事件验证监听器彻底切断，杜绝幽灵回调。
  - **构造失败二次容错**：即使清理分支自身发生异常，依然保证原始初始化错误完整向上抛出，且上下文强制销毁不遗漏。
  - **14/14 全绿自动化测试套件 + GitHub Actions CI**：全自动化质量大门守卫。

![阶段 1.4 实机截图](./stage1_4_verified.png)

---

## 阶段 1.2 · 最终整改验收与自动化质检 (Phase 1.2)

### 1. 阶段 1.2 最终版实机运行与高精度监控台
* **文件路径**：`docs/screenshots/stage1_2_final_verification.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_2_final_verification.png)
* **核心升级要点**：
  - **1000 帧大容量滑动窗口**：高精度计算真实 1% Low FPS，样本不足 60 帧自动标定预热状态。
  - **150ms DOM 节流**：面板数据刷新采用 150ms 节流调度，彻底免除高频重绘损耗。
  - **Set 去重与幂等资源释放**：全场景几何体与材质通过 Set 集合去重释放，`dispose()` 幂等安全重复调用。
  - **9/9 自动化测试保障**：配置 Vitest 全自动化测试套件（覆盖 1% Low 统计、时间暂停恢复、重复销毁幂等性、初始化失败回滚），100% 通过。

![阶段 1.2 实机截图](./stage1_2_final_verification.png)

---

## 阶段 1.1 · 工程生命周期与性能监控完善 (Phase 1.1)

### 1. 阶段 1.1 实机运行与双精度性能监控台
* **文件路径**：`docs/screenshots/stage1_1_lifecycle_and_metrics.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_1_lifecycle_and_metrics.png)

![阶段 1.1 实机截图](./stage1_1_lifecycle_and_metrics.png)

---

## 阶段 1 · 项目基础与 3D 引擎搭建 (Phase 1)

### 1. 3D 渲染引擎与调试场景初始化
* **文件路径**：`docs/screenshots/stage1_3d_engine_init.png`
* **GitHub 直链**：[查看图片](https://raw.githubusercontent.com/liucai18/fyjs/main/docs/screenshots/stage1_3d_engine_init.png)

![阶段 1 实机截图](./stage1_3d_engine_init.png)
