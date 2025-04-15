<template>
  <div ref="canvas" class="scene">
    <div class="color-picker">
      <div class="light-color-picker color-picker-wrap">
        <div>
          <input v-model="wheelColor" type="color" />
        </div>
        <div>轮毂色</div>
      </div>
      <div class="car-color-picker color-picker-wrap">
        <div>
          <input v-model="carCoatColor" type="color" />
        </div>
        <div>车身色</div>
      </div>
    </div>
    
    <div class="vehicle-selector">
      <select :value="currentVehicle.id" @change="onVehicleChange($event.target.value)">
        <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
          {{ vehicle.name }}
        </option>
      </select>
    </div>

    <!-- 调试面板 -->
    <div class="debug-panel" v-if="showDebug">
      <h3>调试面板</h3>
      <div class="debug-controls">
        <div class="control-group">
          <label>缩放比例 (scale)</label>
          <input type="number" v-model.number="debugScale" step="0.1" min="0.01" max="1000" @change="updateModelScale" />
        </div>
        <div class="control-group">
          <label>位置</label>
          <div class="position-group">
            <input type="number" v-model.number="debugPosition[0]" step="0.1" min="-100" max="100" @change="updateModelPosition" placeholder="X" />
            <input type="number" v-model.number="debugPosition[1]" step="0.1" min="-100" max="100" @change="updateModelPosition" placeholder="Y" />
            <input type="number" v-model.number="debugPosition[2]" step="0.1" min="-100" max="100" @change="updateModelPosition" placeholder="Z" />
          </div>
        </div>
        <div class="control-group">
          <label>旋转 Y (弧度)</label>
          <input type="number" v-model.number="debugRotationY" step="0.1" min="-6.28318" max="6.28318" @change="updateRotationAndSave" />
        </div>
        <div class="control-group">
          <label>预设朝向</label>
          <div class="rotation-presets">
            <button @click="setRotation(0)">0°</button>
            <button @click="setRotation(Math.PI/2)">90°</button>
            <button @click="setRotation(Math.PI)">180°</button>
            <button @click="setRotation(-Math.PI/2)">-90°</button>
          </div>
        </div>
        <button @click="saveCurrentSettings" :disabled="isSaving">
          <span v-if="isSaving">保存中...</span>
          <span v-else>保存当前设置</span>
        </button>
        
        <!-- 保存状态提示 -->
        <div class="save-status" :class="saveStatus" v-if="saveStatus !== ''">
          <span v-if="saveStatus === 'saving'">正在保存...</span>
          <span v-else-if="saveStatus === 'saved'">已保存</span>
          <span v-else-if="saveStatus === 'error'">保存失败</span>
          <span v-else-if="saveStatus === 'offline'">离线模式：更改将在网络恢复后同步</span>
        </div>
      </div>

      <h3 style="margin-top: 20px;">相机设置</h3>
      <div class="debug-controls">
        <div class="control-group">
          <label>相机位置</label>
          <div class="position-group">
            <input type="number" v-model.number="cameraPosition[0]" step="0.1" min="-100" max="100" @keyup.enter="updateCameraPosition" placeholder="X" />
            <input type="number" v-model.number="cameraPosition[1]" step="0.1" min="-100" max="100" @keyup.enter="updateCameraPosition" placeholder="Y" />
            <input type="number" v-model.number="cameraPosition[2]" step="0.1" min="-100" max="100" @keyup.enter="updateCameraPosition" placeholder="Z" />
          </div>
        </div>
        <div class="control-group">
          <label>视野角度 (FOV)</label>
          <input type="number" v-model.number="cameraFov" step="1" @input="updateCameraFov" min="1" max="180" />
        </div>
        <div class="control-group">
          <label>自动旋转</label>
          <input type="checkbox" v-model="autoRotate" @change="toggleAutoRotate" />
        </div>
      </div>

      <h3 style="margin-top: 20px;">参考网格</h3>
      <div class="debug-controls">
        <div class="control-group">
          <label>辅助线</label>
          <div class="helper-controls">
            <label>
              <input type="checkbox" v-model="showGrid" @change="toggleGridHelper" />
              网格
            </label>
            <label>
              <input type="checkbox" v-model="showAxes" @change="toggleAxesHelper" />
              坐标轴
            </label>
          </div>
        </div>
        <div class="control-group" v-if="showAxes">
          <div class="axes-legend">
            <div class="axis-item">
              <span class="axis-color" style="background: #ff0000"></span>
              <span>X轴: 右+/左-</span>
            </div>
            <div class="axis-item">
              <span class="axis-color" style="background: #00ff00"></span>
              <span>Y轴: 上+/下-</span>
            </div>
            <div class="axis-item">
              <span class="axis-color" style="background: #0000ff"></span>
              <span>Z轴: 外+/内-</span>
            </div>
          </div>
        </div>
        <div class="control-group" v-if="showGrid">
          <label>网格大小</label>
          <input type="number" v-model.number="gridSize" step="1" min="1" max="1000" @keyup.enter="updateGridHelper" />
        </div>
        <div class="control-group" v-if="showGrid">
          <label>网格密度</label>
          <input type="number" v-model.number="gridDivisions" step="1" min="1" max="1000" @keyup.enter="updateGridHelper" />
        </div>
        <div class="control-group" v-if="showAxes">
          <label>坐标轴长度</label>
          <input type="number" v-model.number="axesSize" step="1" min="1" max="1000" @keyup.enter="updateAxesHelper" />
        </div>
      </div>

      <div class="button-group">
        <button @click="saveCurrentSettings" :disabled="isSaving">
          <span v-if="isSaving">保存中...</span>
          <span v-else>保存当前设置</span>
        </button>
        <button @click="resetSettings">重置所有设置</button>
        <button @click="viewSavedConfigs">查看已保存配置</button>
        <button @click="exportConfigs">导出所有配置</button>
        <button @click="importConfigs">导入配置</button>
      </div>
    </div>
    
    <!-- 操作结果提示 -->
    <div class="notification" v-if="notification.show">
      <div class="notification-content" :class="notification.type">
        <span>{{ notification.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  SpotLight,
  AmbientLight,
  Group,
  WebGLCubeRenderTarget,
  CubeCamera,
  Mesh,
  Vector3,
  Color,
  SphereGeometry,
  MeshPhongMaterial,
  PlaneGeometry,
  Clock,
  HalfFloatType,
  ACESFilmicToneMapping,
  sRGBEncoding,
  PCFSoftShadowMap,
  DoubleSide,
  GridHelper,
  AxesHelper,
} from "three";
import { GLTFLoader } from "@/utils/loaders/GLTFLoader";
import { DRACOLoader } from "@/utils/loaders/DRACOLoader";
import { OrbitControls } from "@/utils/controls/OrbitControls";

import {
  getMaterials,
  changModel,
  generateVirtualLight,
  createContactShadow,
  setMovingSpot,
  floatMesh,
  createCustomMaterial,
} from "@/utils/utils";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { GUI } from "@/utils/libs/lil-gui.module.min";
import { vehiclesList, getVehicles } from '@/config/vehicles';
import { vehicleService } from './services/vehicleService';
import { settingsService } from './services/settingsService';
import { debounce, isOnline } from '@/utils/helpers';

//屏幕长比
const RADIO = window.innerWidth / window.innerHeight;
// 当前显示设备的物理像素分辨率与CSS像素分辨率之比
const DPR = window.devicePixelRatio;

// canvas 容器
const canvas = ref();

// 场景对象
let scene;

// 虚拟场景对象
let virtualScene = new Scene();
// 虚拟背景
let virtualBackgroundMesh;
/**
 * 透视摄像机
 * @param fov 第一个参数是视野角度（FOV）。视野角度就是无论在什么时候，你所能在显示器上看到的场景的范围，它的单位是角度(与弧度区分开)
 * @param ratio 第二个参数是长宽比（aspect ratio）。 也就是你用一个物体的宽除以它的高的值。比如说，当你在一个宽屏电视上播放老电影时，可以看到图像仿佛是被压扁的。
 * @param near 近截面（near）。
 * @param far 远截面（far）。
 * @type {PerspectiveCamera}
 */
let camera = new PerspectiveCamera(30, RADIO);

// 聚光灯对象
let spotLight = new SpotLight();

// 环境光
let ambientLight = new AmbientLight(0x404040);

/**
 * 渲染器，用WebGL渲染出你精心制作的场景
 * 高性能
 * 抗锯齿
 * 开启alpha通道
 * @type {WebGLRenderer}
 */
let renderer = new WebGLRenderer({
  powerPreference: "high-performance",
  antialias: true,
  alpha: true,
});

// 3D 模型对象
let model;
const modelZ = 0;

// 模型的接触阴影对象
let shadowGroup = new Group();

// 车身颜色
let carCoatColor = ref("#2f426f");

// 轮毂颜色
let wheelColor = ref("#1a1a1a");

// 相机控制对象
let controls;

// 相机运动锁
let cameraMoveClock = false;
/**
 * @description 设置相机
 */

const setCamera = () => {
  camera.position.set(0, 0.8, 8);
  camera.castShadow = true;

  scene.add(camera);
};

/**
 * @description 设置聚光灯
 */

const setSpotLight = () => {
  spotLight.position.set(0, 15, 0);
  spotLight.intensity = 3;
  spotLight.penumbra = 1;
  spotLight.angle = 0.5;
  spotLight.shadow.bias = -0.0001;
  spotLight.shadow.mapSize.width = 2048;
  spotLight.shadow.mapSize.height = 2048;
  spotLight.castShadow = true;
  spotLight.target.position.set(0, 0, 6);
  scene.add(spotLight.target);

  scene.add(spotLight);
};

/**
 * @description 设置环境光，环境光会均匀的照亮场景中的所有物体。
 */

const setAmbientLight = () => {
  ambientLight.intensity = 0.6;
  scene.add(ambientLight);
};

/**
 * @description 设置渲染器
 */

const setRender = () => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(DPR, 2));

  renderer.outputEncoding = sRGBEncoding;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  renderer.shadowMap.autoUpdate = true;
};

// 车辆列表
const vehicles = ref(vehiclesList);
// 当前选中的车辆
const currentVehicle = ref(vehiclesList[0]);

// 调试状态
const showDebug = ref(true);
const debugScale = ref(1.0);
const debugPosition = ref([0, 0, 0]);
const debugRotationY = ref(Math.PI);

// 相机设置
const cameraPosition = ref([0, 0.8, 8]);
const cameraFov = ref(30);
const autoRotate = ref(false);

// 辅助线设置
const showGrid = ref(true);
const showAxes = ref(true);
const gridSize = ref(20);
const gridDivisions = ref(20);
const axesSize = ref(10);
let gridHelper;
let axesHelper;

// 添加网格辅助线
const addGridHelper = () => {
  if (gridHelper) {
    scene.remove(gridHelper);
  }
  gridHelper = new GridHelper(gridSize.value, gridDivisions.value, 0x444444, 0x888888);
  gridHelper.position.y = -1;
  scene.add(gridHelper);
};

// 添加坐标轴辅助线
const addAxesHelper = () => {
  if (axesHelper) {
    scene.remove(axesHelper);
  }
  axesHelper = new AxesHelper(axesSize.value);
  axesHelper.position.y = -1;
  scene.add(axesHelper);
};

// 切换网格辅助线显示
const toggleGridHelper = () => {
  if (showGrid.value) {
    addGridHelper();
  } else if (gridHelper) {
    scene.remove(gridHelper);
  }
};

// 切换坐标轴辅助线显示
const toggleAxesHelper = () => {
  if (showAxes.value) {
    addAxesHelper();
  } else if (axesHelper) {
    scene.remove(axesHelper);
  }
};

// 更新网格辅助线
const updateGridHelper = () => {
  if (showGrid.value) {
    addGridHelper();
  }
};

// 更新坐标轴辅助线
const updateAxesHelper = () => {
  if (showAxes.value) {
    addAxesHelper();
  }
};

// 更新相机位置
const updateCameraPosition = () => {
  if (camera) {
    camera.position.set(...cameraPosition.value);
    camera.lookAt(model.scene.position);
  }
};

// 更新相机FOV
const updateCameraFov = () => {
  if (camera) {
    camera.fov = cameraFov.value;
    camera.updateProjectionMatrix();
  }
};

// 切换自动旋转
const toggleAutoRotate = () => {
  if (controls) {
    controls.autoRotate = autoRotate.value;
    if (autoRotate.value) {
      controls.autoRotateSpeed = 2.0;
      cameraMoveClock = true;
      cancelAnimationFrame(stopID);
    } else {
      cameraMoveClock = false;
      setCameraAnimate();
    }
  }
};

/**
 * @description 清理模型资源
 */
const cleanupModel = () => {
  if (model && model.scene) {
    // 递归遍历并清理所有资源
    model.scene.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            if (material.map) material.map.dispose();
            if (material.lightMap) material.lightMap.dispose();
            if (material.bumpMap) material.bumpMap.dispose();
            if (material.normalMap) material.normalMap.dispose();
            if (material.specularMap) material.specularMap.dispose();
            if (material.envMap) material.envMap.dispose();
            material.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          if (child.material.lightMap) child.material.lightMap.dispose();
          if (child.material.bumpMap) child.material.bumpMap.dispose();
          if (child.material.normalMap) child.material.normalMap.dispose();
          if (child.material.specularMap) child.material.specularMap.dispose();
          if (child.material.envMap) child.material.envMap.dispose();
          child.material.dispose();
        }
      }
    });
    
    // 从场景中移除
    scene.remove(model.scene);
    
    // 清空引用
    model.scene = null;
    model = null;
  }
};

/**
 * @description 更新模型变换
 */
const updateModelTransform = async () => {
  if (model && model.scene) {
    // 暂时禁用渲染器的阴影自动更新
    renderer.shadowMap.autoUpdate = false;

    // 更新变换
    model.scene.scale.set(debugScale.value, debugScale.value, debugScale.value);
    model.scene.position.set(...debugPosition.value);
    model.scene.rotation.set(0, debugRotationY.value, 0);

    // 更新当前车辆对象
    currentVehicle.value = {
      ...currentVehicle.value,
      customSettings: {
        ...currentVehicle.value.customSettings,
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      }
    };

    // 保存到数据库并获取最新配置
    try {
      await vehicleService.updateVehicle(currentVehicle.value);
      const updatedConfig = await vehicleService.getVehicle(currentVehicle.value.id);
      if (updatedConfig && updatedConfig.customSettings) {
        currentVehicle.value = updatedConfig;
      }
    } catch (error) {
      console.error('保存和更新配置失败:', error);
    }

    // 重新启用阴影自动更新并强制更新一次
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
};

// 保存状态
const isSaving = ref(false);
const saveStatus = ref('');
const isManuallyUpdating = ref(false);

// 通知提示
const notification = ref({
  show: false,
  type: 'info',
  message: ''
});

// 显示通知
const showNotification = (message, type = 'info', duration = 3000) => {
  notification.value = {
    show: true,
    type,
    message
  };
  
  setTimeout(() => {
    notification.value.show = false;
  }, duration);
};

// 显示保存成功提示
const showSaveSuccess = () => {
  saveStatus.value = 'saved';
  showNotification('保存成功', 'success');
  
  // 3秒后清除状态
  setTimeout(() => {
    if (saveStatus.value === 'saved') {
      saveStatus.value = '';
    }
  }, 3000);
};

// 显示保存错误提示
const showSaveError = () => {
  saveStatus.value = 'error';
  showNotification('保存失败', 'error');
  
  // 3秒后清除状态
  setTimeout(() => {
    if (saveStatus.value === 'error') {
      saveStatus.value = '';
    }
  }, 3000);
};

// 显示离线状态提示
const showOfflineStatus = () => {
  saveStatus.value = 'offline';
  showNotification('离线模式：更改将在网络恢复后同步', 'warning');
};

// 统一的保存函数 - 使用防抖减少频繁操作
const saveCurrentSettings = async () => {
  try {
    if (!currentVehicle.value || !currentVehicle.value.id) return;
    
    // 禁用保存按钮，显示加载状态
    isSaving.value = true;
    saveStatus.value = 'saving';
    
    // 标记为手动更新，避免触发自动保存
    isManuallyUpdating.value = true;
    
    // 检查网络连接
    if (!isOnline()) {
      showOfflineStatus();
    }
    
    // 合并当前所有修改到一个对象中
    const updatedSettings = {
      ...currentVehicle.value,
      customSettings: {
        ...(currentVehicle.value.customSettings || {}),
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      },
      updatedAt: new Date().toISOString()
    };
    
    // 使用带重试的更新方法
    await vehicleService.updateVehicleWithRetry(updatedSettings);
    
    // 显示成功提示
    showSaveSuccess();
  } catch (error) {
    console.error('保存设置失败:', error);
    // 显示错误提示
    showSaveError();
  } finally {
    // 恢复保存按钮状态和手动更新标记
    isSaving.value = false;
    isManuallyUpdating.value = false;
  }
};

// 创建防抖版本的保存函数
const debouncedSave = debounce(async () => {
  if (!currentVehicle.value || !currentVehicle.value.id) return;
  
  // 不在手动保存过程中才自动保存
  if (isManuallyUpdating.value) return;
  
  try {
    // 设置保存状态
    saveStatus.value = 'saving';
    
    // 检查网络连接
    if (!isOnline()) {
      showOfflineStatus();
    }
    
    await vehicleService.updateVehicle({
      ...currentVehicle.value,
      customSettings: {
        ...(currentVehicle.value.customSettings || {}),
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      }
    });
    
    // 更新保存状态指示器
    saveStatus.value = 'saved';
    setTimeout(() => {
      if (saveStatus.value === 'saved') {
        saveStatus.value = '';
      }
    }, 3000);
  } catch (error) {
    console.error('自动保存车辆设置失败:', error);
    // 更新保存状态指示器
    saveStatus.value = 'error';
    setTimeout(() => {
      if (saveStatus.value === 'error') {
        saveStatus.value = '';
      }
    }, 3000);
  }
}, 500); // 500ms延迟

// 更新模型缩放
const updateModelScale = async () => {
  if (model && model.scene) {
    // 暂时禁用渲染器的阴影自动更新
    renderer.shadowMap.autoUpdate = false;

    // 更新缩放
    model.scene.scale.set(debugScale.value, debugScale.value, debugScale.value);

    // 更新当前车辆对象（不立即保存）
    currentVehicle.value = {
      ...currentVehicle.value,
      customSettings: {
        ...(currentVehicle.value.customSettings || {}),
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      }
    };

    // 触发防抖保存
    debouncedSave();

    // 重新启用阴影自动更新并强制更新一次
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
};

// 更新模型位置
const updateModelPosition = async () => {
  if (model && model.scene) {
    // 暂时禁用渲染器的阴影自动更新
    renderer.shadowMap.autoUpdate = false;

    // 更新位置
    model.scene.position.set(...debugPosition.value);

    // 更新当前车辆对象（不立即保存）
    currentVehicle.value = {
      ...currentVehicle.value,
      customSettings: {
        ...(currentVehicle.value.customSettings || {}),
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      }
    };

    // 触发防抖保存
    debouncedSave();

    // 重新启用阴影自动更新并强制更新一次
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
};

// 更新模型旋转
const updateModelRotation = async () => {
  if (model && model.scene) {
    // 更新模型的旋转
    model.scene.rotation.set(0, debugRotationY.value, 0);
    console.log(`当前旋转角度：${(debugRotationY.value * 180 / Math.PI).toFixed(1)}°（${debugRotationY.value.toFixed(3)} 弧度）`);

    // 更新当前车辆对象（不立即保存）
    currentVehicle.value = {
      ...currentVehicle.value,
      customSettings: {
        ...(currentVehicle.value.customSettings || {}),
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      }
    };

    // 触发防抖保存
    debouncedSave();
  }
};

/**
 * @description 加载 3D 模型
 * @returns {Promise<void>}
 */
const load3DModel = async () => {
  try {
    // glb 是压缩的gltf，需要使用 dracoLoader 解压缩
    const dracoLoader = new DRACOLoader().setDecoderPath("/libs/draco/");
    const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);

    // 加载模型
    model = await gltfLoader.loadAsync(currentVehicle.value.model);

    if (model.scene) {
      const { materials, nodes } = getMaterials(model.scene);

      // 设置阴影
      model.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // 确保释放旧的几何体和材质
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      Object.assign(model, { materials, nodes });
      
      // 应用保存的变换
      model.scene.scale.set(debugScale.value, debugScale.value, debugScale.value);
      model.scene.position.set(...debugPosition.value);
      model.scene.rotation.set(0, debugRotationY.value, 0);
      
      // 添加到场景
      scene.add(model.scene);

      // 更新相机视角
      camera.lookAt(model.scene.position);
    }
  } catch (error) {
    console.error('模型加载失败:', error);
  }
};

/**
 * @description 自定义模型的样式和位置
 */

const customModel = () => {
  if (!model || !model.materials) return;

  // 遍历所有材质
  Object.entries(model.materials).forEach(([name, material]) => {
    const lowerName = name.toLowerCase();
    // 轮胎和橡胶部分
    if (lowerName.includes('rubber') || lowerName.includes('tire')) {
      changModel(model, name, {
        color: "#222",
        roughness: 0.6,
        roughnessMap: null,
        normalScale: [4, 4],
      });
    }
    // 玻璃部分
    else if (lowerName.includes('window') || lowerName.includes('glass')) {
      changModel(model, name, {
        color: "black",
        roughness: 0,
        clearcoat: 0.1,
      });
    }
    // 车身部分
    else if (lowerName.includes('body') || lowerName.includes('paint') || lowerName.includes('coat')) {
      changModel(model, name, {
        color: carCoatColor.value,
        envMapIntensity: 4,
      });
    }
    // 轮毂部分
    else if ((lowerName.includes('wheel') || lowerName.includes('rim')) && 
             !lowerName.includes('tire') && !lowerName.includes('rubber')) {
      changModel(model, name, {
        color: wheelColor.value,
        roughness: 0.1,
        metalness: 0.9,
        envMapIntensity: 3,
      });
    }
    // 其他金属部分
    else {
      changModel(model, name, {
        roughness: 0.5,
        metalness: 0.8,
        envMapIntensity: 2,
      });
    }
  });
};

/**
 * @description 设置接触阴影,显得更真实
 */

const setContactShadow = () => {
  shadowGroup.position.set(0, -1.01, modelZ);
  shadowGroup.rotation.set(0, Math.PI / 2, 0);
  scene.add(shadowGroup);
  createContactShadow(scene, renderer, shadowGroup);
};

/**
 * @description 添加控制操作
 */

const addControls = () => {
  if (controls) {
    controls.dispose();
  }
  
  controls = new OrbitControls(camera, renderer.domElement);
  
  // 设置控制器参数
  controls.enableDamping = true; // 启用阻尼效果
  controls.dampingFactor = 0.05; // 阻尼系数
  controls.rotateSpeed = 0.5; // 旋转速度
  controls.enableZoom = true; // 启用缩放
  controls.zoomSpeed = 0.5; // 缩放速度
  controls.enablePan = true; // 启用平移
  controls.panSpeed = 0.5; // 平移速度
  controls.minDistance = 3; // 最小距离
  controls.maxDistance = 20; // 最大距离
  
  // 限制垂直旋转角度
  controls.minPolarAngle = Math.PI / 4; // 最小仰角
  controls.maxPolarAngle = Math.PI / 2; // 最大仰角

  controls.addEventListener("start", () => (cameraMoveClock = true));
  controls.addEventListener("end", () => {
    cameraMoveClock = false;
  });
};

/**
 * @description 清理虚拟场景
 */
const cleanupVirtualScene = () => {
  if (virtualScene) {
    virtualScene.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    while(virtualScene.children.length > 0) {
      virtualScene.remove(virtualScene.children[0]);
    }
  }
  if (virtualBackgroundMesh) {
    if (virtualBackgroundMesh.material) virtualBackgroundMesh.material.dispose();
    if (virtualBackgroundMesh.geometry) virtualBackgroundMesh.geometry.dispose();
    virtualBackgroundMesh = null;
  }
};

/**
 * @description 清理场景
 */
const cleanupScene = () => {
  // 停止渲染循环
  cancelAnimationFrame(renderFrameId);
  
  // 清理控制器
  if (controls) {
    controls.dispose();
    controls = null;
  }
  
  // 清理模型资源
  cleanupModel();
  
  // 清理虚拟场景
  cleanupVirtualScene();
  
  // 清理阴影组
  if (shadowGroup) {
    shadowGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            if (m.map) m.map.dispose();
            if (m.lightMap) m.lightMap.dispose();
            if (m.bumpMap) m.bumpMap.dispose();
            if (m.normalMap) m.normalMap.dispose();
            if (m.specularMap) m.specularMap.dispose();
            if (m.envMap) m.envMap.dispose();
            m.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          if (child.material.lightMap) child.material.lightMap.dispose();
          if (child.material.bumpMap) child.material.bumpMap.dispose();
          if (child.material.normalMap) child.material.normalMap.dispose();
          if (child.material.specularMap) child.material.specularMap.dispose();
          if (child.material.envMap) child.material.envMap.dispose();
          child.material.dispose();
        }
      }
    });
    while(shadowGroup.children.length > 0) {
      shadowGroup.remove(shadowGroup.children[0]);
    }
    scene.remove(shadowGroup);
    shadowGroup = new Group();
  }

  // 清理场景中的所有对象
  while(scene.children.length > 0) {
    const obj = scene.children[0];
    scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => {
          if (m.map) m.map.dispose();
          if (m.lightMap) m.lightMap.dispose();
          if (m.bumpMap) m.bumpMap.dispose();
          if (m.normalMap) m.normalMap.dispose();
          if (m.specularMap) m.specularMap.dispose();
          if (m.envMap) m.envMap.dispose();
          m.dispose();
        });
      } else {
        if (obj.material.map) obj.material.map.dispose();
        if (obj.material.lightMap) obj.material.lightMap.dispose();
        if (obj.material.bumpMap) obj.material.bumpMap.dispose();
        if (obj.material.normalMap) obj.material.normalMap.dispose();
        if (obj.material.specularMap) obj.material.specularMap.dispose();
        if (obj.material.envMap) obj.material.envMap.dispose();
        obj.material.dispose();
      }
    }
  }

  // 清理渲染器
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    renderer = null;
  }

  // 清理相机
  if (camera) {
    camera = new PerspectiveCamera(30, RADIO);
  }

  // 重置场景
  scene = new Scene();
  virtualScene = new Scene();
  
  // 重新初始化渲染器
  renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true,
    alpha: true,
  });
  setRender();
  
  // 重新添加到DOM
  if (canvas.value) {
    canvas.value.appendChild(renderer.domElement);
  }
};

let renderFrameId;

/**
 * @description 自动渲染
 */
const autoRender = () => {
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  renderFrameId = requestAnimationFrame(autoRender);
};

/**
 * @description 虚拟HDR环境，设置场景的环境
 */
const setEnvironment = (
  scene,
  resolution = 256,
  frames = 1,
  near = 1,
  far = 1000,
  background = false
) => {
  // 清理旧的环境贴图
  if (scene.environment) {
    scene.environment.dispose();
    scene.environment = null;
  }
  if (scene.background) {
    scene.background.dispose();
    scene.background = null;
  }

  const fbo = new WebGLCubeRenderTarget(resolution);
  fbo.texture.type = HalfFloatType;
  const cubeCamera = new CubeCamera(near, far, fbo);

  virtualScene.add(cubeCamera);

  // 天花板灯
  const topLight = generateVirtualLight({
    intensity: 1.5, // 增加光照强度
    scale: [10, 10, 1],
    position: [0, 5, -9],
    rotation: [Math.PI / 2, 0, 0],
  });

  // 四周灯光
  const leftTopLight = generateVirtualLight({
    intensity: 5, // 增加光照强度
    scale: [20, 0.1, 1],
    position: [-5, 1, -1],
    rotation: [0, Math.PI / 2, 0],
  });
  const leftBottomLight = generateVirtualLight({
    intensity: 2, // 增加光照强度
    scale: [20, 0.5, 1],
    position: [-5, -1, -1],
    rotation: [0, Math.PI / 2, 0],
  });
  const rightTopLight = generateVirtualLight({
    intensity: 2, // 增加光照强度
    scale: [20, 1, 1],
    position: [10, 1, 0],
    rotation: [0, -Math.PI / 2, 0],
  });

  const floatLight = generateVirtualLight({
    form: "ring",
    color: "red",
    intensity: 2, // 增加光照强度
    scale: 10,
    position: [-15, 4, -18],
    target: [0, 0, 0],
  });

  virtualScene.add(topLight);
  virtualScene.add(leftTopLight);
  virtualScene.add(leftBottomLight);
  virtualScene.add(rightTopLight);
  virtualScene.add(floatLight);

  if (background !== "only") {
    scene.environment = fbo.texture;
  }
  if (background) {
    scene.background = fbo.texture;
  }

  // 创建背景球体
  const geometry = new SphereGeometry(1, 64, 64);
  const material = createCustomMaterial("#2f2f2f"); // 使用固定的暗色背景

  virtualBackgroundMesh = new Mesh(geometry, material);
  virtualBackgroundMesh.scale.set(100, 100, 100);
  virtualScene.add(virtualBackgroundMesh);

  // 让环形网格运动起来
  floatMesh({
    group: floatLight,
    speed: 5,
    rotationIntensity: 2,
    floatIntensity: 2,
  });

  // 更新相机内容
  let count = 1;
  const virtualRender = () => {
    if (frames === Infinity || count < frames) {
      cubeCamera.update(renderer, virtualScene);
      count++;
    }
    requestAnimationFrame(virtualRender);
  };
  virtualRender();
};

/**
 * 设置相机的运动轨迹
 * @param camera
 * @param v
 */
let stopID;
const clock = new Clock();
let cameraX, cameraZ;
const setCameraAnimate = () => {
  const vector = new Vector3();

  if (cameraMoveClock) {
    cancelAnimationFrame(stopID);
  } else {
    const t = clock.getElapsedTime();

    const theta = t / 6;

    const newx = 14 * Math.sin(theta) - 6;
    const newy = 14 * Math.cos(theta) - 6;
    cameraX = newx < -10 ? cameraX : newx;
    cameraZ = newy < -10 ? cameraZ : newy;

    camera.position.lerp(vector.set(cameraX, 0.5, cameraZ), 0.05);
    camera.lookAt(model.scene.position);
  }

  stopID = requestAnimationFrame(setCameraAnimate);
};

/**
 * 设置相机的运动轨迹
 * @param camera
 * @param v
 */

function guiMeshPhongMaterial(mesh, material, geometry) {
  const gui = new GUI();
  const data = {
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
    specular: material.specular.getHex(),
  };

  const folder = gui.addFolder("THREE.MeshPhongMaterial");

  folder.addColor(data, "color").onChange(handleColorChange(material.color));
  folder
    .addColor(data, "emissive")
    .onChange(handleColorChange(material.emissive));
  folder
    .addColor(data, "specular")
    .onChange(handleColorChange(material.specular));

  folder.add(material, "shininess", 0, 100);

  function handleColorChange(color) {
    return function (value) {
      if (typeof value === "string") {
        value = value.replace("#", "0x");
      }

      color.setHex(value);
    };
  }
}

/**
 * @description 为车设置聚光灯
 */

const setBigSpotLight = () => {
  // 移除旧的地面
  scene.traverse((child) => {
    if (child.geometry instanceof PlaneGeometry) {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      if (child.geometry) {
        child.geometry.dispose();
      }
      scene.remove(child);
    }
  });

  scene.background = new Color("#d4cfa3");
  renderer.shadowMap.type = PCFSoftShadowMap;

  const material = new MeshPhongMaterial({
    side: DoubleSide,
    color: "#00ff1a",
    emissive: "#ac8f3e",
  });
  const FloorGeometry = new PlaneGeometry(200, 200);

  const floorMesh = new Mesh(FloorGeometry, material);

  floorMesh.rotation.x = Math.PI / 2;
  floorMesh.receiveShadow = true;

  floorMesh.position.set(0, -1.02, 0);

  scene.add(floorMesh);

  // 移除旧的聚光灯
  scene.traverse((child) => {
    if (child instanceof SpotLight && child !== spotLight) {
      scene.remove(child);
    }
  });

  const bigSpotLight = new SpotLight("#ffffff", 2);

  bigSpotLight.angle = Math.PI / 8;
  bigSpotLight.penumbra = 0.2;
  bigSpotLight.decay = 2;
  bigSpotLight.distance = 30;

  bigSpotLight.position.set(0, 10, 0);
  bigSpotLight.target.position.set(0, 0, modelZ);

  scene.add(bigSpotLight.target);
  scene.add(bigSpotLight);
};

/**
 * @description 初始化场景
 * @returns {Promise<void>}
 */
const initScene = async () => {
  // 创建场景
  scene = new Scene();
  // 设置渲染器
  setRender();
  // 设置环境光
  setAmbientLight();
  // 设置相机
  setCamera();
  // 添加辅助线
  if (showGrid.value) addGridHelper();
  if (showAxes.value) addAxesHelper();
  // 加载3d 模型
  await load3DModel();
  // 自定义3d模型
  customModel();
  // 设置聚光灯
  setSpotLight();

  const t = 600;
  setTimeout(() => {
    // 设置 HDR环境（模拟HDR贴图）
    setEnvironment(scene, 256, Infinity);
    // 设置运动光源，获得打光效果
    setMovingSpot(virtualScene);
  }, t * 2);
  setTimeout(() => {
    spotLight.visible = false;
    // 设置舞台聚光灯
    setBigSpotLight();
    // 设置接触阴影
    setContactShadow();
  }, 3 * t);

  // 添加控制效果
  addControls();

  // 将渲染结果写入html dom中
  canvas.value.appendChild(renderer.domElement);
  // 开启实时渲染，无需手动渲染
  autoRender();
  // 监听颜色变化
  watchColorChange();
  // 监听页面变化重新渲染画布
  listenPageSizeChange();
};

/**
 * 监听颜色变化
 */

const watchColorChange = () => {
  // 车身颜色改变
  watch(carCoatColor, (val, old) => {
    requestAnimationFrame(() => {
      if (val && model && model.materials) {
        // 查找包含 body、paint 或 coat 的材质
        Object.entries(model.materials).forEach(([name, material]) => {
          if (name.toLowerCase().includes('body') || 
              name.toLowerCase().includes('paint') || 
              name.toLowerCase().includes('coat')) {
            material.color.set(val);
            material.needsUpdate = true;
          }
        });
      }
    });
  });

  // 轮毂颜色改变
  watch(wheelColor, (val, old) => {
    requestAnimationFrame(() => {
      if (val && model && model.materials) {
        // 查找包含 wheel 或 rim 的材质，但排除 tire 和 rubber
        Object.entries(model.materials).forEach(([name, material]) => {
          const lowerName = name.toLowerCase();
          if ((lowerName.includes('wheel') || lowerName.includes('rim')) && 
              !lowerName.includes('tire') && !lowerName.includes('rubber')) {
            material.color.set(val);
            material.needsUpdate = true;
          }
        });
      }
    });
  });
};

/**
 * @description 重新设置渲染窗口大小
 */
const changeRenderSize = () => {
  requestAnimationFrame(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

/**
 * 添加页面变化监听
 */
const listenPageSizeChange = () => {
  window.addEventListener("resize", changeRenderSize);
};

/**
 * @description 处理车辆切换
 */
const onVehicleChange = async (newVehicleId) => {
  try {
    // 根据ID找到对应的车辆对象
    const newVehicle = vehicles.value.find(v => v.id === newVehicleId);
    if (!newVehicle) {
      console.error('未找到选中的车辆');
      return;
    }

    // 更新当前选中的车辆
    currentVehicle.value = newVehicle;

    // 尝试从数据库加载保存的配置
    const savedConfig = await loadVehicleConfig(newVehicleId);
    
    if (savedConfig && savedConfig.customSettings) {
      // 使用保存的配置
      debugScale.value = savedConfig.customSettings.scale || newVehicle.scale || 1.0;
      debugPosition.value = savedConfig.customSettings.position || [...newVehicle.position] || [0, 0, 0];
      debugRotationY.value = savedConfig.customSettings.rotation || 0;  // 如果没有保存的角度，默认为0度
      carCoatColor.value = savedConfig.customSettings.colors?.body || newVehicle.colors?.body || "#2f426f";
      wheelColor.value = savedConfig.customSettings.colors?.wheel || newVehicle.colors?.wheel || "#1a1a1a";
    } else {
      // 使用默认配置
      debugScale.value = newVehicle.scale || 1.0;
      debugPosition.value = Array.isArray(newVehicle.position) ? 
        [...newVehicle.position] : [0, 0, 0];
      debugRotationY.value = 0;  // 默认为0度
      carCoatColor.value = newVehicle.colors?.body || "#2f426f";
      wheelColor.value = newVehicle.colors?.wheel || "#1a1a1a";
    }
    
    // 禁用渲染器的阴影自动更新
    if (renderer) {
      renderer.shadowMap.autoUpdate = false;
    }
    
    // 彻底清理场景和资源
    cleanupScene();
    
    // 强制进行垃圾回收
    if (window.gc) window.gc();
    
    // 重新设置基础场景
    scene = new Scene();
    setAmbientLight();
    setCamera();
    if (showGrid.value) addGridHelper();
    if (showAxes.value) addAxesHelper();
    
    // 加载新模型
    await load3DModel();
    
    // 重新应用材质
    customModel();
    
    // 设置光照
    setSpotLight();
    
    // 重新设置环境和阴影
    setEnvironment(scene, 256, Infinity);
    setMovingSpot(virtualScene);
    setBigSpotLight();
    setContactShadow();
    
    // 重新初始化控制器
    addControls();
    
    // 重新启用阴影自动更新并强制更新一次
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;

    // 重新开始渲染循环
    autoRender();

    // 打印当前角度值以便调试
    console.log('切换车辆后的角度值:', debugRotationY.value);
  } catch (error) {
    console.error('切换模型失败:', error);
  }
};

// 监听车辆变化
watch(currentVehicle, (newVehicle, oldVehicle) => {
  if (newVehicle && newVehicle.id !== oldVehicle?.id) {
    onVehicleChange(newVehicle);
  }
});

// 设置预设旋转值
const setRotation = async (angle) => {
  // 更新显示的角度
  debugRotationY.value = angle;
  
  // 更新模型旋转
  if (model && model.scene) {
    model.scene.rotation.set(0, angle, 0);
  }
  
  // 立即保存当前设置（不使用防抖）
  saveCurrentSettings();
};

// 更新旋转并保存
const updateRotationAndSave = async () => {
  // 更新模型旋转
  if (model && model.scene) {
    model.scene.rotation.set(0, debugRotationY.value, 0);
  }
  
  // 立即保存当前设置（不使用防抖）
  saveCurrentSettings();
};

// 监听旋转值变化
watch(debugRotationY, () => {
  updateModelRotation();
});

// 从数据库加载配置
const loadVehicleConfig = async (vehicleId) => {
  try {
    const vehicle = await vehicleService.getVehicle(vehicleId);
    return vehicle;
  } catch (error) {
    console.error('加载配置失败:', error);
    return null;
  }
};

// 修改导出配置函数
const exportConfigs = async () => {
  try {
    // 获取所有车辆配置
    const configs = await vehicleService.getAllVehicles();
    
    // 创建导出数据
    const exportData = {
      vehicles: configs,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    // 创建 Blob 对象
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-configs-${new Date().toISOString().split('T')[0]}.json`;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('配置导出成功');
  } catch (error) {
    console.error('导出配置失败:', error);
  }
};

// 修改导入配置函数
const importConfigs = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // 检查导入数据的格式
      if (!importData.vehicles || !Array.isArray(importData.vehicles)) {
        throw new Error('无效的配置文件格式');
      }

      // 导入所有车辆配置
      await Promise.all(importData.vehicles.map(async (config) => {
        try {
          // 检查是否已存在该车辆配置
          const existingVehicle = await vehicleService.getVehicle(config.id);
          if (existingVehicle) {
            // 更新现有配置
            await vehicleService.updateVehicle(config);
          } else {
            // 添加新配置
            await vehicleService.addVehicle(config);
          }
        } catch (error) {
          console.error(`导入车辆 ${config.id} 失败:`, error);
        }
      }));

      // 重新加载车辆列表
      vehicles.value = await getVehicles();
      
      console.log('配置导入成功');
    } catch (error) {
      console.error('导入配置失败:', error);
    }
  };

  input.click();
};

// 初始化数据库和场景
const initializeApp = async () => {
  try {
    // 获取最新的车辆配置
    vehicles.value = await getVehicles();
    currentVehicle.value = vehicles.value[0];

    // 初始化数据库和加载配置
    await Promise.all([
      vehicleService.initializeVehicles(),
      settingsService.initializeSettings()
    ]);

    // 加载当前车辆的保存配置
    const savedConfig = await vehicleService.getVehicle(currentVehicle.value.id);
    if (savedConfig && savedConfig.customSettings) {
      debugScale.value = savedConfig.customSettings.scale || currentVehicle.value.scale || 1.0;
      debugPosition.value = savedConfig.customSettings.position || [...currentVehicle.value.position] || [0, 0, 0];
      debugRotationY.value = savedConfig.customSettings.rotation || 0;  // 如果没有保存的角度，默认为0度
      carCoatColor.value = savedConfig.customSettings.colors?.body || currentVehicle.value.colors?.body || "#2f426f";
      wheelColor.value = savedConfig.customSettings.colors?.wheel || currentVehicle.value.colors?.wheel || "#1a1a1a";
    } else {
      // 使用默认配置
      debugScale.value = currentVehicle.value.scale || 1.0;
      debugPosition.value = [...currentVehicle.value.position] || [0, 0, 0];
      debugRotationY.value = 0;  // 默认为0度
      carCoatColor.value = currentVehicle.value.colors?.body || "#2f426f";
      wheelColor.value = currentVehicle.value.colors?.wheel || "#1a1a1a";
    }

    // 初始化场景
    await initScene();

    // 应用保存的变换
    if (model && model.scene) {
      model.scene.scale.set(debugScale.value, debugScale.value, debugScale.value);
      model.scene.position.set(...debugPosition.value);
      model.scene.rotation.set(0, debugRotationY.value, 0);
    }

    // 打印初始角度值以便调试
    console.log('初始化后的角度值:', debugRotationY.value);
  } catch (error) {
    console.error('初始化失败:', error);
  }
};

// 监听所有可能需要保存的参数变化
watch([debugScale, debugPosition, debugRotationY, carCoatColor, wheelColor], 
  () => {
    if (isManuallyUpdating.value) return; // 避免与手动更新冲突
    
    // 更新当前车辆对象
    if (currentVehicle.value && currentVehicle.value.id) {
      currentVehicle.value = {
        ...currentVehicle.value,
        customSettings: {
          ...currentVehicle.value.customSettings,
          scale: debugScale.value,
          position: debugPosition.value,
          rotation: debugRotationY.value,
          colors: {
            body: carCoatColor.value,
            wheel: wheelColor.value
          }
        }
      };
      
      // 触发防抖保存
      debouncedSave();
    }
  },
  { deep: true }
);

// 监听网格和坐标轴设置变化
watch([showGrid, showAxes, gridSize, gridDivisions, axesSize], async () => {
  try {
    await settingsService.updateSettings({
      gridSettings: {
        showGrid: showGrid.value,
        showAxes: showAxes.value,
        gridSize: gridSize.value,
        gridDivisions: gridDivisions.value,
        axesSize: axesSize.value
      }
    });
  } catch (error) {
    console.error('自动保存网格设置失败:', error);
  }
});

// 监听网络连接状态变化
window.addEventListener('online', () => {
  if (saveStatus.value === 'offline') {
    saveStatus.value = '';
    showNotification('网络已恢复，正在同步更改...', 'info');
    // 尝试保存当前设置
    saveCurrentSettings();
  }
});

window.addEventListener('offline', () => {
  showOfflineStatus();
});

// 重置所有设置
const resetSettings = async () => {
  try {
    if (confirm('确定要重置所有设置吗？这将恢复默认状态。')) {
      // 重置系统设置
      await settingsService.resetSettings();
      
      // 重置当前车辆的自定义设置
      if (currentVehicle.value && currentVehicle.value.id) {
        // 标记为手动更新，避免触发自动保存
        isManuallyUpdating.value = true;
        
        // 使用默认值
        debugScale.value = currentVehicle.value.scale || 1.0;
        debugPosition.value = [...currentVehicle.value.position] || [0, 0, 0];
        debugRotationY.value = 0;  // 默认为0度
        carCoatColor.value = currentVehicle.value.colors?.body || "#2f426f";
        wheelColor.value = currentVehicle.value.colors?.wheel || "#1a1a1a";
        
        // 更新模型变换
        if (model && model.scene) {
          model.scene.scale.set(debugScale.value, debugScale.value, debugScale.value);
          model.scene.position.set(...debugPosition.value);
          model.scene.rotation.set(0, debugRotationY.value, 0);
        }
        
        // 更新当前车辆对象
        currentVehicle.value = {
          ...currentVehicle.value,
          customSettings: {
            scale: debugScale.value,
            position: debugPosition.value,
            rotation: debugRotationY.value,
            colors: {
              body: carCoatColor.value,
              wheel: wheelColor.value
            }
          }
        };
        
        // 保存重置后的设置
        await vehicleService.updateVehicle(currentVehicle.value);
        
        // 恢复手动更新标记
        isManuallyUpdating.value = false;
      }
      
      // 更新网格和坐标轴
      showGrid.value = true;
      showAxes.value = true;
      gridSize.value = 20;
      gridDivisions.value = 20;
      axesSize.value = 10;
      updateGridHelper();
      updateAxesHelper();
      
      // 显示成功提示
      showNotification('设置已重置', 'success');
    }
  } catch (error) {
    console.error('重置设置失败:', error);
    showNotification('重置设置失败', 'error');
  }
};

// 查看已保存的配置
const viewSavedConfigs = async () => {
  try {
    // 获取所有车辆配置
    const configs = await vehicleService.getAllVehicles();
    
    // 格式化展示数据
    const formattedData = configs.map(config => {
      return {
        id: config.id,
        name: config.name,
        updatedAt: new Date(config.updatedAt).toLocaleString(),
        hasCustomSettings: !!config.customSettings
      };
    });
    
    // 在控制台中展示数据
    console.table(formattedData);
    showNotification('已在控制台显示配置信息', 'info');
  } catch (error) {
    console.error('获取配置失败:', error);
    showNotification('获取配置失败', 'error');
  }
};

onMounted(() => {
  initializeApp();
});

onUnmounted(() => {
  // 清理所有资源
  cancelAnimationFrame(renderFrameId);
  cleanupScene();
  window.removeEventListener("resize", changeRenderSize);
});
</script>

<style scoped>
.scene {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.color-picker {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 999;
  display: flex;
  gap: 15px;
  background: rgba(0, 0, 0, 0.6);
  padding: 12px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.color-picker-wrap {
  text-align: center;
  color: #fff;
}

.color-picker-wrap input[type="color"] {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.color-picker-wrap div:last-child {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.9;
}

.vehicle-selector {
  position: fixed;
  left: 50%;
  top: 20px;
  transform: translateX(-50%);
  z-index: 999;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.vehicle-selector select {
  padding: 8px 12px;
  font-size: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 200px;
  cursor: pointer;
}

.vehicle-selector select option {
  background: #333;
  color: white;
  padding: 8px;
}

.debug-panel {
  position: fixed;
  right: 20px;
  top: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 8px;
  z-index: 1000;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  width: 300px;
  backdrop-filter: blur(10px);
}

.debug-panel::-webkit-scrollbar {
  width: 6px;
}

.debug-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.debug-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.debug-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.debug-panel h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.control-group input {
  width: 100%;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 4px;
  font-size: 13px;
}

.control-group input:focus {
  outline: none;
  border-color: rgba(33, 150, 243, 0.5);
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

.debug-panel button {
  width: 100%;
  margin-top: 15px;
  padding: 8px 16px;
  background: #2196f3;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.debug-panel button:hover {
  background: #1976d2;
}

.helper-controls {
  display: flex;
  gap: 15px;
}

.helper-controls label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.helper-controls input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.axes-legend {
  margin-top: 5px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.axis-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 12px;
}

.axis-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.rotation-presets {
  display: flex;
  gap: 8px;
  margin-top: 5px;
}

.rotation-presets button {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  margin: 0;
}

.rotation-presets button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.input-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.input-group input {
  flex: 1;
  height: 24px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: white;
  font-size: 12px;
  min-width: 0;
}

.position-group {
  display: flex;
  gap: 4px;
  flex: 1;
}

.position-group input {
  width: 33.33%;
}

.mini-btn {
  padding: 2px 6px;
  height: 24px;
  min-width: 36px;
  background: #2196f3;
  border: none;
  border-radius: 3px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.mini-btn:hover {
  background: #1976d2;
}

.input-with-button,
.position-inputs,
.apply-btn {
  display: none;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 15px;
}

.button-group button {
  margin-top: 0;
}

.save-status {
  margin-top: 10px;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
  transition: opacity 0.3s;
}

.save-status.saving {
  background: rgba(255, 165, 0, 0.2);
  color: #ffcc00;
}

.save-status.saved {
  background: rgba(0, 255, 0, 0.2);
  color: #00cc00;
}

.save-status.error {
  background: rgba(255, 0, 0, 0.2);
  color: #ff6666;
}

.save-status.offline {
  background: rgba(128, 128, 128, 0.2);
  color: #cccccc;
}

.notification {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
}

.notification-content {
  padding: 10px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
  white-space: nowrap;
}

.notification-content.success {
  background: rgba(46, 204, 113, 0.9);
  color: white;
}

.notification-content.error {
  background: rgba(231, 76, 60, 0.9);
  color: white;
}

.notification-content.info {
  background: rgba(52, 152, 219, 0.9);
  color: white;
}

.notification-content.warning {
  background: rgba(241, 196, 15, 0.9);
  color: white;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}
</style>
