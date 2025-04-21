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
      v-if="!isLoadingVehicle && currentVehicle && world && scene"
      ref="carController"
      :world="world"
      :scene="scene"
      :carModel="carModel"
      :initialPosition="startPosition"
      :selectedVehicle="currentVehicle"
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
import { useCamera } from '@/composables/useCamera'; // Import the composable
import { useRaceLogic } from '@/composables/game/useRaceLogic'; // 引入比赛逻辑
import { trackManager } from '@/game/track/TrackManager'; // 引入赛道管理器

// 引入UI组件
import RaceHUD from '@/components/race/RaceHUD.vue';

// 引入 pinia storeToRefs
import { storeToRefs } from 'pinia';

export default {
  name: 'Race',
  components: {
    PhysicsEngine,
    VehicleController,
    VehicleRenderer,
    RaceHUD
  },
  setup() {
    const router = useRouter();
    
    // 储存动画帧ID
    let renderFrameId = null;
    
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
    // const isDebugMode = ref(false);
    
    // 添加相机ref给useCamera使用
    const cameraRef = shallowRef(null);
    
    // 添加视角演示状态跟踪
    const isAutoCameraRotationComplete = ref(false);
    
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
        console.log('[Race] 比赛开始!');
        // 移除相机切换逻辑，放到 watch 中处理
        // if (isCameraInitialized.value) {
        //   nextModeComposable();
        // } else {
        //   console.warn('[Race] Camera not initialized, cannot switch mode on race start.');
        // }
      },
      onRaceFinish: (results) => {
        console.log('[Race] 比赛结束!', results);
      }
    });
    
    // --- Use the useCamera composable ---
    // Destructure refs/functions needed in template/return, AND get the full object
    const cameraControls = useCamera(cameraRef, carModel, rendererElement, { initialMode: 0 });
    const {
      isInitialized: isCameraInitialized,
      currentCameraMode: cameraModeFromComposable,
      cameraParams: cameraParamsFromComposable,
      isSaving: isSavingCamera,
      updateParameters: updateCameraParameters,
      saveSettings: saveCameraSettings,
      update: updateCamera
    } = cameraControls;
    // console.log('[Race setup] Type of nextModeComposable after destructuring:', typeof nextModeComposable); // Keep commented or remove

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
        
        console.log(`[Race] 开始加载赛道：${trackId.value}`);
        
        // 使用TrackManager加载赛道
        const trackModel = await trackManager.loadTrack(trackId.value, scene.value);
        
        // 获取赛道上的检查点
        const checkpointsData = trackManager.getCheckpoints();
        console.log(`[Race] 获取到检查点数量：${checkpointsData.length}`);
        
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
            startPosition.value = startMarker.position.clone().add(new THREE.Vector3(0, 0.2, 8));
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
        
        console.log(`[Race] 赛道起始位置：`, startPosition.value);
        
        isLoadingTrack.value = false;
        
        // 如果车辆控制器已准备好且视角演示已完成，而且比赛还没开始，现在可以开始倒计时
        if (isCarControllerReady.value && isAutoCameraRotationComplete.value && raceStatus.value === 'waiting') {
          startCountdown();
        }
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
      }

      // --- Update camera using the composable's update function ---
      if (isCameraInitialized.value) { // Check if composable is ready
        updateCamera(); // Calls internal update logic for controller/controls
      }

      if (raceStatus.value === 'racing') {
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
      
      // 只有在赛道加载完成且视角演示已完成时才开始倒计时
      if (!isLoadingTrack.value && isAutoCameraRotationComplete.value) {
        startCountdown();
      }
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
    onMounted(async () => { // Make onMounted async
      isLoadingVehicle.value = true;
      isLoading.value = true; // Start general loading
      let vehicleIdToLoad = vehiclesList[0].id; // Default to first vehicle ID
      const lastVehicleId = localStorage.getItem('lastSelectedVehicleId');
      
      if (lastVehicleId) {
        if (vehiclesList.some(v => v.id === lastVehicleId)) {
          vehicleIdToLoad = lastVehicleId;
        } else {
          console.warn(`Stored vehicle ID ${lastVehicleId} not found in vehiclesList, using default.`);
          localStorage.removeItem('lastSelectedVehicleId'); 
        }
      }

      const baseVehicleData = vehiclesList.find(v => v.id === vehicleIdToLoad) || vehiclesList[0];
      let loadedVehicleData = null;

      try {
        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleIdToLoad);

        if (vehicleDataFromDB) {
          loadedVehicleData = {
            ...baseVehicleData, 
            ...vehicleDataFromDB, 
            customSettings: {
              ...(baseVehicleData.customSettings || {}), 
              ...(vehicleDataFromDB.customSettings || {}), 
            }
          };
        } else {
          console.warn(`Vehicle data for ID ${vehicleIdToLoad} not found in DB, using list data.`);
          loadedVehicleData = {
            ...baseVehicleData,
            customSettings: baseVehicleData.customSettings || {}
          };
        }
      } catch (error) {
        console.error("Error loading vehicle data from DB:", error);
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
        
        // 如果车辆控制器已准备好但比赛尚未开始，现在可以开始倒计时
        if (isCarControllerReady.value && raceStatus.value === 'waiting' && !isLoadingTrack.value) {
          startCountdown();
        }
      };
      
      // 递归函数，定期切换视角
      const scheduleSwitching = () => {
        // 如果已经切换完所有视角或比赛不再处于等待状态，则停止
        if (switchCount >= targetSwitchCount || raceStatus.value !== 'waiting') {
          cleanup();
          
          // 如果是正常完成所有视角切换(而非因比赛开始被中断)
          if (switchCount >= targetSwitchCount && raceStatus.value === 'waiting') {
            // 如果车辆控制器已准备好，现在可以开始倒计时
            if (isCarControllerReady.value && !isLoadingTrack.value) {
              startCountdown();
            }
          }
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
      if (isCameraInitialized.value) {
        scheduleSwitching();
      } else {
        // 否则等待相机初始化
        initWatcherStop = watch(isCameraInitialized, (isInit) => {
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
          if (!isCameraInitialized.value) {
            cleanup();
            
            // 即使超时也标记为已完成，允许游戏继续
            isAutoCameraRotationComplete.value = true;
            
            // 如果车辆控制器已准备好但比赛尚未开始，现在可以开始倒计时
            if (isCarControllerReady.value && raceStatus.value === 'waiting' && !isLoadingTrack.value) {
              startCountdown();
            }
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
      // 执行所有注册的清理函数
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
      console.log("[Race.vue] Scene is ready.");

      await loadTrack();
      await nextTick();

      try {
        let camInstance = null;
        if (track.value?.getCamera) {
          camInstance = track.value.getCamera();
          if (camInstance) {
            console.log("成功从VehicleRenderer获取相机引用");
          } else {
            console.warn("VehicleRenderer.getCamera() 返回 null，创建备用相机");
          }
        } else {
          console.warn("VehicleRenderer没有提供getCamera方法，创建备用相机");
        }

        if (!camInstance && scene.value) {
          camInstance = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          camInstance.position.set(0, 5, 10); 
          camInstance.lookAt(0, 0, 0); 

          const handleResize = () => {
            if (camInstance) {
              camInstance.aspect = window.innerWidth / window.innerHeight;
              camInstance.updateProjectionMatrix();
            }
          };
          window.addEventListener('resize', handleResize);

          // 添加到清理函数列表
          cleanupFunctions.push(() => {
            window.removeEventListener('resize', handleResize);
          });
          console.log("已创建备用相机");
        }

        if (camInstance) {
          cameraRef.value = camInstance;
          console.log("[Race.vue] Camera instance assigned to ref");
          
          // 检查 carModel 是否也准备好了，如果是，则设置模式
          if (carModel.value) {
            console.log("[Race.vue] Both camera and model ready in onSceneReady");
            // 使用 nextTick 确保 useCamera 的内部 watch 有机会响应 refs 的变化
            nextTick(() => {
              // 设置相机模式并启动视角演示
              startCameraDemo();
            });
          }
        } else {
          console.error("[Race.vue] Failed to obtain or create a camera instance.");
        }
      } catch (error) {
        console.error("onSceneReady 处理相机时出错:", error);
      }
    };
    
    // 当车辆模型准备好时调用
    const onModelReady = (model) => {
      carModel.value = model;
      console.log("[Race.vue] Model ref set for useCamera");
      
      // 检查 cameraRef 是否也准备好了，如果是，则设置模式
      if (cameraRef.value) {
        console.log("[Race.vue] Both camera and model ready in onModelReady");
        // 使用 nextTick 确保 useCamera 的内部 watch 有机会响应 refs 的变化
        nextTick(() => {
          // 设置相机模式并启动视角演示
          startCameraDemo();
        });
      }
    };
    
    // 设置相机模式并启动视角演示
    const startCameraDemo = () => {
      // 首先设置FREE_LOOK模式(0)作为起点
      const success = cameraControls.setMode(0);
      if (success) {
        // 启动视角演示
        const cleanup = startAutoCameraRotation();
        if (cleanup) {
          cleanupFunctions.push(cleanup);
        }
      }
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
        if (isCameraInitialized.value) {
          // 使用 nextTick 延迟切换，确保车辆状态更新
          nextTick(() => {
            // 设置追逐视角 (模式 3 - CHASE)
            cameraControls.setMode(3);
          });
        }
      }
    });
    
    return {
      rendererElement, 
      physicsEngine,
      track,
      carController,
      scene,
      world,
      carModel, 
      raceStatus,
      countdown,
      showInterface,
      speed,
      currentLapTime,
      bestLapTime,
      totalRaceTime,
      currentLap,
      totalLaps,
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
      restartRace,
      exitRace,
      formatTime,
      onModelReady,
      isCarControllerReady, 
      isCameraInitialized,
      currentCameraMode: cameraModeFromComposable,
      cameraParams: cameraParamsFromComposable,
      isSavingCamera,
      updateCameraParameters,
      saveCameraSettings,
      handleCameraLookAtOffsetUpdate,
      tuningParams,
      startAutoCameraRotation,
      forceDisableRendererControls,
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
}
</style> 