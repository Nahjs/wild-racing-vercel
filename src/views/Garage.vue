<template>
  <div ref="containerRef" class="scene">
    <canvas ref="canvasElementRef" class="webgl-canvas"></canvas>
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

    <DebugPanel v-if="isDebugMode && currentVehicle"
      :vehicles="vehicles"
      :current-vehicle-id="currentVehicle.id"
      @update:currentVehicleId="handleVehicleUpdate"
      :current-vehicle="currentVehicle"
      :car-coat-color="carCoatColor"
      :wheel-color="wheelColor"
      :auto-rotate="controls?.autoRotate ?? false"
      @update:scale="updateModelScale"
      @update:position="updateModelPosition"
      @update:rotation="updateModelRotation"
      @update:autoRotate="toggleAutoRotate"
      @update:showGrid="toggleGridHelper"
      @update:showAxes="toggleAxesHelper"
      @update:gridSettings="updateGridHelper"
      @update:axesSize="updateAxesHelper"
      @configsImported="handleConfigsImported"
      @update:carColor="updateCarColor"
      @update:wheelColor="updateWheelColor"
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
import { ref, onMounted, onUnmounted, watch, shallowRef, nextTick, markRaw, toRaw } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from "@/utils/loaders/GLTFLoader";
import { DRACOLoader } from "@/utils/loaders/DRACOLoader";
import DebugPanel from '@/debug/GarageDebug.vue';
import { vehiclesList, getVehicles } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';
import { settingsService } from '@/services/settingsService';
import { debounce, isOnline } from '@/utils/helpers';
import { useSceneSetup } from '@/composables/useSceneSetup';
import { useEnvironmentSetup } from '@/composables/useEnvironmentSetup';

const containerRef = ref(null);
const canvasElementRef = ref(null);
const isDebugMode = ref(true);
const vehicles = ref([]);
const currentVehicle = ref(null);
const model = shallowRef(null);
const carCoatColor = ref("#2f426f");
const wheelColor = ref("#1a1a1a");
const notification = ref({ show: false, message: '', type: 'info' });
const debugScale = ref(1.0);
const debugPosition = ref([0, 0, 0]);
const debugRotationY = ref(0);

const {
    scene,
    camera,
    renderer,
    controls,
    startAnimationLoop,
    stopAnimationLoop,
    cleanup: cleanupScene,
    addGridHelper: addGridHelperInternal,
    removeGridHelper: removeGridHelperInternal,
    addAxesHelper: addAxesHelperInternal,
    removeAxesHelper: removeAxesHelperInternal,
    updateGridHelperSize: updateGridHelperSizeInternal,
    updateAxesHelperSize: updateAxesHelperSizeInternal
} = useSceneSetup(canvasElementRef, {
    cameraPosition: new THREE.Vector3(0, 0.8, 8),
    cameraFov: 30,
    enableOrbitControls: true,
    orbitControlsOptions: {
         enableDamping: true,
         dampingFactor: 0.05,
         rotateSpeed: 0.5,
         enableZoom: true,
         zoomSpeed: 0.5,
         enablePan: true,
         panSpeed: 0.5,
         minDistance: 3,
         maxDistance: 20,
         minPolarAngle: Math.PI / 4,
         maxPolarAngle: Math.PI / 2,
    }
});

const {
  initializeEnvironment,
  cleanupEnvironment,
} = useEnvironmentSetup({
    enableContactShadow: true,
    enableEnvironmentMap: true,
    enableBigSpotLight: true
});

const showNotification = (message, type = 'info', duration = 3000) => {
    notification.value = { show: true, message, type };
    setTimeout(() => { notification.value.show = false; }, duration);
};

const cleanupModelRefs = () => {
    if (model.value) {
        const rawScene = toRaw(scene.value);
        if (rawScene && model.value.parent === rawScene) {
            rawScene.remove(model.value);
        }
        model.value.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
               if (Array.isArray(child.material)) {
                   child.material.forEach(m => {
                       Object.values(m).forEach(value => {
                           if (value instanceof THREE.Texture) value.dispose();
                       });
                       m?.dispose();
                   });
               } else {
                    Object.values(child.material).forEach(value => {
                           if (value instanceof THREE.Texture) value.dispose();
                       });
                    child.material?.dispose();
               }
            }
        });
        console.log("Garage: Cleaned up previous model resources.");
    }
    model.value = null;
};

const load3DModel = async () => {
    cleanupModelRefs();
    const rawScene = toRaw(scene.value);
    if (!rawScene) {
         console.error("Garage: Scene not available for loading model.");
         showNotification('场景未初始化，无法加载模型', 'error');
         return;
    }
    if (!currentVehicle.value?.model) {
        console.error("Garage: No valid vehicle model path selected.");
        showNotification('无效的车辆模型路径', 'error');
        return;
    }
    console.log(`Garage: Loading model: ${currentVehicle.value.model}`);

    try {
        const dracoLoader = new DRACOLoader().setDecoderPath("/libs/draco/");
        const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
        const loadedGltf = await gltfLoader.loadAsync(currentVehicle.value.model);

        if (loadedGltf.scene) {
             const loadedModelGroup = markRaw(loadedGltf.scene);

             loadedModelGroup.scale.set(debugScale.value, debugScale.value, debugScale.value);
             loadedModelGroup.position.set(...debugPosition.value);
             loadedModelGroup.rotation.set(0, debugRotationY.value, 0);

             loadedModelGroup.traverse((child) => {
                 if (child.isMesh) {
                     child.castShadow = true;
                     child.receiveShadow = true;
                 }
             });

             model.value = loadedModelGroup;
             rawScene.add(model.value);

             console.log("Garage: Model loaded and added to scene:", currentVehicle.value.name);

             await nextTick();
             customModel();

             const rawControls = toRaw(controls.value);
             if (rawControls && model.value) {
                 const box = new THREE.Box3().setFromObject(model.value);
                 const center = box.getCenter(new THREE.Vector3());
                 rawControls.target.copy(center);
                 console.log("Garage: OrbitControls target updated to model center:", center);
             }

        } else {
             console.error('Garage: Loaded GLTF does not contain a scene.');
             showNotification('加载的模型无效', 'error');
        }
    } catch (error) {
        console.error('Garage: Model loading failed:', error);
        showNotification(`模型加载失败: ${error.message}`, 'error');
    }
};

const customModel = () => {
    if (!model.value) {
        console.warn("Garage: customModel called but no model loaded.");
        return;
    }
    console.log("Garage: Applying material customizations...");

    model.value.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            const nodeNameLower = child.name.toLowerCase();

            materials.forEach(material => {
                if (!material) return;
                material.needsUpdate = false;
                const materialNameLower = material.name ? material.name.toLowerCase() : '';

                if (nodeNameLower.includes('rubber') || nodeNameLower.includes('tire') || materialNameLower.includes('rubber') || materialNameLower.includes('tire')) {
                    if (material.color) material.color.set("#222");
                    material.roughness = 0.6;
                    material.metalness = 0.1;
                    material.roughnessMap = null;
                    if (material.normalScale) material.normalScale.set(4, 4);
                    material.needsUpdate = true;
                }
                else if (nodeNameLower.includes('window') || nodeNameLower.includes('glass') || materialNameLower.includes('window') || materialNameLower.includes('glass')) {
                    if (material.color) material.color.set("black");
                    material.roughness = 0;
                    material.metalness = 0;
                    if ('clearcoat' in material) material.clearcoat = 0.1;
                    material.envMapIntensity = 2;
                    material.needsUpdate = true;
                }
                else if (nodeNameLower.includes('body') || nodeNameLower.includes('paint') || nodeNameLower.includes('coat') || materialNameLower.includes('body') || materialNameLower.includes('paint') || materialNameLower.includes('coat')) {
                    if (material.color) material.color.set(carCoatColor.value);
                    material.roughness = 0.2;
                    material.metalness = 0.3;
                    if ('clearcoat' in material) material.clearcoat = 0.5;
                    if ('clearcoatRoughness' in material) material.clearcoatRoughness = 0.1;
                    material.envMapIntensity = 4;
                    material.needsUpdate = true;
                }
                else if ((nodeNameLower.includes('wheel') || nodeNameLower.includes('rim') || materialNameLower.includes('wheel') || materialNameLower.includes('rim')) &&
                         !(nodeNameLower.includes('tire') || nodeNameLower.includes('rubber') || materialNameLower.includes('tire') || materialNameLower.includes('rubber'))) {
                    if (material.color) material.color.set(wheelColor.value);
                    material.roughness = 0.1;
                    material.metalness = 0.9;
                    material.envMapIntensity = 3;
                    material.needsUpdate = true;
                }
                else {
                    material.roughness = 0.6;
                    material.metalness = 0.4;
                    material.envMapIntensity = 1.5;
                }
            });
        }
    });
     console.log("Garage: Material customizations applied.");
};

const loadVehicleConfig = async (vehicleId) => {
    try {
        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleId);
        const baseVehicleData = vehicles.value.find(v => v.id === vehicleId);

        if (!baseVehicleData) {
            console.error(`Base data for vehicle ID ${vehicleId} not found!`);
            showNotification('找不到车辆基础数据', 'error');
            return vehicles.value[0] || null;
        }

        let finalConfig = {
             ...baseVehicleData,
             customSettings: baseVehicleData.customSettings || {}
        };

        if (vehicleDataFromDB) {
             finalConfig = {
                 ...finalConfig,
                 ...vehicleDataFromDB,
                 customSettings: {
                     ...finalConfig.customSettings,
                     ...(vehicleDataFromDB.customSettings || {})
                 }
             };
        } else {
            console.warn(`Config for ${vehicleId} not found in DB, using base data defaults.`);
        }

        const settings = finalConfig.customSettings;
        const basePos = Array.isArray(baseVehicleData.position) ? baseVehicleData.position : [0, 0, 0];
        const savedPos = settings.position;

        debugScale.value = settings.scale ?? baseVehicleData.scale ?? 1.0;
        debugPosition.value = Array.isArray(savedPos) ? savedPos : basePos;
        debugRotationY.value = settings.rotation ?? 0;
        carCoatColor.value = settings.colors?.body ?? baseVehicleData.colors?.body ?? "#2f426f";
        wheelColor.value = settings.colors?.wheel ?? baseVehicleData.colors?.wheel ?? "#1a1a1a";

        return finalConfig;

    } catch (error) {
        console.error(`Error loading config for ${vehicleId}:`, error);
        showNotification('加载车辆配置失败', 'error');
        const baseVehicleData = vehicles.value.find(v => v.id === vehicleId) || vehicles.value[0] || null;
        if (baseVehicleData) {
            debugScale.value = baseVehicleData.scale || 1.0;
            debugPosition.value = Array.isArray(baseVehicleData.position) ? [...baseVehicleData.position] : [0, 0, 0];
            debugRotationY.value = 0;
            carCoatColor.value = baseVehicleData.colors?.body || "#2f426f";
            wheelColor.value = baseVehicleData.colors?.wheel || "#1a1a1a";
            return baseVehicleData;
        }
        return null;
    }
};

const selectVehicleById = async (newVehicleId) => {
    console.log("Garage: Selecting vehicle:", newVehicleId);
    if (currentVehicle.value?.id === newVehicleId) {
        console.log("Garage: Vehicle already selected.");
        return;
    }

    const newVehicleBase = vehicles.value.find(v => v.id === newVehicleId);
    if (!newVehicleBase) {
         console.error("Garage: Vehicle not found in list:", newVehicleId);
         showNotification('车辆列表中找不到该车辆', 'error');
         return;
    }

    const loadedFullConfig = await loadVehicleConfig(newVehicleId);
    if (!loadedFullConfig) return;
    currentVehicle.value = loadedFullConfig;
    localStorage.setItem('lastSelectedVehicleId', newVehicleId);

    console.log("Garage: Cleaning up for vehicle switch...");
    stopAnimationLoop();
    cleanupEnvironment();
    cleanupModelRefs();

    const rawScene = toRaw(scene.value);
    const rawRenderer = toRaw(renderer.value);
    if (rawScene && rawRenderer) {
        initializeEnvironment(rawScene, rawRenderer, debugPosition.value[2] || 0);
        console.log("Garage: Environment re-initialized.");
    } else {
        console.error("Garage: Scene/Renderer invalid during environment re-init.");
    }

    await load3DModel();

    startAnimationLoop();
    console.log("Garage: Vehicle switch complete, animation loop restarted.");
};

const handleVehicleUpdate = (newVehicleId) => {
    if (currentVehicle.value?.id !== newVehicleId) {
        selectVehicleById(newVehicleId);
    }
};

const changeVehicle = (direction) => {
    if (!vehicles.value || vehicles.value.length === 0) return;
    const currentIndex = vehicles.value.findIndex(v => v.id === currentVehicle.value?.id);
    let nextIndex = (currentIndex === -1 ? 0 : currentIndex) + direction;
    if (nextIndex < 0) nextIndex = vehicles.value.length - 1;
    else if (nextIndex >= vehicles.value.length) nextIndex = 0;
    selectVehicleById(vehicles.value[nextIndex].id);
};

const updateModelScale = (scale) => {
    debugScale.value = scale;
    if (model.value) model.value.scale.set(scale, scale, scale);
};
const updateModelPosition = (position) => {
    debugPosition.value = position;
    if (model.value) model.value.position.set(...position);
    const rawControls = toRaw(controls.value);
    if (rawControls && model.value) {
        const box = new THREE.Box3().setFromObject(model.value);
        const center = box.getCenter(new THREE.Vector3());
        rawControls.target.copy(center);
    }
};
const updateModelRotation = (rotation) => {
    debugRotationY.value = rotation;
    if (model.value) model.value.rotation.set(0, rotation, 0);
};
const updateCarColor = (color) => { carCoatColor.value = color; customModel(); };
const updateWheelColor = (color) => { wheelColor.value = color; customModel(); };

const toggleAutoRotate = (enabled) => {
    const rawControls = toRaw(controls.value);
    if (rawControls) {
        rawControls.autoRotate = enabled;
    }
};
const toggleGridHelper = (enabled) => {
   if (enabled) addGridHelperInternal();
   else removeGridHelperInternal();
};
const toggleAxesHelper = (enabled) => {
    if (enabled) addAxesHelperInternal();
    else removeAxesHelperInternal();
};
const updateGridHelper = (settings) => {
    updateGridHelperSizeInternal(settings.size, settings.divisions);
};
const updateAxesHelper = (size) => {
    updateAxesHelperSizeInternal(size);
};

const handleConfigsImported = async () => {
    try {
        const oldVehicleId = currentVehicle.value?.id;
        vehicles.value = await getVehicles();
        showNotification('配置导入成功', 'success');
        if (oldVehicleId && vehicles.value.some(v => v.id === oldVehicleId)) {
             await selectVehicleById(oldVehicleId);
        } else if (vehicles.value.length > 0) {
             await selectVehicleById(vehicles.value[0].id);
        } else {
            cleanupModelRefs();
            currentVehicle.value = null;
        }
    } catch (error) {
        console.error('更新车辆列表失败:', error);
        showNotification('更新车辆列表失败', 'error');
    }
};

const initializeApp = async () => {
    console.log("Garage: Initializing application...");
    let initSuccess = false;
    try {
        vehicles.value = await getVehicles();
        if (!vehicles.value || vehicles.value.length === 0) {
            console.error("Garage: No vehicles available to load.");
            showNotification('没有可用的车辆', 'error');
            return;
        }

        let vehicleIdToLoad = vehicles.value[0].id;
        const lastVehicleId = localStorage.getItem('lastSelectedVehicleId');
        if (lastVehicleId && vehicles.value.some(v => v.id === lastVehicleId)) {
            vehicleIdToLoad = lastVehicleId;
            console.log(`Garage: Loading last selected vehicle: ${vehicleIdToLoad}`);
        } else {
             console.log(`Garage: Loading default vehicle: ${vehicleIdToLoad}`);
             if(lastVehicleId) localStorage.removeItem('lastSelectedVehicleId');
        }

        const initialConfig = await loadVehicleConfig(vehicleIdToLoad);
        if (!initialConfig) {
             console.error("Garage: Failed to load initial vehicle configuration.");
             showNotification('加载初始车辆配置失败', 'error');
             return;
        }
        currentVehicle.value = initialConfig;

        const stopWatchScene = watch([scene, renderer], async ([sceneVal, rendererVal]) => {
            if (sceneVal && rendererVal && !initSuccess) {
                console.log("Garage: Scene and Renderer are ready from useSceneSetup.");

                initializeEnvironment(sceneVal, rendererVal, debugPosition.value[2] || 0);
                console.log("Garage: Environment initialization initiated.");

                await load3DModel();

                startAnimationLoop(() => {
                });
                console.log("Garage: Animation loop started.");

                setupKeyListener();
                initSuccess = true;
                stopWatchScene();
            }
        }, { immediate: true });

        console.log('Garage: Initialization sequence started (waiting for scene/renderer).');

    } catch (error) {
        console.error('Garage: Initialization failed:', error);
        showNotification(`初始化失败: ${error.message}`, 'error');
    }
};

onMounted(() => {
    initializeApp();
});

onUnmounted(() => {
    console.log("Garage: Cleaning up component...");

    // 1. Stop animation loop FIRST
    stopAnimationLoop();
    console.log("Garage: Animation loop stopped by component.");

    // 2. Clean up environment resources (needs renderer)
    cleanupEnvironment();
    console.log("Garage: Environment cleanup called by component.");

    // 3. Clean up the loaded 3D model
    cleanupModelRefs();
    console.log("Garage: Model cleanup called by component.");

    // 4. Clean up scene, camera, renderer (disposes renderer)
    cleanupScene();
    console.log("Garage: Scene cleanup called by component.");

    // 5. Remove event listeners
    removeKeyListener();
    console.log("Garage: Key listener removed by component.");

    console.log("Garage: Component cleanup finished.");
});

const handleKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
    }
    if (event.key === 'p' || event.key === 'P') {
         isDebugMode.value = !isDebugMode.value;
    } else if (event.key === 'ArrowLeft') {
         changeVehicle(-1);
    } else if (event.key === 'ArrowRight') {
         changeVehicle(1);
    }
};
const setupKeyListener = () => { window.addEventListener('keydown', handleKeyDown); };
const removeKeyListener = () => { window.removeEventListener('keydown', handleKeyDown); };

watch(carCoatColor, () => {
  if (model.value) {
    customModel();
  }
});
watch(wheelColor, () => {
  if (model.value) {
    customModel();
  }
});

</script>

<style scoped>
.scene {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background-color: #111;
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
  line-height: 38px;
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

.debug-panel {
  z-index: 1000;
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

.webgl-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style> 