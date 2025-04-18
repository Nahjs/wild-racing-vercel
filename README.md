# Wild Racing Vercel (Vue 3 + Three.js + Cannon-es)

这是一个基于 Vue 3、Three.js 和 Cannon-es 的 3D 赛车游戏项目原型。

## 项目目标

(创建一个可在 Web 上运行的多人赛车游戏，允许玩家自定义车辆并在不同赛道上比赛。)

## 技术栈

*   **前端框架**: [Vue 3](https://vuejs.org/) (使用 Composition API 和 `<script setup>`)
*   **3D 渲染**: [Three.js](https://threejs.org/)
*   **物理引擎**: [Cannon-es](https://pmndrs.github.io/cannon-es/) (一个 Cannon.js 的维护分支)
*   **状态管理**: [Pinia](https://pinia.vuejs.org/)
*   **路由**: [Vue Router](https://router.vuejs.org/)
*   **构建工具**: [Vite](https://vitejs.dev/)
*   **语言**: JavaScript 

## 项目结构

```
.
├── public/              # 静态文件 (直接复制到构建输出)
│   ├── libs/            # 第三方库 (如 Draco decoder)
├── src/
│   ├── assets/             # 静态资源 (图片, 字体等，会被 Vite 处理)
│   ├── composables/        # 可复用的组合式函数
│   │   ├── useInputControls.js # 封装键盘/触摸输入逻辑
│   │   └── useSceneSetup.js    # 封装 Three.js 场景基础设置
│   ├── config/             # 项目配置
│   │   └── vehicles.js     # 车辆基础数据列表
│   ├── core/               # 游戏核心底层逻辑
│   │   ├── input/          # 输入管理
│   │   │   └── InputManager.js # 定义 ControlState, Keyboard/TouchController
│   │   ├── physics/        # 物理引擎封装和交互
│   │   │   └── PhysicsWorld.js # 创建物理世界、地面、调试器等辅助函数
│   │   │   └── PhysicsEngine.js # 物理引擎
│   ├── game/               # 核心游戏玩法逻辑
│   │   ├── race/           # 比赛逻辑 (未来可包含状态管理, 规则)
│   │   ├── track/          # 赛道相关
│   │   │   ├── CheckpointSystem.js # 检查点逻辑处理
│   │   │   ├── TrackEditor.vue     # 赛道编辑器 UI 和逻辑
│   │   │   ├── TrackGenerator.js   # 程序化生成赛道逻辑
│   │   │   ├── TrackManager.js     # 加载和管理预设赛道模型
│   │   │   └── TrackObjects.js     # 管理赛道上的物体 (障碍物、道具)
│   │   └── vehicle/        # 车辆相关
│   │       ├── VehicleController.vue # 车辆物理控制和输入响应
│   │       ├── VehiclePhysics.js   # 创建车辆物理 Body (chassis)
│   │       └── VehicleRenderer.vue # 车辆模型加载和视觉更新
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
*   **`TrackEditorView.vue`**: 赛道编辑器界面，用于创建和编辑赛道。
*   **`Profile.vue`**: 玩家个人中心，展示统计数据、成就和设置。

### `src/game` - 游戏核心逻辑

*   **`game/vehicle/`**:
    *   `VehicleRenderer.vue`: 负责加载和显示车辆 3D 模型，并根据物理状态更新视觉。
    *   `VehicleController.vue`: 负责车辆的物理模拟控制 (使用 Cannon-es RaycastVehicle)，响应玩家输入，并与 `tuningStore` 交互获取调校参数。
    *   `VehiclePhysics.js`: 辅助函数，用于创建车辆的物理 Chassis Body。
*   **`game/track/`**:
    *   `TrackManager.js`: 加载和管理从 `.glb` 文件定义的预设赛道模型，提取检查点。
    *   `TrackGenerator.js`: 程序化生成赛道几何体和物理形状。
    *   `TrackObjects.js`: 管理放置在赛道上的物体（如锥桶、坡道），包括模型加载和物理。
    *   `CheckpointSystem.js`: 处理检查点通过逻辑、计时和计圈。
    *   `TrackEditor.vue`: 赛道编辑器的 UI 和交互逻辑组件。

### `src/core` - 底层核心

*   **`core/input/InputManager.js`**: 定义键盘和触摸（待实现）输入的控制器类和状态。
*   **`core/physics/PhysicsWorld.js`**: 提供创建 Cannon-es 物理世界、地面和调试渲染器的辅助函数。

### `src/composables` - 组合式函数

*   **`useInputControls.js`**: 封装输入监听器的设置和清理，提供响应式的 `controlState`。
*   **`useSceneSetup.js`**: 封装 Three.js 场景的基本设置（相机、渲染器、灯光、地面、网格），简化视图组件中的场景初始化代码。

### `src/store` - 状态管理 (Pinia)

*   **`tuning.js`**: 管理当前车辆的可调校参数（如引擎功率、悬挂硬度等）的加载、保存和更新。

### `src/services` - 数据服务

*   **`vehicleService.js`**: 与 IndexedDB 交互，用于读取和保存车辆的自定义设置（包括调校参数）。
*   **`trackService.js`**: 与 IndexedDB 交互，用于保存和加载用户创建或编辑的赛道数据。
*   **`settingsService.js`**: 与 IndexedDB 交互，用于保存和加载用户偏好设置。

### `src/modules/debug` - 调试模块

*   **`components/GarageDebug.vue`**: 用于车库场景的调试面板，可调整车辆模型变换、颜色、相机等。
*   **`components/DebugControls.vue`**: 用于比赛场景的调试面板，实时调整车辆物理调校参数。

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

## 后续开发建议

*   **赛道与检查点集成**: 在 `Race.vue` 或相关逻辑中，实现赛道加载（使用 `TrackManager` 或 `TrackGenerator`），并将其生成的检查点数据传递给 `CheckpointSystem` 进行初始化。
*   **完善比赛逻辑**: 在 `Race.vue` 或提取出的 `useRaceLogic` 中，结合 `CheckpointSystem` 实现完整的比赛流程（开始、计时、计圈、结束）。
*   **车库功能完善**: 在 `Garage.vue` 中实现更丰富的车辆定制功能，并与 `vehicleService` 和 `tuningStore` 结合。
*   **物理引擎组件**: 处理 `Race.vue` 中引用的 `@/physics/PhysicsEngine.vue` 文件（创建、移动或移除引用）。
*   **TypeScript**: 考虑将项目迁移到 TypeScript 以增强代码健壮性。
*   **UI/UX 改进**: 优化比赛界面、车库界面等的视觉效果和用户体验。
*   **性能优化**: 对 3D 渲染和物理模拟进行性能分析和优化。
*   **网络同步**: 实现多人游戏所需的网络逻辑。

---

(请根据你的项目实际情况填充和修改这个 README 文件。) 