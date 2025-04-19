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
      :auto-rotate="sceneAutoRotate"
      :showGrid="sceneShowGrid"
      :gridSize="sceneGridSize"
      :gridDivisions="sceneGridDivisions"
      :showAxes="sceneShowAxes"
      :axesSize="sceneAxesSize"
      :enginePower="tuningParams.enginePower"
      :turnStrength="tuningParams.turnStrength"
      :vehicleMass="tuningParams.vehicleMass"
      :linearDamping="tuningParams.linearDamping"
      :angularDamping="tuningParams.angularDamping"
      :groundFriction="tuningParams.groundFriction"
      :brakePower="tuningParams.brakePower"
      :slowDownForce="tuningParams.slowDownForce"
      :suspensionStiffness="tuningParams.suspensionStiffness"
      :suspensionRestLength="tuningParams.suspensionRestLength"
      :frictionSlip="tuningParams.frictionSlip"
      :dampingRelaxation="tuningParams.dampingRelaxation"
      :dampingCompression="tuningParams.dampingCompression"
      :maxSuspensionForce="tuningParams.maxSuspensionForce"
      :rollInfluence="tuningParams.rollInfluence"
      :maxSuspensionTravel="tuningParams.maxSuspensionTravel"
      :customSlidingRotationalSpeed="tuningParams.customSlidingRotationalSpeed"
      :initialCorrectionAxis="tuningParams.initialCorrectionAxis"
      :initialCorrectionAngle="tuningParams.initialCorrectionAngle"
      :showWheelAxes="tuningParams.showWheelAxes"
      :showPhysicsDebug="showPhysicsDebug"
      :isSavingTuning="isSavingTuning"
      @update:scale="updateModelScale"
      @update:position="updateModelPosition"
      @update:rotation="updateModelRotation"
      @update:carColor="updateCarColor"
      @update:wheelColor="updateWheelColor"
      @update:autoRotate="toggleAutoRotate"
      @update:showGrid="toggleGridHelper"
      @update:gridSettings="updateGridHelper"
      @update:showAxes="toggleAxesHelper"
      @update:axesSize="updateAxesHelper"
      @configsImported="handleConfigsImported"
      @save-tuning="handleSaveTuning"
      @update:enginePower="updateTuningParam('enginePower', $event)"
      @update:turnStrength="updateTuningParam('turnStrength', $event)"
      @update:vehicleMass="updateTuningParam('vehicleMass', $event)"
      @update:linearDamping="updateTuningParam('linearDamping', $event)"
      @update:angularDamping="updateTuningParam('angularDamping', $event)"
      @update:groundFriction="updateTuningParam('groundFriction', $event)"
      @update:brakePower="updateTuningParam('brakePower', $event)"
      @update:slowDownForce="updateTuningParam('slowDownForce', $event)"
      @update:suspensionStiffness="updateTuningParam('suspensionStiffness', $event)"
      @update:suspensionRestLength="updateTuningParam('suspensionRestLength', $event)"
      @update:frictionSlip="updateTuningParam('frictionSlip', $event)"
      @update:dampingRelaxation="updateTuningParam('dampingRelaxation', $event)"
      @update:dampingCompression="updateTuningParam('dampingCompression', $event)"
      @update:maxSuspensionForce="updateTuningParam('maxSuspensionForce', $event)"
      @update:rollInfluence="updateTuningParam('rollInfluence', $event)"
      @update:maxSuspensionTravel="updateTuningParam('maxSuspensionTravel', $event)"
      @update:customSlidingRotationalSpeed="updateTuningParam('customSlidingRotationalSpeed', $event)"
      @update:initialCorrectionAxis="updateTuningParam('initialCorrectionAxis', $event)"
      @update:initialCorrectionAngle="updateTuningParam('initialCorrectionAngle', $event)"
      @update:showPhysicsDebug="showPhysicsDebug = $event"
      @update:showWheelAxes="updateTuningParam('showWheelAxes', $event)"
      :wheel-indices="tuningParams.wheelIndices"
      @update:wheelIndices="updateTuningParam('wheelIndices', $event)"
      :visualOffsetY="tuningParams.visualOffsetY"
      @update:visualOffsetY="updateTuningParam('visualOffsetY', $event)"
      :connection-points="tuningParams.connectionPoints"
      @update:connectionPoints="updateTuningParam('connectionPoints', $event)"
    />
    
    <!-- 操作结果提示 -->
    <div class="notification" v-if="notification.show">
      <div class="notification-content" :class="notification.type">
        <span>{{ notification.message }}</span>
      </div>
    </div>

    <!-- Physics Engine Component -->
    <PhysicsEngine
      v-if="scene"
      ref="physicsEngineRef"
      :scene="scene"
      :debug="showPhysicsDebug"
      @physics-ready="handlePhysicsReady"
    />

    <!-- Vehicle Controller Component (conditionally rendered) -->
    <VehicleController
      v-if="physicsWorld && currentVehicle && model"
      ref="vehicleControllerRef"
      :world="physicsWorld"
      :scene="scene"
      :carModel="model"
      :scale="debugScale"
      :initialPosition="{ x: debugPosition[0], y: -0.5, z: debugPosition[2] }"
      :selectedVehicle="currentVehicle"
      @car-ready="handleCarReady"
      @position-update="handleVehiclePositionUpdate"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, shallowRef, nextTick, markRaw, toRaw, computed } from 'vue';
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
import PhysicsEngine from '@/core/physics/PhysicsEngine.vue';
import VehicleController from '@/game/vehicle/VehicleController.vue';
import { useInputControls } from '@/composables/useInputControls';
import * as CANNON from 'cannon-es';
import { useTuningStore } from '@/store/tuning';
import { storeToRefs } from 'pinia';

const containerRef = ref(null);
const canvasElementRef = ref(null);
const isDebugMode = ref(true);
const vehicles = ref([]);
const currentVehicle = ref(null);
const model = shallowRef(null);
const notification = ref({ show: false, message: '', type: 'info' });

const tuningStore = useTuningStore();
const { tuningParams, isSaving: isSavingTuning } = storeToRefs(tuningStore);

const debugScale = ref(1.0);
const debugPosition = ref([0, -1.0, 0]);
const debugRotationY = ref(0);
const carCoatColor = ref("#2f426f");
const wheelColor = ref("#1a1a1a");
const sceneAutoRotate = ref(false);
const sceneShowGrid = ref(false);
const sceneGridSize = ref(10);
const sceneGridDivisions = ref(10);
const sceneShowAxes = ref(false);
const sceneAxesSize = ref(1);
const showPhysicsDebug = ref(false);

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
    updateAxesHelperSize: updateAxesHelperSizeInternal,
    gridHelperRef,
    axesHelperRef
} = useSceneSetup(canvasElementRef, {
    cameraPosition: new THREE.Vector3(0, 0.8, 15),
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
         minDistance: 2,
         maxDistance: 100,
         minPolarAngle: Math.PI / 4,
         maxPolarAngle: Math.PI / 2,
    }
});

const { initializeEnvironment, cleanupEnvironment } = useEnvironmentSetup({
    enableContactShadow: false,
    enableEnvironmentMap: true,
    enableBigSpotLight: true
});

const showNotification = (message, type = 'info', duration = 3000) => {
    notification.value = { show: true, message, type };
    setTimeout(() => { notification.value.show = false; }, duration);
};

const cleanupModelRefs = () => {
    removeWheelAxes();
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
                       if (m) {
                         Object.values(m).forEach(value => {
                             if (value instanceof THREE.Texture) value.dispose();
                         });
                         m.dispose();
                       }
                   });
               } else {
                    Object.values(child.material).forEach(value => {
                           if (value instanceof THREE.Texture) value.dispose();
                       });
                    child.material.dispose();
               }
            }
        });
        console.log("Garage: Cleaned up previous model resources.");
    }
    model.value = null;
    wheelMeshRefs.value = { FL: null, FR: null, RL: null, RR: null };
    console.log("Garage: Cleaned up model and wheel references.");
};

const wheelMeshRefs = ref({ FL: null, FR: null, RL: null, RR: null });
const AXES_HELPER_NAME = 'wheelAxesHelper';

const addWheelAxes = () => {
  Object.values(wheelMeshRefs.value).forEach(wheelRef => {
    if (wheelRef && !wheelRef.getObjectByName(AXES_HELPER_NAME)) {
      const axesHelper = new THREE.AxesHelper(0.5);
      axesHelper.name = AXES_HELPER_NAME;
      wheelRef.add(axesHelper);
    }
  });
};

const removeWheelAxes = () => {
  Object.values(wheelMeshRefs.value).forEach(wheelRef => {
    if (wheelRef) {
      const helper = wheelRef.getObjectByName(AXES_HELPER_NAME);
      if (helper) {
        wheelRef.remove(helper);
      }
    }
  });
};

watch(() => tuningParams.value.showWheelAxes, (show) => {
    if (show) {
        addWheelAxes();
    } else {
        removeWheelAxes();
    }
}, { immediate: true });

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

             // --- 添加 Z-up 到 Y-up 修正 ---
             // 围绕 X 轴旋转 -90 度，将 Z 轴指向 Y 轴
             const zUpToYUpQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
             loadedModelGroup.quaternion.multiplyQuaternions(zUpToYUpQuaternion, loadedModelGroup.quaternion);
             // 应用旋转后，更新一下矩阵是个好习惯
             loadedModelGroup.updateMatrixWorld(true); 
             console.log("Garage: Applied Z-up to Y-up correction.");
             // --- 修正结束 ---

             loadedModelGroup.scale.set(debugScale.value, debugScale.value, debugScale.value);
             loadedModelGroup.position.set(...debugPosition.value);
             // 注意：这里的 Y 轴旋转是在 Y-up 坐标系下进行的
             loadedModelGroup.rotation.set(0, debugRotationY.value, 0);

             model.value = loadedModelGroup;

             const baseData = currentVehicle.value;
             let wheelNodeNames = baseData.wheelNodeNames || {}; 
             console.log("Garage: Using configured wheel node names:", JSON.stringify(wheelNodeNames));

             wheelMeshRefs.value = { FL: null, FR: null, BL: null, BR: null };
             const foundWheels = { fl: false, fr: false, bl: false, br: false };
             const assignedNodes = new Set();
             const allNodesMap = new Map();
             const nodeNames = [];

             loadedModelGroup.traverse((child) => {
                 allNodesMap.set(child.name, child.type);
                 nodeNames.push(child.name);
                 if (child instanceof THREE.Object3D) {
                     child.castShadow = true; 
                     child.receiveShadow = true; 
                     
                     if (!assignedNodes.has(child)) {
                         const childNameTrimmed = child.name.trim(); // 去除前后空格
                         
                         if (wheelNodeNames.fl && childNameTrimmed === wheelNodeNames.fl) {
                             console.log(`Garage: Matched FL config: '${wheelNodeNames.fl}' with node '${child.name}' (Type: ${child.type})`);
                             wheelMeshRefs.value.FL = markRaw(child);
                             foundWheels.fl = true;
                             assignedNodes.add(child);
                         } else if (wheelNodeNames.fr && childNameTrimmed === wheelNodeNames.fr) {
                             console.log(`Garage: Matched FR config: '${wheelNodeNames.fr}' with node '${child.name}' (Type: ${child.type})`);
                             wheelMeshRefs.value.FR = markRaw(child);
                             foundWheels.fr = true;
                             assignedNodes.add(child);
                         } else if (wheelNodeNames.rl && childNameTrimmed === wheelNodeNames.rl) { // 使用 rl 键
                             console.log(`Garage: Matched RL(BL) config: '${wheelNodeNames.rl}' with node '${child.name}' (Type: ${child.type})`);
                             wheelMeshRefs.value.BL = markRaw(child); // 存入 BL
                             foundWheels.bl = true; // 标记 bl
                             assignedNodes.add(child);
                         } else if (wheelNodeNames.rr && childNameTrimmed === wheelNodeNames.rr) { // 使用 rr 键
                             console.log(`Garage: Matched RR(BR) config: '${wheelNodeNames.rr}' with node '${child.name}' (Type: ${child.type})`);
                             wheelMeshRefs.value.BR = markRaw(child); // 存入 BR
                             foundWheels.br = true; // 标记 br
                             assignedNodes.add(child);
                         }
                     }
                 }
             });

             const allConfiguredWheelsFound = Object.keys(wheelNodeNames).every(key => {
                 const mappedKey = key === 'rl' ? 'bl' : (key === 'rr' ? 'br' : key);
                 return foundWheels[mappedKey.toLowerCase()];
             });
             
             if (Object.keys(wheelNodeNames).length > 0 && !allConfiguredWheelsFound) {
                console.error("Garage: Failed to find all configured wheel nodes!", 
                            "Expected:", wheelNodeNames, 
                            "Found:", wheelMeshRefs.value);
                console.warn("Garage: All node names and types in the model:", Object.fromEntries(allNodesMap));
             }
             else if (!foundWheels.fl || !foundWheels.fr || !foundWheels.bl || !foundWheels.br) {
                console.warn("Garage: Some wheels not found via config (or config empty), attempting auto-detection for remaining...");
             }

             const allWheelsAssigned = wheelMeshRefs.value.FL && wheelMeshRefs.value.FR && wheelMeshRefs.value.BL && wheelMeshRefs.value.BR;
             if (allWheelsAssigned) {
                  console.log("Garage: Successfully found/assigned all wheel nodes:", wheelMeshRefs.value);
             } else {
                 console.error("Garage: Failed to find all required wheel nodes after config and auto-detection.", foundWheels);
                 console.warn("Garage: All node names in the model:", nodeNames);
                 console.warn("Garage: All node names and types in the model:", Object.fromEntries(allNodesMap));
                  console.log("Garage: Partially found wheel nodes:", wheelMeshRefs.value);
             }

             // Log wheel parent structure
             console.log('Wheel Parent Check (FL):', wheelMeshRefs.value.FL?.parent?.name, ' | Model Root:', model.value?.name);
             console.log('Wheel Parent Check (RR):', wheelMeshRefs.value.RR?.parent?.name, ' | Model Root:', model.value?.name);

             if (tuningParams.value.showWheelAxes) {
                addWheelAxes();
             }

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

             // 由 VehicleController 内部 watch 或 onMounted 逻辑处理物理初始化
             // tryInitializeVehiclePhysics(); 

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
    console.log("Garage: Applying material customizations (using local color refs)...", { body: carCoatColor.value, wheel: wheelColor.value });

    model.value.traverse((child) => {
        if (child instanceof THREE.Object3D) {
            const isWheelParent = Object.values(wheelMeshRefs.value).some(ref => ref === child);
            if (isWheelParent) {
                child.traverse((wheelPart) => {
                    if (wheelPart.isMesh && wheelPart.material) {
                        applyMaterialLogic(wheelPart);
                    }
                });
            } else if (child.isMesh && child.material) {
                applyMaterialLogic(child);
            }
        }
    });
    console.log("Garage: Material customizations applied.");
};

const applyMaterialLogic = (mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nodeNameLower = mesh.name.toLowerCase();

    materials.forEach(material => {
        if (!material) return;
        material.needsUpdate = false;
        const materialNameLower = material.name ? material.name.toLowerCase() : '';

        if (nodeNameLower.includes('body') || nodeNameLower.includes('paint') || nodeNameLower.includes('coat') || materialNameLower.includes('body') || materialNameLower.includes('paint') || materialNameLower.includes('coat')) {
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
        else if (nodeNameLower.includes('rubber') || nodeNameLower.includes('tire') || materialNameLower.includes('rubber') || materialNameLower.includes('tire')) {
            if (material.color) material.color.set("#222");
            material.roughness = 0.6;
            material.metalness = 0.1;
            if (material.normalScale) material.normalScale.set(4, 4);
            material.needsUpdate = true;
        }
        else if (nodeNameLower.includes('window') || nodeNameLower.includes('glass') || materialNameLower.includes('window') || materialNameLower.includes('glass')) {
            material.metalness = 0;
            if ('clearcoat' in material) material.clearcoat = 0.1;

            // Ensure it's MeshPhysicalMaterial for proper transmission/ior
            if (!(material instanceof THREE.MeshPhysicalMaterial)) {
                const physicalMaterial = new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color("black"),
                    roughness: 0,
                    metalness: 0,
                    transmission: 0.9, 
                    ior: 1.5,
                    thickness: 0.1, // Add thickness for refraction
                    transparent: true,
                    opacity: 0.3, // Keep opacity for visual effect
                    envMapIntensity: 2,
                    // Copy other relevant properties if needed from original material
                    // map: material.map, // Example: copy texture map
                });
                // If the mesh had multiple materials, replace only this one
                if (Array.isArray(material)) {
                    const index = material.indexOf(material);
                    if (index !== -1) material[index] = physicalMaterial;
                } else {
                    material = physicalMaterial;
                }
                material = physicalMaterial; // Update reference for needsUpdate
            } else {
                // Already PhysicalMaterial, just set properties
                if (material.color) material.color.set("black");
                material.roughness = 0;
                material.metalness = 0;
                material.transmission = 0.9;
                material.ior = 1.5;
                material.thickness = 0.1; // Ensure thickness is set
                material.opacity = 0.3;
                material.transparent = true;
                material.envMapIntensity = 2;
            }
            material.needsUpdate = true;
        }
        else {
        }
    });
};

const loadVehicleConfig = async (vehicleId) => {
    try {
        tuningStore.loadTuning(vehicleId);

        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleId);
        const baseVehicleData = vehicles.value.find(v => v.id === vehicleId);

        if (!baseVehicleData) {
            console.error(`Base data for vehicle ID ${vehicleId} not found!`);
            showNotification('找不到车辆基础数据', 'error');
            return vehicles.value[0] || null;
        }

        let finalConfig = {
             ...baseVehicleData,
             customSettings: vehicleDataFromDB?.customSettings ?? baseVehicleData.customSettings ?? {}
        };

        const settings = finalConfig.customSettings;
        const basePos = Array.isArray(baseVehicleData.position) ? baseVehicleData.position : [0, 0, 0];
        const savedPos = settings.position;

        debugScale.value = settings.scale ?? baseVehicleData.scale ?? 1.0;
        debugPosition.value = Array.isArray(savedPos) ? savedPos : basePos;
        debugRotationY.value = settings.rotation ?? baseVehicleData.rotation ?? 0;
        carCoatColor.value = settings.colors?.body ?? baseVehicleData.colors?.body ?? "#2f426f";
        wheelColor.value = settings.colors?.wheel ?? baseVehicleData.colors?.wheel ?? "#1a1a1a";

        console.log(`Loaded config for ${vehicleId}:`, { finalConfig, debugScale: debugScale.value, debugPosition: debugPosition.value, debugRotationY: debugRotationY.value });

        return finalConfig;

    } catch (error) {
        console.error(`Error loading config for ${vehicleId}:`, error);
        showNotification('加载车辆配置失败', 'error');
        const baseVehicleData = vehicles.value.find(v => v.id === vehicleId) || vehicles.value[0] || null;
        if (baseVehicleData) {
             tuningStore.resetToDefaults();
             debugScale.value = baseVehicleData.scale || 1.0;
             debugPosition.value = Array.isArray(baseVehicleData.position) ? [...baseVehicleData.position] : [0, 0, 0];
             debugRotationY.value = baseVehicleData.rotation || 0;
             carCoatColor.value = baseVehicleData.colors?.body || "#2f426f";
             wheelColor.value = baseVehicleData.colors?.wheel || "#1a1a1a";
             return { ...baseVehicleData, customSettings: {} };
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

    // 2. 获取新车辆配置
    const loadedFullConfig = await loadVehicleConfig(newVehicleId);
    if (!loadedFullConfig) return;
    currentVehicle.value = loadedFullConfig;
    localStorage.setItem('lastSelectedVehicleId', newVehicleId);

    // 3. 停止动画
    stopAnimationLoop(); 
    console.log("Garage: Animation loop stopped for vehicle switch.");

    // 4. 清理物理引擎
    const oldVehicleController = vehicleControllerRef.value;
    if (oldVehicleController && typeof oldVehicleController.cleanupPhysics === 'function') {
        console.log("Garage: Cleaning up previous vehicle physics...");
        oldVehicleController.cleanupPhysics();
        // 显式设置 null 可能有助于垃圾回收和状态判断
        vehicleControllerRef.value = null;
    } else {
        console.log("Garage: No old vehicle physics to clean up.");
    }

    // 5. 清理视觉资源
    console.log("Garage: Cleaning up THREE.js resources (environment and model)...");
    cleanupEnvironment();
    cleanupModelRefs();

    const rawScene = toRaw(scene.value);
    const rawRenderer = toRaw(renderer.value);
    if (rawScene && rawRenderer) {
        // 6. 重新初始化环境
        initializeEnvironment(rawScene, rawRenderer, debugPosition.value[2] || 0);
        console.log("Garage: Environment re-initialized for new vehicle.");
    } else {
        console.error("Garage: Scene/Renderer invalid during environment re-init.");
    }

    // 7. 加载新模型 (此时不应直接触发物理初始化)
    await load3DModel();
 
    // 8. 最后再启动动画循环
    // VehicleController 内部会根据 props 状态自行初始化物理
    startAnimationLoop(() => {
        // 确保 vehicleControllerRef 存在再调用
        vehicleControllerRef.value?.handlePhysicsUpdate(); 
    });
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
    sceneAutoRotate.value = enabled;
    const rawControls = toRaw(controls.value);
    if (rawControls) rawControls.autoRotate = enabled;
};
const toggleGridHelper = (enabled) => {
   sceneShowGrid.value = enabled;
   if (enabled) addGridHelperInternal(sceneGridSize.value, sceneGridDivisions.value);
   else removeGridHelperInternal();
};
const toggleAxesHelper = (enabled) => {
    sceneShowAxes.value = enabled;
    if (enabled) addAxesHelperInternal(sceneAxesSize.value);
    else removeAxesHelperInternal();
};
const updateGridHelper = (settings) => {
    sceneGridSize.value = settings.size;
    sceneGridDivisions.value = settings.divisions;
    updateGridHelperSizeInternal(settings.size, settings.divisions);
};
const updateAxesHelper = (size) => {
    sceneAxesSize.value = size;
    updateAxesHelperSizeInternal(size);
};

const updateTuningParam = (paramName, value) => {
    tuningStore.updateParam(paramName, value);
};

const handleSaveTuning = async () => {
    if (!currentVehicle.value?.id) {
        showNotification('No vehicle selected to save tuning for.', 'error');
        return;
    }
    showNotification('Saving tuning...', 'info');
    try {
        await tuningStore.saveTuning(); 
        showNotification('Tuning saved successfully!', 'success');
    } catch (error) {
        console.error("Garage: Failed to save tuning:", error);
        showNotification('Failed to save tuning.', 'error');
    }
};

const handleConfigsImported = async () => {
    showNotification('Reloading vehicle configurations...', 'info');
    try {
        const oldVehicleId = currentVehicle.value?.id;
        vehicles.value = await getVehicles();
        showNotification('Configurations reloaded', 'success');
        if (oldVehicleId && vehicles.value.some(v => v.id === oldVehicleId)) {
             await selectVehicleById(oldVehicleId);
        } else if (vehicles.value.length > 0) {
             await selectVehicleById(vehicles.value[0].id);
        } else {
            cleanupModelRefs();
            currentVehicle.value = null;
            tuningStore.resetToDefaults();
        }
    } catch (error) {
        console.error('Failed to reload vehicle list:', error);
        showNotification('Failed to reload configurations', 'error');
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
        } else {
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
                console.log("Garage: Scene and Renderer are ready.");
                initializeEnvironment(sceneVal, rendererVal, debugPosition.value[2] || 0);
                console.log("Garage: Environment initialized.");

                await load3DModel();

                startAnimationLoop(() => {
                    vehicleControllerRef.value?.handlePhysicsUpdate();
                });
                console.log("Garage: Animation loop started.");

                setupKeyListener();
                initSuccess = true;
                stopWatchScene();
            }
        }, { immediate: true });

        console.log('Garage: Initialization sequence started.');

    } catch (error) {
        console.error('Garage: Initialization failed:', error);
        showNotification(`初始化失败: ${error.message || error}`, 'error');
    }
};

onMounted(() => {
    initializeApp();
});

onUnmounted(() => {
    console.log("Garage: Cleaning up component...");
    stopAnimationLoop();
    if (vehicleControllerRef.value && typeof vehicleControllerRef.value.cleanupPhysics === 'function') {
        console.log("Garage: Cleaning up vehicle controller physics.");
        vehicleControllerRef.value.cleanupPhysics();
    }
    vehicleControllerRef.value = null;
    physicsEngineRef.value = null;
    physicsWorld.value = null;
    cleanupEnvironment();
    cleanupModelRefs();
    cleanupScene();
    removeKeyListener();
    console.log("Garage: Component cleanup finished.");
});

const handleKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
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

watch(carCoatColor, () => { if (model.value) customModel(); });
watch(wheelColor, () => { if (model.value) customModel(); });

const physicsEngineRef = ref(null);
const vehicleControllerRef = ref(null);

const physicsWorld = shallowRef(null);

const { controlState } = useInputControls();

const handlePhysicsReady = (payload) => {
  console.log("Garage: Physics world is ready.");
  physicsWorld.value = markRaw(payload.world);
  // 由 VehicleController 内部 watch 或 onMounted 逻辑处理物理初始化
  // tryInitializeVehiclePhysics(); 
};

const handleCarReady = () => {
  console.log("Garage: VehicleController reported car physics ready.");
};

const finalWheelQuaternion = new THREE.Quaternion();
const tempWorldPosition = new THREE.Vector3(); // Temporary vector for world position
const initialCorrectionQuaternion = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4(); // Reusable matrix
const tempQuaternion = new THREE.Quaternion(); // Reusable quaternion
const tempScale = new THREE.Vector3(); // Reusable vector for scale decomposition
const targetWorldMatrix = new THREE.Matrix4();
const targetLocalMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();

const handleVehiclePositionUpdate = (update) => {
  if (!model.value || !update.position || !update.quaternion || !update.wheelPositions || !update.wheelQuaternions) {
      return;
  }

  // 1. 更新车身模型的世界位置和旋转 (应用偏移)
  model.value.position.copy(update.position).add(new THREE.Vector3(0, tuningParams.value.visualOffsetY, 0));
  model.value.quaternion.copy(update.quaternion);

  // --- 添加: 更新 OrbitControls 的目标点 ---
  const rawControls = toRaw(controls.value);
  if (rawControls && model.value) {
      rawControls.target.copy(model.value.position); 
  }
  // --- 结束添加 ---

  // 确保车身模型的世界矩阵是最新的
  model.value.updateMatrixWorld(true);

  // 2. 准备初始旋转修正 (保持不变)
  const axisMap = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const correctionAxis = axisMap[tuningParams.value.initialCorrectionAxis] || axisMap.x;
  const angleRad = THREE.MathUtils.degToRad(tuningParams.value.initialCorrectionAngle);
  initialCorrectionQuaternion.setFromAxisAngle(correctionAxis, angleRad);

  // 3. 遍历轮毂网格并更新其世界变换
  const wheelIndices = tuningParams.value.wheelIndices;
  const wheelMeshes = wheelMeshRefs.value;

  for (const wheelKey in wheelMeshes) {
      const mesh = wheelMeshes[wheelKey];
      const index = wheelIndices[wheelKey];

      if (mesh && index !== undefined && index >= 0 && index < update.wheelPositions.length &&
          update.wheelPositions[index] &&
          update.wheelQuaternions[index]) {

        const physicsWheelWorldPosition = update.wheelPositions[index];
        const physicsWheelWorldQuaternion = update.wheelQuaternions[index];

        // --- 更新变换逻辑 V2: 使用矩阵分解 ---
        // 确保父级矩阵已更新
        mesh.parent.updateMatrixWorld(true);

        // a. 计算目标世界旋转 (物理旋转 * 初始修正)
        finalWheelQuaternion.copy(physicsWheelWorldQuaternion).multiply(initialCorrectionQuaternion);

        // b. 构造目标世界矩阵 (位置: 物理位置, 旋转: 最终旋转, 缩放: 1,1,1)
        targetWorldMatrix.compose(physicsWheelWorldPosition, finalWheelQuaternion, tempScale.set(1, 1, 1));

        // c. 计算父级的逆世界矩阵
        tempMatrix.copy(mesh.parent.matrixWorld).invert(); // Reusable tempMatrix holds parent inverse

        // d. 计算目标本地矩阵 (父级逆矩阵 * 目标世界矩阵)
        targetLocalMatrix.multiplyMatrices(tempMatrix, targetWorldMatrix);

        // e. 分解目标本地矩阵
        targetLocalMatrix.decompose(mesh.position, mesh.quaternion, tempScale); // Decompose into mesh's local props, ignore scale

        // f. 再次强制设置本地缩放为 1 (安全措施)
        mesh.scale.set(1, 1, 1);
        // --- 结束更新 V2 ---

      } else if (mesh && (index === undefined || index < 0 || index >= update.wheelPositions.length)) {
          // console.warn(`Garage: Invalid or out-of-bounds index (${index}) for wheel ${wheelKey} from tuningParams.wheelIndices.`);
      } else if (mesh && (!update.wheelPositions[index] || !update.wheelQuaternions[index])) {
          // console.warn(`Garage: Missing physics data for wheel ${mesh.name} or invalid index`);
      }
  }
};

const tryInitializeVehiclePhysics = () => {
  // 这个函数现在主要由 VehicleController 内部逻辑触发， Garage.vue 不再直接调用
  const controller = vehicleControllerRef.value;
  const world = physicsWorld.value;
  const vehicleData = currentVehicle.value;
  const carModel = model.value;

  if (controller && world && vehicleData && carModel && !controller.isReady) {
     console.log("Garage: Conditions met, initializing vehicle physics...");
     controller.initializePhysics();
  } else {
  }
};

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
  animation: fadeIn 0.3s, fadeOut 0.3s 2.7s forwards;
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

@keyframes fadeIn { from { opacity: 0; transform: translateY(20px) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }
@keyframes fadeOut { from { opacity: 1; transform: translateY(0) translateX(-50%); } to { opacity: 0; transform: translateY(-20px) translateX(-50%); } }

.webgl-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style> 