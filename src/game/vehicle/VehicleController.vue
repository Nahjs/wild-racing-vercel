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
import { vehicleService } from '@/services/vehicleService';
import { useTuningStore } from '@/store/tuning';

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
  },
  setup(props, { emit }) {
    const tuningStore = useTuningStore();

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
    const connectionPoints = computed(() => props.selectedVehicle?.connectionPoints ?? [
      new CANNON.Vec3(-0.78, 0.1, -1.25),
      new CANNON.Vec3(0.78, 0.1, -1.25),
      new CANNON.Vec3(-0.75, 0.1, 1.32),
      new CANNON.Vec3(0.75, 0.1, 1.32)
    ]);
    const customSlidingRotationalSpeed = computed(() => tuningStore.tuningParams.customSlidingRotationalSpeed ?? 30);
    
    const initializePhysics = () => {
      if (isReady.value) return;
      try {
        createCarPhysics();
        isReady.value = true;
        emit('car-ready');
        
      } catch (error) {
        console.error("VehicleController: Failed to initialize physics:", error);
        isReady.value = false;
      } finally {
        console.log("VehicleController: initializePhysics attempt finished.");
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

      const options = {
        radius: wheelRadius.value,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: tuningStore.tuningParams.suspensionStiffness,
        suspensionRestLength: tuningStore.tuningParams.suspensionRestLength,
        frictionSlip: tuningStore.tuningParams.frictionSlip,
        dampingRelaxation: tuningStore.tuningParams.dampingRelaxation,
        dampingCompression: tuningStore.tuningParams.dampingCompression,
        maxSuspensionForce: tuningStore.tuningParams.maxSuspensionForce,
        rollInfluence: tuningStore.tuningParams.rollInfluence,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
        maxSuspensionTravel: tuningStore.tuningParams.maxSuspensionTravel,
        customSlidingRotationalSpeed: customSlidingRotationalSpeed.value,
      };

      connectionPoints.value.forEach((connectionPoint, index) => {
          vehicle.value.addWheel({
              ...options,
              chassisConnectionPointLocal: connectionPoint
          });
      });
      
      vehicle.value.wheelInfos.forEach(wheel => {
        wheel.suspensionLength = tuningStore.tuningParams.suspensionRestLength;
      });
      
      vehicle.value.addToWorld(props.world);
    };
    
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
          console.warn("updateCarModel skipped: carModel or vehicle physics not ready.");
      }
    };
    
    const handlePhysicsUpdate = () => {
      if (isReady.value && vehicle.value && vehicle.value.chassisBody && props.carModel) {
        const steerValue = (controlState.value.turnLeft ? 1 : 0) - (controlState.value.turnRight ? 1 : 0);
        const actualSteer = steerValue * tuningStore.tuningParams.turnStrength;

        vehicle.value.setSteeringValue(actualSteer, 2);
        vehicle.value.setSteeringValue(actualSteer, 3);

        const forwardVelocityVec = vehicle.value.chassisBody.vectorToLocalFrame(vehicle.value.chassisBody.velocity);
        const forwardVelocity = forwardVelocityVec ? forwardVelocityVec.z : 0;
        const reverseThreshold = 0.5;

        if (controlState.value.accelerate) {
            vehicle.value.setBrake(0, 0);
            vehicle.value.setBrake(0, 1);
            vehicle.value.setBrake(0, 2);
            vehicle.value.setBrake(0, 3);
            const force = -tuningStore.tuningParams.enginePower;
            vehicle.value.applyEngineForce(force, 0);
            vehicle.value.applyEngineForce(force, 1);
        } else if (controlState.value.brake) {
            if (forwardVelocity < reverseThreshold) {
                vehicle.value.setBrake(0, 0);
                vehicle.value.setBrake(0, 1);
                vehicle.value.setBrake(0, 2);
                vehicle.value.setBrake(0, 3);
                const reverseForce = tuningStore.tuningParams.enginePower * 0.5;
                vehicle.value.applyEngineForce(reverseForce, 0);
                vehicle.value.applyEngineForce(reverseForce, 1);
            } else {
                vehicle.value.applyEngineForce(0, 0);
                vehicle.value.applyEngineForce(0, 1);
                vehicle.value.applyEngineForce(0, 2);
                vehicle.value.applyEngineForce(0, 3);
                vehicle.value.setBrake(tuningStore.tuningParams.brakePower, 0);
                vehicle.value.setBrake(tuningStore.tuningParams.brakePower, 1);
                vehicle.value.setBrake(tuningStore.tuningParams.brakePower, 2);
                vehicle.value.setBrake(tuningStore.tuningParams.brakePower, 3);
            }
        } else {
            vehicle.value.applyEngineForce(0, 0);
            vehicle.value.applyEngineForce(0, 1);
            vehicle.value.applyEngineForce(0, 2);
            vehicle.value.applyEngineForce(0, 3);
            vehicle.value.setBrake(tuningStore.tuningParams.slowDownForce, 0);
            vehicle.value.setBrake(tuningStore.tuningParams.slowDownForce, 1);
            vehicle.value.setBrake(tuningStore.tuningParams.slowDownForce, 2);
            vehicle.value.setBrake(tuningStore.tuningParams.slowDownForce, 3);
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
    
    onMounted(() => {
      if (!props.world || !props.scene || !props.selectedVehicle) {
           console.warn("VehicleController: World, Scene, or SelectedVehicle missing on mount. Initialization delayed.");
           return; 
      }
    });
    
    onUnmounted(() => {
      if (props.world && vehicle.value) {
        vehicle.value.removeFromWorld(props.world);
      }
      
      if (resetCooldownTimer) {
          clearTimeout(resetCooldownTimer);
      }
    });
    
    return {
      vehicle,
      speed,
      isReady,
      initializePhysics,
      resetCar,
      handlePhysicsUpdate,
    };
  }
};
</script>

<style scoped>
.car-controller {
  position: relative;
}
</style> 