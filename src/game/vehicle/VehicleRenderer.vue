<template>
  <div class="track-view">
    <!-- Canvas is now managed by the composable, but we might need the ref here -->
    <canvas ref="canvas" class="track-canvas"></canvas>
    
    <div class="loading-overlay" v-if="isLoadingProp"> <!-- Renamed prop to avoid clash -->
      <div class="loader"></div>
      <div class="loading-text">加载中...</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import * as THREE from 'three';
import { markRaw } from 'vue';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { useSceneSetup } from '@/composables/garage/useSceneSetup'; // Import the scene setup composable
import { useEnvironmentSetup } from '@/composables/garage/useEnvironmentSetup'; // 引入环境设置组合式函数
import { useDeviceDetection } from '@/composables/useDeviceDetection'; // 修正导入路径

export default {
  name: 'VehicleRenderer', // Renamed component
  emits: [
    'scene-ready',
    'model-ready',
    'camera-ready'
  ],
  props: {
    selectedVehicle: { 
      type: Object, 
      required: true 
    },
    isLoadingProp: { // Renamed prop to avoid clash with internal loading state
      type: Boolean, 
      default: false 
    },
    wheelQuaternions: { 
      type: Array,
      default: () => []
    },
    wheelPositions: {
      type: Array,
      default: () => []
    },
    // 添加车轮索引映射 prop
    wheelIndices: {
      type: Object,
      required: true
    },
    // 添加车轮修正属性
    initialCorrectionAxis: {
      type: String,
      default: 'x',
      validator: (value) => ['x', 'y', 'z'].includes(value)
    },
    initialCorrectionAngle: {
      type: Number,
      default: 90
    },
    showWheelAxes: {
      type: Boolean,
      default: false
    },
    // 添加环境配置属性
    enableLighting: {
      type: Boolean,
      default: true
    },
    enableEnvironmentMap: {
      type: Boolean,
      default: true
    },
    enableContactShadow: {
      type: Boolean,
      default: true
    },
    enableBigSpotLight: {
      type: Boolean,
      default: true
    }
  },
  setup(props, { emit }) {
    const canvas = ref(null);
    const isLoading = ref(false); // Internal loading state for the model
    
    // 引入设备检测
    const { isMobile } = useDeviceDetection();

    // Use the scene setup composable
    // Pass the canvas ref to the composable
    const { scene, camera, renderer, controls, startAnimationLoop, stopAnimationLoop } = useSceneSetup(canvas);
    
    // 如果是移动设备，设置较低的渲染质量
    onMounted(() => {
      nextTick(() => {
        if (isMobile.value && renderer.value) {
          console.log("移动设备检测到，降低渲染质量以提高性能");
          renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 1));
          
          // 根据设备性能降低阴影质量
          if (renderer.value.shadowMap) {
            renderer.value.shadowMap.autoUpdate = false;
            renderer.value.shadowMap.needsUpdate = true;
          }
        }
      });
    });
    
    // 使用环境设置组合式函数
    const { 
      initializeEnvironment, 
      cleanupEnvironment 
    } = useEnvironmentSetup({
      enableContactShadow: props.enableContactShadow && !isMobile.value, // 移动设备禁用接触阴影
      enableEnvironmentMap: props.enableEnvironmentMap,
      enableBigSpotLight: props.enableBigSpotLight && !isMobile.value, // 移动设备禁用大型聚光灯
      isMobile
    });
    
    // 添加标志位防止 camera-ready 重复触发
    const cameraReadyEmitted = ref(false);
    
    // Local refs for this component's specific objects
    const carModel = ref(null);
    const wheelMeshRefs = ref({ fl: null, fr: null, rl: null, rr: null });

    // Remove initScene, handleResize, animate - Handled by useSceneSetup
    // const initScene = () => { ... };
    // const handleResize = () => { ... };
    // const animate = () => { ... };

    // --- Model Loading Logic (Remains mostly the same) ---
    const loadSelectedCarModel = async () => {
      isLoading.value = true; 
      try {
        if (carModel.value && scene.value) { 
            scene.value.remove(carModel.value); // 移除旧模型 (现在 carModel.value 应该是 THREE.Group)
        }
        // 旧的 carModel.value 置空，等待加载新模型
        carModel.value = null; 
        
        if (!scene.value) {
            console.error("VehicleRenderer: Scene is not initialized. Cannot load model.");
            isLoading.value = false;
            return;
        }
        
        console.log(`VehicleRenderer: Loading model ${props.selectedVehicle.model}`);
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        // 确保你的 Draco decoder 路径正确
        dracoLoader.setDecoderPath('public/libs/draco'); // 或者你存放 decoder 的实际路径
        loader.setDRACOLoader(dracoLoader);
        
        // loadedGltf 包含 { scene, scenes, animations, ... }
        const loadedGltf = await loader.loadAsync(props.selectedVehicle.model);
        
        // 检查加载结果是否有效，并且包含 scene 属性
        if (loadedGltf && loadedGltf.scene) {
            // 将加载到的模型场景 (THREE.Group) 赋值给 carModel ref
            const loadedModel = markRaw(loadedGltf.scene);
            
            // 递归处理模型中的所有对象，确保它们都被 markRaw 处理
            function processModelObjects(object) {
              markRaw(object);
              
              if (object.children && object.children.length > 0) {
                object.children.forEach(child => {
                  processModelObjects(child);
                });
              }
              
              // 处理材质
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach(mat => markRaw(mat));
                } else {
                  markRaw(object.material);
                }
              }
              
              // 处理关键属性
              if (object.geometry) markRaw(object.geometry);
              if (object.matrixWorld) markRaw(object.matrixWorld);
              if (object.modelViewMatrix) markRaw(object.modelViewMatrix);
              if (object.normalMatrix) markRaw(object.normalMatrix);
            }
            
            // 处理整个模型
            processModelObjects(loadedModel);
            
            // === 车轮识别逻辑 ===
            // 配置的车轮父节点名称 (从selectedVehicle中获取，如果有的话)
            const wheelParentNames = props.selectedVehicle.wheelNames || {};
            const foundWheels = { fl: false, fr: false, rl: false, rr: false };
            const nodeNames = [];
            const potentialWheelNodes = [];
            
            // 遍历模型的所有子节点，查找车轮
            loadedModel.traverse((child) => {
                nodeNames.push(child.name);
                let assigned = false;
                // 1. 优先使用配置中的名称 (精确匹配)
                if (wheelParentNames.fl && child.name === wheelParentNames.fl) { 
                  wheelMeshRefs.value.fl = markRaw(child); 
                  foundWheels.fl = true; 
                  assigned = true; 
                }
                else if (wheelParentNames.fr && child.name === wheelParentNames.fr) { 
                  wheelMeshRefs.value.fr = markRaw(child); 
                  foundWheels.fr = true; 
                  assigned = true; 
                }
                else if (wheelParentNames.rl && child.name === wheelParentNames.rl) { 
                  wheelMeshRefs.value.rl = markRaw(child); 
                  foundWheels.rl = true; 
                  assigned = true; 
                }
                else if (wheelParentNames.rr && child.name === wheelParentNames.rr) { 
                  wheelMeshRefs.value.rr = markRaw(child); 
                  foundWheels.rr = true; 
                  assigned = true; 
                }
                
                // 记录潜在节点 (用于日志和未来的改进)
                if (!assigned) {
                    const nameLower = child.name.toLowerCase();
                    const keywords = ['wheel', '轮', 'tire', 'tyre'];
                    const patterns = [/wheel.?fl/, /wheel.?fr/, /wheel.?rl/, /wheel.?rr/, /wheel.?bl/, /wheel.?br/, /front.?l/, /front.?r/, /back.?l/, /back.?r/, /rear.?l/, /rear.?r/]; 
                    
                    if (keywords.some(kw => nameLower.includes(kw)) || patterns.some(p => nameLower.match(p))) {
                        potentialWheelNodes.push(child.name); 
                    }
                }
            });

            // 2. 如果配置不完整，尝试基于常见模式自动识别
            if (!foundWheels.fl || !foundWheels.fr || !foundWheels.rl || !foundWheels.rr) {
                console.warn("VehicleRenderer: Configuration incomplete/missing. Attempting automatic wheel detection...");
                const autoDetectedWheels = { fl: null, fr: null, rl: null, rr: null };
                const flPatterns = [/wheel.?fl/i, /front.?l/i];
                const frPatterns = [/wheel.?fr/i, /front.?r/i];
                const rlPatterns = [/wheel.?[br]l/i, /back.?l/i, /rear.?l/i]; // Include BL and RL
                const rrPatterns = [/wheel.?[br]r/i, /back.?r/i, /rear.?r/i]; // Include BR and RR

                loadedModel.traverse((child) => {
                    const nameLower = child.name.toLowerCase();
                    if (!autoDetectedWheels.fl && flPatterns.some(p => nameLower.match(p))) autoDetectedWheels.fl = child;
                    if (!autoDetectedWheels.fr && frPatterns.some(p => nameLower.match(p))) autoDetectedWheels.fr = child;
                    if (!autoDetectedWheels.rl && rlPatterns.some(p => nameLower.match(p))) autoDetectedWheels.rl = child;
                    if (!autoDetectedWheels.rr && rrPatterns.some(p => nameLower.match(p))) autoDetectedWheels.rr = child;
                });

                // 合并自动检测结果到 wheelMeshRefs (仅当配置中未找到时)
                if (!foundWheels.fl && autoDetectedWheels.fl) { 
                  wheelMeshRefs.value.fl = markRaw(autoDetectedWheels.fl); 
                  foundWheels.fl = true; 
                  console.log(`VehicleRenderer: Auto-detected FL wheel: ${autoDetectedWheels.fl.name}`); 
                }
                if (!foundWheels.fr && autoDetectedWheels.fr) { 
                  wheelMeshRefs.value.fr = markRaw(autoDetectedWheels.fr); 
                  foundWheels.fr = true; 
                  console.log(`VehicleRenderer: Auto-detected FR wheel: ${autoDetectedWheels.fr.name}`); 
                }
                if (!foundWheels.rl && autoDetectedWheels.rl) { 
                  wheelMeshRefs.value.rl = markRaw(autoDetectedWheels.rl); 
                  foundWheels.rl = true; 
                  console.log(`VehicleRenderer: Auto-detected RL/BL wheel: ${autoDetectedWheels.rl.name}`); 
                }
                if (!foundWheels.rr && autoDetectedWheels.rr) { 
                  wheelMeshRefs.value.rr = markRaw(autoDetectedWheels.rr); 
                  foundWheels.rr = true; 
                  console.log(`VehicleRenderer: Auto-detected RR/BR wheel: ${autoDetectedWheels.rr.name}`); 
                }
            }

            // 最终检查和日志记录
            const allWheelsFound = Object.values(foundWheels).every(found => found);
            if (allWheelsFound) {
                 console.log("VehicleRenderer: Successfully found/assigned all wheel nodes:", wheelMeshRefs.value);
            } else {
                console.error("VehicleRenderer: Failed to find all required wheel nodes after config and auto-detection.", foundWheels);
                // 记录所有节点名称以供调试
                console.warn("VehicleRenderer: All node names in the model:", nodeNames);
                // 如果有潜在节点但未被自动识别，则记录下来
                if (potentialWheelNodes.length > 0) {
                    console.warn("VehicleRenderer: Potential wheel nodes found by keyword/pattern (not automatically assigned):", [...new Set(potentialWheelNodes)]);
                }
                 // 即使不完整，也记录下已找到的部分
                 console.log("VehicleRenderer: Partially found wheel nodes:", wheelMeshRefs.value);
            }
            
            // 更新车轮坐标轴可见性
            updateWheelAxesVisibility();
            
            carModel.value = markRaw(loadedModel);
            scene.value.add(carModel.value);
            console.log("VehicleRenderer: Model loaded and added to scene.");

            // 发送 model-ready 事件，传递正确的模型对象 (THREE.Group)
            emit('model-ready', carModel.value); 
            
            // 模型加载完成后，尝试更新相机位置并发送相机就绪事件
            nextTick(() => {
              updateCameraPosition();
              // 检查标志位，防止重复触发
              if (camera.value && !cameraReadyEmitted.value) {
                cameraReadyEmitted.value = true;
                emit('camera-ready', camera.value);
              }
            });
        } else {
            console.error('VehicleRenderer: Loaded GLTF is invalid or does not contain a scene.');
            // 这里可以添加加载失败的 fallback 逻辑
            // Fallback 逻辑... (如果需要)
        }

      } catch (error) {
        console.error('VehicleRenderer: Failed to load selected model:', error);
        // Fallback 逻辑 (保持不变)
        if (scene.value) { 
            const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
            const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
            const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
            carModel.value = markRaw(fallbackMesh); // Fallback 模型
            scene.value.add(carModel.value);
            emit('model-ready', carModel.value); // 发送 fallback 模型
        } else {
             console.error("VehicleRenderer: Scene not available for fallback model.");
        }
      } finally {
          isLoading.value = false; 
      }
    };

    // --- Wheel Axes Logic (Remains the same) ---
    const updateWheelAxesVisibility = () => {
      if (!carModel.value) return;
      
      Object.values(wheelMeshRefs.value).forEach(wheelRef => {
        if (wheelRef) {
          // 移除旧的帮助器 (如果存在)
          const existingHelper = wheelRef.getObjectByName('axesHelper');
          if (existingHelper) {
            wheelRef.remove(existingHelper);
          }
          
          // 如果需要显示坐标轴，添加新的帮助器
          if (props.showWheelAxes) {
            const axesHelper = new THREE.AxesHelper(0.5); // 调整大小
            axesHelper.name = 'axesHelper'; // 命名以便查找
            wheelRef.add(axesHelper);
          }
        }
      });
    };

    watch(() => props.showWheelAxes, (newValue) => {
      updateWheelAxesVisibility();
    });

    // --- Camera Update Logic (Needs adjustment) ---
    // We need to decide how camera control is handled.
    // Opt 1: Let this component control the camera (like before)
    // Opt 2: Let the parent component (e.g., Race.vue) control the camera via the composable's camera ref.
    // Let's assume Opt 1 for now, modifying the camera provided by the composable.
    const cameraMode = ref('thirdPersonFollow'); // Default camera mode?
    const cameraDistance = ref(8);
    const cameraHeight = ref(4);

    const updateCameraPosition = () => {
      // 调整检查，确保 carModel 及其关键属性存在
      if (!carModel.value || !carModel.value.position || !carModel.value.quaternion || !camera.value || !controls.value) {
          // console.warn("updateCameraPosition skipped: carModel or camera not ready."); // 可选的调试日志
          return; 
      }
      
      const carPosition = carModel.value.position;
      const carQuaternion = carModel.value.quaternion;
      
      if (cameraMode.value === 'thirdPersonFollow') {
        const cameraOffset = new THREE.Vector3(0, cameraHeight.value, -cameraDistance.value);
        // 确保 applyQuaternion 不会修改原始 offset
        const worldOffset = cameraOffset.clone().applyQuaternion(carQuaternion); 
        const cameraTargetPosition = new THREE.Vector3().copy(carPosition).add(worldOffset);
        // 使用lerp平滑移动，避免突变
        camera.value.position.lerp(cameraTargetPosition, 0.1); 
        const lookAtTarget = carPosition.clone().add(new THREE.Vector3(0, 0.5, 0));
        camera.value.lookAt(lookAtTarget);
        // 同步 OrbitControls 的目标点
        controls.value.target.lerp(carPosition, 0.1); 
      } else if (cameraMode.value === 'firstPerson') {
        const firstPersonOffset = new THREE.Vector3(0, 0.8, 0.3); 
        const worldPosition = carModel.value.localToWorld(firstPersonOffset.clone());
        camera.value.position.copy(worldPosition);
        const lookDirectionOffset = new THREE.Vector3(0, 0.7, 5);
        const lookAtWorld = carModel.value.localToWorld(lookDirectionOffset.clone());
        camera.value.lookAt(lookAtWorld);
        controls.value.target.copy(carPosition); 
      } else if (cameraMode.value === 'freeOrbit') {
        controls.value.target.lerp(carPosition, 0.1); 
      }
    };

    // --- Wheel Rotation Logic (Remains mostly the same) ---
    const updateWheelRotations = () => {
      if (!carModel.value || !props.wheelQuaternions || props.wheelQuaternions.length < 4) return;

      const chassisQuaternion = carModel.value.quaternion;
      const invChassisQuaternion = chassisQuaternion.clone().invert();
      const localWheelQuaternion = new THREE.Quaternion();
      const finalWheelQuaternion = new THREE.Quaternion(); // 用于存储最终组合旋转

      // --- 根据调试控件动态生成初始修正四元数 ---
      let axis;
      switch (props.initialCorrectionAxis) {
          case 'y': axis = new THREE.Vector3(0, 1, 0); break;
          case 'z': axis = new THREE.Vector3(0, 0, 1); break;
          default:  axis = new THREE.Vector3(1, 0, 0); // 默认为 X 轴
      }
      const angleRad = THREE.MathUtils.degToRad(props.initialCorrectionAngle);
      const initialCorrectionQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
      // --------------------------------------------

      try {
          // --- 使用传入的 wheelIndices prop 进行映射 ---
          // 创建一个反向查找映射：物理索引 -> 渲染器车轮键名 (fl, fr, rl, rr)
          const physicsIndexToMeshKey = {};
          for (const key in props.wheelIndices) {
              // 注意转换: wheelIndices prop 的键是 'FL', 'FR', 'BL', 'BR'
              // 而 wheelMeshRefs 的键是 'fl', 'fr', 'rl', 'rr'
              const meshKey = key.toLowerCase().replace('b', 'r'); // 将 BL/BR 转换为 rl/rr
              physicsIndexToMeshKey[props.wheelIndices[key]] = meshKey;
          }
          // -------------------------------------------------

          for (let i = 0; i < props.wheelQuaternions.length; i++) {
              // --- 根据物理索引 i 查找对应的渲染器车轮键名 ---
              const meshKey = physicsIndexToMeshKey[i];
              if (!meshKey) {
                  console.warn(`VehicleRenderer: No mesh key found for physics index ${i} in wheelIndices.`);
                  continue;
              }
              // --- 获取对应的车轮引用 ---
              const wheelRef = wheelMeshRefs.value[meshKey];
              // --------------------------

              const physicsQuaternion = props.wheelQuaternions[i];

              if (wheelRef && physicsQuaternion instanceof THREE.Quaternion) {
                  // 1. 计算局部物理旋转
                  localWheelQuaternion.copy(invChassisQuaternion).multiply(physicsQuaternion);
                  
                  // 2. 组合旋转: final = localPhysics * initialCorrection
                  finalWheelQuaternion.copy(initialCorrectionQuaternion).multiply(localWheelQuaternion);
                  
                  // 应用最终计算出的旋转到车轮模型
                  wheelRef.quaternion.copy(finalWheelQuaternion);
              } else if (physicsQuaternion && !(physicsQuaternion instanceof THREE.Quaternion)) {
                  console.warn(`VehicleRenderer: wheelQuaternions[${i}] is not a THREE.Quaternion instance.`);
              }
          }
      } catch (error) {
          console.error("VehicleRenderer: Error applying wheel quaternion:", error);
          console.log("wheelQuaternions:", props.wheelQuaternions);
      }
    };

    // --- 自定义模型材质 (从Garage.vue移植) ---
    const customizeModelMaterials = () => {
      if (!carModel.value) return;
      
      // 提取模型的材质
      const materials = {};
      carModel.value.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat, index) => {
              materials[`${child.name}_${index}`] = mat;
            });
          } else {
            materials[child.name] = child.material;
          }
        }
      });
      
      // 应用车库中的材质定制逻辑
      Object.entries(materials).forEach(([name, material]) => {
        const lowerName = name.toLowerCase();
        
        // 根据材质名称应用不同的属性
        if (lowerName.includes('rubber') || lowerName.includes('tire')) {
          // 轮胎材质
          material.color.set("#222");
          material.roughness = 0.6;
          material.roughnessMap = null;
          if (material.normalScale) material.normalScale.set(4, 4);
        }
        else if (lowerName.includes('window') || lowerName.includes('glass')) {
          // 玻璃材质
          material.color.set("black");
          material.roughness = 0;
          material.clearcoat = 0.1;
        }
        else if (lowerName.includes('body') || lowerName.includes('paint') || lowerName.includes('coat')) {
          // 车身材质
          if (props.selectedVehicle.colors?.body) {
            material.color.set(props.selectedVehicle.colors.body);
          } else {
            material.color.set("#2f426f"); // 默认车身颜色
          }
          material.envMapIntensity = 4;
        }
        else if ((lowerName.includes('wheel') || lowerName.includes('rim')) && 
                !lowerName.includes('tire') && !lowerName.includes('rubber')) {
          // 轮毂材质
          if (props.selectedVehicle.colors?.wheel) {
            material.color.set(props.selectedVehicle.colors.wheel);
          } else {
            material.color.set("#1a1a1a"); // 默认轮毂颜色
          }
          material.roughness = 0.1;
          material.metalness = 0.9;
          material.envMapIntensity = 3;
        }
        else {
          // 其他材质
          material.roughness = 0.5;
          material.metalness = 0.8;
          material.envMapIntensity = 2;
        }
        
        material.needsUpdate = true;
      });
    };

    // 监听相机引用变化
    watch(() => camera.value, (newCamera) => {
      // 检查标志位，防止重复触发
      if (newCamera && !cameraReadyEmitted.value) {
        cameraReadyEmitted.value = true;
        emit('camera-ready', newCamera);
      }
    });

    // --- Lifecycle Hooks --- 
    onMounted(() => {
      // Scene init is handled by the composable automatically on mount.
      // We need to wait for the composable to potentially finish its async setup
      // and for the canvas to be ready.
      nextTick(async () => { 
          console.log("VehicleRenderer: onMounted nextTick - Start");
          
          // 确保先等待渲染器和场景初始化
          let retries = 0;
          const maxRetries = 10;
          while ((!scene.value || !renderer.value) && retries < maxRetries) {
            console.log(`VehicleRenderer: 等待场景和渲染器初始化，尝试 ${retries + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (scene.value && renderer.value) { // Check if scene and renderer from composable are ready
              // 禁用useSceneSetup中的controls，让useCamera完全接管相机控制
              if (controls.value) {
                controls.value.enabled = false;
                console.log("VehicleRenderer: Disabled controls from useSceneSetup to let useCamera take over.");
              }

              // 在相机准备好时发送事件
              if (camera.value) {
                console.log("VehicleRenderer: 相机已初始化，发送camera-ready事件");
                emit('camera-ready', camera.value);
              } else {
                console.warn("VehicleRenderer: 相机尚未初始化，将在创建后发送事件");
                // 创建一个监听器检查camera.value变化
                const unwatch = watch(() => camera.value, (newCamera) => {
                  // 检查标志位，防止重复触发
                  if (newCamera && !cameraReadyEmitted.value) {
                    cameraReadyEmitted.value = true;
                    console.log("VehicleRenderer: 相机已初始化(通过监听)，发送camera-ready事件");
                    emit('camera-ready', newCamera);
                    unwatch(); // 移除监听器
                  }
                }, { immediate: true });
              }

              // 初始化环境(如果启用)
              if (props.enableLighting) {
                // 调用 initializeEnvironment 并传入 scene 和 renderer
                initializeEnvironment(scene.value, renderer.value, 0); 
              }
              
              emit('scene-ready', scene.value); // Emit scene from composable
              console.log("VehicleRenderer: Scene is ready from composable. Loading model...");
              await loadSelectedCarModel(); // Load the model into the scene
              
              // 自定义模型材质
              if (carModel.value) {
                customizeModelMaterials();
              }
              
              console.log("VehicleRenderer: Model loading initiated. Starting animation loop...");
              // Start the animation loop provided by the composable, passing our updates
              startAnimationLoop(() => {
                  // 确保controls始终保持禁用状态
                  if (controls.value && controls.value.enabled) {
                    controls.value.enabled = false;
                  }
                  updateCameraPosition();
                  updateWheelRotations();
              }); 
          } else {
              console.error("VehicleRenderer: Scene or renderer not initialized by useSceneSetup on mount.");
          }
          console.log("VehicleRenderer: onMounted nextTick - End");
      });
    });

    // onUnmounted is handled by the composable for scene cleanup.
    // We might need specific cleanup here if we add objects directly.
    onUnmounted(() => {
        // 清理环境资源
        cleanupEnvironment();
        
        // 停止动画循环
        stopAnimationLoop();
        console.log("VehicleRenderer: Unmounted.");
        // Additional cleanup specific to VehicleRenderer if needed
    });

    // Watch for vehicle changes to reload the model
    watch(() => props.selectedVehicle?.id, async (newId, oldId) => {
        if (newId !== oldId && scene.value) { // Check if scene exists
             console.log(`VehicleRenderer: Vehicle changed to ${newId}. Reloading model.`);
             await loadSelectedCarModel();
             
             // 自定义模型材质
             if (carModel.value) {
               customizeModelMaterials();
             }
        }
    }, { immediate: false }); // Don't run immediately on mount

    // 监听车身颜色和轮毂颜色变化
    watch(() => props.selectedVehicle?.colors?.body, (newColor) => {
      if (carModel.value && newColor) {
        carModel.value.traverse((child) => {
          if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => {
              const name = child.name.toLowerCase();
              if (name.includes('body') || name.includes('paint') || name.includes('coat')) {
                material.color.set(newColor);
                material.needsUpdate = true;
              }
            });
          }
        });
      }
    });
    
    watch(() => props.selectedVehicle?.colors?.wheel, (newColor) => {
      if (carModel.value && newColor) {
        carModel.value.traverse((child) => {
          if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => {
              const name = child.name.toLowerCase();
              if ((name.includes('wheel') || name.includes('rim')) && 
                  !name.includes('tire') && !name.includes('rubber')) {
                material.color.set(newColor);
                material.needsUpdate = true;
              }
            });
          }
        });
      }
    });

    return {
      canvas, // Still need the ref for the composable
      // Scene, camera, renderer, controls are now accessed via the composable's return
      // scene, 
      // camera,
      carModel, // Still expose the loaded car model
      isLoading, // Expose internal loading state
      // Expose methods if needed by parent, e.g., for changing camera mode
      cameraMode, 
      updateWheelAxesVisibility,
      wheelMeshRefs, // 暴露车轮引用，便于调试
      // 修复getCamera方法，确保它能够正确返回相机引用
      getCamera() {
        try {
          // camera是setup中定义的响应式引用，应该始终存在
          // 检查camera.value是否存在
          if (camera && camera.value) {
            return camera.value;
          } else {
            console.warn('VehicleRenderer: Camera引用不可用，创建备用相机');
            return this.createFallbackCamera();
          }
        } catch (error) {
          console.error('VehicleRenderer: 获取相机时发生错误', error);
          return this.createFallbackCamera();
        }
      },
      
      // 创建备用相机
      createFallbackCamera() {
        console.log('VehicleRenderer: 创建备用相机');
        try {
          // 创建一个基本的透视相机作为备用
          const fallbackCamera = markRaw(new THREE.PerspectiveCamera(
            75, // 视场角度
            window.innerWidth / window.innerHeight, // 宽高比
            0.1, // 近截面
            1000 // 远截面
          ));
          
          // 设置相机位置
          fallbackCamera.position.set(0, 5, -10);
          fallbackCamera.lookAt(0, 0, 0);
          
          // 确保相机MatrixWorld已更新
          fallbackCamera.updateMatrixWorld(true);
          
          // 如果场景存在，将相机添加到场景中
          if (scene && scene.value) {
            scene.value.add(fallbackCamera);
            console.log('VehicleRenderer: 备用相机已添加到场景');
          }
          
          return fallbackCamera;
        } catch (error) {
          console.error('VehicleRenderer: 创建备用相机时出错', error);
          // 创建最基本的相机作为最终备用
          const basicCamera = markRaw(new THREE.PerspectiveCamera());
          basicCamera.position.z = 5;
          return basicCamera;
        }
      },
      
      // 暴露自定义模型材质方法
      customizeModelMaterials
    };
  }
};
</script>

<style scoped>
.track-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.track-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loader {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-text {
  color: white;
  font-size: 1.2rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 