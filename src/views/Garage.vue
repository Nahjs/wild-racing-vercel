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
import { useSceneSetup } from '@/composables/garage/useSceneSetup';
import { useEnvironmentSetup } from '@/composables/garage/useEnvironmentSetup';
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
const sceneGridSize = ref(1000);
const sceneGridDivisions = ref(1000);
const sceneShowAxes = ref(false);
const sceneAxesSize = ref(10);
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
         enablePan: false,
         minDistance: 2,
         maxDistance: 100,
         minPolarAngle: Math.PI / 4,
         maxPolarAngle: Math.PI * 0.9,
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
    }
    model.value = null;
    wheelMeshRefs.value = { FL: null, FR: null, RL: null, RR: null };
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
    if (!model.value) return;
    if (show) {
        addWheelAxes();
    } else {
        removeWheelAxes();
    }
});

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
                              wheelMeshRefs.value.FL = markRaw(child);
                             foundWheels.fl = true;
                             assignedNodes.add(child);
                         } else if (wheelNodeNames.fr && childNameTrimmed === wheelNodeNames.fr) {
                              wheelMeshRefs.value.FR = markRaw(child);
                             foundWheels.fr = true;
                             assignedNodes.add(child);
                         } else if (wheelNodeNames.rl && childNameTrimmed === wheelNodeNames.rl) { // 配置使用 rl
                              wheelMeshRefs.value.BL = markRaw(child); // 存入 BL
                             foundWheels.bl = true; // 标记 bl
                             assignedNodes.add(child);
                         } else if (wheelNodeNames.rr && childNameTrimmed === wheelNodeNames.rr) { // 配置使用 rr
                              wheelMeshRefs.value.BR = markRaw(child); // 存入 BR
                             foundWheels.br = true; // 标记 br
                             assignedNodes.add(child);
                         }
                     }
                 }
             });

             // --- Fallback Logic: Auto-detect missing wheels --- 
             if (!foundWheels.fl || !foundWheels.fr || !foundWheels.bl || !foundWheels.br) {
                 console.warn("Garage: Some wheels not found via config (or config missing/empty), attempting auto-detection...");

                 const wheelPatterns = {
                     FL: /wheel.*fl|fl.*wheel|tyre.*fl|fl.*tyre|tire.*fl|fl.*tire/i,
                     FR: /wheel.*fr|fr.*wheel|tyre.*fr|fr.*tyre|tire.*fr|fr.*tire/i,
                     BL: /wheel.*bl|bl.*wheel|tyre.*bl|bl.*tyre|tire.*bl|bl.*tire|wheel.*rl|rl.*wheel|tyre.*rl|rl.*tyre|tire.*rl|rl.*tire/i, // Includes RL
                     BR: /wheel.*br|br.*wheel|tyre.*br|br.*tyre|tire.*br|br.*tire|wheel.*rr|rr.*wheel|tyre.*rr|rr.*tyre|tire.*rr|rr.*tire/i  // Includes RR
                 };

                 loadedModelGroup.traverse((child) => {
                     if (child instanceof THREE.Object3D && !assignedNodes.has(child)) {
                         const childNameLower = child.name.toLowerCase();
                         
                         // Iterate through patterns only for wheels that are still missing
                         for (const wheelKey of ['FL', 'FR', 'BL', 'BR']) {
                             if (!wheelMeshRefs.value[wheelKey] && wheelPatterns[wheelKey].test(childNameLower)) {
                                 wheelMeshRefs.value[wheelKey] = markRaw(child);
                                 foundWheels[wheelKey.toLowerCase()] = true; // Mark as found (using bl/br keys)
                                 assignedNodes.add(child);
                                 console.warn(`Garage: Fallback - Detected ${wheelKey} wheel: ${child.name}`);
                                 break; // Move to the next child once a match is found for this child
                             }
                         }
                     }
                 });
             }
             // --- End Fallback Logic ---

             // Final Check and Logging
             const allWheelsAssigned = wheelMeshRefs.value.FL && wheelMeshRefs.value.FR && wheelMeshRefs.value.BL && wheelMeshRefs.value.BR;

             if (allWheelsAssigned) {
                  console.log("Garage: Successfully found/assigned all wheel nodes:", wheelMeshRefs.value);
             } else {
                 console.error("Garage: Failed to find all required wheel nodes after config and fallback detection.");
                 console.log("   Found Wheels Mapping:", { 
                     FL: wheelMeshRefs.value.FL?.name ?? 'Not Found',
                     FR: wheelMeshRefs.value.FR?.name ?? 'Not Found',
                     BL: wheelMeshRefs.value.BL?.name ?? 'Not Found',
                     BR: wheelMeshRefs.value.BR?.name ?? 'Not Found'
                 });
                 console.warn("Garage: All node names in the model:", nodeNames);
                 console.warn("Garage: All node names and types in the model:", Object.fromEntries(allNodesMap));
             }

           
             if (tuningParams.value.showWheelAxes) {
                addWheelAxes();
             }

             rawScene.add(model.value);

             await nextTick();
             customModel();

             const rawControls = toRaw(controls.value);
             if (rawControls && model.value) {
                 const box = new THREE.Box3().setFromObject(model.value);
                 const center = box.getCenter(new THREE.Vector3());
                 rawControls.target.copy(center);
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
  
    model.value.traverse((child) => {
        if (child instanceof THREE.Object3D) {
            const isWheel = Object.values(wheelMeshRefs.value).some(ref => ref === child);

            if (isWheel) {
                if (child.isMesh && child.material) {
                    applyMaterialLogic(child, true);
                }
                child.traverse((wheelPart) => {
                    if (wheelPart.isMesh && wheelPart.material) {
                         applyMaterialLogic(wheelPart, true);
                    }
                 });
            } else if (child.isMesh && child.material) {
                applyMaterialLogic(child, false);
            }
        }
    });
};

const applyMaterialLogic = (mesh, isWheel) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nodeNameLower = mesh.name.toLowerCase();

    materials.forEach(material => {
        // Initial check if material exists at all
        if (!material) return; 

        let needsUpdate = false;
        const originalMaterial = material; 
        let currentMaterial = material; 
        const materialNameLower = material.name ? material.name.toLowerCase() : '';

        // --- Material logic checks ---
        // 1. Body/Paint Logic
        if (!isWheel && (nodeNameLower.includes('body') || nodeNameLower.includes('paint') || nodeNameLower.includes('coat') || materialNameLower.includes('body') || materialNameLower.includes('paint') || materialNameLower.includes('coat'))) {
            // Ensure currentMaterial is valid before accessing properties
            if (currentMaterial && typeof currentMaterial === 'object') {
                if (currentMaterial.color) currentMaterial.color.set(carCoatColor.value);
                currentMaterial.roughness = 0.2;
                currentMaterial.metalness = 0.3;
                if ('clearcoat' in currentMaterial) currentMaterial.clearcoat = 0.5;
                if ('clearcoatRoughness' in currentMaterial) currentMaterial.clearcoatRoughness = 0.1;
                currentMaterial.envMapIntensity = 4;
                needsUpdate = true;
            }
        }
        // 2. Wheel/Rim Logic 
        else if (isWheel || (nodeNameLower.includes('wheel') || nodeNameLower.includes('rim') || materialNameLower.includes('wheel') || materialNameLower.includes('rim'))) {
             if (currentMaterial && typeof currentMaterial === 'object') {
                if (currentMaterial.color) currentMaterial.color.set(wheelColor.value);
                 currentMaterial.roughness = 0.1;
                 currentMaterial.metalness = 0.9;
                 currentMaterial.envMapIntensity = 3;
                 needsUpdate = true;
             }
        }
        // 3. Tire/Rubber Logic
        else if (nodeNameLower.includes('rubber') || nodeNameLower.includes('tire') || materialNameLower.includes('rubber') || materialNameLower.includes('tire')) {
             if (currentMaterial && typeof currentMaterial === 'object') {
                if (currentMaterial.color) currentMaterial.color.set("#222");
                 currentMaterial.roughness = 0.6;
                 currentMaterial.metalness = 0.1;
                 if (currentMaterial.normalScale) currentMaterial.normalScale.set(4, 4);
                 needsUpdate = true;
             }
        }
        // 4. Window/Glass Logic
        else if (nodeNameLower.includes('window') || nodeNameLower.includes('glass') || materialNameLower.includes('window') || materialNameLower.includes('glass')) {
             // Check originalMaterial before potentially replacing it
             if (originalMaterial && typeof originalMaterial === 'object') {
                 if (!(originalMaterial instanceof THREE.MeshPhysicalMaterial)) {
                    // Create new material (already an object)
                    currentMaterial = new THREE.MeshPhysicalMaterial({
                        color: originalMaterial.color ? originalMaterial.color.clone() : new THREE.Color("black"),
                        map: originalMaterial.map || null,
                        roughness: 0,
                        metalness: 0,
                        transmission: 0.9,
                        ior: 1.5,
                        thickness: 0.1,
                        transparent: true,
                        opacity: 0.3,
                        envMapIntensity: 2,
                    });
                    // Replace material on mesh
                    if (Array.isArray(mesh.material)) {
                        const index = mesh.material.indexOf(originalMaterial);
                        if (index !== -1) mesh.material[index] = currentMaterial;
                    } else {
                        mesh.material = currentMaterial;
                    }
                 }
                 // Now apply properties to currentMaterial (which is guaranteed to be an object)
                 if (currentMaterial.color) currentMaterial.color.set("black");
                 currentMaterial.roughness = 0;
                 currentMaterial.metalness = 0;
                 currentMaterial.transmission = 0.9;
                 currentMaterial.ior = 1.5;
                 currentMaterial.thickness = 0.1;
                 currentMaterial.opacity = 0.3;
                 currentMaterial.transparent = true;
                 currentMaterial.envMapIntensity = 2;
                 needsUpdate = true; 
             }
        }
        // --- End Material logic checks ---

        // Final check before setting needsUpdate
        if (needsUpdate && currentMaterial && typeof currentMaterial === 'object') {
            currentMaterial.needsUpdate = true;
        }
    });
};

const loadVehicleConfig = async (vehicleId) => {
    try {
        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleId);
        const baseVehicleData = vehicles.value.find(v => v.id === vehicleId);

        if (!baseVehicleData) {
            console.error(`Base data for vehicle ID ${vehicleId} not found!`);
            showNotification('找不到车辆基础数据', 'error');
            return null;
        }

        let finalConfig = { ...baseVehicleData };
        let settingsSource = 'JSON';

        if (vehicleDataFromDB?.customSettings) {
             finalConfig.customSettings = {
                 ...(baseVehicleData.customSettings ?? {}),
                 ...(vehicleDataFromDB.customSettings ?? {})
             };
             settingsSource = 'DB';
        } else {
             finalConfig.customSettings = { ...(baseVehicleData.customSettings ?? {}) };
        }
         console.log(`Using settings for ${vehicleId} from: ${settingsSource}`);

        // Now, initialize the tuning store with the determined settings
        // Pass both the settings object and the vehicleId
        tuningStore.setInitialParams(finalConfig.customSettings, vehicleId);

        const settings = finalConfig.customSettings ?? {};
        const basePos = Array.isArray(baseVehicleData.position) ? baseVehicleData.position : [0, -1.0, 0];
        const baseColors = baseVehicleData.colors ?? {};
        const savedPos = settings.position;
        const savedColors = settings.colors ?? {};

        debugScale.value = settings.scale ?? baseVehicleData.scale ?? 1.0;
        debugPosition.value = Array.isArray(savedPos) ? savedPos : basePos;
        if (debugPosition.value.length < 3) debugPosition.value = basePos;
        if (debugPosition.value[1] === undefined || debugPosition.value[1] === null) debugPosition.value[1] = -1.0;

        debugRotationY.value = settings.rotation ?? baseVehicleData.rotation ?? 0;
        carCoatColor.value = savedColors.body ?? baseColors.body ?? "#2f426f";
        wheelColor.value = savedColors.wheel ?? baseColors.wheel ?? "#1a1a1a";

        return finalConfig;

    } catch (error) {
        console.error(`Error loading config for ${vehicleId}:`, error);
        showNotification('加载车辆配置失败', 'error');
        const fallbackVehicleData = vehicles.value.find(v => v.id === vehicleId) || vehicles.value[0];
        if (fallbackVehicleData) {
             tuningStore.resetToDefaults(); 
             debugScale.value = fallbackVehicleData.scale || 1.0;
             const basePos = Array.isArray(fallbackVehicleData.position) ? [...fallbackVehicleData.position] : [0, -1.0, 0];
             debugPosition.value = basePos;
             debugRotationY.value = fallbackVehicleData.rotation || 0;
             carCoatColor.value = fallbackVehicleData.colors?.body || "#2f426f";
             wheelColor.value = fallbackVehicleData.colors?.wheel || "#1a1a1a";
             return { ...fallbackVehicleData, customSettings: {} };
        }
        return null;
    }
};

const handleVehicleUpdate = (newVehicleId) => {
    const currentLoadedId = currentVehicle.value?.id;
    if (currentLoadedId !== newVehicleId) {
        localStorage.setItem('forceLoadVehicleId', newVehicleId);
        window.location.reload();
    } else {
    }
};

const changeVehicle = (direction) => {
    if (!vehicles.value || vehicles.value.length === 0 || !currentVehicle.value) return;

    const currentIndex = vehicles.value.findIndex(v => v.id === currentVehicle.value.id);
    if (currentIndex === -1) {
        console.error("Garage: Current vehicle not found in list for switching.");
        return;
    }

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = vehicles.value.length - 1;
    else if (nextIndex >= vehicles.value.length) nextIndex = 0;

    const nextVehicleId = vehicles.value[nextIndex].id;

    if (currentVehicle.value.id !== nextVehicleId) {
        localStorage.setItem('forceLoadVehicleId', nextVehicleId);
        window.location.reload();
    }
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
        rawControls.target.copy(model.value.position);
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
    if (paramName === 'connectionPoints') {
        tuningStore.updateParam(paramName, value);
    } else {
        tuningStore.updateParam(paramName, value);
    }
    if (paramName === 'visualOffsetY' && model.value && physicsWorld.value) {
        const physicsPosition = vehicleControllerRef.value?.vehicle?.chassisBody?.position;
        if(physicsPosition) {
            model.value.position.copy(physicsPosition).add(new THREE.Vector3(0, value, 0));
        }
    }
};

const handleSaveTuning = async () => {
    if (!currentVehicle.value?.id) {
        showNotification('未选择车辆，无法保存调优数据。', 'error');
        return;
    }

    const customSettingsToSave = {
        scale: debugScale.value,
        position: debugPosition.value,
        rotation: debugRotationY.value,
        colors: {
            body: carCoatColor.value,
            wheel: wheelColor.value,
        },
        visualOffsetY: tuningParams.value.visualOffsetY,
        wheelIndices: tuningParams.value.wheelIndices,
        connectionPoints: tuningParams.value.connectionPoints,
    };

    showNotification('正在保存调优数据...', 'info');
    try {
        await tuningStore.saveTuning();
        await vehicleService.batchUpdateVehicle(currentVehicle.value.id, { customSettings: customSettingsToSave });

        showNotification('调优数据和设置已成功保存!', 'success');
    } catch (error) {
        console.error("Garage: Failed to save tuning/settings:", error);
        showNotification('保存调优数据或设置失败。', 'error');
    }
};

const handleConfigsImported = async () => {
    showNotification('重新加载车辆配置...', 'info');
    try {
        if (currentVehicle.value?.id) {
            localStorage.setItem('lastSelectedVehicleId', currentVehicle.value.id);
            localStorage.setItem('forceLoadVehicleId', currentVehicle.value.id);
        }
        window.location.reload();
    } catch (error) {
        console.error('Error triggering configuration reload:', error);
        showNotification('重新加载配置失败', 'error');
    }
};

const initializeApp = async () => {
    let initSuccess = false;
    try {
        vehicles.value = await getVehicles();
        if (!vehicles.value || vehicles.value.length === 0) {
            console.error("Garage: No vehicles available to load.");
            showNotification('没有可用的车辆', 'error');
            return;
        }

        let vehicleIdToLoad = null;
        let isForceLoad = false;
        const forceLoadId = localStorage.getItem('forceLoadVehicleId');

        if (forceLoadId && vehicles.value.some(v => v.id === forceLoadId)) {
            vehicleIdToLoad = forceLoadId;
            localStorage.removeItem('forceLoadVehicleId');
            isForceLoad = true;
        } else {
            const lastVehicleId = localStorage.getItem('lastSelectedVehicleId');
            if (lastVehicleId && vehicles.value.some(v => v.id === lastVehicleId)) {
                vehicleIdToLoad = lastVehicleId;
            } else {
                if (lastVehicleId) localStorage.removeItem('lastSelectedVehicleId');
                vehicleIdToLoad = vehicles.value[0].id;
            }
        }

        if (!vehicleIdToLoad) {
            console.error("Garage: Could not determine a valid vehicle ID to load.");
            showNotification('无法确定要加载的车辆ID', 'error');
            return;
        }

        const initialConfig = await loadVehicleConfig(vehicleIdToLoad);
        if (!initialConfig) {
             console.error("Garage: Failed to load initial vehicle configuration for ID:", vehicleIdToLoad);
             showNotification('加载初始车辆配置失败', 'error');
             if (vehicleIdToLoad !== vehicles.value[0].id) {
                 const fallbackConfig = await loadVehicleConfig(vehicles.value[0].id);
                 if (fallbackConfig) {
                     currentVehicle.value = fallbackConfig;
                     localStorage.setItem('lastSelectedVehicleId', vehicles.value[0].id);
                 } else {
                     return;
                 }
             } else {
                 return;
             }
        } else {
             currentVehicle.value = initialConfig;
             localStorage.setItem('lastSelectedVehicleId', vehicleIdToLoad);
        }

        const stopWatchScene = watch([scene, renderer], async ([sceneVal, rendererVal]) => {
            if (sceneVal && rendererVal && !initSuccess) {
                initializeEnvironment(sceneVal, rendererVal, debugPosition.value[2] || 0);

                await load3DModel();

                startAnimationLoop(() => {
                    // Ensure physics updates happen in the animation loop
                    // Check if the ref is populated AND the function exists before calling
                    if (physicsEngineRef.value && typeof physicsEngineRef.value.stepPhysics === 'function') {
                        physicsEngineRef.value.stepPhysics(); 
                    }
                    // Similarly, check for vehicle controller readiness if needed
                    if (vehicleControllerRef.value && typeof vehicleControllerRef.value.handlePhysicsUpdate === 'function') {
                       vehicleControllerRef.value.handlePhysicsUpdate(); 
                    }
                });

                setupKeyListener();
                initSuccess = true;
                stopWatchScene();
            }
        }, { immediate: true });


    } catch (error) {
        console.error('Garage: Initialization failed:', error);
        showNotification(`初始化失败: ${error.message || error}`, 'error');
    }
};

onMounted(() => {
    initializeApp();
});

onUnmounted(() => {
    stopAnimationLoop();
    if (vehicleControllerRef.value && typeof vehicleControllerRef.value.cleanupPhysics === 'function') {
      
        vehicleControllerRef.value.cleanupPhysics();
    }
    vehicleControllerRef.value = null;
    if (physicsEngineRef.value && typeof physicsEngineRef.value.cleanupPhysics === 'function') {
        physicsEngineRef.value.cleanupPhysics();
    }
    physicsEngineRef.value = null;
    physicsWorld.value = null;
    cleanupEnvironment();
    cleanupModelRefs();
    cleanupScene();
    removeKeyListener();
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

watch(() => tuningParams.value.visualOffsetY, (value) => {
    if (model.value && physicsWorld.value) {
        const physicsPosition = vehicleControllerRef.value?.vehicle?.chassisBody?.position;
        if(physicsPosition) {
            model.value.position.copy(physicsPosition).add(new THREE.Vector3(0, value, 0));
        }
    }
}, { immediate: false });

watch(carCoatColor, () => { if (model.value) customModel(); });
watch(wheelColor, () => { if (model.value) customModel(); });

const physicsEngineRef = ref(null);
const vehicleControllerRef = ref(null);
const physicsWorld = shallowRef(null);

const { controlState } = useInputControls();

const handlePhysicsReady = (payload) => {
  physicsWorld.value = markRaw(payload.world);
};

const finalWheelQuaternion = new THREE.Quaternion();
const initialCorrectionQuaternion = new THREE.Quaternion();
const targetWorldMatrix = new THREE.Matrix4();
const targetLocalMatrix = new THREE.Matrix4();
const tempMatrix = new THREE.Matrix4();
const tempScale = new THREE.Vector3();

const handleVehiclePositionUpdate = (update) => {
  if (!model.value || !update.position || !update.quaternion || !update.wheelPositions || !update.wheelQuaternions) {
      return;
  }

  // 1. Update Chassis Model Position & Rotation (Applying Visual Offset)
  model.value.position.copy(update.position).add(new THREE.Vector3(0, tuningParams.value.visualOffsetY, 0));
  model.value.quaternion.copy(update.quaternion);

  // 2. Update OrbitControls Target to follow the visual model position - 确保每次更新时都更新相机跟踪点
  const rawControls = toRaw(controls.value);
  if (rawControls && model.value) {
      rawControls.target.copy(model.value.position);
  }

  // Ensure the chassis model's world matrix is updated *before* calculating wheel positions
  model.value.updateMatrixWorld(true);

  // 3. Prepare Initial Wheel Rotation Correction
  const axisMap = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  const correctionAxis = axisMap[tuningParams.value.initialCorrectionAxis] || axisMap.x;
  const angleRad = THREE.MathUtils.degToRad(tuningParams.value.initialCorrectionAngle);
  initialCorrectionQuaternion.setFromAxisAngle(correctionAxis, angleRad);

  // 4. Update Wheel Mesh Transforms
  const wheelIndices = tuningParams.value.wheelIndices;
  const wheelMeshes = wheelMeshRefs.value;

  for (const wheelKey in wheelMeshes) {
      const mesh = wheelMeshes[wheelKey];
      const physicsIndex = wheelIndices[wheelKey];

      if (mesh && physicsIndex !== undefined && physicsIndex >= 0 && physicsIndex < update.wheelPositions.length &&
          update.wheelPositions[physicsIndex] && update.wheelQuaternions[physicsIndex]) {

          const physicsWheelWorldPosition = update.wheelPositions[physicsIndex];
          const physicsWheelWorldQuaternion = update.wheelQuaternions[physicsIndex];

          if (mesh.parent) {
               mesh.parent.updateMatrixWorld(true);
          } else {
               console.warn(`Garage: Wheel mesh ${mesh.name} has no parent!`);
               continue;
          }

          finalWheelQuaternion.copy(physicsWheelWorldQuaternion).multiply(initialCorrectionQuaternion);
          targetWorldMatrix.compose(physicsWheelWorldPosition, finalWheelQuaternion, tempScale.set(1, 1, 1));
          tempMatrix.copy(mesh.parent.matrixWorld).invert();
          targetLocalMatrix.multiplyMatrices(tempMatrix, targetWorldMatrix);
          targetLocalMatrix.decompose(mesh.position, mesh.quaternion, tempScale);
          mesh.scale.set(1, 1, 1);
      }
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