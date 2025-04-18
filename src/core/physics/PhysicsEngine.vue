<template>
  <div class="physics-engine">
    <!-- 该组件只负责物理逻辑，没有可见UI -->
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { 
  createPhysicsWorld, 
  createGround, 
  updatePhysics, 
  CannonDebugRenderer 
} from '@/core/physics/PhysicsWorld';

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
    }
  },
  setup(props, { emit }) {
    const world = ref(null);
    const debugRenderer = ref(null);
    const bodies = ref([]);
    let animationFrameId = null;
    
    // 初始化物理世界
    const initPhysicsWorld = () => {
      // 创建物理世界
      world.value = createPhysicsWorld();
      
      // 创建地面
      const { groundBody } = createGround(world.value);
      bodies.value.push(groundBody);
      
      // 如果开启了调试模式，创建调试渲染器
      if (props.debug && props.scene) {
        debugRenderer.value = new CannonDebugRenderer(props.scene, world.value);
      }
      
      // 通知父组件物理世界已经初始化
      emit('physics-ready', {
        world: world.value,
        bodies: bodies.value
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
    const addBody = (body) => {
      if (world.value && body) {
        world.value.addBody(body);
        bodies.value.push(body);
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
    });
    
    // 暴露给父组件的方法
    return {
      world,
      bodies,
      addBody,
      removeBody,
      updateWorld
    };
  }
};
</script>

<style scoped>
.physics-engine {
  display: none;
}
</style> 