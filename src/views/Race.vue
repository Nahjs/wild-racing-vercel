<template>
  <div class="race-container" ref="rendererElement">
    <PhysicsEngine
      v-if="scene"
      ref="physicsEngine"
      :scene="scene"
      :debug="false"
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
      :initial-correction-angle="tuningStore.tuningParams.initialCorrectionAngle"
      :enable-lighting="true"
      :enable-environment-map="true"
      :enable-contact-shadow="true"
      :enable-big-spot-light="true"
    />
    
    <RaceDebug
      v-if="!isLoadingVehicle && currentVehicle && isDebugMode && isCameraInitialized"
      :engine-power="tuningStore.tuningParams.enginePower"
      :turn-strength="tuningStore.tuningParams.turnStrength"
      :vehicle-mass="tuningStore.tuningParams.vehicleMass"
      :linear-damping="tuningStore.tuningParams.linearDamping"
      :angular-damping="tuningStore.tuningParams.angularDamping"
      :brake-power="tuningStore.tuningParams.brakePower"
      :slow-down-force="tuningStore.tuningParams.slowDownForce"
      :suspension-stiffness="tuningStore.tuningParams.suspensionStiffness"
      :suspension-rest-length="tuningStore.tuningParams.suspensionRestLength"
      :friction-slip="tuningStore.tuningParams.frictionSlip"
      :damping-relaxation="tuningStore.tuningParams.dampingRelaxation"
      :damping-compression="tuningStore.tuningParams.dampingCompression"
      :max-suspension-force="tuningStore.tuningParams.maxSuspensionForce"
      :roll-influence="tuningStore.tuningParams.rollInfluence"
      :max-suspension-travel="tuningStore.tuningParams.maxSuspensionTravel"
      :initial-correction-axis="tuningStore.tuningParams.initialCorrectionAxis"
      :initial-correction-angle="tuningStore.tuningParams.initialCorrectionAngle"
      :show-wheel-axes="tuningStore.tuningParams.showWheelAxes"
      :current-camera-mode="currentCamera.mode || 0"
      :camera-params="currentCamera.params || {}"
      :is-saving-tuning="tuningStore.isSaving"
      :is-saving-camera-settings="isSavingCamera"
      @update:engine-power="newValue => tuningStore.updateParam('enginePower', newValue)"
      @update:turn-strength="newValue => tuningStore.updateParam('turnStrength', newValue)"
      @update:vehicle-mass="newValue => tuningStore.updateParam('vehicleMass', newValue)"
      @update:linear-damping="newValue => tuningStore.updateParam('linearDamping', newValue)"
      @update:angular-damping="newValue => tuningStore.updateParam('angularDamping', newValue)"
      @update:brake-power="newValue => tuningStore.updateParam('brakePower', newValue)"
      @update:slow-down-force="newValue => tuningStore.updateParam('slowDownForce', newValue)"
      @update:suspension-stiffness="newValue => tuningStore.updateParam('suspensionStiffness', newValue)"
      @update:suspension-rest-length="newValue => tuningStore.updateParam('suspensionRestLength', newValue)"
      @update:friction-slip="newValue => tuningStore.updateParam('frictionSlip', newValue)"
      @update:damping-relaxation="newValue => tuningStore.updateParam('dampingRelaxation', newValue)"
      @update:damping-compression="newValue => tuningStore.updateParam('dampingCompression', newValue)"
      @update:max-suspension-force="newValue => tuningStore.updateParam('maxSuspensionForce', newValue)"
      @update:roll-influence="newValue => tuningStore.updateParam('rollInfluence', newValue)"
      @update:max-suspension-travel="newValue => tuningStore.updateParam('maxSuspensionTravel', newValue)"
      @update:initial-correction-axis="newValue => tuningStore.updateParam('initialCorrectionAxis', newValue)"
      @update:initial-correction-angle="newValue => tuningStore.updateParam('initialCorrectionAngle', newValue)"
      @update:show-wheel-axes="newValue => tuningStore.updateParam('showWheelAxes', newValue)"
      @save-tuning="tuningStore.saveTuning"
      @update:cameraParam="updateCameraParameters"
      @update:cameraLookAtOffset="handleCameraLookAtOffsetUpdate"
      @saveCameraSettings="saveCameraSettings"
    />
    
    <VehicleController
      v-if="!isLoadingVehicle && currentVehicle && world && scene"
      ref="carController"
      :world="world"
      :scene="scene"
      :carModel="carModel"
      :initialPosition="{ x: 0, y: 2, z: 0 }"
      :selectedVehicle="currentVehicle"
      @car-ready="onCarReady"
      @position-update="onPositionUpdate"
    />
    
    <div v-if="showInterface" class="race-interface">
      <div class="speed-meter">
        <span>{{ Math.floor(speed * 3.6) }}</span>
        <small>km/h</small>
      </div>
      
      <!-- <div class="lap-info">
        <div>圈数: {{ currentLap }}/{{ totalLaps }}</div>
        <div>最佳时间: {{ formatTime(bestLapTime) }}</div>
        <div>当前时间: {{ formatTime(currentLapTime) }}</div>
      </div> -->
      
      <div v-if="raceStatus === 'countdown'" class="countdown">
        {{ countdown }}
      </div>
      
      <div v-if="raceStatus === 'finished'" class="race-results">
        <h2>比赛结束!</h2>
        <div>总时间: {{ formatTime(totalRaceTime) }}</div>
        <div>最佳单圈: {{ formatTime(bestLapTime) }}</div>
        <button @click="restartRace" class="restart-btn">重新开始</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, watchEffect, provide, computed, nextTick, shallowRef } from 'vue';
import PhysicsEngine from '@/core/physics/PhysicsEngine.vue';
import VehicleController from '@/game/vehicle/VehicleController.vue';
import VehicleRenderer from '@/game/vehicle/VehicleRenderer.vue';
import RaceDebug from '@/debug/RaceDebug.vue';
import { vehiclesList } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';
import { settingsService } from '@/services/settingsService';
import * as CANNON from 'cannon-es'; // 导入 CANNON 用于 Vec3
import * as THREE from 'three'; // 导入THREE用于创建相机
import { useTuningStore } from '@/store/tuning'; // Import the store
import { CameraController, CameraMode } from '@/game/user/camera/CameraController';
import { useCamera } from '@/composables/useCamera'; // Import the composable

export default {
  name: 'Race',
  components: {
    PhysicsEngine,
    VehicleController,
    VehicleRenderer,
    RaceDebug
  },
  setup() {
    // Instantiate the store
    const tuningStore = useTuningStore();

    // 场景和物理引擎引用
    const physicsEngine = ref(null);
    const track = ref(null);
    const carController = ref(null);
    const scene = ref(null);
    const world = ref(null);
    const carModel = shallowRef(null); // Use shallowRef for THREE model
    const rendererElement = ref(null);
    const isDebugMode = ref(true);
    
    // 添加相机ref给useCamera使用
    const cameraRef = shallowRef(null);
    
    // 比赛状态
    const raceStatus = ref('waiting'); // waiting, countdown, racing, finished
    const countdown = ref(3);
    const showInterface = ref(true);
    const speed = ref(0);
    
    // 计时器
    const raceStartTime = ref(0);
    const currentLapStartTime = ref(0);
    const currentLapTime = ref(0);
    const bestLapTime = ref(0);
    const totalRaceTime = ref(0);
    const currentLap = ref(0);
    const totalLaps = ref(3);
    
    // 检查点和赛道
    const checkpoints = ref([]);
    const nextCheckpoint = ref(0);
    
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
    
    // 添加当前相机状态对象用于传递给RaceDebug组件
    const currentCamera = ref({
      mode: 0,
      params: {}
    });
    
    // --- Use the useCamera composable ---
    const {
      isInitialized: isCameraInitialized,
      currentCameraMode: cameraModeFromComposable,
      cameraParams: cameraParamsFromComposable,
      isSaving: isSavingCamera,
      setMode: setCameraMode,
      nextMode: nextCameraModeComposable,
      updateParameters: updateCameraParameters,
      saveSettings: saveCameraSettings,
      loadSettings: loadCameraSettingsFromComposable,
      update: updateCamera
    } = useCamera(cameraRef, carModel, rendererElement, { initialMode: CameraMode.FREE_LOOK });

    // 监听相机模式和参数变化，更新currentCamera
    watch(cameraModeFromComposable, (newMode) => {
      if (newMode !== undefined) {
        currentCamera.value.mode = newMode;
      }
    });
    
    watch(cameraParamsFromComposable, (newParams) => {
      if (newParams) {
        currentCamera.value.params = newParams;
      }
    });

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
        checkCheckpoints();
      }
    };
    
    // 车辆控制器准备就绪 (从 VehicleController 发出的 car-ready 事件)
    const onCarReady = () => {
      isLoading.value = false; // 这个 loading 可能是指整体加载？
      isInitializingPhysics.value = false; 
      
      // 设置标志位，表示 VehicleController 已准备好
      isCarControllerReady.value = true; 
      
      startCountdown(); // 开始倒计时
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
    
    // 开始倒计时
    const startCountdown = () => {
      raceStatus.value = 'countdown';
      countdown.value = 3;
      
      const countdownInterval = setInterval(() => {
        countdown.value--;
        
        if (countdown.value <= 0) {
          clearInterval(countdownInterval);
          startRace();
        }
      }, 1000);
    };
    
    // 开始比赛
    const startRace = () => {
      raceStatus.value = 'racing';
      currentLap.value = 1;
      raceStartTime.value = Date.now();
      currentLapStartTime.value = Date.now();
    };
    
    // 更新比赛时间
    const updateRaceTime = () => {
      if (raceStatus.value === 'racing') {
        currentLapTime.value = Date.now() - currentLapStartTime.value;
        totalRaceTime.value = Date.now() - raceStartTime.value;
      }
    };
    
    // 检查检查点
    const checkCheckpoints = () => {
      // 在实际应用中，这里会检查车辆是否通过了检查点
      // 简化版本，我们在这里模拟随机完成检查点
      if (Math.random() < 0.001 && nextCheckpoint.value < checkpoints.value.length) {
        nextCheckpoint.value++;
        
        if (nextCheckpoint.value >= checkpoints.value.length) {
          completeLap();
        }
      }
    };
    
    // 完成一圈
    const completeLap = () => {
      // 更新最佳圈速
      if (bestLapTime.value === 0 || currentLapTime.value < bestLapTime.value) {
        bestLapTime.value = currentLapTime.value;
      }
      
      // 检查是否完成全部圈数
      currentLap.value++;
      
      if (currentLap.value > totalLaps.value) {
        finishRace();
      } else {
        // 开始新的一圈
        nextCheckpoint.value = 0;
        currentLapStartTime.value = Date.now();
      }
    };
    
    // 完成比赛
    const finishRace = () => {
      raceStatus.value = 'finished';
    };
    
    // 重新开始比赛
    const restartRace = () => {
      // 重置车辆位置
      if (carController.value) {
        carController.value.resetCar();
      }
      
      // 重置比赛状态
      raceStatus.value = 'waiting';
      currentLap.value = 0;
      nextCheckpoint.value = 0;
      totalRaceTime.value = 0;
      currentLapTime.value = 0;
      
      // 开始新的倒计时
      startCountdown();
    };
    
    // 格式化时间显示 (毫秒转换为 分:秒.毫秒)
    const formatTime = (timeMs) => {
      if (timeMs === 0) return '00:00.000';
      
      const minutes = Math.floor(timeMs / 60000);
      const seconds = Math.floor((timeMs % 60000) / 1000);
      const ms = timeMs % 1000;
      
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };
    
    // 组件挂载
    onMounted(async () => { // Make onMounted async
      isLoadingVehicle.value = true;
      isLoading.value = true; // Start general loading
      let vehicleIdToLoad = vehiclesList[0].id; // Default to first vehicle ID
      const lastVehicleId = localStorage.getItem('lastSelectedVehicleId');
      
      if (lastVehicleId) {
          // 验证 lastVehicleId 是否在当前列表中仍然有效（可选但推荐）
          if (vehiclesList.some(v => v.id === lastVehicleId)) {
              vehicleIdToLoad = lastVehicleId;
          } else {
              console.warn(`Stored vehicle ID ${lastVehicleId} not found in vehiclesList, using default.`);
              localStorage.removeItem('lastSelectedVehicleId'); // 清除无效 ID
          }
      }

      // Find the base vehicle data from the static list first
      const baseVehicleData = vehiclesList.find(v => v.id === vehicleIdToLoad) || vehiclesList[0];

      try {
          const vehicleDataFromDB = await vehicleService.getVehicle(vehicleIdToLoad);

          if (vehicleDataFromDB) {
              // Merge DB data (especially customSettings) with base data
              // Ensure essential fields like name and model come from base data if missing in DB
              currentVehicle.value = {
                  ...baseVehicleData, // Start with base data (includes name, model, etc.)
                  ...vehicleDataFromDB, // Override with DB data (id, customSettings, updatedAt)
                  // Ensure customSettings is properly merged if it exists in both (though unlikely)
                  customSettings: {
                      ...(baseVehicleData.customSettings || {}), // Base custom settings (if any)
                      ...(vehicleDataFromDB.customSettings || {}), // DB custom settings take precedence
                  }
              };
              } else {
              // DB fetch failed or returned null, use base data directly
              console.warn(`Vehicle data for ID ${vehicleIdToLoad} not found in DB, using list data.`);
              // Ensure customSettings exists even if loading from list
              currentVehicle.value = {
                  ...baseVehicleData,
                  customSettings: baseVehicleData.customSettings || {}
              };
          }
      } catch (error) {
          console.error("Error loading vehicle data from DB:", error);
          // Error fetching, use base data directly
           // Ensure customSettings exists even on error
           currentVehicle.value = {
               ...baseVehicleData,
               customSettings: baseVehicleData.customSettings || {}
           };
      }
      
      // Load tuning data using the store action
      await tuningStore.loadTuning(vehicleIdToLoad);

      isLoadingVehicle.value = false; 
      // Don't set isLoading to false yet, wait for scene/camera/controller

      // Remove placeholder checkpoints - actual checkpoints should be loaded with the track
      // checkpoints.value = [
      //   { x: 10, y: 0, z: 0 },
      //   { x: 0, y: 0, z: 10 },
      //   { x: -10, y: 0, z: 0 },
      //   { x: 0, y: 0, z: -10 }
      // ];
      checkpoints.value = []; // Initialize as empty, wait for track load

      // 键盘事件将在初始化相机控制器成功后设置
      // 修改：移除setupKeyListener的直接调用
      // setupKeyListener();

      // Wait for the VehicleRenderer to emit scene-ready before initializing camera controller
    });
    
    // 组件卸载
    let renderFrameId = null; // Need to store the animation frame ID

    // Basic animation loop placeholder - assumes rendering is handled elsewhere or by PhysicsEngine/VehicleRenderer?
    // If Race.vue needs its own loop (e.g., for camera independent of physics), implement properly.
    const startAnimationLoop = () => { /* ... */ }; 
    const stopAnimationLoop = () => {
        if (renderFrameId) {
            cancelAnimationFrame(renderFrameId);
            renderFrameId = null;
        }
    };

    onUnmounted(() => {
      // 清理逻辑
      stopAnimationLoop(); // Assuming there's a stop function if startAnimationLoop is used
      removeKeyListener();
      if (rendererElement.value) {
          rendererElement.value.dispose();
      }
      // Add other cleanup as necessary
    });
    
    // 当 Track 组件的场景准备好时调用
    const onSceneReady = async (emittedScene) => { // 使用 async
      scene.value = emittedScene;
      console.log("Race.vue: Scene is ready.");

      // 等待 DOM 更新后再尝试获取相机和渲染元素
      await nextTick();

      try {
        // 尝试从VehicleRenderer获取相机
        let camInstance = null;
        if (track.value?.getCamera) {
          camInstance = track.value.getCamera();
          if (camInstance) {
            console.log("成功从VehicleRenderer获取相机引用");
          } else {
             console.warn("VehicleRenderer.getCamera() 返回 null，创建备用相机");
             // Fallback logic below will handle this
          }
        } else {
          console.warn("VehicleRenderer没有提供getCamera方法，创建备用相机");
        }

        // 创建备用相机 (如果获取失败或未提供)
        if (!camInstance && scene.value) {
          camInstance = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          camInstance.position.set(0, 5, 10); // 默认位置
          camInstance.lookAt(0, 0, 0); // 默认朝向

          // 添加窗口大小调整监听器
          const handleResize = () => {
              if (camInstance) {
                  camInstance.aspect = window.innerWidth / window.innerHeight;
                  camInstance.updateProjectionMatrix();
              }
          };
          window.addEventListener('resize', handleResize);

          // 在组件卸载时移除监听器
          onUnmounted(() => {
              window.removeEventListener('resize', handleResize);
          });
          console.log("已创建备用相机");
        }

        // 更新相机ref，useCamera组合式函数会监听这个变化
        if (camInstance) {
            cameraRef.value = camInstance;
            console.log("Race.vue: Camera instance assigned to ref, useCamera should detect this change.");
            
            // 确保模型也存在时再调用相机模式设置
            if (carModel.value) {
                // 给useCamera一点时间来初始化，然后再设置模式
                setTimeout(() => {
                    const success = setCameraMode(CameraMode.FREE_LOOK);
                    if (success) {
                        console.log("Race.vue: Camera mode set successfully.");
                    } else {
                        console.warn("Race.vue: Failed to set camera mode.");
                    }
                }, 100); // 短暂延迟确保useCamera内部的watch能响应
            } else {
                console.log("Race.vue: Waiting for car model before setting camera mode.");
            }
        } else {
            console.error("Race.vue: Failed to obtain or create a camera instance.");
        }

      } catch (error) {
        console.error("onSceneReady 处理相机时出错:", error);
      }
    };
    
    // 当车辆模型准备好时调用
    const onModelReady = (model) => {
      carModel.value = model;
      console.log("Race.vue: Model ref set for useCamera.");
      
      // 如果相机已经准备好，但相机控制器尚未初始化，尝试设置相机模式
      if (cameraRef.value && !isCameraInitialized.value) {
          setTimeout(() => {
              const success = setCameraMode(CameraMode.FREE_LOOK);
              console.log(`Race.vue: Camera mode set on model ready: ${success}`);
          }, 100);
      }
    };
    
    // 切换相机模式
    const toggleCameraMode = () => {
        if (isCameraInitialized.value) {
            try {
                const success = nextCameraModeComposable();
                if (success) {
                    console.log(`相机模式已切换到: ${Object.keys(CameraMode)[cameraModeFromComposable.value]}`);
                } else {
                    console.warn('切换相机模式失败');
                }
            } catch (error) {
                console.error('切换相机模式时出错:', error);
            }
        } else {
            console.warn('相机控制器未初始化，无法切换模式');
        }
    };
    
    // 设置键盘监听器
    const handleKeyDown = (event) => {
        if (event.key === 'v' || event.key === 'V') {
            console.log('检测到相机切换快捷键');
             nextCameraModeComposable(); // <<< CALL COMPOSABLE'S METHOD
        }
    };

    const setupKeyListener = () => {
        console.log('设置相机切换键盘监听器');
        window.addEventListener('keydown', handleKeyDown);
    };

    const removeKeyListener = () => {
        console.log('移除相机切换键盘监听器');
        window.removeEventListener('keydown', handleKeyDown);
    };
    
    // WatchEffect remains, dependencies might need adjustment based on store loading state?
    watchEffect(() => {
      // Maybe add check for !tuningStore.isLoading?
      if (carController.value && world.value && scene.value && carModel.value && !isInitializingPhysics.value && !tuningStore.isLoading) { 
        isInitializingPhysics.value = true; // 设置调用锁
        try {
            carController.value.initializePhysics(); // 调用子组件暴露的方法
        } catch(error) {
            console.error("Race.vue: Error calling initializePhysics on CarController:", error);
            isInitializingPhysics.value = false; // 出错时解锁
            // 可能需要显示错误信息给用户
        }
      }
    });
    
    // WatchEffect for camera initialization
    watch(isCameraInitialized, (initialized) => {
        if (initialized) {
            setupKeyListener();
        } else {
            removeKeyListener(); // Clean up if camera becomes uninitialized?
        }
    });
    
    // Keep refs that are still needed as props or for other logic
    // const customSlidingRotationalSpeed = ref(30); // Assuming this isn't in tuning store yet
    // const wheelRadius = ref(0.34); // Assuming this isn't in tuning store yet
    
    const handleCameraLookAtOffsetUpdate = (payload) => {
        // Create the new full parameter object based on the current state and the partial update
        const currentParams = cameraParamsFromComposable.value; // Get current params from composable
        const currentOffset = currentParams.lookAtOffset || [0, 0, 0];
        const newOffset = [...currentOffset];
        newOffset[payload.index] = payload.value;
        updateCameraParameters({ ...currentParams, lookAtOffset: newOffset });
    };
    
    return {
      rendererElement, // Expose for template ref
      physicsEngine,
      track,
      carController,
      scene,
      world,
      carModel, // Expose model ref if needed by template/children
      isDebugMode,
      raceStatus,
      countdown,
      showInterface,
      speed,
      currentLapTime,
      bestLapTime,
      totalRaceTime,
      currentLap,
      totalLaps,
      currentVehicle, // 暴露 currentVehicle
      isLoadingVehicle, // 暴露加载状态
      isLoading, // Consider linking this to tuningStore.isLoading or having separate states
      // Expose the store itself or specific parts if needed
      tuningStore,
      // Expose remaining non-tuning refs
      // customSlidingRotationalSpeed,
      // wheelRadius,
      // connectionPoints,
      wheelQuaternions,
      wheelPositions,
      // Keep functions
      onPhysicsReady,
      onPhysicsUpdate,
      onSceneReady,
      onCarReady,
      onPositionUpdate,
      restartRace,
      formatTime,
      onModelReady,
      isCarControllerReady, // 需要暴露吗？暂时不用
      // 相机相关暴露
      isCameraInitialized,
      currentCameraMode: cameraModeFromComposable,
      cameraParams: cameraParamsFromComposable,
      isSavingCamera,
      updateCameraParameters,
      saveCameraSettings,
      handleCameraLookAtOffsetUpdate,
      currentCamera // <--- 添加 currentCamera 到 return 语句
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

.race-interface {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.speed-meter {
  position: absolute;
  bottom: 30px;
  right: 30px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 10px;
  text-align: center;
}

.speed-meter span {
  font-size: 36px;
  font-weight: bold;
  display: block;
}

.speed-meter small {
  font-size: 14px;
}

.lap-info {
  position: absolute;
  top: 20px;
  left: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-size: 16px;
}

.countdown {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 100px;
  font-weight: bold;
  color: white;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
}

.race-results {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  pointer-events: auto;
}

.restart-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  margin-top: 15px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.restart-btn:hover {
  background-color: #45a049;
}
</style> 