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
      
      // 使用 props.controlState
      const steerValue = (props.controlState.turnLeft ? 1 : 0) - (props.controlState.turnRight ? 1 : 0);
      const actualSteer = steerValue * tuningStore.tuningParams.turnStrength;

      // --- 动态获取转向轮索引 ---
      const steerLeftIndex = tuningParams.value.wheelIndices?.FL ?? 0;
      const steerRightIndex = tuningParams.value.wheelIndices?.FR ?? 1;
      vehicle.value.setSteeringValue(actualSteer, steerLeftIndex);
      vehicle.value.setSteeringValue(actualSteer, steerRightIndex);
      // --- 结束 ---

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
         // 使用 brakeWheelIndices 施加减速力 (轻微刹车)
         brakeWheelIndices.forEach(index => vehicle.value.setBrake(tuningStore.tuningParams.slowDownForce, index));
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