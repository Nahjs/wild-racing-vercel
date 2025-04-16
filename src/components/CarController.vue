<template>
  <div class="car-controller">
    <slot></slot>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createVehicle, createWheel, applyDriveControls } from '../utils/physics';
import { ControlState, KeyboardController, TouchController } from '../utils/controls';
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
    carOptions: {
      type: Object,
      default: () => ({})
    },
    selectedVehicle: {
      type: Object,
      required: true
    }
  },
  setup(props, { emit }) {
    const chassis = ref(null);
    const wheels = ref([]);
    const controlState = ref(new ControlState());
    const keyboardController = ref(null);
    const touchController = ref(null);
    const isReady = ref(false);
    const vehicle = ref(null);
    const controls = ref({
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false
    });
    
    // 创建车辆物理体
    const createCarPhysics = () => {
      const position = new CANNON.Vec3(
        props.initialPosition.x, 
        props.initialPosition.y, 
        props.initialPosition.z
      );
      
      // 创建车辆主体
      const { chassisBody } = createVehicle(props.world, {
        position,
        ...props.carOptions
      });
      
      chassis.value = chassisBody;
      
      // 创建四个车轮
      const wheelRadius = 0.5;
      const wheelPositions = [
        new CANNON.Vec3(-1, -0.6, 1),    // 左前
        new CANNON.Vec3(1, -0.6, 1),     // 右前
        new CANNON.Vec3(-1, -0.6, -1),   // 左后
        new CANNON.Vec3(1, -0.6, -1)     // 右后
      ];
      
      wheelPositions.forEach(pos => {
        const { wheelBody } = createWheel(props.world, chassisBody, pos, wheelRadius);
        wheels.value.push(wheelBody);
      });
      
      // 初始化控制器
      keyboardController.value = new KeyboardController(controlState.value);
      touchController.value = new TouchController(controlState.value);
      
      isReady.value = true;
      
      // 注意：此处不再触发 car-ready，统一在 onMounted 中触发
    };
    
    // 更新车辆位置和方向
    const updateCarModel = () => {
      if (props.carModel && chassis.value) {
        // 将物理模型的位置和旋转同步到3D模型
        props.carModel.position.copy(chassis.value.position);
        props.carModel.quaternion.copy(chassis.value.quaternion);
        
        // 通知父组件位置更新
        emit('position-update', {
          position: chassis.value.position,
          quaternion: chassis.value.quaternion,
          velocity: chassis.value.velocity
        });
      }
    };
    
    // 物理更新处理函数
    const handlePhysicsUpdate = () => {
      if (isReady.value && chassis.value) {
        // 应用驾驶控制
        applyDriveControls(chassis.value, wheels.value, controlState.value);
        
        // 更新3D模型位置
        updateCarModel();
      }
    };
    
    // 获取车辆速度
    const speed = computed(() => {
      if (chassis.value) {
        return chassis.value.velocity.length();
      }
      return 0;
    });
    
    // 重置车辆位置
    const resetCar = (newPosition) => {
      if (chassis.value) {
        // 重置速度和角速度
        chassis.value.velocity.set(0, 0, 0);
        chassis.value.angularVelocity.set(0, 0, 0);
        
        // 设置新位置
        if (newPosition) {
          chassis.value.position.copy(newPosition);
        } else {
          chassis.value.position.set(
            props.initialPosition.x, 
            props.initialPosition.y, 
            props.initialPosition.z
          );
        }
        
        // 重置旋转
        chassis.value.quaternion.set(0, 0, 0, 1);
        
        // 更新3D模型位置
        updateCarModel();
      }
    };
    
    // 组件挂载时创建车辆
    onMounted(async () => {
      console.log("CarController: onMounted - Start");
      if (props.world && props.scene && props.selectedVehicle) {
        console.log("CarController: World, Scene, and SelectedVehicle exist.");
        try {
          console.log(`CarController: Attempting to load vehicle config for ID: ${props.selectedVehicle.id}`);
          const vehicleData = await vehicleService.getVehicle(props.selectedVehicle.id);
          console.log("CarController: Vehicle config loaded:", vehicleData);
          
          console.log("CarController: Calling createCarPhysics...");
          createCarPhysics();
          console.log("CarController: createCarPhysics finished.");
          
          console.log("CarController: Emitting car-ready event...");
          emit('car-ready');
          console.log("CarController: car-ready event emitted.");
          
        } catch (error) {
          console.error("CarController: Failed to load vehicle config or create physics:", error);
        } finally {
          console.log("CarController: onMounted - Try/Catch block finished.");
        }
      } else {
        console.warn("CarController: World, Scene, or SelectedVehicle missing on mount.", 
          { world: !!props.world, scene: !!props.scene, vehicle: !!props.selectedVehicle });
      }
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    });
    
    // 组件卸载时清理
    onUnmounted(() => {
      // 清理物理体
      if (props.world && chassis.value) {
        props.world.removeBody(chassis.value);
        
        wheels.value.forEach(wheel => {
          props.world.removeBody(wheel);
        });
      }
      
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    });
    
    const handleKeyDown = (event) => {
      switch(event.key) {
        case 'w':
          controls.value.forward = true;
          break;
        case 's':
          controls.value.backward = true;
          break;
        case 'a':
          controls.value.left = true;
          break;
        case 'd':
          controls.value.right = true;
          break;
        case ' ':
          controls.value.brake = true;
          break;
      }
    };

    const handleKeyUp = (event) => {
      switch(event.key) {
        case 'w':
          controls.value.forward = false;
          break;
        case 's':
          controls.value.backward = false;
          break;
        case 'a':
          controls.value.left = false;
          break;
        case 'd':
          controls.value.right = false;
          break;
        case ' ':
          controls.value.brake = false;
          break;
      }
    };

    const update = (deltaTime) => {
      if (vehicle.value) {
        applyDriveControls(vehicle.value, controls.value, deltaTime);
      }
    };
    
    // 暴露给父组件的方法和属性
    return {
      chassis,
      wheels,
      controlState,
      speed,
      isReady,
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