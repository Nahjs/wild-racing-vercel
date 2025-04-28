<template>
  <div class="race-container" ref="rendererElement">
    <VehicleRenderer
      v-if="currentVehicle"
      ref="track"
      @scene-ready="onSceneReady"
      @model-ready="onModelReady"
      @camera-ready="onCameraReady"
      :is-loading-prop="isLoading"
      :selected-vehicle="currentVehicle"
      :wheel-quaternions="wheelQuaternions"
      :wheel-positions="wheelPositions"
      :show-wheel-axes="tuningStore.tuningParams.showWheelAxes"
      :initial-correction-axis="tuningStore.tuningParams.initialCorrectionAxis"
      :initial-correction-angle="tuningParams.initialCorrectionAngle"
      :enable-lighting="true"
      :enable-environment-map="true"
      :enable-contact-shadow="true"
      :enable-big-spot-light="false"
      :wheel-indices="tuningParams.wheelIndices"
    />
    
    <VehicleController_Rapier
      @car-ready="onCarReady"
      @position-update="onPositionUpdate"
      v-if="rapierPhysics.isInitialized.value && scene && carModel"
      :ref="setCarControllerRef"
      :vehicleModel="carModel"
      :initialPosition="startPosition"
      :initialRotation="startRotation"
      :physicsParams="currentVehicle?.customSettings"
    />
    
    <RaceHUD
      v-if="showInterface"
      :speed="speed"
      :race-status="raceStatus"
      :countdown="countdown"
      :current-lap="currentLap"
      :total-laps="totalLaps"
      :current-lap-time="currentLapTime"
      :best-lap-time="bestLapTime"
      :total-time="totalRaceTime"
      :lap-times="lapTimes"
      :format-time="formatTime"
      @restart="restartRace"
      @exit="exitRace"
    />
    
    <TouchControls
      v-if="controls && isMobile.value"
      :controlState="controls"
      :currentCameraMode="cameraControls.currentCameraMode.value"
      :switchCameraMode="cameraControls.nextMode"
    />
    
    <RaceStartPrompt
      v-if="showStartPrompt && isCarControllerReady && !isLoadingTrack && rapierPhysics.isInitialized.value"
      :race-status="raceStatus"
      @race-start="onStartRaceFromPrompt"
    />
    
    <VehicleDebugUI
      v-if="debugMode"
      :debug-data="debugData"
    />
    
    <div class="debug-controls">
      <button
        @click="toggleDebugMode"
        class="debug-mode-btn">
        {{ debugMode ? '关闭' : '调试' }}
      </button>
      <button
        v-if="debugMode"
        @click="togglePhysicsDebug"
        class="debug-mode-btn">
        {{ showPhysicsDebug ? '隐藏物理' : '显示物理' }}
      </button>
      <button
        v-if="debugMode"
        @click="forceEnableTouchControls"
        class="force-touch-btn">
        强制启用移动端控制
      </button>
      <div v-if="debugMode" class="device-info">
        <p>设备类型: {{ isMobile.value ? '移动' : '桌面' }}</p>
        <ul>
          <li>加速: {{ controls.accelerate }}</li>
          <li>刹车: {{ controls.brake }}</li>
          <li>左转: {{ controls.turnLeft }}</li>
          <li>右转: {{ controls.turnRight }}</li>
          <li>手刹: {{ controls.handbrake }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, watchEffect, provide, computed, nextTick, shallowRef, reactive } from 'vue';
import { useRouter } from 'vue-router'; 
import VehicleController_Rapier from '@/game/rapier/vehicle/VehicleController_Rapier.vue';
import VehicleRenderer from '@/game/vehicle/VehicleRenderer.vue';
import VehicleDebugUI from '@/game/rapier/vehicle/VehicleDebugUI.vue';
import { vehiclesList } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';
import * as THREE from 'three'; // 导入THREE用于创建相机
import { useTuningStore } from '@/store/tuning'; 
import { useCamera } from '@/composables/game/useCamera'; // Import the composable
import { useRaceLogic } from '@/composables/game/useRaceLogic'; // 引入比赛逻辑
import trackManager from '@/game/track/TrackManager'; // Import default export
import { useInputControls } from '@/composables/useInputControls'; // 引入输入控制组合式函数
import { useRapierPhysics } from '@/composables/useRapierPhysics'; // Import Rapier physics composable

// 引入UI组件
import RaceHUD from '@/components/race/RaceHUD.vue';
import TouchControls from '@/components/TouchControls.vue'; // 引入触摸控制组件
import RaceStartPrompt from '@/components/race/RaceStartPrompt.vue'; // 引入比赛开始提示组件

// 引入 pinia storeToRefs
import { storeToRefs } from 'pinia';

export default {
  name: 'Race',
  components: {
    VehicleController_Rapier,
    VehicleRenderer,
    RaceHUD,
    TouchControls,
    RaceStartPrompt,
    VehicleDebugUI
  },
  setup() {
    const router = useRouter();
    
    // --- 确保 renderFrameId 在这里定义 ---
    let renderFrameId = null; 
    // ------------------------------------

    const logTracker = reactive({ // Use reactive for easy logging object updates
      onMountedStart: false,
      rapierInitStart: false,
      rapierInitEnd: false,
      vehicleLoadStart: false,
      vehicleLoadEnd: false,
      onMountedEnd: false,
      sceneReady: false,
      modelReady: false,
      cameraReady: false,
      trackLoadWatchTriggered: false,
      trackLoadStart: false,
      trackLoadEnd: false,
      controllerVifConditionMet: false,
      controllerRefAssigned: false,
      controllerCarReadyEvent: false,
      controllerPhysicsInstanceReceived: false,
      animationLoopStarted: false,
      firstPhysicsUpdateCalled: false,
      firstPhysicsUpdateCheckPassed: false,
    });

    console.log("[Race Init] Setup function start");
    
    // Helper function to log with timestamp
    const logInit = (step) => {
      console.log(`[Race Init - ${Date.now()}] ${step}`);
      const key = step.split(' ')[0].toLowerCase().replace(/[:.]/g, ''); // Create a simple key
      if (key in logTracker) {
        logTracker[key] = true;
      } else {
         // If you add new log steps, add corresponding keys to logTracker initial state
         console.warn(`[Race Init] Log key "${key}" not found in logTracker for step: "${step}"`);
      }
    };

    // 获取输入控制
    const { controlState: controls, isMobile} = useInputControls();
    
    // Instantiate the store
    const tuningStore = useTuningStore();
    // 使用 storeToRefs 获取响应式状态和 getter
    const { tuningParams } = storeToRefs(tuningStore);

    // 场景和物理引擎引用
    const track = ref(null);
    const carController = ref(null);
    const scene = ref(null);
    const world = ref(null);
    const carModel = shallowRef(null); // Use shallowRef for THREE model
    const rendererElement = ref(null);
    const showPhysicsDebug = ref(false); // 控制物理调试视图的 ref
    
    // 添加比赛开始提示控制
    const showStartPrompt = ref(true);
    
    // 添加相机ref给useCamera使用
    const cameraRef = shallowRef(null);
    
    // 添加视角演示状态跟踪
    const isAutoCameraRotationComplete = ref(false);
    
    // 添加标志位防止重复执行视角演示
    const isCameraDemoStarted = ref(false);
    
    // 界面控制
    const showInterface = ref(true);
    const speed = ref(0);
    
    // 赛道信息
    const trackId = ref('karting_club_lider__karting_race_track_early'); // 赛道ID，可从配置或路由参数获取
    const isLoadingTrack = ref(false);
    const startPosition = ref(new THREE.Vector3(0, 0.8, 30));
    const startRotation = ref({ x: 0, y: 0, z: 0 }); // Added for controller initial rotation
    const isTrackLoaded = ref(false); // 新增：防止重复加载的标志
    
    // 在setup函数中添加currentVehicle引用，初始化为 null
    const currentVehicle = ref(null);
    const isLoadingVehicle = ref(true); // 添加加载状态
    const isLoading = ref(true); // General loading state (can potentially use store.isLoading)
    const isInitializingPhysics = ref(false); // 防止重复调用
    
    // 新增：跟踪 VehicleController 是否准备就绪的标志
    const isCarControllerReady = ref(false); 
    
    // 车轮数据 (用于传递给 Track 更新视觉)
    const wheelQuaternions = ref([]);
    const wheelPositions = ref([]); // (可选) 如果 Track 需要位置信息
    
    // 使用比赛逻辑组合式API
    const { 
      raceStatus, countdown, currentLap, totalLaps, 
      currentLapTime, bestLapTime, totalRaceTime, 
      checkpoints, nextCheckpointIndex, lapTimes,
      setCheckpoints, startCountdown, updateRaceTime, 
      checkCheckpoint, restartRace, formatTime 
    } = useRaceLogic({
      totalLaps: 3,
      onRaceStart: () => {
        // 确保隐藏开始提示
        showStartPrompt.value = false;
        if (controls.value && typeof controls.value.reset === 'function') {
          controls.value.reset(); 
        } else {
          console.warn('[Race] 无法重置 controlState');
        }
      },
      onRaceFinish: (results) => {
        console.log("Race Finished:", results);
      }
    });
    
    // --- Use the useCamera composable ---
    // Destructure refs/functions needed in template/return, AND get the full object
    const cameraControls = useCamera(cameraRef, carModel, rendererElement, { initialMode: 0 });
    const {
      isInitialized: isCameraComposableInitialized,
      currentCameraMode: cameraModeFromComposable,
      cameraParams: cameraParamsFromComposable,
      isSaving: isSavingCamera,
      updateParameters: updateCameraParameters,
      saveSettings: saveCameraSettings,
      update: updateCamera
    } = cameraControls;
   
    // 使用 Rapier physics
    const rapierPhysics = useRapierPhysics();
    const vehiclePhysicsInstance = ref(null); // Ref for the actual VehiclePhysicsRapier instance
    const debugData = ref(null); // Reactive data for the Debug UI
    
    const debugRayHelpers = ref([]); // Store helpers
    
    const updateRayVisualization = () => {
      if (!debugMode.value || !vehiclePhysicsInstance.value) {
         // Remove existing helpers if debug mode is off or physics instance is gone
         debugRayHelpers.value.forEach(helper => scene.value?.remove(helper));
         debugRayHelpers.value = [];
         return;
      }

      const physics = vehiclePhysicsInstance.value;
      if (!physics.rigidBody || !physics.wheelsInfo) return;

      const bodyPosition = physics.rigidBody.translation();
      const bodyRotation = physics.rigidBody.rotation();
      const threeBodyQuat = new THREE.Quaternion(bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w);

      physics.wheelsInfo.forEach((wheel, index) => {
        // Recalculate start and direction (same logic as in _updateSuspension)
        const rotatedWheelPos = new THREE.Vector3().copy(wheel.position).applyQuaternion(threeBodyQuat);
        const suspensionStart = new THREE.Vector3(bodyPosition.x, bodyPosition.y, bodyPosition.z).add(rotatedWheelPos);
        const suspensionDirection = new THREE.Vector3(0, -1, 0).applyQuaternion(threeBodyQuat);
        const rayLength = 10.0; // Or the actual ray length used

        // Determine color based on hit status
        const color = wheel.isInContact ? 0x00ff00 : 0xff0000; // Green if hit, Red if not

        // Reuse or create helper
        let helper = debugRayHelpers.value[index];
        if (!helper) {
          helper = new THREE.ArrowHelper(suspensionDirection, suspensionStart, rayLength, color);
          debugRayHelpers.value[index] = helper;
          scene.value?.add(helper); // Add to the main scene
        } else {
          helper.position.copy(suspensionStart);
          helper.setDirection(suspensionDirection);
          helper.setLength(rayLength);
          helper.setColor(color);
        }
      });

      // Remove extra helpers if number of wheels changed (unlikely but good practice)
      while (debugRayHelpers.value.length > physics.wheelsInfo.length) {
         const helper = debugRayHelpers.value.pop();
         scene.value?.remove(helper);
      }
    };
    
    // 加载赛道模型
    const loadTrack = async () => {
      logInit("trackLoadStart");
      if (!scene.value || !rapierPhysics.isInitialized.value) {
        console.warn('[Race] loadTrack called, but scene or physics is not ready yet.');
        logInit("trackLoadEnd (skipped - prereqs not met)");
        return;
      }
      console.log("[Race] loadTrack execution started.");
      try {
        isAutoCameraRotationComplete.value = false;
        const trackModel = await trackManager.loadTrack(trackId.value, scene.value);
        const checkpointsData = trackManager.getCheckpoints();
        setCheckpoints(checkpointsData);
        if (trackModel) {
          let startMarker = null;
          trackModel.traverse(node => {
            if (node.name === 'object_200' || node.name.toLowerCase().includes('start')) {
              console.log(`[Race] 找到起点标记: ${node.name}`, node.position);
              startMarker = node;
            }
          });
          if (startMarker) {
            startPosition.value = startMarker.position.clone().add(new THREE.Vector3(0, 0.2, 30));
          } else {
            const trackStartPosition = trackManager.getStartPosition();
            if (trackStartPosition) {
              startPosition.value = trackStartPosition; 
            }
          }
        }
        console.log("[Race] loadTrack execution finished.");
        logInit("trackLoadEnd (success)");
      } catch (error) {
        console.error('[Race] 加载赛道失败:', error);
        logInit("trackLoadEnd (error)");
      } finally {
        isLoadingTrack.value = false; // Keep this
      }
    };

    // Physics ready (remains the same)
    const onPhysicsReady = (data) => {
      logInit("onPhysicsReady");
      world.value = data.world;
    };

    // Physics update - Call camera update here
    const onPhysicsUpdate = () => {
      if (!logTracker.firstPhysicsUpdateCalled) {
         logInit("firstPhysicsUpdateCalled");
         logTracker.firstPhysicsUpdateCalled = true; // Log only once
      }
      const deltaTime = 1 / 60;
      rapierPhysics.update(deltaTime);

      if (isCarControllerReady.value && carController.value) {
        if (!logTracker.firstPhysicsUpdateCheckPassed) {
           logInit("firstPhysicsUpdateCheckPassed");
           logTracker.firstPhysicsUpdateCheckPassed = true; // Log only once
        }
        carController.value.handlePhysicsUpdate(deltaTime);
      }

      // --- Update Debug Data ---
      if (vehiclePhysicsInstance.value) {
        const rb = vehiclePhysicsInstance.value.rigidBody;
        const pos = rb?.translation();
        const linvel = rb?.linvel();
        // Add more data points as needed by VehicleDebugUI
        debugData.value = {
          position: pos ? {x: pos.x, y: pos.y, z: pos.z} : {x:0,y:0,z:0},
          linearVelocity: linvel ? {x: linvel.x, y: linvel.y, z: linvel.z} : {x:0,y:0,z:0},
          // Example: Add suspension info if needed by debug UI
          // wheelsContact: vehiclePhysicsInstance.value.wheelsInfo?.map(w => w.isInContact) || [] 
        };
      } else {
        debugData.value = null;
      }

      // --- Update camera using the composable's update function ---
      if (isCameraComposableInitialized.value) {
        updateCamera(); // Calls internal update logic for controller/controls
      }

      if (raceStatus.value === 'racing' && !isLoadingTrack.value && isCarControllerReady.value) {
        updateRaceTime();
        
        // 检查检查点通过
        if (carController.value && carController.value.getPosition) {
          const vehiclePosition = carController.value.getPosition();
          if (vehiclePosition) {
            checkCheckpoint(vehiclePosition);
          }
        }
      }

      updateRayVisualization();
    };
    
    // 车辆控制器准备就绪 (从 VehicleController 发出的 car-ready 事件)
    const onCarReady = (physicsInstance) => {
      logInit("controllerCarReadyEvent received");
      isLoading.value = false;
      isInitializingPhysics.value = false; 
      // 设置标志位，表示 VehicleController 已准备好
      isCarControllerReady.value = true; 
      
      // Directly assign the received instance
      if (physicsInstance) {
        vehiclePhysicsInstance.value = physicsInstance;
        logInit("controllerPhysicsInstanceReceived: YES");
        console.log("[Race] Physics instance received via event:", vehiclePhysicsInstance.value);
      } else {
        logInit("controllerPhysicsInstanceReceived: NO (Missing!)");
        console.error("[Race] onCarReady event received, but physicsInstance payload was missing!");
      }
      
      // Start the animation loop only when the car controller is fully ready
      startAnimationLoop();
    };
    
    // 更新车辆位置
    const onPositionUpdate = (data) => {
      // Get speed from event data instead of accessing chassisBody
      if (data.speed !== undefined) {
        speed.value = data.speed;
      }
      // 保存车轮数据以传递给 Track
      if (data.wheelQuaternions) {
        wheelQuaternions.value = data.wheelQuaternions;
      }
      if (data.wheelPositions) { // (可选)
        wheelPositions.value = data.wheelPositions;
      }
    };
    
    // 退出比赛
    const exitRace = () => {
      router.push('/');
    };
    
    // 组件卸载
    onUnmounted(() => {
      logInit("onUnmounted");
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      
      stopAnimationLoop(); 
      if (scene.value) {
        trackManager.unloadCurrentTrack(scene.value);
      }
      rapierPhysics.dispose(); // Dispose Rapier physics
    });

    // 组件挂载
    onMounted(async () => { 
      logInit("onMountedStart");

      logInit("rapierInitStart");
      await rapierPhysics.initialize();
      logInit("rapierInitEnd");

      nextTick(() => {
      });
      
      // 添加全局键盘事件监听器，用于调试
      const globalKeyDownHandler = (e) => {
        // 不阻止事件继续传播
      };
      
      const globalKeyUpHandler = (e) => {
        // 不阻止事件继续传播
      };
      
      window.addEventListener('keydown', globalKeyDownHandler, { capture: false }); // 使用冒泡阶段
      window.addEventListener('keyup', globalKeyUpHandler, { capture: false });
      
      // 记得在卸载时清理
      cleanupFunctions.push(() => {
        window.removeEventListener('keydown', globalKeyDownHandler, { capture: false });
        window.removeEventListener('keyup', globalKeyUpHandler, { capture: false });
      });
      
      // 添加 P 键监听器切换物理调试
      const handleDebugToggleKey = (e) => {
        if (e.key === 'p' || e.key === 'P') {
          togglePhysicsDebug(); // 切换 ref 的值
          console.log("Physics debug toggled:", showPhysicsDebug.value);
        }
      };
      window.addEventListener('keydown', handleDebugToggleKey);

      cleanupFunctions.push(() => {
        window.removeEventListener('keydown', handleDebugToggleKey);
      });
      
      // 添加一个测试键盘事件监听器，验证键盘事件捕获
      const testKeyHandler = (e) => {
      };
      document.addEventListener('keydown', testKeyHandler);
      
      // 记得在卸载时清理
      cleanupFunctions.push(() => {
        document.removeEventListener('keydown', testKeyHandler);
      });
      
      logInit("vehicleLoadStart");
      isLoadingVehicle.value = true;
      isLoading.value = true; // Start general loading
      let vehicleIdToLoad = vehiclesList[0].id; // Default to first vehicle ID
      const lastVehicleId = localStorage.getItem('lastSelectedVehicleId');
      
      if (lastVehicleId) {
        if (vehiclesList.some(v => v.id === lastVehicleId)) {
          vehicleIdToLoad = lastVehicleId;
        } else {
          console.warn(`[Race] 存储的车辆ID ${lastVehicleId} 在vehiclesList中未找到，使用默认值。`);
          localStorage.removeItem('lastSelectedVehicleId'); 
        }
      }

      const baseVehicleData = vehiclesList.find(v => v.id === vehicleIdToLoad) || vehiclesList[0];
      let loadedVehicleData = null;

      try {
        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleIdToLoad);

        if (vehicleDataFromDB) {
          // 合并来自数据库的车辆数据和基础数据
          loadedVehicleData = {
            ...baseVehicleData, 
            ...vehicleDataFromDB, 
            customSettings: {
              ...(baseVehicleData.customSettings || {}), 
              ...(vehicleDataFromDB.customSettings || {}),
            }
          };
        } else {
          console.warn(`[Race] 在数据库中未找到ID为 ${vehicleIdToLoad} 的车辆数据，使用列表数据。`);
          loadedVehicleData = {
            ...baseVehicleData,
            customSettings: baseVehicleData.customSettings || {}
          };
        }
      } catch (error) {
        console.error("[Race] 从数据库加载车辆数据时出错:", error);
        loadedVehicleData = {
          ...baseVehicleData,
          customSettings: baseVehicleData.customSettings || {}
        };
      }
      
      // 设置当前车辆
      currentVehicle.value = loadedVehicleData;

      // 使用 tuningStore 的 setInitialParams 来设置初始调校数据
      if (loadedVehicleData) {
        tuningStore.setInitialParams(loadedVehicleData.customSettings || {}, loadedVehicleData.id);
      }

      isLoadingVehicle.value = false; 

      // 更新触控点数
      const updateTouchPoints = () => {
        touchPoints.value = navigator.maxTouchPoints || 0;
      };
      
      // 更新屏幕方向
      const updateOrientation = () => {
        isLandscape.value = window.innerWidth > window.innerHeight;
      };
      
      updateTouchPoints();
      updateOrientation();
      
      window.addEventListener('resize', updateOrientation);
      
      // 在组件卸载时清理
      onUnmounted(() => {
        window.removeEventListener('resize', updateOrientation);
      });
      
      // 添加焦点和全屏事件监听
      const handleFocus = () => {
      };
      
      const handleBlur = () => {
      };
      
      const handleFullscreenChange = () => {
        const isDocFullscreen = document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement;
        
        // 全屏状态变化后重置键盘状态
        setTimeout(() => {
          // useInputControls 中的 focus 监听器会处理状态重置
        }, 100);
      };
      
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('visibilitychange', handleBlur);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      
      // 记得在卸载时清理
      cleanupFunctions.push(() => {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('visibilitychange', handleBlur);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      });

      // Find the canvas element within the renderer container
      // Use nextTick to ensure the DOM is updated after VehicleRenderer mounts
      await nextTick(); 
      const canvasElement = rendererElement.value?.querySelector('canvas.track-canvas'); // Adjust selector if needed

      if (canvasElement) {

        const stopCanvasTouchPropagation = (event) => {
          // Check if the event target is one of our control buttons
          // If it is, DO NOT stop propagation, let the button handle it.
          if (event.target && event.target.closest('.control-btn')) {
             return; 
          }

          event.stopPropagation();
        };

        // Add touch event listeners to the canvas
        canvasElement.addEventListener('touchstart', stopCanvasTouchPropagation, { capture: true }); // Use capture phase
        canvasElement.addEventListener('touchmove', stopCanvasTouchPropagation, { capture: true }); // Use capture phase
        canvasElement.addEventListener('touchend', stopCanvasTouchPropagation, { capture: true }); // Use capture phase
        canvasElement.addEventListener('touchcancel', stopCanvasTouchPropagation, { capture: true }); // Use capture phase

        // Add to cleanup functions
        cleanupFunctions.push(() => {
          if (canvasElement) {
            canvasElement.removeEventListener('touchstart', stopCanvasTouchPropagation, { capture: true });
            canvasElement.removeEventListener('touchmove', stopCanvasTouchPropagation, { capture: true });
            canvasElement.removeEventListener('touchend', stopCanvasTouchPropagation, { capture: true });
            canvasElement.removeEventListener('touchcancel', stopCanvasTouchPropagation, { capture: true });
          }
        });
      } else {
        console.warn("[Race.vue] Could not find canvas element within rendererElement.");
      }

      logInit("vehicleLoadEnd");
    });
    
    // 监听 isCarControllerReady 变化
    watch(isCarControllerReady, (newValue) => {
      if (newValue === true) {
        // 尝试再次检查 nextTick
        nextTick(() => {
        });
      }
    });
    
    // 自动切换相机视角
    const startAutoCameraRotation = () => {
      // 确保每次调用时重置状态
      isAutoCameraRotationComplete.value = false;
      
      // 存储定时器ID和watcher清理函数
      let currentTimer = null;
      let initWatcherStop = null;
      let statusWatcherStop = null;
      
      // 视角切换次数和目标次数
      let switchCount = 0;
      const targetSwitchCount = 5; // 总共切换5次视角
      
      // 各模式展示时间（毫秒）
      const modeDurations = {
        0: 1000, // FREE_LOOK
        1: 1000, // FOLLOW
        3: 1000, // CHASE
        4: 1000, // TOP_DOWN
        5: 2500  // CINEMATIC (延长时间)
      };
      
      // 清理函数
      const cleanup = () => {
        if (currentTimer) {
          clearTimeout(currentTimer);
          currentTimer = null;
        }
        
        if (initWatcherStop) {
          initWatcherStop();
          initWatcherStop = null;
        }
        
        if (statusWatcherStop) {
          statusWatcherStop();
          statusWatcherStop = null;
        }
        
        // 标记视角演示已完成
        isAutoCameraRotationComplete.value = true;
      };
      
      // 递归函数，定期切换视角
      const scheduleSwitching = () => {
        // 如果已经切换完所有视角或比赛不再处于等待状态，则停止
        if (switchCount >= targetSwitchCount || raceStatus.value !== 'waiting') {
          cleanup();
          return;
        }
        
        // 强制禁用控制器，确保视角切换不受干扰
        forceDisableRendererControls();
        
        // 使用nextMode切换到下一个视角
        cameraControls.nextMode();
        
        // 获取当前模式
        const currentMode = cameraModeFromComposable.value;
        
        // 获取当前模式的展示时间
        const duration = modeDurations[currentMode] || 1000;
        
        // 延迟后切换到下一个视角
        currentTimer = setTimeout(() => {
          // 切换前再次检查比赛状态
          if (raceStatus.value !== 'waiting') {
            cleanup();
            return;
          }
          
          // 增加计数并安排下一次切换
          switchCount++;
          scheduleSwitching();
        }, duration);
      };
      
      // 监听比赛状态变化
      statusWatcherStop = watch(raceStatus, (newStatus) => {
        if (newStatus !== 'waiting') {
          cleanup();
        }
      });
      
      // 如果相机已初始化，立即开始切换
      if (isCameraComposableInitialized.value) {
        scheduleSwitching();
      } else {
        // 否则等待相机初始化
        initWatcherStop = watch(isCameraComposableInitialized, (isInit) => {
          if (isInit) {
            // 开始视角切换计划
            scheduleSwitching();
            
            // 停止监听初始化状态
            if (initWatcherStop) {
              initWatcherStop();
              initWatcherStop = null;
            }
          }
        });
        
        // 设置超时，如果10秒后相机仍未初始化，则放弃
        currentTimer = setTimeout(() => {
          if (!isCameraComposableInitialized.value) {
            cleanup();
            
            // 即使超时也标记为已完成，允许游戏继续
            isAutoCameraRotationComplete.value = true;
          }
        }, 10000);
      }
      
      // 返回清理函数供外部使用
      return cleanup;
    };
    
    // 存储需要在组件卸载时清理的函数
    const cleanupFunctions = [];
    
    // 组件卸载
    const startAnimationLoop = () => { 
      if (renderFrameId) return; // Avoid starting multiple loops
      console.log("[Race] Starting animation loop...");

      const animate = () => {
        onPhysicsUpdate(); // Call the physics update function
        renderFrameId = requestAnimationFrame(animate);
      };
      animate(); // Start the loop
    }; 
    
    const stopAnimationLoop = () => {
      if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }
      
      // Start the animation loop only when the car controller is fully ready
      startAnimationLoop();
    };

    // 当 Track 组件的场景准备好时调用
    const onSceneReady = (emittedScene) => {
      console.log("[Race] onSceneReady called.");
      scene.value = emittedScene;

      // 保留备用相机逻辑 (如果需要)
      if (!cameraRef.value && scene.value) {
        const backupCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        backupCamera.position.set(0, 5, 10);
        backupCamera.lookAt(0, 0, 0);
        
        const handleResize = () => {
          if (backupCamera) {
            backupCamera.aspect = window.innerWidth / window.innerHeight;
            backupCamera.updateProjectionMatrix();
          }
        };
        window.addEventListener('resize', handleResize);
        
        // 添加到清理函数列表
        cleanupFunctions.push(() => {
          window.removeEventListener('resize', handleResize);
        });
        
        // 只有在还没有通过camera-ready事件设置相机时才使用备用相机
        if (!cameraRef.value) {
          cameraRef.value = backupCamera;
        }
      }
    };
    
    // 当车辆模型准备好时调用
    const onModelReady = (model) => {
      carModel.value = model;
    };
    
    // 强制禁用VehicleRenderer中的控制器
    const forceDisableRendererControls = () => {
      if (!track.value) return false;
      
      // 尝试1: 检查直接导出的controls
      if (track.value.controls && track.value.controls.enabled !== undefined) {
        track.value.controls.enabled = false;
        return true;
      }
      
      // 尝试2: 检查常见的私有属性命名
      const rendererInstance = track.value;
      const controlsKeys = ['_controls', '__controls', '$controls', 'sceneControls'];
      
      for (const key of controlsKeys) {
        if (rendererInstance[key] && rendererInstance[key].enabled !== undefined) {
          rendererInstance[key].enabled = false;
          return true;
        }
      }
      
      // 尝试3: 检查$refs中的controls
      if (track.value.$refs && track.value.$refs.controls) {
        track.value.$refs.controls.enabled = false;
        return true;
      }
      
      return false;
    };

    
    watchEffect(() => {
      if (carController.value && world.value && scene.value && carModel.value && !isInitializingPhysics.value && !tuningStore.isLoading) { 
        isInitializingPhysics.value = true; 
        try {
          carController.value.initializePhysics(); 
        } catch(error) {
          console.error("[Race.vue] Error calling initializePhysics on CarController:", error);
          isInitializingPhysics.value = false; 
        }
      }
    });
    
    const handleCameraLookAtOffsetUpdate = (payload) => {
      const currentParams = cameraParamsFromComposable.value; 
      const currentOffset = currentParams.lookAtOffset || [0, 0, 0];
      const newOffset = [...currentOffset];
      newOffset[payload.index] = payload.value;
      updateCameraParameters({ ...currentParams, lookAtOffset: newOffset });
    };
    
    // 监听比赛状态变化，在比赛开始时切换到追逐视角
    watch(raceStatus, (newStatus, oldStatus) => {
      // 确保是从非 racing 状态变为 racing 状态
      if (newStatus === 'racing' && oldStatus !== 'racing') {
        if (isCameraComposableInitialized.value) {
          // 使用 nextTick 延迟切换，确保车辆状态更新
          nextTick(() => {
            // 设置追逐视角 (模式 3 - CHASE)
            cameraControls.setMode(3);
          });
        }
      }
    });
    
    // 处理相机准备好事件
    const onCameraReady = (camera) => {
      if (camera) {
        cameraRef.value = camera;
      } else {
      }
    };
    
    // --- 新增 watchEffect 处理视角演示启动 --- 
    watchEffect(() => {
     if (
        isCameraComposableInitialized.value && // 确保 useCamera 初始化完成
        carModel.value &&                  // 确保车辆模型加载完成
        scene.value &&                     // 确保场景准备就绪
        !isLoadingTrack.value &&           // 确保赛道加载完成
        raceStatus.value === 'waiting' &&  // 确保比赛处于等待状态
        !isCameraDemoStarted.value         // 确保演示尚未开始
      ) {
        // 直接调用 startAutoCameraRotation，并设置标志位
        isCameraDemoStarted.value = true; 
        const cleanup = startAutoCameraRotation();
        if (cleanup) {
          cleanupFunctions.push(cleanup);
        }
      }
    });

    // --- Function Ref for VehicleController ---
    const setCarControllerRef = (el) => {
      // Check if el is the expected component instance (usually has a $ property in Vue 3)
      if (el && el.$) {
        carController.value = el;
      } else if (el === null) {
        carController.value = null;
      } else {
        console.warn("[Race] setCarControllerRef received unexpected value:", el);
        // Optionally clear ref if unexpected value received
        // carController.value = null; 
      }
    }
    // -----------------------------------------

    // 处理从比赛开始提示组件接收到的开始事件
    const onStartRaceFromPrompt = () => {
      if (raceStatus.value === 'waiting') {
        console.log('[Race] 用户点击开始比赛，开始倒计时');
        startCountdown();
      }
    };

    // 添加临时调试模式按钮
    const debugMode = ref(false);
    const toggleDebugMode = () => {
      debugMode.value = !debugMode.value;
    };

    // --- Function to toggle physics debug view ---
    const togglePhysicsDebug = () => {
      showPhysicsDebug.value = !showPhysicsDebug.value;
    };

    const forceEnableTouchControls = () => {
      
      // 1. 强制设置为移动设备模式
      if (isMobile && typeof isMobile === 'object' && 'value' in isMobile) {
        isMobile.value = true;
      }
      
      // 2. 尝试直接启用TouchControls组件的调试模式
      const touchControlsComponent = document.querySelector('.touch-controls');
      if (touchControlsComponent && touchControlsComponent.__vue__) {
        try {
          // 访问组件实例并设置debugMode
          touchControlsComponent.__vue__.debugMode = true;
        } catch (e) {
          console.error("无法直接修改TouchControls组件状态:", e);
        }
      } else {
        console.log("未找到TouchControls组件实例");
      }
      
      // 3. 刷新页面并添加debug参数
      const url = new URL(window.location.href);
      url.searchParams.set('debug', 'true');
      
      setTimeout(() => {
        window.location.href = url.toString();
      }, 3000);
    };

    // 添加设备信息相关变量
    const touchPoints = ref(0);
    const isLandscape = ref(false);
    const controlDebugInfo = computed(() => {
      // 返回一个普通对象，避免循环引用
      return {
        accelerate: controls.accelerate,
        brake: controls.brake,
        turnLeft: controls.turnLeft,
        turnRight: controls.turnRight,
        handbrake: controls.handbrake
      };
    });

    // 监听 showPhysicsDebug 的变化来切换碰撞体可视化
    watch(showPhysicsDebug, (newValue) => {
      // trackManager.toggleCollisionVisualizers(newValue); // TEMP: Disable custom visualizer for now
    });

    // 新增 watch: 监听比赛状态变化
    watch(raceStatus, (newStatus, oldStatus) => {
      if (newStatus === 'racing' && oldStatus !== 'racing') {
        if (isCameraComposableInitialized.value) {
          nextTick(() => { cameraControls.setMode(3); }); // Switch to CHASE mode
        }
      }
    });

    // 新增 watch: 监听 conditions to start camera demo
    watchEffect(() => {
      if (
        isCameraComposableInitialized.value &&
        carModel.value &&
        scene.value &&
        !isLoadingTrack.value &&
        isTrackLoaded.value && // Ensure track is fully loaded
        raceStatus.value === 'waiting' &&
        !isCameraDemoStarted.value
      ) {
        isCameraDemoStarted.value = true;
        console.log("[Race] Starting camera demo...");
        const cleanup = startAutoCameraRotation();
        if (cleanup) cleanupFunctions.push(cleanup);
      }
    });

    // 新增 watch: 监听 showPhysicsDebug 变化来切换 Rapier debug lines
    watch(showPhysicsDebug, (newValue) => {
      if (rapierPhysics.isInitialized.value) {
        console.log(`[Race] Toggling Rapier debug draw: ${newValue}. Scene valid: ${!!scene.value}`); // Log scene validity
        rapierPhysics.adapter.toggleDebugDraw(newValue, scene.value);
      }
      // trackManager.toggleCollisionVisualizers(newValue); // TEMP: Disable custom visualizer for now
    });

    // --- Use watchEffect to trigger track loading when conditions are met --- 
    watchEffect(async () => {
      // Check if physics is initialized AND scene is ready AND track is not already loaded/loading
      if (rapierPhysics.isInitialized.value && scene.value && !isTrackLoaded.value && !isLoadingTrack.value) {
        console.log("[Race] watchEffect: Conditions met to load track.");
        isLoadingTrack.value = true; // Set loading flag
        isTrackLoaded.value = true;  // Prevent re-triggering immediately
        try {
          await loadTrack();
        } catch (error) {
          console.error("[Race] Error during track loading triggered by watchEffect:", error);
          // Reset flags if loading fails to allow retry?
          // isTrackLoaded.value = false; 
        } finally {
          // isLoadingTrack is managed inside loadTrack's finally block
          // isLoadingTrack.value = false; 
        }
      }
    });

    // Add logTracker to the return object for potential debugging in template/dev tools
    provide('logTracker', logTracker); // Optional: provide for deeper components

    return {
      rendererElement,
      world,
      scene,
      carModel,
      speed,
      showInterface,
      raceStatus,
      countdown,
      bestLapTime,
      totalRaceTime,
      currentLap,
      totalLaps,
      currentLapTime,
      currentVehicle, 
      isLoadingVehicle, 
      isLoading, 
      startRotation,
      lapTimes,
      tuningStore,
      startPosition,
      wheelQuaternions,
      wheelPositions,
      onPhysicsReady,
      onPhysicsUpdate,
      onSceneReady,
      onCarReady,
      onPositionUpdate,
      onCameraReady,
      restartRace,
      exitRace,
      formatTime,
      onModelReady,
      isCarControllerReady, 
      isCameraInitialized: isCameraComposableInitialized,
      currentCameraMode: cameraModeFromComposable,
      cameraParams: cameraParamsFromComposable,
      isSavingCamera,
      updateCameraParameters,
      saveCameraSettings,
      handleCameraLookAtOffsetUpdate,
      tuningParams,
      startAutoCameraRotation,
      forceDisableRendererControls,
      controls,
      isMobile,
      cameraControls,
      setCarControllerRef,
      showStartPrompt,
      onStartRaceFromPrompt,
      isLoadingTrack,
      vehiclePhysicsInstance,
      debugMode,
      toggleDebugMode,
      forceEnableTouchControls,
      touchPoints,
      isLandscape,
      controlDebugInfo,
      showPhysicsDebug,
      rapierPhysics,
      debugData,
      togglePhysicsDebug,
      logTracker
    };
  }
};
</script>

<style scoped>
.race-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  /* Ensure the container itself doesn't block events meant for its children */
  /* pointer-events: none; NO - this would block everything */
}

.debug-controls {
  position: absolute;
  top: 60px;
  left: 10px;
  z-index: 100;
}

.debug-mode-btn,
.force-touch-btn,
.reinit-input-btn {
  padding: 5px 10px;
  margin-bottom: 5px;
  cursor: pointer;
  user-select: none; /* Prevent text selection */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

.device-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 5px;
}
</style> 