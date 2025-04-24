<template>
  <div class="race-container" ref="rendererElement">
    <PhysicsEngine
      v-if="scene"
      ref="physicsEngine"
      :scene="scene"
      :debug="true"
      @physics-ready="onPhysicsReady"
      @physics-update="onPhysicsUpdate"
    />
    
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
    
    <VehicleController
      v-if="world && scene"
      :ref="setCarControllerRef"
      :world="world"
      :scene="scene"
      :carModel="carModel"
      :initialPosition="startPosition"
      :selectedVehicle="currentVehicle"
      :controlState="controls"
      @car-ready="onCarReady"
      @position-update="onPositionUpdate"
    />
    
    <!-- 使用RaceHUD组件 -->
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
    
    <!-- 移动触摸控制 - 直接在Race.vue中添加 -->
    <TouchControls 
      v-if="controls" 
      :controlState="controls" 
      :currentCameraMode="currentCameraMode"
      :switchCameraMode="cameraControls.nextMode"
    />
    
    <!-- 添加比赛开始提示组件 -->
    <RaceStartPrompt
      v-if="showStartPrompt && isCarControllerReady && !isLoadingTrack"
      :race-status="raceStatus"
      @race-start="onStartRaceFromPrompt"
    />
    
    <!-- 添加临时调试模式按钮 -->
    <div class="debug-controls">
      <button 
        @click="toggleDebugMode" 
        class="debug-mode-btn">
        {{ debugMode ? '关闭调试模式' : '开启调试模式' }}
      </button>
      
      <button 
        v-if="debugMode"
        @click="forceEnableTouchControls" 
        class="force-touch-btn">
        强制启用触摸控制
      </button>
      
      <button 
        v-if="debugMode"
        @click="reinitializeInputControls" 
        class="reinit-input-btn">
        重新初始化控制
      </button>
      
      <!-- 设备信息显示区域 -->
      <div v-if="debugMode" class="device-info">
        <p>设备类型: {{ isMobile.value ? '移动' : '桌面' }}</p>
        <p>屏幕方向: {{ isLandscape ? '横屏' : '竖屏' }}</p>
        <p>触控点数: {{ touchPoints }}</p>
        <p>控制状态:</p>
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
import { ref, onMounted, onUnmounted, watch, watchEffect, provide, computed, nextTick, shallowRef } from 'vue';
import { useRouter } from 'vue-router'; 
import PhysicsEngine from '@/core/physics/PhysicsEngine.vue';
import VehicleController from '@/game/vehicle/VehicleController.vue';
import VehicleRenderer from '@/game/vehicle/VehicleRenderer.vue';
import { vehiclesList } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';
import * as THREE from 'three'; // 导入THREE用于创建相机
import { useTuningStore } from '@/store/tuning'; 
import { useCamera } from '@/composables/game/useCamera'; // Import the composable
import { useRaceLogic } from '@/composables/game/useRaceLogic'; // 引入比赛逻辑
import { trackManager } from '@/game/track/TrackManager'; // 引入赛道管理器
import { useInputControls } from '@/composables/useInputControls'; // 引入输入控制组合式函数

// 引入UI组件
import RaceHUD from '@/components/race/RaceHUD.vue';
import TouchControls from '@/components/TouchControls.vue'; // 引入触摸控制组件
import RaceStartPrompt from '@/components/race/RaceStartPrompt.vue'; // 引入比赛开始提示组件

// 引入 pinia storeToRefs
import { storeToRefs } from 'pinia';

export default {
  name: 'Race',
  components: {
    PhysicsEngine,
    VehicleController,
    VehicleRenderer,
    RaceHUD,
    TouchControls,
    RaceStartPrompt
  },
  setup() {
    const router = useRouter();
    
    // 储存动画帧ID
    let renderFrameId = null;
    
    // 获取输入控制
    const { controlState: controls, isMobile, reinitializeInputControls } = useInputControls();
    
    // Instantiate the store
    const tuningStore = useTuningStore();
    // 使用 storeToRefs 获取响应式状态和 getter
    const { tuningParams } = storeToRefs(tuningStore);

    // 场景和物理引擎引用
    const physicsEngine = ref(null);
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
    const isLoadingTrack = ref(true);
    const startPosition = ref(new THREE.Vector3(0, 0.2, 30)); // 临时起点位置
    
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
   
    // 加载赛道模型
    const loadTrack = async () => {
      try {
        isLoadingTrack.value = true;
        // 确保每次加载新赛道时，重置自动视角旋转状态
        isAutoCameraRotationComplete.value = false;
        
        if (!scene.value) {
          console.warn('[Race] 场景未准备好，无法加载赛道');
          return;
        }
        
        
        // 使用TrackManager加载赛道
        const trackModel = await trackManager.loadTrack(trackId.value, scene.value);
        
        // 获取赛道上的检查点
        const checkpointsData = trackManager.getCheckpoints();
        
        // 设置检查点
        setCheckpoints(checkpointsData);
        
        // 获取准确的起点位置
        if (trackModel) {
          // 标记起点位置对象
          let startMarker = null;
          trackModel.traverse(node => {
            if (node.name === 'object_200' || node.name.toLowerCase().includes('start')) {
              console.log(`[Race] 找到起点标记: ${node.name}`, node.position);
              startMarker = node;
            }
          });
          
          if (startMarker) {
            // 使用起点标记的位置，并增加Y轴偏移量
            startPosition.value = startMarker.position.clone().add(new THREE.Vector3(0, 0.2, 30));
          } else {
            // 尝试使用TrackManager的getStartPosition方法
            const trackStartPosition = trackManager.getStartPosition();
            if (trackStartPosition) {
              // TrackManager返回的位置已经包含了Y轴偏移量
              startPosition.value = trackStartPosition; 
            }
            // 否则保持当前位置 (可能需要一个更健壮的回退逻辑)
          }
        }
        
        isLoadingTrack.value = false;
      } catch (error) {
        console.error('[Race] 加载赛道失败:', error);
        isLoadingTrack.value = false;
      }
    };

    // Physics ready (remains the same)
    const onPhysicsReady = (data) => {
      world.value = data.world;
    };

    // Physics update - Call camera update here
    const onPhysicsUpdate = () => {
      if (isCarControllerReady.value && carController.value) {

        carController.value.handlePhysicsUpdate();
      } else if (isCarControllerReady.value && !carController.value) {
        // 如果 isReady 但 ref 仍为 null，尝试 nextTick
        console.warn("[Race] onPhysicsUpdate: carController is null even when ready. Checking in nextTick...");
        nextTick(() => {
          if (carController.value) {
            carController.value.handlePhysicsUpdate();
          } else {
            console.error("[Race] FATAL: carController ref is still null in nextTick after onCarReady!");
          }
        });
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
    };
    
    // 车辆控制器准备就绪 (从 VehicleController 发出的 car-ready 事件)
    const onCarReady = () => {
      isLoading.value = false;
      isInitializingPhysics.value = false; 
      
      
      // 设置标志位，表示 VehicleController 已准备好
      isCarControllerReady.value = true; 
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
    
    // 组件挂载
    onMounted(async () => { 
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
          showPhysicsDebug.value = !showPhysicsDebug.value; // 切换 ref 的值
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
    const startAnimationLoop = () => { /* ... */ }; 
    
    const stopAnimationLoop = () => {
      if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }
    };

    onUnmounted(() => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      
      stopAnimationLoop(); 
      if (scene.value) {
        trackManager.unloadCurrentTrack(scene.value);
      }
    });
    
    // 当 Track 组件的场景准备好时调用
    const onSceneReady = async (emittedScene) => { // 使用 async
      scene.value = emittedScene;

      await loadTrack();
      await nextTick();

      // 注释：在这里我们只创建备用相机，但通常会优先使用camera-ready事件接收到的相机
      // 备用相机只在VehicleRenderer组件未能正确发送camera-ready事件时使用
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
      showStartPrompt, // 添加开始提示控制
      onStartRaceFromPrompt, // 添加开始游戏处理函数
      isLoadingTrack, // 添加赛道加载状态
      debugMode,
      toggleDebugMode,
      forceEnableTouchControls,
      touchPoints,
      isLandscape,
      controlDebugInfo,
      reinitializeInputControls,
      showPhysicsDebug // 返回 ref
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
  top: 10px;
  right: 10px;
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