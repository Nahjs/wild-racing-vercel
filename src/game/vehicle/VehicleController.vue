<template>
  <div class="car-controller">
    <slot></slot>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch, watchEffect, defineExpose } from 'vue';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createVehicleChassis } from '@/game/vehicle/VehiclePhysics';
import { useInputControls } from '@/composables/useInputControls';
import { useTuningStore } from '@/store/tuning';
import { storeToRefs } from 'pinia';

export default {
  name: 'VehicleController',
  props: {
    world: {
      type: Object,
      required: true
    },
    scene: {
      type: Object,
      required: true
    },
    carModel: {
      type: Object,
      default: null
    },
    initialPosition: {
      type: Object,
      default: () => ({ x: 0, y: 1, z: 0 })
    },
    selectedVehicle: {
      type: Object,
      required: true
    },
    scale: {
      type: Number,
      default: 1.0
    },
    controlState: {
      type: Object,
      required: true,
      default: () => ({
        accelerate: false,
        brake: false,
        turnLeft: false,
        turnRight: false
      })
    }
  },
  setup(props, { emit }) {
    const tuningStore = useTuningStore();
    const { tuningParams } = storeToRefs(tuningStore);

    const chassisBody = ref(null);
    const vehicle = ref(null);
    const isReady = ref(false);

    const { controlState } = useInputControls();
    
    const localUp = new THREE.Vector3(0, 1, 0);
    
    const worldUp = new THREE.Vector3();
    const resetThreshold = 0.1;
    let justReset = false;
    let resetCooldownTimer = null;
    let handbrakeTimer = ref(0); // 新增：跟踪手刹持续时间
    let previousHandbrakeState = false; // 新增：记录上一帧的手刹状态
    
    const wheelRadius = computed(() => props.selectedVehicle?.wheelRadius ?? 0.34);
    
    // --- Watch for dynamic suspension updates ---
    watch(
      [
        () => tuningParams.value.suspensionStiffness,
        () => tuningParams.value.suspensionRestLength,
        () => tuningParams.value.frictionSlip,
        () => tuningParams.value.dampingRelaxation,
        () => tuningParams.value.dampingCompression,
        () => tuningParams.value.maxSuspensionForce,
        () => tuningParams.value.rollInfluence,
        () => tuningParams.value.maxSuspensionTravel,
        // Note: We don't watch customSlidingRotationalSpeed here as it might be less common to update live 
        // or might require physics reset depending on implementation.
      ],
      (newValues) => {
        if (isReady.value && vehicle.value) {
          const [
            stiffness, restLength, friction, dampRelax, dampComp, maxForce, rollInfluence, maxTravel
          ] = newValues;
          
          const currentScale = props.scale; // Get current scale for calculations

          vehicle.value.wheelInfos.forEach(wheelInfo => {
            wheelInfo.suspensionStiffness = stiffness;
            // Ensure restLength and maxTravel are scaled correctly if needed
            wheelInfo.suspensionRestLength = (restLength ?? 0.5) * currentScale; 
            wheelInfo.frictionSlip = friction;
            wheelInfo.dampingRelaxation = dampRelax;
            wheelInfo.dampingCompression = dampComp;
            wheelInfo.maxSuspensionForce = maxForce;
            wheelInfo.rollInfluence = rollInfluence;
            wheelInfo.maxSuspensionTravel = (maxTravel ?? 1) * currentScale;
          });
          console.log("VehicleController: Dynamically updated suspension parameters.");
        }
      },
      { deep: false } // Not deep, watching individual refs/values
    );
    // --- End dynamic suspension watch ---

    function initializePhysics() {
      if (isReady.value) return;
      try {
        createCarPhysics();
        isReady.value = true;
        emit('car-ready');
        
      } catch (error) {
        isReady.value = false;
      } finally {
      }
    };
    
    function createCarPhysics() {
      const position = new CANNON.Vec3(
        props.initialPosition.x * props.scale, 
        props.initialPosition.y * props.scale,
        props.initialPosition.z * props.scale
      );
      
      const { chassisBody: createdChassisBody } = createVehicleChassis(props.world, {
        position,
        mass: tuningStore.tuningParams.vehicleMass,
        linearDamping: tuningStore.tuningParams.linearDamping,
        angularDamping: tuningStore.tuningParams.angularDamping,
      });
      
      chassisBody.value = createdChassisBody;
      
      vehicle.value = new CANNON.RaycastVehicle({
        chassisBody: chassisBody.value,
        indexRightAxis: 0,
        indexUpAxis: 1,
        indexForwardAxis: 2
      });

      const currentScale = props.scale;

      const options = {
        radius: (wheelRadius.value || 0.34) * currentScale,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: tuningStore.tuningParams.suspensionStiffness,
        suspensionRestLength: (tuningStore.tuningParams.suspensionRestLength || 0.5) * currentScale,
        frictionSlip: tuningStore.tuningParams.frictionSlip,
        dampingRelaxation: tuningStore.tuningParams.dampingRelaxation,
        dampingCompression: tuningStore.tuningParams.dampingCompression,
        maxSuspensionForce: tuningStore.tuningParams.maxSuspensionForce,
        rollInfluence: tuningStore.tuningParams.rollInfluence,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
        maxSuspensionTravel: (tuningStore.tuningParams.maxSuspensionTravel || 1) * currentScale,
        customSlidingRotationalSpeed: tuningStore.tuningParams.customSlidingRotationalSpeed,
      };

      tuningParams.value.connectionPoints.forEach((point, index) => {
          const scaledConnectionPoint = new CANNON.Vec3(
            point.x * currentScale,
            point.y * currentScale,
            point.z * currentScale
          );
          vehicle.value.addWheel({
              ...options,
              chassisConnectionPointLocal: scaledConnectionPoint 
          });
      });
      
      vehicle.value.wheelInfos.forEach(wheel => {
        wheel.suspensionLength = (tuningStore.tuningParams.suspensionRestLength || 0.5) * currentScale;
      });
      
      vehicle.value.addToWorld(props.world);
    };
    
    // 使用 watchEffect 确保物理在条件满足时初始化
    // 将 watchEffect 移到函数声明之后
    watchEffect(() => {
       // 检查所有依赖项是否有效
      if (props.world && props.selectedVehicle && props.carModel && !isReady.value) {
            initializePhysics();
      } else if (!props.world || !props.selectedVehicle || !props.carModel) {
        // 如果依赖项失效 (例如车辆切换时)，确保清理旧的物理实体
        if (isReady.value) {
             cleanupPhysics(); // 现在可以安全调用
        }
      }
    });

    const updateCarModel = () => {
      if (props.carModel && vehicle.value && vehicle.value.chassisBody && 
          vehicle.value.chassisBody.position && vehicle.value.chassisBody.quaternion &&
          props.carModel.position && props.carModel.quaternion) {
          
        props.carModel.position.copy(vehicle.value.chassisBody.position);
        props.carModel.quaternion.copy(vehicle.value.chassisBody.quaternion);
        
        const wheelQuaternions = [];
        const wheelPositions = [];
        if (vehicle.value.wheelInfos) {
              for (let i = 0; i < vehicle.value.wheelInfos.length; i++) {
              vehicle.value.updateWheelTransform(i);
              const transform = vehicle.value.wheelInfos[i].worldTransform;
              
              if (transform && transform.quaternion && transform.position) {
                  const threeQuaternion = new THREE.Quaternion(
                      transform.quaternion.x,
                      transform.quaternion.y,
                      transform.quaternion.z,
                      transform.quaternion.w
                  );
                  const threePosition = new THREE.Vector3(
                      transform.position.x,
                      transform.position.y,
                      transform.position.z
                  );
                  wheelQuaternions.push(threeQuaternion);
                  wheelPositions.push(threePosition);
              }
            }
        }
        
        const currentSpeed = vehicle.value.chassisBody.velocity ? vehicle.value.chassisBody.velocity.length() : 0;
        
        emit('position-update', {
          position: vehicle.value.chassisBody.position.clone(),
          quaternion: vehicle.value.chassisBody.quaternion.clone(),
          velocity: vehicle.value.chassisBody.velocity ? vehicle.value.chassisBody.velocity.clone() : new CANNON.Vec3(),
          wheelQuaternions: wheelQuaternions,
          wheelPositions: wheelPositions,
          speed: currentSpeed
        });
      } else {
      }
    };
    
    const handlePhysicsUpdate = () => {
      // 增强检查：确保核心 props 和 isReady 都有效
      if (!isReady.value || !props.world || !props.scene || !props.carModel || !vehicle.value || !vehicle.value.chassisBody) {
        console.log("[VehicleController] handlePhysicsUpdate skipped: Not fully ready or props missing.");
        return; // 如果未就绪或 props 丢失，则提前返回
      }
      
      // 获取当前车速（km/h）
      const currentSpeed = vehicle.value.chassisBody.velocity.length() * 3.6; // 转换为km/h
      
      // 根据阿克曼转向原理计算转向角度
      const wheelBase = tuningParams.value.wheelBase || 2.8; // 轴距
      const trackWidth = tuningParams.value.trackWidth || 1.7; // 轮距
      const baseRadius = tuningParams.value.baseSteeringRadius || 8; // 基础转向半径
      const speedFactor = tuningParams.value.speedSteeringFactor || 0.1; // 速度影响因子
      
      // 计算速度相关的动态转向半径
      const dynamicRadius = baseRadius + Math.abs(currentSpeed) * speedFactor;
      
      // 获取转向输入
      const steerValue = (props.controlState.turnLeft ? 1 : 0) - (props.controlState.turnRight ? 1 : 0);
      
      // --- 动态获取转向轮索引 ---
      const steerLeftIndex = tuningParams.value.wheelIndices?.FL ?? 0;
      const steerRightIndex = tuningParams.value.wheelIndices?.FR ?? 1;
      
      // 应用阿克曼转向原理
      if (steerValue !== 0) {
        // 计算转向角度（内侧轮和外侧轮）
        const innerWheelAngle = Math.atan(wheelBase / (dynamicRadius - trackWidth/2));
        const outerWheelAngle = Math.atan(wheelBase / (dynamicRadius + trackWidth/2));
        
        // 高速漂移时转向感应度调整
        const isHighSpeed = currentSpeed > 60; // 60km/h以上视为高速
        const isDrifting = props.controlState.handbrake && handbrakeTimer.value > 0.2; // 手刹持续0.2秒以上视为漂移中
        
        // 计算转向强度修正因子 
        // 高速漂移时提供更精细的转向控制，防止过度转向
        let steeringFactor = tuningParams.value.turnStrength;
        if (isHighSpeed && isDrifting) {
          // 高速漂移时降低转向强度，使玩家可以更精细地控制
          const driftSteeringReduction = 0.3 + (Math.min(currentSpeed, 120) / 120) * 0.4; // 根据速度减少30%-70%的转向强度
          steeringFactor *= (1 - driftSteeringReduction);
        }
        
        // 根据转向方向（左/右）确定内侧和外侧轮
        if (steerValue > 0) { // 左转
          vehicle.value.setSteeringValue(innerWheelAngle * steeringFactor, steerLeftIndex);  // 左轮
          vehicle.value.setSteeringValue(outerWheelAngle * steeringFactor, steerRightIndex); // 右轮
        } else { // 右转
          vehicle.value.setSteeringValue(-outerWheelAngle * steeringFactor, steerLeftIndex);  // 左轮
          vehicle.value.setSteeringValue(-innerWheelAngle * steeringFactor, steerRightIndex); // 右轮
        }
      } else {
        // 不转向时重置
        vehicle.value.setSteeringValue(0, steerLeftIndex);
        vehicle.value.setSteeringValue(0, steerRightIndex);
      }
      // --- 结束转向计算 ---

      const forwardVelocityVec = vehicle.value.chassisBody.vectorToLocalFrame(vehicle.value.chassisBody.velocity);
      const forwardVelocity = forwardVelocityVec ? forwardVelocityVec.z : 0;
      const reverseThreshold = 0.5;

      // --- 动态获取驱动轮和刹车轮索引 (根据驱动类型) ---
      const wheelIndices = tuningParams.value.wheelIndices ?? { FL: 0, FR: 1, BL: 2, BR: 3 };
      let driveWheelIndices = [];
      const allWheelIndices = [wheelIndices.FL, wheelIndices.FR, wheelIndices.BL, wheelIndices.BR];

      switch (tuningParams.value.driveType) {
        case 'FWD':
          driveWheelIndices = [wheelIndices.FL, wheelIndices.FR];
          break;
        case 'AWD':
          driveWheelIndices = allWheelIndices;
          break;
        case 'RWD':
        default:
          driveWheelIndices = [wheelIndices.BL, wheelIndices.BR];
          break;
      }
      // 刹车通常作用于所有轮子
      const brakeWheelIndices = allWheelIndices;
      // 后轮索引（用于漂移）
      const rearWheelIndices = [wheelIndices.BL, wheelIndices.BR];
     
      // --- 重新启用地面接触检查日志 ---
      let driveWheelsOnGround = true;
      driveWheelIndices.forEach(index => {
          if (vehicle.value.wheelInfos && vehicle.value.wheelInfos[index] && !vehicle.value.wheelInfos[index].raycastResult.hasHit) {
              driveWheelsOnGround = false;
          }
      });
      if (!driveWheelsOnGround) {
      }
      // --- 结束检查 ---
      
      // 处理手刹状态
      if (props.controlState.handbrake) {
        // 手刹被按下，增加计时器
        if (!previousHandbrakeState) {
          handbrakeTimer.value = 0; // 如果是刚刚按下，重置计时器
        }
        handbrakeTimer.value += 1/60; // 增加计时器(假设60帧/秒)
        
        // 根据车速计算动态摩擦系数
        // 高速时提供更多抓地力以防止过度旋转
        const speedFactor = Math.min(Math.max(currentSpeed, 20) / 120, 1); // 将速度映射到0-1之间，20km/h以下视为低速
        const maxHandbrakeTime = 1.5; // 最大手刹效果时间(秒)
        const timeFactor = Math.min(handbrakeTimer.value / maxHandbrakeTime, 1); // 手刹时间因子，限制在0-1之间
        
        // 计算动态漂移摩擦系数：
        // - 高速时摩擦系数更高(更多抓地力)
        // - 手刹时间越长，摩擦系数越低(更容易漂移)
        const baseDriftFriction = tuningParams.value.driftFrictionSlip || 12.0;
        const speedAdjustment = speedFactor * 8.0; // 高速时增加抓地力
        const timeReduction = timeFactor * 5.0;   // 随着时间增加减少抓地力
        
        // 最终摩擦系数：基础值 + 速度调整 - 时间降低
        const dynamicDriftFriction = Math.max(baseDriftFriction + speedAdjustment - timeReduction, 5.0);
        
        // 应用到后轮
        rearWheelIndices.forEach(index => {
          if (vehicle.value.wheelInfos && vehicle.value.wheelInfos[index]) {
            vehicle.value.wheelInfos[index].frictionSlip = dynamicDriftFriction;
          }
        });
        
        // 应用手刹制动力 (也随车速调整)
        const handbrakePower = (tuningParams.value.handbrakePower || 65) * (1 - speedFactor * 0.3);
        rearWheelIndices.forEach(index => {
          vehicle.value.setBrake(handbrakePower, index);
        });
        
        // 在手刹状态下，前轮保持正常摩擦力
        const normalFriction = tuningParams.value.normalFrictionSlip || 30;
        [wheelIndices.FL, wheelIndices.FR].forEach(index => {
          if (vehicle.value.wheelInfos && vehicle.value.wheelInfos[index]) {
            vehicle.value.wheelInfos[index].frictionSlip = normalFriction;
          }
        });
      } else {
        // 手刹释放
        // 如果刚刚松开手刹，实现平滑过渡
        if (previousHandbrakeState) {
          // 随时间逐渐恢复正常摩擦系数
          const recoveryTime = 0.5; // 完全恢复需要的秒数
          const normalFriction = tuningParams.value.normalFrictionSlip || 30;
          const currentDriftFriction = vehicle.value.wheelInfos[rearWheelIndices[0]]?.frictionSlip || normalFriction;
          
          // 计算恢复步进
          const frictionStep = (normalFriction - currentDriftFriction) / (recoveryTime * 60); // 假设60帧/秒
          
          // 逐步恢复所有轮子的正常摩擦系数
          allWheelIndices.forEach(index => {
            if (vehicle.value.wheelInfos && vehicle.value.wheelInfos[index]) {
              const currentFriction = vehicle.value.wheelInfos[index].frictionSlip;
              // 如果当前值低于正常值，逐步增加
              if (currentFriction < normalFriction) {
                vehicle.value.wheelInfos[index].frictionSlip = Math.min(currentFriction + frictionStep, normalFriction);
              } else {
                vehicle.value.wheelInfos[index].frictionSlip = normalFriction;
              }
            }
          });
          
          // 重置手刹计时器
          handbrakeTimer.value = 0;
        } else {
          // 如果已经处于正常状态一段时间，直接设置为正常摩擦系数
          const normalFriction = tuningParams.value.normalFrictionSlip || 30;
          allWheelIndices.forEach(index => {
            if (vehicle.value.wheelInfos && vehicle.value.wheelInfos[index]) {
              vehicle.value.wheelInfos[index].frictionSlip = normalFriction;
            }
          });
        }
      }
      
      // 更新上一帧的手刹状态
      previousHandbrakeState = props.controlState.handbrake;
      
      // 处理加速和刹车
      if (props.controlState.accelerate) {
          // 使用 brakeWheelIndices 清除所有轮子的刹车
          brakeWheelIndices.forEach(index => vehicle.value.setBrake(0, index));

          const force = -tuningStore.tuningParams.enginePower;
          if (driveWheelsOnGround) {
              // 使用 driveWheelIndices 施加驱动力
              driveWheelIndices.forEach(index => vehicle.value.applyEngineForce(force, index));
          } else {
          }
      } else if (props.controlState.brake) {
        if (forwardVelocity < reverseThreshold) {
            // 使用 brakeWheelIndices 清除所有轮子的刹车
          brakeWheelIndices.forEach(index => vehicle.value.setBrake(0, index));

          const reverseForce = tuningStore.tuningParams.enginePower * 0.5;
          if (driveWheelsOnGround) {
              // 使用 driveWheelIndices 施加倒车力
              driveWheelIndices.forEach(index => vehicle.value.applyEngineForce(reverseForce, index));
          } else {
          }
        } else {
              // 清除引擎力
           driveWheelIndices.forEach(index => vehicle.value.applyEngineForce(0, index));

             // 使用 brakeWheelIndices 施加刹车力
           brakeWheelIndices.forEach(index => vehicle.value.setBrake(tuningStore.tuningParams.brakePower, index));
        }
      } else {
            // 清除引擎力
         driveWheelIndices.forEach(index => vehicle.value.applyEngineForce(0, index));
         
         // 如果不在手刹状态，则应用轻微刹车
         if (!props.controlState.handbrake) {
           // 使用 brakeWheelIndices 施加减速力 (轻微刹车)
           brakeWheelIndices.forEach(index => vehicle.value.setBrake(tuningStore.tuningParams.slowDownForce, index));
         }
      }

      if (!justReset && chassisBody.value && chassisBody.value.quaternion) {
          const vehicleQuaternion = new THREE.Quaternion(
              chassisBody.value.quaternion.x,
              chassisBody.value.quaternion.y,
              chassisBody.value.quaternion.z,
              chassisBody.value.quaternion.w
          );
          worldUp.copy(localUp).applyQuaternion(vehicleQuaternion);
          if (worldUp.y < resetThreshold) {
              resetCar();
              justReset = true;
              if(resetCooldownTimer) clearTimeout(resetCooldownTimer);
              resetCooldownTimer = setTimeout(() => {
                  justReset = false;
              }, 3000);
          }
      }
      
      updateCarModel();
    };
    
    const speed = computed(() => {
      if (chassisBody.value) {
        return chassisBody.value.velocity.length();
      }
      return 0;
    });
    
    const resetCar = (newPosition) => {
      if (chassisBody.value) {
        chassisBody.value.velocity.set(0, 0, 0);
        chassisBody.value.angularVelocity.set(0, 0, 0);
        
        if (newPosition) {
          chassisBody.value.position.copy(newPosition);
        } else {
          chassisBody.value.position.set(
            props.initialPosition.x, 
            props.initialPosition.y + 0.5, 
            props.initialPosition.z
          );
        }
        chassisBody.value.quaternion.set(0, 0, 0, 1);
        updateCarModel();
      }
    };
    
    function cleanupPhysics() {
      if (props.world && vehicle.value) {
        vehicle.value.removeFromWorld(props.world);
        // 可能还需要清理 chassisBody (如果 RaycastVehicle 不自动处理)
        // props.world.removeBody(chassisBody.value); // 可能不需要
        vehicle.value = null; // 清除引用
        chassisBody.value = null; // 清除引用
        isReady.value = false; // 重置状态
      }
      if (resetCooldownTimer) {
          clearTimeout(resetCooldownTimer);
          resetCooldownTimer = null;
      }
    };
    
    onMounted(() => {
      // 不再需要在这里初始化物理
      // if (!props.world || !props.scene || !props.selectedVehicle) {
      // }, 50);
      // } else {
      // console.warn("VehicleController: Cannot reinitialize physics, world or vehicle data missing.");
      // }
    });
    
    onUnmounted(() => {
      cleanupPhysics(); // 在卸载时调用清理
    });
    
    // onMounted 现在可以保持为空或用于其他非物理初始化逻辑
    onMounted(() => {
      // 不再需要在这里初始化物理
      // if (!props.world || !props.scene || !props.selectedVehicle) {
      // }, 50);
      // } else {
      // console.warn("VehicleController: Cannot reinitialize physics, world or vehicle data missing.");
      // }
    });
    
    // 移除旧的 watch, 因为 watchEffect 覆盖了初始化和部分清理逻辑
    // 如果还需要监听特定 tuning 参数变化来重建物理，可以保留或重写该 watch
    // 例如，只监听需要完全重建物理的参数（如 connectionPoints, mass 等）
    // Watch for specific parameters that require full physics reinitialization
    watch(
      [
        () => tuningParams.value.connectionPoints, // 示例：连接点变化需要重建
        () => tuningParams.value.vehicleMass,      // 示例：质量变化需要重建
        // 添加其他需要完全重建物理的参数
        // () => props.scale, // 缩放可能也需要重建
      ],
      (newValues, oldValues) => {
        // 仅当物理已就绪且值确实发生变化时才重建
        if (isReady.value && JSON.stringify(newValues) !== JSON.stringify(oldValues)) {
            console.log("VehicleController: Rebuilding physics due to core parameter change (mass/connectionPoints).");
            cleanupPhysics();
          // 让 watchEffect 来处理重新初始化
          // initializePhysics(); // 不再直接调用
        }
      },
      { deep: true }
    );
    
    return {
      vehicle,
      speed,
      isReady,
      initializePhysics,
      resetCar,
      handlePhysicsUpdate,
      cleanupPhysics,
    };

    // Explicitly expose necessary methods/refs
    defineExpose({
      handlePhysicsUpdate,
      initializePhysics,
      resetCar,
      cleanupPhysics,
      isReady,
      speed,
      vehicle // Expose vehicle for potential debugging
    });
  }
};
</script>

<style scoped>
.car-controller {
  position: relative;
  width: 100%;
  height: 100%;
}
</style> 