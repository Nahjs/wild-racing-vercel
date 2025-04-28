# Wild Racing Vercel (Vue 3 + Three.js + Rapier)

这是一个基于 Vue 3、Three.js 和 Rapier 的 3D 赛车游戏项目原型。

## 项目目标

创建一个可在 Web 上运行的多人赛车游戏，允许玩家自定义车辆并在不同赛道上比赛。

## 技术栈

*   **前端框架**: [Vue 3](https://vuejs.org/) (使用 Composition API 和 `<script setup>`)
*   **3D 渲染**: [Three.js](https://threejs.org/)
*   **物理引擎**: [Rapier](https://rapier.rs/) (@dimforge/rapier3d-compat) (高性能Rust物理引擎)
*   **状态管理**: [Pinia](https://pinia.vuejs.org/)
*   **路由**: [Vue Router](https://router.vuejs.org/)
*   **构建工具**: [Vite](https://vitejs.dev/)
*   **语言**: JavaScript 

## 项目结构

```
.
├── public/              # 静态文件 (直接复制到构建输出)
│   ├── libs/            # 第三方库 (如 Draco decoder)
│   ├── track/           # 赛道模型文件
│   │   └── karting_club_lider__karting_race_track_early.glb # 卡丁车赛道模型
├── src/
│   ├── assets/             # 静态资源 (图片, 字体等，会被 Vite 处理)
│   ├── components/         # 可复用组件
│   │   ├── race/           # 比赛界面相关组件
│   │   │   ├── LapTimer.vue      # 圈速计时器组件
│   │   │   ├── RaceCountdown.vue # 比赛倒计时组件
│   │   │   ├── RaceHUD.vue       # 比赛界面HUD容器组件
│   │   │   ├── RaceResults.vue   # 比赛结果显示组件
│   │   │   └── Speedometer.vue   # 车速显示组件
│   ├── composables/        # 可复用的组合式函数
│   │   ├── useCamera.js         # 相机控制逻辑
│   │   ├── useInputControls.js  # 封装键盘/触摸输入逻辑
│   │   ├── useRaceLogic.js      # 封装比赛逻辑 (计时、检查点、比赛状态)
│   │   ├── useSceneSetup.js     # 封装 Three.js 场景基础设置
│   │   └── useRapierPhysics.js  # 封装 Rapier 物理世界管理
│   ├── config/             # 项目配置
│   │   └── vehicles.js     # 车辆基础数据列表
│   ├── core/               # 游戏核心底层逻辑
│   │   ├── input/          # 输入管理
│   │   │   └── InputManager.js # 定义 ControlState, Keyboard/TouchController
│   │   ├── physics/        # 物理引擎封装和交互
│   │   │   ├── rapier/     # Rapier物理引擎相关实现
│   │   │   │   ├── shapes/           # 碰撞形状生成器
│   │   │   │   ├── RapierAdapter.js  # 适配器，简化迁移
│   │   │   │   ├── RapierRigidBodyFactory.js  # 刚体和碰撞体创建工厂
│   │   │   │   └── RapierWorld.js    # Rapier世界管理类
│   │   ├── collision/      # 碰撞检测和管理
│   │   │   ├── CollisionManager.js  # 统一管理碰撞事件和碰撞回调
│   │   │   ├── CollisionShapes.js   # 管理物体的碰撞体
│   │   │   └── rapier/     # Rapier专用碰撞系统
│   │   │       ├── RapierCollisionManager.js  # Rapier碰撞管理器
│   │   │       └── feedback/         # 碰撞反馈系统
│   │   ├── feedback/       # 碰撞反馈管理
│   │   │   └── CollisionFeedback.js # 处理碰撞的视觉、音效和物理反馈
│   │   └── utilities/      # 辅助功能
│   │       └── CollisionUtils.js    # 碰撞体计算、物理状态转换等工具函数
│   ├── game/               # 核心游戏玩法逻辑
│   │   ├── race/           # 比赛逻辑 (未来可包含状态管理, 规则)
│   │   ├── track/          # 赛道相关
│   │   │   ├── CheckpointSystem.js # 检查点逻辑处理
│   │   │   ├── TrackEditor.vue     # 赛道编辑器 UI 和逻辑
│   │   │   ├── TrackGenerator.js   # 程序化生成赛道逻辑
│   │   │   ├── TrackManager.js     # 加载和管理预设赛道模型
│   │   │   └── TrackObjects.js     # 管理赛道上的物体 (障碍物、道具)
│   │   ├── vehicle/        # 旧版Cannon.js车辆系统 (已弃用)
│   │   │   ├── VehicleController.vue # 车辆物理控制和输入响应
│   │   │   ├── VehiclePhysics.js   # 创建车辆物理 Body (chassis)
│   │   │   └── VehicleRenderer.vue # 车辆模型加载和视觉更新
│   │   └── rapier/         # Rapier物理引擎车辆系统
│   │       └── vehicle/
│   │           ├── VehicleController_Rapier.vue # 基于Rapier的车辆控制器
│   │           ├── VehiclePhysics_Rapier.js    # 基于Rapier的车辆物理实现
│   │           └── VehicleDebugUI.vue         # 车辆物理调试UI
│   ├── debug/          # 调试工具模块
│           ├── RaceDebug.vue       # 比赛调试面板
│           └── GarageDebug.vue    # 车库调试面板
│   ├── router/             # 路由配置
│   │   └── index.js
│   ├── services/           # API 请求或其他外部服务
│   │   ├── settingsService.js # 用户设置读写服务
│   │   ├── trackService.js    # 赛道数据读写服务
│   │   └── vehicleService.js  # 车辆数据读写服务 (调校等)
│   ├── store/              # 全局状态管理 (Pinia stores)
│   │   └── tuning.js       # 车辆调校参数状态
│   ├── styles/             # 全局样式或 SASS/LESS 变量
│   ├── utils/              # 通用工具函数
│   │   ├── db.js           # IndexedDB 数据库交互封装
│   │   ├── contactShadow.js # 接触阴影实现 (可能需要调整)
│   │   ├── loaders/        # Three.js 加载器封装 (GLTFLoader, DRACOLoader)
│   │   └── shaders/        # GLSL 着色器代码 (用于特殊效果如模糊)
│   ├── views/              # 页面级组件 (视图)
│   │   ├── Garage.vue      # 车库视图
│   │   ├── Home.vue        # 主页视图
│   │   ├── Profile.vue     # 个人中心视图
│   │   ├── Race.vue        # 比赛视图
│   │   └── TrackEditorView.vue # 赛道编辑器视图
│   ├── App.vue             # 应用根组件
│   └── main.js             # 应用入口文件
├── .env                    # 环境变量
├── .gitignore
├── index.html              # 入口 HTML 文件
├── jsconfig.json           # JS 配置 (推荐换成 tsconfig.json)
├── package.json
├── README.md               # 项目说明文档
└── vite.config.js          # Vite 配置文件
```

## 主要文件/模块说明

### `src/views` - 视图层

*   **`Home.vue`**: 应用首页，展示游戏特色和入口。
*   **`Garage.vue`**: 车库界面，用于选择、预览和可能的基础改装车辆。
*   **`Race.vue`**: 核心比赛场景，整合物理引擎、车辆控制、渲染和比赛逻辑。
*   **`Profile.vue`**: 玩家个人中心，展示统计数据、成就和设置。

### `src/components/race` - 比赛UI组件

*   **`Speedometer.vue`**: 车速表组件，显示当前车辆速度。
*   **`LapTimer.vue`**: 圈速计时器组件，显示当前圈数、当前圈速、最佳圈速和总时间。
*   **`RaceCountdown.vue`**: 比赛倒计时组件，显示比赛开始前的倒计时。
*   **`RaceResults.vue`**: 比赛结果组件，显示比赛结束后的各项成绩。
*   **`RaceHUD.vue`**: 比赛界面HUD容器组件，整合上述组件并管理其显示逻辑。

### `src/composables` - 组合式函数

*   **`useRaceLogic.js`**: 封装比赛核心逻辑，包括计时、圈数计算、检查点逻辑和比赛状态管理。
*   **`useInputControls.js`**: 封装输入监听器的设置和清理，提供响应式的 `controlState`。
*   **`useCamera.js`**: 封装相机控制逻辑，提供多种相机视角模式和切换功能。
*   **`useSceneSetup.js`**: 封装 Three.js 场景的基本设置（相机、渲染器、灯光、地面、网格）。
*   **`useRapierPhysics.js`**: 管理 Rapier 物理世界的生命周期（初始化、更新、销毁）。

### `src/game` - 游戏核心逻辑

*   **`game/rapier/vehicle/`**:
    *   `VehicleController_Rapier.vue`: 负责基于 Rapier 的车辆控制，处理用户输入并更新车辆状态。
    *   `VehiclePhysics_Rapier.js`: 实现基于 Rapier 的车辆物理系统，包括悬挂、转向、驱动力和刹车。
    *   `VehicleDebugUI.vue`: 提供实时调整车辆物理参数的界面，方便调试和优化。
*   **`game/track/`**:
    *   `TrackManager.js`: 加载和管理从 `.glb` 文件定义的预设赛道模型，提取检查点，并设置护栏碰撞检测。
    *   `CheckpointSystem.js`: 处理检查点通过逻辑、计时和计圈。

### `src/core` - 底层核心

*   **`core/physics/rapier/`**:
    *   `RapierWorld.js`: 管理 Rapier 物理世界的生命周期（初始化、更新、事件处理、调试绘制）。
    *   `RapierAdapter.js`: 提供兼容层，封装 Rapier 常用操作，简化从 Cannon.es 的迁移。
    *   `RapierRigidBodyFactory.js`: 创建各种类型的 Rapier 刚体和碰撞体。
*   **`core/collision/`**:
    *   `CollisionManager.js`: 统一管理碰撞事件和碰撞回调，使用事件驱动的方式降低系统耦合度。
    *   `CollisionShapes.js`: 负责为游戏对象创建和管理适当的碰撞体。
    *   `rapier/`: 基于 Rapier 的新碰撞系统实现。
*   **`core/feedback/`**:
    *   `CollisionFeedback.js`: 处理碰撞的视觉效果（粒子）、音效反馈和物理反馈。
*   **`core/utilities/`**:
    *   `CollisionUtils.js`: 提供碰撞检测和物理转换的辅助工具函数。

### `src/store` - 状态管理 (Pinia)

*   **`tuning.js`**: 管理当前车辆的可调校参数（如引擎功率、悬挂硬度等）的加载、保存和更新。

### `src/services` - 数据服务

*   **`vehicleService.js`**: 与 IndexedDB 交互，用于读取和保存车辆的自定义设置（包括调校参数）。
*   **`trackService.js`**: 与 IndexedDB 交互，用于保存和加载用户创建或编辑的赛道数据。
*   **`settingsService.js`**: 与 IndexedDB 交互，用于保存和加载用户偏好设置。

### `src/debug` - 调试模块

*   **`GarageDebug.vue`**: 用于车库场景的调试面板，可调整车辆模型变换、颜色、相机等。

### `src/utils` - 工具函数

*   **`db.js`**: IndexedDB 的简单封装，提供增删改查接口。
*   **`loaders/`**: 封装 Three.js 的模型加载器。
*   **`contactShadow.js`, `shaders/`**: 实现接触阴影效果。

## 如何开始

1.  **安装依赖**:
    ```bash
    npm install
    # 或者
    yarn install
    # 或者
    pnpm install
    ```
2.  **运行开发服务器**:
    ```bash
    npm run dev
    # 或者
    yarn dev
    # 或者
    pnpm dev
    ```
3.  在浏览器中打开显示的本地地址 (通常是 `http://localhost:3001`)。

## 比赛界面模块化结构

比赛界面现已模块化重构，主要包括以下几个部分：

1. **核心比赛逻辑**:
   - `src/composables/useRaceLogic.js` - 封装计时、圈数计算、检查点逻辑、比赛状态管理等核心逻辑，使 Race.vue 更专注于视图协调。

2. **UI 组件**:
   - `src/components/race/Speedometer.vue` - 显示车速。
   - `src/components/race/LapTimer.vue` - 显示圈数、当前圈速、最佳圈速、总时间。
   - `src/components/race/RaceCountdown.vue` - 显示比赛开始前的倒计时。
   - `src/components/race/RaceResults.vue` - 显示比赛结束后的结果和重新开始按钮。
   - `src/components/race/RaceHUD.vue` - 作为容器，组合上述 UI 组件，统一管理 HUD 的显示逻辑。

3. **Race.vue 职责**:
   - 作为主容器，负责加载 3D 场景、物理引擎、车辆渲染器、车辆控制器。
   - 初始化并协调 TrackManager 和比赛逻辑模块 (useRaceLogic)。
   - 根据比赛状态，控制 UI 组件的显示。
   - 将需要的数据（如速度、时间、圈数）传递给相应的 UI 组件。

4. **赛道加载**:
   - 使用 `TrackManager` 在比赛界面加载赛道模型，目前使用 `/track/karting_club_lider__karting_race_track_early.glb`。
   - 从赛道模型中获取检查点信息和起点位置。

## Rapier 物理引擎升级

项目已从 Cannon-es 迁移到 Rapier 物理引擎，带来以下优势：

1. **性能提升**:
   - Rapier 使用 Rust 编写并通过 WebAssembly 编译，性能显著优于纯 JavaScript 实现。
   - 支持多线程物理计算（WebWorkers），避免主线程阻塞。
   - 高效的碰撞检测算法，可处理更复杂的场景。

2. **精确碰撞检测**:
   - 支持凸包（Convex Hull）和三角网格（Trimesh）碰撞体，能更精确地模拟不规则物体。
   - 提供连续碰撞检测（CCD），避免高速物体穿模问题。
   - 实现了更精确的护栏和地形碰撞检测。

3. **高级车辆物理**:
   - 新实现的 `VehiclePhysics_Rapier` 提供更真实的悬挂系统模拟。
   - 改进的转向模型，包括阿克曼转向几何和速度相关转向阻尼。
   - 更精确的轮胎物理，包括抓地力、侧滑和漂移机制。

4. **调试工具**:
   - `VehicleDebugUI.vue` 提供实时调整物理参数的界面。
   - 内置的碰撞形状可视化工具，方便调试碰撞问题。

## 新的碰撞检测系统（规划中）

基于 Rapier 引擎，项目正在规划实现更加先进的碰撞检测和反馈系统：

1. **系统架构**:
   - 分层设计，将碰撞检测、碰撞处理和反馈机制解耦。
   - 基于事件的碰撞处理，支持不同系统（如UI、音效）响应碰撞事件。

2. **计划功能**:
   - **复合碰撞体**: 使用多个基本形状组合成更精确的碰撞体。
   - **材质系统**: 为不同表面定义物理属性（摩擦、反弹等）。
   - **车身变形**: 根据碰撞力度和方向实现临时或永久变形。
   - **丰富的视觉反馈**: 根据碰撞类型生成火花、碎片等效果。
   - **动态音效**: 基于材质和力度混合不同的碰撞音效。

3. **性能优化**:
   - 碰撞分组和掩码系统控制碰撞检测范围。
   - 空间分区技术（八叉树）优化宽相碰撞检测。
   - 动态细节级别调整碰撞体精度。

## 后续开发建议

*   **完善 Rapier 碰撞系统**: 实现规划中的高级碰撞检测和反馈系统，提升游戏真实感。
*   **多赛道支持**: 实现更多赛道的加载与切换，并为每个赛道提供预览和难度信息。
*   **多车辆支持**: 为不同类型的车辆提供特定的物理参数和视觉效果。
*   **完善比赛逻辑**: 增加排名、计时榜、AI对手等功能。
*   **车库功能完善**: 在 `Garage.vue` 中实现更丰富的车辆定制功能，并与 `vehicleService` 和 `tuningStore` 结合。
*   **性能优化**: 进一步优化复杂场景下的渲染和物理性能。
*   **网络同步**: 实现多人游戏所需的网络逻辑，考虑使用确定性物理进行状态同步。
*   **环境影响**: 实现不同路面材质（如沥青、泥地、冰面）对车辆操控的影响。
*   **天气系统**: 添加天气变化（雨、雪等）及其对赛道条件的影响。
*   **TypeScript**: 考虑将项目迁移到 TypeScript 以增强代码健壮性。
*   **UI/UX 改进**: 优化比赛界面、车库界面等的视觉效果和用户体验。

---
