<template>
  <div class="race-container">
    <PhysicsEngine
      v-if="scene"
      ref="physicsEngine"
      :scene="scene"
      :debug="false"
      @physics-ready="onPhysicsReady"
      @physics-update="onPhysicsUpdate"
    />
    
    <Track
      v-if="currentVehicle"
      ref="track"
      @scene-ready="onSceneReady"
      :showControls="true"
      trackName="default"
      :selectedVehicle="currentVehicle"
      @model-ready="onModelReady"
      :is-loading="isLoading"
      :engine-power="enginePower"
      :brake-force="brakeForce"
      :turn-strength="turnStrength"
      @update:engine-power="handleEnginePowerUpdate"
      @update:brake-force="handleBrakeForceUpdate"
      @update:turn-strength="handleTurnStrengthUpdate"
    />
    
    <CarController
      v-if="!isLoadingVehicle && currentVehicle && world && scene && carModel"
      ref="carController"
      :world="world"
      :scene="scene"
      :carModel="carModel"
      :initialPosition="{ x: 0, y: 2, z: 0 }"
      :selectedVehicle="currentVehicle"
      :engine-power="enginePower"
      :brake-force="brakeForce"
      :turn-strength="turnStrength"
      @car-ready="onCarReady"
      @position-update="onPositionUpdate"
    />
    
    <div v-if="showInterface" class="race-interface">
      <div class="speed-meter">
        <span>{{ Math.floor(speed * 3.6) }}</span>
        <small>km/h</small>
      </div>
      
      <div class="lap-info">
        <div>圈数: {{ currentLap }}/{{ totalLaps }}</div>
        <div>最佳时间: {{ formatTime(bestLapTime) }}</div>
        <div>当前时间: {{ formatTime(currentLapTime) }}</div>
      </div>
      
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
import { ref, onMounted, onUnmounted } from 'vue';
import PhysicsEngine from '../components/PhysicsEngine.vue';
import CarController from '../components/CarController.vue';
import Track from './Track.vue';
import { vehiclesList } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';

export default {
  name: 'Race',
  components: {
    PhysicsEngine,
    CarController,
    Track
  },
  setup() {
    // 场景和物理引擎引用
    const physicsEngine = ref(null);
    const track = ref(null);
    const carController = ref(null);
    const scene = ref(null);
    const world = ref(null);
    const carModel = ref(null);
    
    // 调试模式
    const debugMode = ref(false);
    
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
    const isLoading = ref(true); // 添加整体加载状态
    
    // 新增：管理控制参数状态
    const enginePower = ref(6000); 
    const brakeForce = ref(6000);  
    const turnStrength = ref(5000);   // 转向强度可以从稍高点开始尝试
    
    // 初始化场景
    const initScene = () => {
      // 获取Track组件的场景
      if (track.value) {
        scene.value = track.value.scene;
        // 不再在这里获取 carModel
        // carModel.value = track.value.carModel; 
      }
    };
    
    // 物理引擎准备就绪
    const onPhysicsReady = (data) => {
      world.value = data.world;
    };
    
    // 物理引擎更新
    const onPhysicsUpdate = () => {
      // 调用 CarController 处理物理更新
      if (carController.value) { 
        // CarController 内部的 isReady 状态似乎没必要在此检查，
        // 因为 CarController 只有在准备好后才会被渲染并触发 car-ready
        // handlePhysicsUpdate 内部应该有自己的准备状态检查（如果需要）
        carController.value.handlePhysicsUpdate(); 
      }

      // 其他比赛逻辑更新
      if (raceStatus.value === 'racing') {
        updateRaceTime();
        checkCheckpoints();
      }
    };
    
    // 车辆准备就绪
    const onCarReady = () => {
      console.log("Race.vue: onCarReady called (received car-ready event).");
      // 开始倒计时
      isLoading.value = false; // 所有组件准备就绪，结束加载状态
      startCountdown();
    };
    
    // 更新车辆位置
    const onPositionUpdate = (data) => {
      speed.value = data.velocity.length();
    };
    
    // 开始倒计时
    const startCountdown = () => {
      console.log("Race.vue: startCountdown called. Current raceStatus:", raceStatus.value);
      raceStatus.value = 'countdown';
      console.log("Race.vue: raceStatus set to 'countdown'. New status:", raceStatus.value);
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
              console.log("Race view loaded and merged vehicle data:", currentVehicle.value.name, currentVehicle.value);
          } else {
              // DB fetch failed or returned null, use base data directly
              console.warn(`Vehicle data for ID ${vehicleIdToLoad} not found in DB, using list data.`);
              currentVehicle.value = baseVehicleData;
          }
      } catch (error) {
          console.error("Error loading vehicle data from DB:", error);
          // Error fetching, use base data directly
          currentVehicle.value = baseVehicleData;
      }
      
      isLoadingVehicle.value = false; // 加载完成

      // 初始化检查点（在实际应用中这些会从赛道模型中获取）
      checkpoints.value = [
        { x: 10, y: 0, z: 0 },
        { x: 0, y: 0, z: 10 },
        { x: -10, y: 0, z: 0 },
        { x: 0, y: 0, z: -10 }
      ];
      
      // 在下一个渲染周期执行初始化，确保子组件已挂载
      setTimeout(() => {
        initScene();
      }, 100);
    });
    
    // 组件卸载
    onUnmounted(() => {
      // 清理逻辑
    });
    
    // 当 Track 组件的场景准备好时调用
    const onSceneReady = (emittedScene) => {
        console.log("Track scene is ready.");
        scene.value = emittedScene;
        // 现在可以安全地认为 scene 存在了
        // 移除获取 carModel 的逻辑
        // if (track.value) {
        //   carModel.value = track.value.carModel; 
        //   console.log("Car model obtained from Track component:", carModel.value ? 'Success' : 'Failed');
        // } else {
        //   console.error("Track component ref is not available in onSceneReady.");
        // }
    };
    
    // 添加 model-ready 事件处理函数
    const onModelReady = (model) => {
        console.log("Race.vue: Received model-ready event.");
        carModel.value = model;
        console.log("Car model set in Race.vue:", carModel.value ? 'Success' : 'Failed');
    };
    
    // 新增：事件处理函数，用于更新控制参数状态
    const handleEnginePowerUpdate = (newValue) => {
        enginePower.value = newValue;
    };
    const handleBrakeForceUpdate = (newValue) => {
        brakeForce.value = newValue;
    };
    const handleTurnStrengthUpdate = (newValue) => {
        turnStrength.value = newValue;
    };
    
    return {
      physicsEngine,
      track,
      carController,
      scene,
      world,
      carModel,
      debugMode,
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
      isLoading, // 暴露整体加载状态
      enginePower,
      brakeForce,
      turnStrength,
      onPhysicsReady,
      onPhysicsUpdate,
      onSceneReady,
      onCarReady,
      onPositionUpdate,
      restartRace,
      formatTime,
      onModelReady,
      handleEnginePowerUpdate,
      handleBrakeForceUpdate,
      handleTurnStrengthUpdate
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