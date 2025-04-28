<template>
  <div class="vehicle-controller-rapier" style="display: none;">
    <!-- 此组件没有可见UI，仅处理逻辑 -->
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, defineExpose, defineEmits } from 'vue';
import { useInputControls } from '@/composables/useInputControls';
import { VehiclePhysicsRapier } from './VehiclePhysics_Rapier';
import * as THREE from 'three';

const props = defineProps({
  vehicleModel: {
    type: Object, // THREE.Object3D
    required: true
  },
  initialPosition: {
    type: Object, // { x, y, z }
    default: () => ({ x: 0, y: 2, z: 0 })
  },
  initialRotation: {
    type: Object, // { x, y, z, w } or Euler { x, y, z }
    default: () => ({ x: 0, y: 0, z: 0 })
  },
  physicsParams: {
    type: Object,
    default: () => ({})
  }
});

// Define emits
const emit = defineEmits(['car-ready', 'position-update']);

// 修改：解构时获取计算属性
const { controlState: rawControlState, horizontalAxis, verticalAxis, isMobile: isInputMobile } = useInputControls();
const vehiclePhysics = ref(null);
let animationFrameId = null;

// 将初始旋转转换为四元数
const initialQuaternion = new THREE.Quaternion();
if (props.initialRotation.w !== undefined) {
  initialQuaternion.set(props.initialRotation.x, props.initialRotation.y, props.initialRotation.z, props.initialRotation.w);
} else {
  initialQuaternion.setFromEuler(new THREE.Euler(props.initialRotation.x, props.initialRotation.y, props.initialRotation.z, 'YXZ'));
}

// 设置模型的初始变换 - 确保Y轴有一个合理的初始高度（如果未指定）
const initialY = props.initialPosition.y < 1 ? 1.0 : props.initialPosition.y;
props.vehicleModel.position.set(props.initialPosition.x, initialY, props.initialPosition.z);
props.vehicleModel.quaternion.copy(initialQuaternion);

// 打印初始位置和旋转，方便调试
console.log("[VehicleController_Rapier] 初始模型变换:", {
  position: { x: props.vehicleModel.position.x, y: props.vehicleModel.position.y, z: props.vehicleModel.position.z },
  rotation: props.initialRotation,
  quaternion: { x: initialQuaternion.x, y: initialQuaternion.y, z: initialQuaternion.z, w: initialQuaternion.w }
});


// Define the update handler function BEFORE defineExpose
const handlePhysicsUpdate = (deltaTime) => { 
  if (vehiclePhysics.value) {
    
    // 1. 使用计算好的轴值和原始刹车状态
    const controls = {
      steering: horizontalAxis.value, 
      throttle: verticalAxis.value, // 直接使用 verticalAxis，允许负值表示倒车意图
      brake: rawControlState.value.brake ? 1 : 0 
    };
    
    
    // 验证车辆物理状态
    if (!vehiclePhysics.value.rigidBody) {
      console.error("[VehicleController_Rapier] 刚体不存在，物理更新失败");
      return;
    }
    
    // 2. Update physics controls
    vehiclePhysics.value.updateControls(controls); // 直接使用计算后的controls
    
    // 3. Call the core physics update (apply forces, etc.)
    vehiclePhysics.value.update(deltaTime);
    
    // 4. Sync visuals
    vehiclePhysics.value.syncVisuals();

    // 5. Emit position update (including speed and wheel data)
    const position = vehiclePhysics.value.rigidBody?.translation();
    const quaternion = vehiclePhysics.value.rigidBody?.rotation();
    const linvel = vehiclePhysics.value.rigidBody?.linvel();
    const speed = linvel ? Math.sqrt(linvel.x**2 + linvel.y**2 + linvel.z**2) * 3.6 : 0; // km/h

    // Get wheel transforms from physics if available (assuming VehiclePhysicsRapier provides them)
    const wheelQuaternions = vehiclePhysics.value.wheelsInfo?.map(w => w.worldRotation || new THREE.Quaternion()); // Example
    const wheelPositions = vehiclePhysics.value.wheelsInfo?.map(w => w.worldPosition || new THREE.Vector3()); // Example

    emit('position-update', {
      position: position ? { x: position.x, y: position.y, z: position.z } : null,
      quaternion: quaternion ? { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w } : null,
      speed: speed,
      wheelQuaternions: wheelQuaternions,
      wheelPositions: wheelPositions
    });
  } else {
    console.warn("[VehicleController_Rapier] vehiclePhysics.value为空，无法更新物理");
  }
};

onMounted(() => {
  // 创建车辆物理实例
  try {
    console.log("[VehicleController_Rapier] 创建车辆物理实例，参数:", {
      position: props.vehicleModel.position,
      quaternion: props.vehicleModel.quaternion,
      params: props.physicsParams
    });
    
    // 使用传入的参数作为首选，不再设置默认值
    // 这样可以确保使用tuningStore中的参数
    vehiclePhysics.value = new VehiclePhysicsRapier(props.vehicleModel, props.physicsParams);
    console.log("[VehicleController_Rapier] VehiclePhysicsRapier 实例已创建", vehiclePhysics.value);
    
    // 确保物理对象初始速度为零
    if (vehiclePhysics.value.rigidBody) {
      vehiclePhysics.value.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      vehiclePhysics.value.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      
      console.log("[VehicleController_Rapier] 已重置物理对象初始速度");
    }
    
    // Emit the car-ready event WITH the instance payload
    emit('car-ready', vehiclePhysics.value);
  } catch (error) {
    console.error("[VehicleController_Rapier] 创建 VehiclePhysicsRapier 失败:", error);
    return;
  }
});

onBeforeUnmount(() => {
  // 停止更新循环
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null; // Clear the ID
  }
  // 清理物理资源
  if (vehiclePhysics.value) {
    vehiclePhysics.value.dispose();
    vehiclePhysics.value = null;
  }
});

// Expose the vehiclePhysics instance and the update handler
// for the parent component (Race.vue)
// This allows Race.vue to pass the instance to VehicleDebugUI
defineExpose({ 
  vehiclePhysics, // Expose the ref directly
  handlePhysicsUpdate // Expose the update handler
});

// 监听模型变化（例如从外部加载完成时）
watch(() => props.vehicleModel, (newModel, oldModel) => {
  if (newModel && newModel !== oldModel) {
    // 如果模型变化，可能需要重新初始化或更新物理绑定
    console.warn('车辆模型已更改，可能需要重新处理物理绑定。');
    // 这里可以添加逻辑来处理模型的更换
    // 例如，清理旧的物理，用新模型创建新的物理实例
  }
});

</script>

<style scoped>
/* No specific styles needed */
</style> 