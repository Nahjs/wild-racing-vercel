<template>
  <div ref="canvas" class="scene">
    <div class="navigation-buttons">
      <router-link to="/" class="nav-btn home-btn">
        <i class="icon-home"></i> 返回首页
      </router-link>
      <router-link to="/race" class="nav-btn race-btn">
        开始比赛 <i class="icon-arrow-right"></i>
      </router-link>
    </div>

    <!-- 添加左右切换按钮 -->
    <button class="arrow-btn left-arrow" @click="changeVehicle(-1)" title="上一辆">
      &lt;
    </button>
    <button class="arrow-btn right-arrow" @click="changeVehicle(1)" title="下一辆">
      &gt;
    </button>

    <DebugPanel
      :vehicles="vehicles"
      :current-vehicle-id="currentVehicle.id"
      @update:currentVehicleId="handleVehicleUpdate"
      :current-vehicle="currentVehicle"
      :car-coat-color="carCoatColor"
      :wheel-color="wheelColor"
      @update:scale="updateModelScale"
      @update:position="updateModelPosition"
      @update:rotation="updateModelRotation"
      @update:cameraPosition="updateCameraPosition"
      @update:cameraFov="updateCameraFov"
      @update:autoRotate="toggleAutoRotate"
      @update:showGrid="toggleGridHelper"
      @update:showAxes="toggleAxesHelper"
      @update:gridSettings="updateGridHelper"
      @update:axesSize="updateAxesHelper"
      @configsImported="handleConfigsImported"
    />
    
    <!-- 操作结果提示 -->
    <div class="notification" v-if="notification.show">
      <div class="notification-content" :class="notification.type">
        <span>{{ notification.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
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
import DebugPanel from '@/components/DebugPanel.vue';

import {
  getMaterials,
  changModel,
  generateVirtualLight,
  createContactShadow,
  setMovingSpot,
  floatMesh,
  createCustomMaterial,
} from "@/utils/utils";
import { vehiclesList, getVehicles } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';
import { settingsService } from '@/services/settingsService';
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

// 透视摄像机
let camera = new PerspectiveCamera(30, RADIO);

// 聚光灯对象
let spotLight = new SpotLight();

// 环境光
let ambientLight = new AmbientLight(0x404040);

// 渲染器
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

// 车辆列表
const vehicles = ref(vehiclesList);
// 当前选中的车辆
const currentVehicle = ref(vehiclesList[0]);

// 通知提示
const notification = ref({
  show: false,
  message: '',
  type: 'info'
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

// 设置相机
const setCamera = () => {
  camera.position.set(0, 0.8, 8);
  camera.castShadow = true;
  scene.add(camera);
};

// 设置聚光灯
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

// 设置环境光
const setAmbientLight = () => {
  ambientLight.intensity = 0.6;
  scene.add(ambientLight);
};

// 设置渲染器
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

// 清理模型资源
const cleanupModel = () => {
  if (model && model.scene) {
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
    
    scene.remove(model.scene);
    model.scene = null;
    model = null;
  }
};

// 加载3D模型
const load3DModel = async () => {
  try {
    const dracoLoader = new DRACOLoader().setDecoderPath("/libs/draco/");
    const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);

    model = await gltfLoader.loadAsync(currentVehicle.value.model);

    if (model.scene) {
      const { materials, nodes } = getMaterials(model.scene);

      model.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
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
      
      model.scene.scale.set(debugScale.value, debugScale.value, debugScale.value);
      model.scene.position.set(...debugPosition.value);
      model.scene.rotation.set(0, debugRotationY.value, 0);
      
      scene.add(model.scene);
      camera.lookAt(model.scene.position);
    }
  } catch (error) {
    console.error('模型加载失败:', error);
    showNotification('模型加载失败', 'error');
  }
};

// 自定义模型
const customModel = () => {
  if (!model || !model.materials) return;

  Object.entries(model.materials).forEach(([name, material]) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('rubber') || lowerName.includes('tire')) {
      changModel(model, name, {
        color: "#222",
        roughness: 0.6,
        roughnessMap: null,
        normalScale: [4, 4],
      });
    }
    else if (lowerName.includes('window') || lowerName.includes('glass')) {
      changModel(model, name, {
        color: "black",
        roughness: 0,
        clearcoat: 0.1,
      });
    }
    else if (lowerName.includes('body') || lowerName.includes('paint') || lowerName.includes('coat')) {
      changModel(model, name, {
        color: carCoatColor.value,
        envMapIntensity: 4,
      });
    }
    else if ((lowerName.includes('wheel') || lowerName.includes('rim')) && 
             !lowerName.includes('tire') && !lowerName.includes('rubber')) {
      changModel(model, name, {
        color: wheelColor.value,
        roughness: 0.1,
        metalness: 0.9,
        envMapIntensity: 3,
      });
    }
    else {
      changModel(model, name, {
        roughness: 0.5,
        metalness: 0.8,
        envMapIntensity: 2,
      });
    }
  });
};

// 设置接触阴影
const setContactShadow = () => {
  shadowGroup.position.set(0, -1.01, modelZ);
  shadowGroup.rotation.set(0, Math.PI / 2, 0);
  scene.add(shadowGroup);
  createContactShadow(scene, renderer, shadowGroup);
};

// 添加控制操作
const addControls = () => {
  if (controls) {
    controls.dispose();
  }
  
  controls = new OrbitControls(camera, renderer.domElement);
  
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.5;
  controls.enableZoom = true;
  controls.zoomSpeed = 0.5;
  controls.enablePan = true;
  controls.panSpeed = 0.5;
  controls.minDistance = 3;
  controls.maxDistance = 20;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 2;

  controls.addEventListener("start", () => (cameraMoveClock = true));
  controls.addEventListener("end", () => {
    cameraMoveClock = false;
  });
};

// 清理虚拟场景
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

// 清理场景
const cleanupScene = () => {
  cancelAnimationFrame(renderFrameId);
  
  if (controls) {
    controls.dispose();
    controls = null;
  }
  
  cleanupModel();
  cleanupVirtualScene();
  
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

  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    renderer = null;
  }

  if (camera) {
    camera = new PerspectiveCamera(30, RADIO);
  }

  scene = new Scene();
  virtualScene = new Scene();
  
  renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: true,
    alpha: true,
  });
  setRender();
  
  if (canvas.value) {
    canvas.value.appendChild(renderer.domElement);
  }
};

let renderFrameId;

// 自动渲染
const autoRender = () => {
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  renderFrameId = requestAnimationFrame(autoRender);
};

// 设置环境
const setEnvironment = (
  scene,
  resolution = 256,
  frames = 1,
  near = 1,
  far = 1000,
  background = false
) => {
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

  const topLight = generateVirtualLight({
    intensity: 1.5,
    scale: [10, 10, 1],
    position: [0, 5, -9],
    rotation: [Math.PI / 2, 0, 0],
  });

  const leftTopLight = generateVirtualLight({
    intensity: 5,
    scale: [20, 0.1, 1],
    position: [-5, 1, -1],
    rotation: [0, Math.PI / 2, 0],
  });
  const leftBottomLight = generateVirtualLight({
    intensity: 2,
    scale: [20, 0.5, 1],
    position: [-5, -1, -1],
    rotation: [0, Math.PI / 2, 0],
  });
  const rightTopLight = generateVirtualLight({
    intensity: 2,
    scale: [20, 1, 1],
    position: [10, 1, 0],
    rotation: [0, -Math.PI / 2, 0],
  });

  const floatLight = generateVirtualLight({
    form: "ring",
    color: "red",
    intensity: 2,
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

  const geometry = new SphereGeometry(1, 64, 64);
  const material = createCustomMaterial("#2f2f2f");

  virtualBackgroundMesh = new Mesh(geometry, material);
  virtualBackgroundMesh.scale.set(100, 100, 100);
  virtualScene.add(virtualBackgroundMesh);

  floatMesh({
    group: floatLight,
    speed: 5,
    rotationIntensity: 2,
    floatIntensity: 2,
  });

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

// 设置相机动画
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

// 设置舞台聚光灯
const setBigSpotLight = () => {
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

// 初始化场景
const initScene = async () => {
  scene = new Scene();
  setRender();
  setAmbientLight();
  setCamera();
  await load3DModel();
  customModel();
  setSpotLight();

  const t = 600;
  setTimeout(() => {
    setEnvironment(scene, 256, Infinity);
    setMovingSpot(virtualScene);
  }, t * 2);
  setTimeout(() => {
    spotLight.visible = false;
    setBigSpotLight();
    setContactShadow();
  }, 3 * t);

  addControls();
  canvas.value.appendChild(renderer.domElement);
  autoRender();
  watchColorChange();
  listenPageSizeChange();
};

// 监听颜色变化
const watchColorChange = () => {
  watch(carCoatColor, (val, old) => {
    requestAnimationFrame(() => {
      if (val && model && model.materials) {
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

  watch(wheelColor, (val, old) => {
    requestAnimationFrame(() => {
      if (val && model && model.materials) {
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

// 重新设置渲染窗口大小
const changeRenderSize = () => {
  requestAnimationFrame(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

// 添加页面变化监听
const listenPageSizeChange = () => {
  window.addEventListener("resize", changeRenderSize);
};

// 切换车辆的核心逻辑
const selectVehicleById = async (newVehicleId) => {
  const newVehicle = vehicles.value.find(v => v.id === newVehicleId);
  if (!newVehicle || newVehicle.id === currentVehicle.value.id) {
      console.log("Vehicle not found or already selected:", newVehicleId);
    return;
  }

  currentVehicle.value = newVehicle;
  localStorage.setItem('lastSelectedVehicleId', newVehicleId); // 保存选择

  try {
    const savedConfig = await loadVehicleConfig(newVehicleId);
    
    if (savedConfig && savedConfig.customSettings) {
      debugScale.value = savedConfig.customSettings.scale || newVehicle.scale || 1.0;
      debugPosition.value = savedConfig.customSettings.position || [...newVehicle.position] || [0, 0, 0];
      debugRotationY.value = savedConfig.customSettings.rotation || 0;
      carCoatColor.value = savedConfig.customSettings.colors?.body || newVehicle.colors?.body || "#2f426f";
      wheelColor.value = savedConfig.customSettings.colors?.wheel || newVehicle.colors?.wheel || "#1a1a1a";
    } else {
      debugScale.value = newVehicle.scale || 1.0;
      debugPosition.value = Array.isArray(newVehicle.position) ?
        [...newVehicle.position] : [0, 0, 0];
      debugRotationY.value = 0;
      carCoatColor.value = newVehicle.colors?.body || "#2f426f";
      wheelColor.value = newVehicle.colors?.wheel || "#1a1a1a";
    }
    
    if (renderer) {
      renderer.shadowMap.autoUpdate = false;
    }
    
    cleanupScene();
    
    if (window.gc) window.gc();
    
    scene = new Scene();
    setAmbientLight();
    setCamera();
    
    await load3DModel();
    customModel();
    setSpotLight();
    setEnvironment(scene, 256, Infinity);
    setMovingSpot(virtualScene);
    setBigSpotLight();
    setContactShadow();
    addControls();
    
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;

    autoRender();

  } catch (error) {
    console.error('切换模型失败:', error);
    showNotification('切换模型失败', 'error');
  }
};

// 处理来自 DebugPanel 的更新事件
const handleVehicleUpdate = (newVehicleId) => {
  selectVehicleById(newVehicleId);
};

// 左右箭头切换车辆
const changeVehicle = (direction) => {
  const currentIndex = vehicles.value.findIndex(v => v.id === currentVehicle.value.id);
  let nextIndex = currentIndex + direction;

  if (nextIndex < 0) {
    nextIndex = vehicles.value.length - 1; // 循环到最后一个
  } else if (nextIndex >= vehicles.value.length) {
    nextIndex = 0; // 循环到第一个
  }

  selectVehicleById(vehicles.value[nextIndex].id);
};

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

// 处理配置导入
const handleConfigsImported = async () => {
  try {
    vehicles.value = await getVehicles();
    showNotification('配置导入成功', 'success');
  } catch (error) {
    console.error('更新车辆列表失败:', error);
    showNotification('更新车辆列表失败', 'error');
  }
};

// 初始化应用
const initializeApp = async () => {
  try {
    // 先获取车辆列表
    vehicles.value = await getVehicles();
    
    // 检查 currentVehicle 是否已被 onMounted 中的 localStorage 逻辑设置
    // 如果没有（即仍然是默认的第一个），或者找不到，则重置为第一个
    if (!currentVehicle.value || !vehicles.value.find(v => v.id === currentVehicle.value.id)) {
        currentVehicle.value = vehicles.value[0];
        localStorage.setItem('lastSelectedVehicleId', currentVehicle.value.id); // 确保 LocalStorage 更新
    }
    
    // 使用确定好的 currentVehicle.value.id 初始化服务和加载配置
    const vehicleIdToLoad = currentVehicle.value.id;

    await Promise.all([
      vehicleService.initializeVehicles(), // 这个可能不需要每次都执行?
      settingsService.initializeSettings()
    ]);

    const savedConfig = await vehicleService.getVehicle(vehicleIdToLoad);
    const vehicleData = vehicles.value.find(v => v.id === vehicleIdToLoad); // 获取基础数据

    if (savedConfig && savedConfig.customSettings) {
      debugScale.value = savedConfig.customSettings.scale ?? vehicleData?.scale ?? 1.0;
      debugPosition.value = savedConfig.customSettings.position ?? [...(vehicleData?.position ?? [0, 0, 0])];
      debugRotationY.value = savedConfig.customSettings.rotation ?? 0;
      carCoatColor.value = savedConfig.customSettings.colors?.body ?? vehicleData?.colors?.body ?? "#2f426f";
      wheelColor.value = savedConfig.customSettings.colors?.wheel ?? vehicleData?.colors?.wheel ?? "#1a1a1a";
    } else {
      debugScale.value = vehicleData?.scale ?? 1.0;
      // 使用 Array.isArray 检查 position
      debugPosition.value = Array.isArray(vehicleData?.position) ? [...vehicleData.position] : [0, 0, 0];
      debugRotationY.value = 0;
      carCoatColor.value = vehicleData?.colors?.body ?? "#2f426f";
      wheelColor.value = vehicleData?.colors?.wheel ?? "#1a1a1a";
    }

    await initScene(); // initScene 内部会使用 currentVehicle.value

    // 在模型加载后应用初始变换（initScene 内部已包含加载和设置）
    // if (model && model.scene) { ... } // 这部分逻辑似乎在 initScene 内部处理了

    console.log('初始化完成，车辆:', currentVehicle.value.name, '角度值:', debugRotationY.value);

  } catch (error) {
    console.error('初始化失败:', error);
    showNotification('初始化失败', 'error');
  }
};

onMounted(() => {
  const lastVehicleId = localStorage.getItem('lastSelectedVehicleId');
  console.log("LocalStorage read:", lastVehicleId);
  if (lastVehicleId) {
    // 暂时只设置 ID，让 initializeApp 去完整加载
    // 注意：需要确保 vehiclesList 在此时可用，或者 initializeApp 先获取列表
    // 更好的方法是 initializeApp 接收一个可选的 initialVehicleId
    const foundVehicle = vehiclesList.find(v => v.id === lastVehicleId); // 直接用导入的列表查找
    if(foundVehicle) {
        currentVehicle.value = foundVehicle; // 先设置，initializeApp 会验证和加载
        console.log("Found vehicle in list for stored ID:", foundVehicle.name);
    } else {
        console.log("Vehicle ID from storage not found in current list, defaulting.");
        localStorage.removeItem('lastSelectedVehicleId'); // 清除无效 ID
    }
  }
  initializeApp(); // initializeApp 现在会检查 currentVehicle.value
});

onUnmounted(() => {
  cancelAnimationFrame(renderFrameId);
  cleanupScene();
  window.removeEventListener("resize", changeRenderSize);
});

const debugScale = ref(1.0);
const debugPosition = ref([0, 0, 0]);
const debugRotationY = ref(0);

// 更新模型缩放
const updateModelScale = (scale) => {
  debugScale.value = scale;
  if (model && model.scene) {
    model.scene.scale.set(scale, scale, scale);
  }
  // 同步缩放阴影组
  if (shadowGroup) {
      // 假设阴影组的初始缩放是 1, 1, 1
      // 注意：如果阴影的创建方式不同，这里的逻辑可能需要调整
      shadowGroup.scale.set(scale, scale, 1); 
      // 可能只需要缩放 x 和 y，取决于阴影平面的朝向
      // 如果 shadowGroup.rotation 是 (0, PI/2, 0)，则 x,y 对应原始平面的 x,y
  }
};

// 更新模型位置
const updateModelPosition = (position) => {
  debugPosition.value = position;
  if (model && model.scene) {
    model.scene.position.set(...position);
  }
};

// 更新模型旋转
const updateModelRotation = (rotation) => {
  debugRotationY.value = rotation;
  if (model && model.scene) {
    model.scene.rotation.set(0, rotation, 0);
  }
};

// 更新相机位置
const updateCameraPosition = (position) => {
  if (camera) {
    camera.position.set(...position);
  }
};

// 更新相机FOV
const updateCameraFov = (fov) => {
  if (camera) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
};

// 切换自动旋转
const toggleAutoRotate = (enabled) => {
  if (controls) {
    controls.autoRotate = enabled;
  }
};

// 切换网格显示
const toggleGridHelper = (enabled) => {
  if (enabled) {
    const gridHelper = new GridHelper(10, 10);
    scene.add(gridHelper);
  } else {
    scene.children.forEach(child => {
      if (child instanceof GridHelper) {
        scene.remove(child);
      }
    });
  }
};

// 切换坐标轴显示
const toggleAxesHelper = (enabled) => {
  if (enabled) {
    const axesHelper = new AxesHelper(1);
    scene.add(axesHelper);
  } else {
    scene.children.forEach(child => {
      if (child instanceof AxesHelper) {
        scene.remove(child);
      }
    });
  }
};

// 更新网格设置
const updateGridHelper = (settings) => {
  scene.children.forEach(child => {
    if (child instanceof GridHelper) {
      scene.remove(child);
    }
  });
  const gridHelper = new GridHelper(settings.size, settings.divisions);
  scene.add(gridHelper);
};

// 更新坐标轴大小
const updateAxesHelper = (size) => {
  scene.children.forEach(child => {
    if (child instanceof AxesHelper) {
      scene.remove(child);
    }
  });
  const axesHelper = new AxesHelper(size);
  scene.add(axesHelper);
};
</script>

<style scoped>
.scene {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.navigation-buttons {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1002;
  display: flex;
  gap: 15px;
}

.nav-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(5px);
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.nav-btn i {
  font-size: 1.1em;
}

.home-btn {
  background-color: rgba(66, 185, 131, 0.7);
  border-color: rgba(66, 185, 131, 0.9);
}

.home-btn:hover {
  background-color: rgba(66, 185, 131, 0.9);
}

.race-btn {
  background-color: rgba(52, 152, 219, 0.7);
  border-color: rgba(52, 152, 219, 0.9);
}

.race-btn:hover {
  background-color: rgba(52, 152, 219, 0.9);
}

/* 添加箭头按钮样式 */
.arrow-btn {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1001;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 20px;
  line-height: 38px; /* 微调垂直居中 */
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  backdrop-filter: blur(5px);
}

.arrow-btn:hover {
  background-color: rgba(0, 0, 0, 0.7);
  transform: translateY(-50%) scale(1.1);
}

.left-arrow {
  left: 20px;
}

.right-arrow {
  right: 20px;
}

/* 确保 DebugPanel 的 z-index 低于箭头按钮，如果需要的话 */
.debug-panel { 
  z-index: 1000; /* 确保调试面板在箭头下方 */
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