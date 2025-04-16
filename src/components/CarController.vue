<template>
  <div class="car-controller">
    <slot></slot>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createVehicle, createWheel, applyDriveControls } from '../utils/physics';
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
    carOptions: {
      type: Object,
      default: () => ({})
    },
    selectedVehicle: {
      type: Object,
      required: true
    },
    enginePower: {
      type: Number,
      required: true
    },
    brakeForce: {
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
    
    // 用于检测翻转的变量
    const localUp = new THREE.Vector3(0, 1, 0); // 车辆的局部向上向量
    const worldUp = new THREE.Vector3();        // 转换到世界坐标后的向上向量
    const resetThreshold = 0.1;                 // 判定为翻转的阈值 (Y分量小于此值)
    let justReset = false;                      // 防止连续重置的标志
    let resetCooldownTimer = null;              // 重置冷却计时器
    
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
        mass: props.vehicleMass,
        linearDamping: props.linearDamping,
        angularDamping: props.angularDamping,
        ...props.carOptions
      });
      
      chassis.value = chassisBody;
      
      // --- 添加日志：检查物理体属性 ---
      console.log(`CarController: chassisBody created. Mass: ${chassisBody.mass}, LinearDamping: ${chassisBody.linearDamping}, AngularDamping: ${chassisBody.angularDamping}`);
      
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
      // --- 暂时注释掉 TouchController 的初始化 ---
      // touchController.value = new TouchController(controlState.value);
      console.log("TouchController temporarily disabled for debugging."); // 添加日志
      
      isReady.value = true;
      
      // 注意：此处不再触发 car-ready，统一在 onMounted 中触发
    };
    
    // 更新车辆位置和方向
    const updateCarModel = () => {
      if (props.carModel && chassis.value) {
        props.carModel.position.copy(chassis.value.position);
        props.carModel.quaternion.copy(chassis.value.quaternion);
        
        // --- 获取车轮四元数 ---
        const wheelQuaternions = wheels.value.map(wheelBody => wheelBody.quaternion.clone());
        
        // --- 在事件中发送车轮数据 ---
        emit('position-update', {
          position: chassis.value.position.clone(), // Clone vectors/quaternions
          quaternion: chassis.value.quaternion.clone(),
          velocity: chassis.value.velocity.clone(),
          wheelQuaternions: wheelQuaternions 
        });
      }
    };
    
    // 物理更新处理函数
    const handlePhysicsUpdate = () => {
      if (isReady.value && chassis.value) {
        // 应用驾驶控制
        applyDriveControls(chassis.value, wheels.value, controlState.value);
        
        // 检测是否翻转 (如果启用了自动重置)
        if (!justReset) { // 暂时无条件检查
            // 获取当前车辆的四元数 (从 CANNON.Quaternion 转换为 THREE.Quaternion)
            const vehicleQuaternion = new THREE.Quaternion(
                chassis.value.quaternion.x,
                chassis.value.quaternion.y,
                chassis.value.quaternion.z,
                chassis.value.quaternion.w
            );
            
            // 计算车辆在世界坐标系中的向上向量
            worldUp.copy(localUp).applyQuaternion(vehicleQuaternion);
            
            // 检查 Y 分量是否小于阈值
            if (worldUp.y < resetThreshold) {
                resetCar(); // 调用重置函数
                justReset = true; // 设置标志，防止立即再次重置
                // 设置一个短暂的冷却时间后清除标志
                if(resetCooldownTimer) clearTimeout(resetCooldownTimer);
                resetCooldownTimer = setTimeout(() => {
                    justReset = false;
                }, 3000); // 冷却
            }
        }
        
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
            props.initialPosition.y + 0.5, // 稍微抬高一点，防止卡入地面
            props.initialPosition.z
          );
        }
        
        // 重置旋转
        chassis.value.quaternion.set(0, 0, 0, 1);
        
        // 更新3D模型位置
        updateCarModel();
      }
    };
    
    // 监听控制参数 Props 的变化并更新 controlState
    watch(() => [props.enginePower, props.brakeForce, props.turnStrength], ([power, brake, turn]) => {
      if (controlState.value) {
        console.log(`CarController: Updating control params - Power: ${power}, Brake: ${brake}, Turn: ${turn}`);
        configureControls(controlState.value, {
          power: power,
          brakeForce: brake,
          turnStrength: turn
        });
      }
    }, { immediate: true }); // immediate: true 确保初始值也被设置
    
    // 监听物理参数 Props 的变化并更新 Body
    watch(() => props.vehicleMass, (newMass) => {
      if (chassis.value) {
        console.log(`CarController: Updating mass to ${newMass}`);
        chassis.value.mass = newMass;
        chassis.value.updateMassProperties(); // Important after changing mass!
      }
    });
    watch(() => props.linearDamping, (newDamping) => {
      if (chassis.value) {
        console.log(`CarController: Updating linearDamping to ${newDamping}`);
        chassis.value.linearDamping = newDamping;
      }
    });
    watch(() => props.angularDamping, (newDamping) => {
      if (chassis.value) {
        console.log(`CarController: Updating angularDamping to ${newDamping}`);
        chassis.value.angularDamping = newDamping;
      }
    });
    
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
          
          // 初始化时应用一次从 props 传入的控制参数
          configureControls(controlState.value, {
            power: props.enginePower,
            brakeForce: props.brakeForce,
            turnStrength: props.turnStrength
          });
          console.log("CarController: Initial control params applied.");
          
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
      
      // --- 清理事件监听器 ---
      if (keyboardController.value) {
          keyboardController.value.removeListeners();
      }
      if (touchController.value) { // Also cleanup touch if/when enabled
          touchController.value.removeListeners();
      }
      
      // 清理冷却计时器
      if (resetCooldownTimer) {
          clearTimeout(resetCooldownTimer);
      }
    });
    
    const update = (deltaTime) => {
      console.warn("CarController update function called, but 'vehicle' ref might be unused.");
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