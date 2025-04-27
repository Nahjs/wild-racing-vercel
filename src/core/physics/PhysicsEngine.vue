<template>
  <div class="physics-engine">
    <!-- 该组件只负责物理逻辑，没有可见UI -->
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { 
  createPhysicsWorld, 
  createGround, 
  updatePhysics, 
  CannonDebugRenderer 
} from '@/core/physics/PhysicsWorld';
import collisionManagerInstance from '@/core/collision/CollisionManager';
import CollisionShapes from '@/core/collision/CollisionShapes';

export default {
  name: 'PhysicsEngine',
  props: {
    scene: {
      type: Object,
      required: true
    },
    debug: {
      type: Boolean,
      default: false
    },
    showColliders: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { emit }) {
    const world = ref(null);
    const debugRenderer = ref(null);
    const bodies = ref([]);
    const collisionManager = ref(null);
    let animationFrameId = null;
    
    // 初始化物理世界
    const initPhysicsWorld = () => {
      // 创建物理世界
      world.value = createPhysicsWorld();
      
      // 创建地面
      const { groundBody } = createGround(world.value);
      bodies.value.push(groundBody);
      
      // 初始化碰撞管理器
      collisionManager.value = collisionManagerInstance.init(world.value);
      
      // 添加碰撞材质
      world.value.addContactMaterial(CollisionShapes.railVehicleContactMaterial);
      
      // 通知父组件物理世界已经初始化
      emit('physics-ready', {
        world: world.value,
        bodies: bodies.value,
        collisionManager: collisionManager.value
      });
    };
    
    // 更新物理世界
    const updateWorld = (deltaTime) => {
      if (world.value) {
        // 更新物理模拟
        updatePhysics(world.value, deltaTime);
        
        // 更新调试渲染器
        if (props.debug && debugRenderer.value) {
          debugRenderer.value.update();
        } else if (props.debug && !debugRenderer.value) {
         // console.warn("[PhysicsEngine Debug] Debug prop is true, but debugRenderer is not initialized!");
        }
        
        // 发送物理更新事件
        emit('physics-update', {
          world: world.value,
          bodies: bodies.value,
          deltaTime
        });
      }
    };
    
    // 动画循环
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      updateWorld(1/60);
    };
    
    // 添加物理体到世界
    const addBody = (body, bodyType = null) => {
      if (world.value && body) {
        world.value.addBody(body);
        bodies.value.push(body);
        
        // 如果指定了类型，设置碰撞类型
        if (bodyType && collisionManager.value) {
          collisionManager.value.setBodyType(body, bodyType);
        }
        
        return true;
      }
      return false;
    };
    
    // 从世界移除物理体
    const removeBody = (body) => {
      if (world.value && body) {
        world.value.removeBody(body);
        bodies.value = bodies.value.filter(b => b !== body);
        return true;
      }
      return false;
    };
    
    // 添加碰撞监听
    const addCollisionListener = (bodyA, bodyB, callback) => {
      if (!collisionManager.value) return null;
      
      // 获取物体类型
      const typeA = bodyA.userData?.type || 'unknown';
      const typeB = bodyB.userData?.type || 'unknown';
      
      // 注册碰撞处理器
      return collisionManager.value.registerCollisionHandler(typeA, typeB, callback);
    };
    
    // 为特定物体添加碰撞监听
    const addBodyCollisionListener = (body, callback) => {
      if (!collisionManager.value) return null;
      
      return collisionManager.value.addBodyCollisionListener(body, callback);
    };
    
    // 组件挂载时初始化
    onMounted(() => {
      initPhysicsWorld();
      animate();
    });
    
    // 组件卸载时清理
    onUnmounted(() => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // 清理物理世界中的所有物体
      if (world.value) {
        bodies.value.forEach(body => {
          world.value.removeBody(body);
        });
        bodies.value = [];
      }
      
      // 清理碰撞管理器的监听器
      if (collisionManager.value) {
        collisionManager.value.clearAllListeners();
      }
    });
    
    // 监听 debug prop 的变化来创建/销毁调试渲染器
    watch(() => props.debug, (newDebugValue) => {
      if (newDebugValue) {
        if (!debugRenderer.value && props.scene && world.value) {
          debugRenderer.value = new CannonDebugRenderer(props.scene, world.value);
        } 
      } else {
        if (debugRenderer.value) {
          debugRenderer.value.clearMeshes(); // 调用清理方法
          debugRenderer.value = null;
        }
      }
    }, { immediate: true }); // immediate: true 确保组件加载时也会根据初始 debug 值执行一次
    
    // 暴露给父组件的方法
    return {
      world,
      bodies,
      collisionManager,
      addBody,
      removeBody,
      updateWorld,
      addCollisionListener,
      addBodyCollisionListener
    };
  }
};
</script>

<style scoped>
.physics-engine {
  display: none;
}
</style> 