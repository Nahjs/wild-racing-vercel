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
      :turn-strength="turnStrength"
      :vehicle-mass="vehicleMass"
      :linear-damping="linearDamping"
      :angular-damping="angularDamping"
      :ground-friction="groundFriction"
      :brake-power="brakePower"
      :slow-down-force="slowDownForce"
      :suspension-stiffness="suspensionStiffness"
      :suspension-rest-length="suspensionRestLength"
      :friction-slip="frictionSlip"
      :damping-relaxation="dampingRelaxation"
      :damping-compression="dampingCompression"
      :max-suspension-force="maxSuspensionForce"
      :roll-influence="rollInfluence"
      :max-suspension-travel="maxSuspensionTravel"
      :wheel-quaternions="wheelQuaternions"
      :wheel-positions="wheelPositions"
      :initial-correction-axis="initialCorrectionAxis"
      :initial-correction-angle="initialCorrectionAngle"
      @update:engine-power="handleEnginePowerUpdate"
      @update:turn-strength="handleTurnStrengthUpdate"
      @update:vehicle-mass="handleMassUpdate"
      @update:linear-damping="handleLinearDampingUpdate"
      @update:angular-damping="handleAngularDampingUpdate"
      @update:ground-friction="handleGroundFrictionUpdate"
      @update:brake-power="handleBrakePowerUpdate"
      @update:slow-down-force="handleSlowDownForceUpdate"
      @update:suspension-stiffness="handleSuspensionStiffnessUpdate"
      @update:suspension-rest-length="handleSuspensionRestLengthUpdate"
      @update:friction-slip="handleFrictionSlipUpdate"
      @update:damping-relaxation="handleDampingRelaxationUpdate"
      @update:damping-compression="handleDampingCompressionUpdate"
      @update:max-suspension-force="handleMaxSuspensionForceUpdate"
      @update:roll-influence="handleRollInfluenceUpdate"
      @update:max-suspension-travel="handleMaxSuspensionTravelUpdate"
      @update:initial-correction-axis="handleInitialCorrectionAxisUpdate"
      @update:initial-correction-angle="handleInitialCorrectionAngleUpdate"
      @save-tuning="saveTuning"
      :is-saving-tuning="isLoading"
    />
    
    <CarController
      v-if="!isLoadingVehicle && currentVehicle && world && scene"
      ref="carController"
      :world="world"
      :scene="scene"
      :carModel="carModel"
      :initialPosition="{ x: 0, y: 2, z: 0 }"
      :selectedVehicle="currentVehicle"
      :engine-power="enginePower"
      :turn-strength="turnStrength"
      :vehicle-mass="vehicleMass"
      :linear-damping="linearDamping"
      :angular-damping="angularDamping"
      :brake-power="brakePower"
      :slow-down-force="slowDownForce"
      :suspension-stiffness="suspensionStiffness"
      :suspension-rest-length="suspensionRestLength"
      :friction-slip="frictionSlip"
      :damping-relaxation="dampingRelaxation"
      :damping-compression="dampingCompression"
      :max-suspension-force="maxSuspensionForce"
      :roll-influence="rollInfluence"
      :max-suspension-travel="maxSuspensionTravel"
      :custom-sliding-rotational-speed="customSlidingRotationalSpeed"
      :wheel-radius="wheelRadius"
      :connection-points="connectionPoints"
      :initial-correction-axis="initialCorrectionAxis"
      :initial-correction-angle="initialCorrectionAngle"
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
import { ref, onMounted, onUnmounted, watch, watchEffect } from 'vue';
import PhysicsEngine from '../components/PhysicsEngine.vue';
import CarController from '../components/CarController.vue';
import Track from './Track.vue';
import { vehiclesList } from '@/config/vehicles';
import { vehicleService } from '@/services/vehicleService';
import * as CANNON from 'cannon-es'; // 导入 CANNON 用于 Vec3

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
    const isInitializingPhysics = ref(false); // 防止重复调用
    
    // 新增：管理控制参数状态
    const enginePower = ref(2750); 
    const brakeForce = ref(6000);  
    const turnStrength = ref(0.5);   // 转向强度可以从稍高点开始尝试
    
    // --- 新增物理参数 ref ---
    const vehicleMass = ref(653); // 初始质量
    const linearDamping = ref(0.1); // 初始线性阻尼
    const angularDamping = ref(0.5); // 初始角阻尼
    const groundFriction = ref(0.3); // 初始地面摩擦力
    
    // 新增参数 (RaycastVehicle)
    const brakePower = ref(36); // 主动刹车力
    const slowDownForce = ref(19.6); // 被动刹车/阻力
    
    // wheelInfos 参数 (使用示例默认值)
    const suspensionStiffness = ref(55);
    const suspensionRestLength = ref(0.5);
    const frictionSlip = ref(30);
    const dampingRelaxation = ref(2.3);
    const dampingCompression = ref(4.3);
    const maxSuspensionForce = ref(10000);
    const rollInfluence = ref(0.01);
    const maxSuspensionTravel = ref(1);
    const customSlidingRotationalSpeed = ref(30);
    const wheelRadius = ref(0.34);
    
    // 新增：车轮初始旋转修正 ref (默认值)
    const initialCorrectionAxis = ref('x');
    const initialCorrectionAngle = ref(90);
    
    // 车轮连接点 (需要根据实际模型调整!)
    // 顺序: RL, RR, FL, FR (根据 CarController 默认值)
    const connectionPoints = ref([
        new CANNON.Vec3(-0.78, 0.1, -1.25), // 左后 RL - 调整 Y 值？示例是 0.1
        new CANNON.Vec3(0.78, 0.1, -1.25),  // 右后 RR - 调整 Y 值？
        new CANNON.Vec3(-0.75, 0.1, 1.32),  // 左前 FL - 调整 Y 值？
        new CANNON.Vec3(0.75, 0.1, 1.32)   // 右前 FR - 调整 Y 值？
        // 注意: Y 值 0.1 可能比之前的 -0.6 高很多，需确认
    ]);
    
    // 车轮数据 (用于传递给 Track 更新视觉)
    const wheelQuaternions = ref([]);
    const wheelPositions = ref([]); // (可选) 如果 Track 需要位置信息
    
    // 物理引擎准备就绪
    const onPhysicsReady = (data) => {
      world.value = data.world;
    };
    
    // 物理引擎更新
    const onPhysicsUpdate = () => {
      if (world.value) {
         // Update default contact material friction dynamically if needed
         // world.value.defaultContactMaterial.friction = groundFriction.value; 
         // Note: Continuously updating might have performance implications.
         // Better to update only when the value changes.
      }
      if (carController.value) { 
        carController.value.handlePhysicsUpdate(); 
      }

      // 其他比赛逻辑更新
      if (raceStatus.value === 'racing') {
        updateRaceTime();
        checkCheckpoints();
      }
    };
    
    // Watch for friction changes to update the world's default
    watch(groundFriction, (newFriction) => {
        if (world.value) {
            world.value.defaultContactMaterial.friction = newFriction;
        }
    });
    
    // 车辆准备就绪
    const onCarReady = () => {
      isLoading.value = false;
      isInitializingPhysics.value = false; // 重置调用锁
      startCountdown();
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
      
      // Apply custom settings to refs, falling back to defaults defined in setup() if not set
      if (currentVehicle.value?.customSettings) {
          const settings = currentVehicle.value.customSettings;
          enginePower.value = settings.enginePower ?? enginePower.value;
          turnStrength.value = settings.turnStrength ?? turnStrength.value;
          vehicleMass.value = settings.vehicleMass ?? vehicleMass.value;
          linearDamping.value = settings.linearDamping ?? linearDamping.value;
          angularDamping.value = settings.angularDamping ?? angularDamping.value;
          groundFriction.value = settings.groundFriction ?? groundFriction.value;
          brakePower.value = settings.brakePower ?? brakePower.value;
          slowDownForce.value = settings.slowDownForce ?? slowDownForce.value;
          suspensionStiffness.value = settings.suspensionStiffness ?? suspensionStiffness.value;
          suspensionRestLength.value = settings.suspensionRestLength ?? suspensionRestLength.value;
          frictionSlip.value = settings.frictionSlip ?? frictionSlip.value;
          dampingRelaxation.value = settings.dampingRelaxation ?? dampingRelaxation.value;
          dampingCompression.value = settings.dampingCompression ?? dampingCompression.value;
          maxSuspensionForce.value = settings.maxSuspensionForce ?? maxSuspensionForce.value;
          rollInfluence.value = settings.rollInfluence ?? rollInfluence.value;
          maxSuspensionTravel.value = settings.maxSuspensionTravel ?? maxSuspensionTravel.value;
          // Consider adding customSlidingRotationalSpeed, wheelRadius, connectionPoints if needed
          
          // 新增：加载车轮旋转修正设置
          initialCorrectionAxis.value = settings.initialCorrectionAxis ?? initialCorrectionAxis.value;
          initialCorrectionAngle.value = settings.initialCorrectionAngle ?? initialCorrectionAngle.value;
      }

      isLoadingVehicle.value = false; // 加载完成

      // 初始化检查点（在实际应用中这些会从赛道模型中获取）
      checkpoints.value = [
        { x: 10, y: 0, z: 0 },
        { x: 0, y: 0, z: 10 },
        { x: -10, y: 0, z: 0 },
        { x: 0, y: 0, z: -10 }
      ];
    });
    
    // 组件卸载
    onUnmounted(() => {
      // 清理逻辑
    });
    
    // 当 Track 组件的场景准备好时调用
    const onSceneReady = (emittedScene) => {
        scene.value = emittedScene;
    };
    
    // 添加 model-ready 事件处理函数
    const onModelReady = (model) => {
        carModel.value = model;
    };
    
    // 新增：事件处理函数，用于更新控制参数状态
    const handleMassUpdate = (newValue) => { vehicleMass.value = newValue; };
    const handleLinearDampingUpdate = (newValue) => { linearDamping.value = newValue; };
    const handleAngularDampingUpdate = (newValue) => { angularDamping.value = newValue; };
    const handleGroundFrictionUpdate = (newValue) => { 
        groundFriction.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.groundFriction = newValue;
    };
    const handleEnginePowerUpdate = (newValue) => { 
        enginePower.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.enginePower = newValue;
    };
    const handleBrakeForceUpdate = (newValue) => { 
        brakeForce.value = newValue; 
        // Note: brakeForce is not directly used by RaycastVehicle, brakePower is. Should we save this?
        // if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.brakeForce = newValue; 
    };
    const handleTurnStrengthUpdate = (newValue) => { 
        turnStrength.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.turnStrength = newValue;
    };
    const handleBrakePowerUpdate = (newValue) => { 
        brakePower.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.brakePower = newValue;
    };
    const handleSlowDownForceUpdate = (newValue) => { 
        slowDownForce.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.slowDownForce = newValue;
    };
    const handleSuspensionStiffnessUpdate = (newValue) => { 
        suspensionStiffness.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.suspensionStiffness = newValue;
    };
    const handleSuspensionRestLengthUpdate = (newValue) => { 
        suspensionRestLength.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.suspensionRestLength = newValue;
    };
    const handleFrictionSlipUpdate = (newValue) => { 
        frictionSlip.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.frictionSlip = newValue;
    };
    const handleDampingRelaxationUpdate = (newValue) => { 
        dampingRelaxation.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.dampingRelaxation = newValue;
    };
    const handleDampingCompressionUpdate = (newValue) => { 
        dampingCompression.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.dampingCompression = newValue;
    };
    const handleMaxSuspensionForceUpdate = (newValue) => { 
        maxSuspensionForce.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.maxSuspensionForce = newValue;
    };
    const handleRollInfluenceUpdate = (newValue) => { 
        rollInfluence.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.rollInfluence = newValue;
    };
    const handleMaxSuspensionTravelUpdate = (newValue) => { 
        maxSuspensionTravel.value = newValue; 
        if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.maxSuspensionTravel = newValue;
    };
    
    // 新增：处理车轮旋转修正更新
    const handleInitialCorrectionAxisUpdate = (newValue) => {
      initialCorrectionAxis.value = newValue;
      if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.initialCorrectionAxis = newValue;
    };
    const handleInitialCorrectionAngleUpdate = (newValue) => {
      initialCorrectionAngle.value = newValue;
      if (currentVehicle.value?.customSettings) currentVehicle.value.customSettings.initialCorrectionAngle = newValue;
    };
    
    // --- 新增: 保存调校设置到数据库 ---
    const saveTuning = async () => {
        if (currentVehicle.value && currentVehicle.value.id && currentVehicle.value.customSettings) {
            try {
            isLoading.value = true; // Use the general loading state  // Ensure customSettings object is clean and only contains relevant keys if needed
            await vehicleService.batchUpdateVehicle(currentVehicle.value.id, {
                customSettings: currentVehicle.value.customSettings
            });
            console.log('Tuning saved successfully.');
            // TODO: Add user feedback (e.g., toast notification)
            } catch (error) {
            console.error("Failed to save tuning:", error);
            // TODO: Add user feedback
            } finally {
            isLoading.value = false;
            }
        } else {
            console.warn("Cannot save tuning: No current vehicle, ID, or custom settings found.");
            // TODO: Add user feedback
        }
    };
    
    // --- 新增: 使用 watchEffect 触发 CarController 初始化 ---
    watchEffect(() => {

      // 检查所有依赖项和组件实例是否就绪，并且尚未开始初始化
      if (carController.value && world.value && scene.value && carModel.value && !isInitializingPhysics.value) {
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
      turnStrength,
      vehicleMass,
      linearDamping,
      angularDamping,
      groundFriction,
      brakePower,
      slowDownForce,
      suspensionStiffness,
      suspensionRestLength,
      frictionSlip,
      dampingRelaxation,
      dampingCompression,
      maxSuspensionForce,
      rollInfluence,
      maxSuspensionTravel,
      customSlidingRotationalSpeed,
      wheelRadius,
      connectionPoints,
      wheelQuaternions,
      wheelPositions,
      initialCorrectionAxis,
      initialCorrectionAngle,
      onPhysicsReady,
      onPhysicsUpdate,
      onSceneReady,
      onCarReady,
      onPositionUpdate,
      restartRace,
      formatTime,
      onModelReady,
      handleMassUpdate,
      handleLinearDampingUpdate,
      handleAngularDampingUpdate,
      handleGroundFrictionUpdate,
      handleEnginePowerUpdate,
      handleBrakeForceUpdate,
      handleTurnStrengthUpdate,
      handleBrakePowerUpdate,
      handleSlowDownForceUpdate,
      handleSuspensionStiffnessUpdate,
      handleSuspensionRestLengthUpdate,
      handleFrictionSlipUpdate,
      handleDampingRelaxationUpdate,
      handleDampingCompressionUpdate,
      handleMaxSuspensionForceUpdate,
      handleRollInfluenceUpdate,
      handleMaxSuspensionTravelUpdate,
      handleInitialCorrectionAxisUpdate,
      handleInitialCorrectionAngleUpdate,
      saveTuning, // Expose the save function
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