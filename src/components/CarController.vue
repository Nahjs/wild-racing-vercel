<template>
  <div class="car-controller">
    <slot></slot>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch, watchEffect, defineExpose } from 'vue';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createVehicleChassis } from '../utils/physics';
import { ControlState, KeyboardController, TouchController, configureControls } from '../utils/controls';
import { vehicleService } from '../services/vehicleService';

export default {
  name: 'CarController',
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
    enginePower: {
      type: Number,
      required: true
    },
    turnStrength: {
      type: Number,
      required: true
    },
    vehicleMass: {
      type: Number,
      required: true
    },
    linearDamping: {
      type: Number,
      required: true
    },
    angularDamping: {
      type: Number,
      required: true
    },
    brakePower: {
      type: Number,
      default: 36
    },
    slowDownForce: {
      type: Number,
      default: 19.6
    },
    suspensionStiffness: { type: Number, default: 55 },
    suspensionRestLength: { type: Number, default: 0.5 },
    frictionSlip: { type: Number, default: 30 },
    dampingRelaxation: { type: Number, default: 2.3 },
    dampingCompression: { type: Number, default: 4.3 },
    maxSuspensionForce: { type: Number, default: 10000 },
    rollInfluence: { type: Number, default: 0.01 },
    maxSuspensionTravel: { type: Number, default: 1 },
    customSlidingRotationalSpeed: { type: Number, default: 30 },
    wheelRadius: { type: Number, default: 0.34 },
    connectionPoints: {
      type: Array,
      default: () => [
        new CANNON.Vec3(-0.78, 0.1, -1.25),
        new CANNON.Vec3(0.78, 0.1, -1.25),
        new CANNON.Vec3(-0.75, 0.1, 1.32),
        new CANNON.Vec3(0.75, 0.1, 1.32)
      ]
    }
  },
  setup(props, { emit }) {
    const chassisBody = ref(null);
    const vehicle = ref(null);
    const controlState = ref(new ControlState());
    const keyboardController = ref(null);
    const touchController = ref(null);
    const isReady = ref(false);
    
    const localUp = new THREE.Vector3(0, 1, 0);
    const worldUp = new THREE.Vector3();
    const resetThreshold = 0.1;
    let justReset = false;
    let resetCooldownTimer = null;
    
    const initializePhysics = () => {
      if (isReady.value) return;
      try {
        createCarPhysics();
        isReady.value = true;
        emit('car-ready');
        
      } catch (error) {
        console.error("CarController: Failed to initialize physics:", error);
        isReady.value = false;
      } finally {
        console.log("CarController: initializePhysics attempt finished.");
      }
    };
    
    const createCarPhysics = () => {
      const position = new CANNON.Vec3(
        props.initialPosition.x, 
        props.initialPosition.y,
        props.initialPosition.z
      );
      
      const { chassisBody: createdChassisBody } = createVehicleChassis(props.world, {
        position,
        mass: props.vehicleMass,
        linearDamping: props.linearDamping,
        angularDamping: props.angularDamping,
      });
      
      chassisBody.value = createdChassisBody;
      
      vehicle.value = new CANNON.RaycastVehicle({
        chassisBody: chassisBody.value,
        indexRightAxis: 0,
        indexUpAxis: 1,
        indexForwardAxis: 2
      });

      const options = {
        radius: props.wheelRadius,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: props.suspensionStiffness,
        suspensionRestLength: props.suspensionRestLength,
        frictionSlip: props.frictionSlip,
        dampingRelaxation: props.dampingRelaxation,
        dampingCompression: props.dampingCompression,
        maxSuspensionForce: props.maxSuspensionForce,
        rollInfluence: props.rollInfluence,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
        maxSuspensionTravel: props.maxSuspensionTravel,
        customSlidingRotationalSpeed: props.customSlidingRotationalSpeed,
      };

      props.connectionPoints.forEach((connectionPoint, index) => {
          vehicle.value.addWheel({
              ...options,
              chassisConnectionPointLocal: connectionPoint
          });
      });
      
      vehicle.value.wheelInfos.forEach(wheel => {
        wheel.suspensionLength = props.suspensionRestLength;
      });
      
      vehicle.value.addToWorld(props.world);
      
      keyboardController.value = new KeyboardController(controlState.value);
    };
    
    const updateCarModel = () => {
      if (props.carModel && vehicle.value) {
        props.carModel.position.copy(vehicle.value.chassisBody.position);
        props.carModel.quaternion.copy(vehicle.value.chassisBody.quaternion);
        
        const wheelQuaternions = [];
        const wheelPositions = [];
        for (let i = 0; i < vehicle.value.wheelInfos.length; i++) {
          vehicle.value.updateWheelTransform(i);
          const transform = vehicle.value.wheelInfos[i].worldTransform;
          
          // --- 转换类型 --- 
          // 从 CANNON.Quaternion 转换为 THREE.Quaternion
          const threeQuaternion = new THREE.Quaternion(
              transform.quaternion.x,
              transform.quaternion.y,
              transform.quaternion.z,
              transform.quaternion.w
          );
          // 从 CANNON.Vec3 转换为 THREE.Vector3
          const threePosition = new THREE.Vector3(
              transform.position.x,
              transform.position.y,
              transform.position.z
          );

          // 推入转换后的 Three.js 对象
          wheelQuaternions.push(threeQuaternion);
          wheelPositions.push(threePosition);
        }
        
        // Calculate speed here
        const currentSpeed = vehicle.value.chassisBody.velocity.length();
        
        emit('position-update', {
          position: vehicle.value.chassisBody.position.clone(),
          quaternion: vehicle.value.chassisBody.quaternion.clone(),
          velocity: vehicle.value.chassisBody.velocity.clone(),
          wheelQuaternions: wheelQuaternions,
          wheelPositions: wheelPositions,
          speed: currentSpeed // Add speed to the payload
        });
      }
    };
    
    const handlePhysicsUpdate = () => {
      if (isReady.value && vehicle.value) {
        const steerValue = (controlState.value.turnLeft ? 1 : 0) - (controlState.value.turnRight ? 1 : 0);
        const actualSteer = steerValue * props.turnStrength;

        vehicle.value.setSteeringValue(actualSteer, 2);
        vehicle.value.setSteeringValue(actualSteer, 3);

        const forwardVelocity = vehicle.value.chassisBody.vectorToLocalFrame(vehicle.value.chassisBody.velocity).z; // Get speed along forward axis
        const reverseThreshold = 0.5; // Speed threshold to switch between braking and reversing

        if (controlState.value.accelerate) {
            // Accelerate: Apply negative force (based on CANNON convention)
            vehicle.value.setBrake(0, 0);
            vehicle.value.setBrake(0, 1);
            vehicle.value.setBrake(0, 2);
            vehicle.value.setBrake(0, 3);
            const force = -props.enginePower;
            // Apply force to drive wheels (e.g., rear wheels 0 and 1)
            vehicle.value.applyEngineForce(force, 0); // RL
            vehicle.value.applyEngineForce(force, 1); // RR
            // If AWD:
            // vehicle.value.applyEngineForce(force, 2); // FL
            // vehicle.value.applyEngineForce(force, 3); // FR
        } else if (controlState.value.brake) {
            // Brake or Reverse
            if (forwardVelocity < reverseThreshold) {
                // Reverse: Apply positive force
                vehicle.value.setBrake(0, 0); // Release brakes
                vehicle.value.setBrake(0, 1);
                vehicle.value.setBrake(0, 2);
                vehicle.value.setBrake(0, 3);
                const reverseForce = props.enginePower * 0.5; // Example: reverse power is half of forward power
                vehicle.value.applyEngineForce(reverseForce, 0); // RL
                vehicle.value.applyEngineForce(reverseForce, 1); // RR
                // If AWD:
                // vehicle.value.applyEngineForce(reverseForce, 2); // FL
                // vehicle.value.applyEngineForce(reverseForce, 3); // FR
            } else {
                // Brake: Apply brake power
                vehicle.value.applyEngineForce(0, 0); // Stop engine force
                vehicle.value.applyEngineForce(0, 1);
                vehicle.value.applyEngineForce(0, 2);
                vehicle.value.applyEngineForce(0, 3);
                vehicle.value.setBrake(props.brakePower, 0); // Apply brakes (adjust which wheels brake if needed)
                vehicle.value.setBrake(props.brakePower, 1);
                vehicle.value.setBrake(props.brakePower, 2);
                vehicle.value.setBrake(props.brakePower, 3);
            }
        } else {
            // No input: Apply passive slowdown/drag and release brakes
            vehicle.value.applyEngineForce(0, 0);
            vehicle.value.applyEngineForce(0, 1);
            vehicle.value.applyEngineForce(0, 2);
            vehicle.value.applyEngineForce(0, 3);
            // Apply a small brake force to simulate drag/engine braking
            vehicle.value.setBrake(props.slowDownForce, 0);
            vehicle.value.setBrake(props.slowDownForce, 1);
            vehicle.value.setBrake(props.slowDownForce, 2);
            vehicle.value.setBrake(props.slowDownForce, 3);
        }

        if (!justReset && chassisBody.value) { 
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
      }
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
    
    watch(() => [props.enginePower, props.brakePower, props.turnStrength], ([power, brake, turn]) => {
      console.log(`CarController: Control params props changed - Power: ${power}, Brake: ${brake}, Turn: ${turn}`);
    });
    
    watch(() => props.vehicleMass, (newMass) => {
      if (chassisBody.value) {
        chassisBody.value.mass = newMass;
        chassisBody.value.updateMassProperties();
      }
    });
    watch(() => props.linearDamping, (newDamping) => {
      if (chassisBody.value) {
        chassisBody.value.linearDamping = newDamping;
      }
    });
    watch(() => props.angularDamping, (newDamping) => {
      if (chassisBody.value) {
        chassisBody.value.angularDamping = newDamping;
      }
    });

    onMounted(() => {
      if (!props.world || !props.scene || !props.selectedVehicle) {
           console.warn("CarController: World, Scene, or SelectedVehicle missing on mount. Initialization delayed.");
           return; 
      }
    });
    
    onUnmounted(() => {
      if (props.world && vehicle.value) {
        vehicle.value.removeFromWorld(props.world);
      }
      
      if (keyboardController.value) {
          keyboardController.value.removeListeners();
      }
      if (touchController.value) {
          touchController.value.removeListeners();
      }
      
      if (resetCooldownTimer) {
          clearTimeout(resetCooldownTimer);
      }
    });
    
    const update = (deltaTime) => {
      console.warn("CarController update function called, but may be unused with RaycastVehicle.");
    };
    
    return {
      vehicle,
      controlState,
      speed,
      isReady,
      initializePhysics,
      resetCar,
      handlePhysicsUpdate,
      update
    };
  }
};
</script>

<style scoped>
.car-controller {
  position: relative;
}
</style> 