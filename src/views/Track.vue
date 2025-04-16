<template>
  <div class="track-view">
    <canvas ref="canvas" class="track-canvas"></canvas>
    
    <div v-if="showControls" class="controls-panel">
      <h3>物理引擎调试面板</h3>
      <div class="control-group">
        <label>显示调试渲染</label>
        <input type="checkbox" v-model="debugRender">
      </div>
      <div class="control-group">
        <label>重力</label>
        <input type="range" min="0" max="30" v-model.number="gravity" @input="updateGravity">
        <span>{{ gravity }}</span>
      </div>
      <div class="control-group">
        <label>加速力</label>
        <input type="range" min="1000" max="15000" :value="enginePower" @input="emitEnginePowerUpdate">
        <span>{{ enginePower }}</span>
      </div>
      <div class="control-group">
        <label>刹车力</label>
        <input type="range" min="1000" max="15000" :value="brakeForce" @input="emitBrakeForceUpdate">
        <span>{{ brakeForce }}</span>
      </div>
      <div class="control-group">
        <label>转向强度</label>
        <input type="range" min="5000" max="15000" :value="turnStrength" @input="emitTurnStrengthUpdate">
        <span>{{ turnStrength }}</span>
      </div>
      <div class="speed-display">
        <span>速度: {{ Math.floor(speed * 3.6) }} km/h</span>
      </div>
      <button class="reset-btn" @click="resetCar">重置车辆</button>
    </div>
    
    <div class="loading-overlay" v-if="isLoading">
      <div class="loader"></div>
      <div class="loading-text">加载中...</div>
    </div>

    <!-- 移除 CarController 实例 -->
    <!-- 
    <CarController
      v-if="world"
      ref="carController"
      :world="world"
      :scene="scene"
      :carModel="carModel"
      :initialPosition="{ x: 0, y: 2, z: 0 }"
      :selectedVehicle="currentVehicle"
      @car-ready="onCarReady"
      @position-update="onPositionUpdate"
    /> 
    -->
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, defineEmits } from 'vue';
import * as THREE from 'three';
import PhysicsEngine from '../components/PhysicsEngine.vue';
// 移除 CarController 导入
// import CarController from '../components/CarController.vue';
import { vehiclesList } from '@/config/vehicles';
import { markRaw } from 'vue';
// 添加加载器导入
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';
import { DRACOLoader } from '@/utils/loaders/DRACOLoader';

export default {
  name: 'Track',
  // 定义要 emit 的事件，包括新的 update:* 事件
  emits: ['scene-ready', 'model-ready', 'update:enginePower', 'update:brakeForce', 'update:turnStrength'],
  components: {
    PhysicsEngine,
    // 移除 CarController 组件注册
    // CarController
  },
  props: {
    showControls: {
      type: Boolean,
      default: true
    },
    trackName: {
      type: String,
      default: 'default'
    },
    // 添加 selectedVehicle prop
    selectedVehicle: {
      type: Object,
      required: true
    },
    // 添加 isLoading prop
    isLoading: {
        type: Boolean,
        required: true
    },
    // 新增 props 从 Race.vue 接收控制参数
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
    }
  },
  setup(props, { emit }) {
    // Three.js相关引用
    const canvas = ref(null);
    const scene = ref(null);
    const camera = ref(null);
    const renderer = ref(null);
    const directionalLight = ref(null);
    
    // 物理引擎相关引用
    const physicsEngine = ref(null);
    const world = ref(null);
    // 移除 carController ref
    // const carController = ref(null);
    const carModel = ref(null);
    const chassis = ref(null);
    const speed = ref(0);
    
    // 将 Three.js 核心对象标记为非响应式
    let rawScene, rawCamera, rawRenderer, rawDirectionalLight;
    
    // UI状态
    // const loading = ref(true); // 移除本地 loading 状态
    const debugRender = ref(false);
    const gravity = ref(9.82);
    
    // 初始化Three.js场景
    const initScene = () => {
      // 创建场景
      rawScene = markRaw(new THREE.Scene());
      rawScene.background = new THREE.Color(0x87ceeb); // 蓝天
      scene.value = rawScene; // 暴露给模板的 ref 仍然使用
      
      // 创建相机
      rawCamera = markRaw(new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        1000
      ));
      rawCamera.position.set(0, 5, 10);
      rawCamera.lookAt(0, 0, 0);
      camera.value = rawCamera;
      
      // 创建渲染器
      rawRenderer = markRaw(new THREE.WebGLRenderer({ 
        canvas: canvas.value,
        antialias: true 
      }));
      rawRenderer.setSize(window.innerWidth, window.innerHeight);
      rawRenderer.setPixelRatio(window.devicePixelRatio);
      rawRenderer.shadowMap.enabled = true;
      renderer.value = rawRenderer;
      
      // 添加灯光
      const ambientLight = markRaw(new THREE.AmbientLight(0xffffff, 0.6));
      rawScene.add(ambientLight);
      
      rawDirectionalLight = markRaw(new THREE.DirectionalLight(0xffffff, 0.8));
      rawDirectionalLight.position.set(10, 20, 10);
      rawDirectionalLight.castShadow = true;
      rawScene.add(rawDirectionalLight);
      directionalLight.value = rawDirectionalLight; // 如果需要 ref 访问
      
      // 添加地面 - 简单平面
      const groundGeometry = new THREE.PlaneGeometry(100, 100);
      const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a5e1a, 
        roughness: 0.8 
      });
      const ground = markRaw(new THREE.Mesh(groundGeometry, groundMaterial));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      rawScene.add(ground);
      
      // 添加网格辅助线
      const gridHelper = markRaw(new THREE.GridHelper(10000, 10000)); // 网格
      rawScene.add(gridHelper);
      
      // 添加事件监听
      window.addEventListener('resize', handleResize);

      // Scene is ready, emit event
      emit('scene-ready', rawScene);
    };
    
    // 添加加载真实模型的函数
    const loadSelectedCarModel = async () => {
      if (!props.selectedVehicle || !props.selectedVehicle.model) {
        console.error("Track.vue: No selected vehicle or model path provided.");
        // 可以考虑创建一个默认的立方体作为备用
        const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
        const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
        carModel.value = markRaw(new THREE.Mesh(fallbackGeometry, fallbackMaterial));
        rawScene.add(carModel.value);
        return;
      }

      try {
        // 清理旧模型 (如果需要切换模型的话，这里可能需要)
        if (carModel.value) {
            rawScene.remove(carModel.value);
            // TODO: 更彻底的清理，参考 Garage.vue cleanupModel
            carModel.value = null;
        }
        
        console.log(`Track.vue: Loading model ${props.selectedVehicle.model}`);
        const dracoLoader = new DRACOLoader().setDecoderPath("/libs/draco/");
        const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
        const gltf = await gltfLoader.loadAsync(props.selectedVehicle.model);
        
        const loadedModel = gltf.scene;
        loadedModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // 注意：Race.vue 现在传递的是从数据库加载的配置
        // 我们需要使用 customSettings (如果存在) 或基础值
        const baseData = props.selectedVehicle; // 基础数据和可能的 customSettings
        const customSettings = baseData.customSettings || {};

        // 优先使用 customSettings，然后是基础数据，最后是默认值
        const scale = customSettings.scale ?? baseData.scale ?? 1.0;
        // 初始位置应由 CarController 设置，这里可以不设置或设为 (0,0,0)
        // const position = customSettings.position ?? baseData.position ?? [0, 0, 0]; 
        // 初始旋转理论上也应由物理引擎决定，这里暂不设置
        // const rotationY = customSettings.rotation ?? 0;

        loadedModel.scale.set(scale, scale, scale);
        // loadedModel.position.set(...position); // 由 CarController/Physics 控制
        // loadedModel.rotation.set(0, rotationY, 0); // 由 CarController/Physics 控制

        carModel.value = markRaw(loadedModel);
        rawScene.add(carModel.value);
        console.log("Track.vue: Model loaded and added to scene.");

        // 模型加载完成后触发 model-ready 事件
        emit('model-ready', carModel.value);

      } catch (error) {
        console.error('Track.vue: Failed to load selected model:', error);
        // 加载失败也创建一个备用模型
        const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
        const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
        carModel.value = markRaw(new THREE.Mesh(fallbackGeometry, fallbackMaterial));
        rawScene.add(carModel.value);
      }
    };
    
    // 处理窗口大小变化
    const handleResize = () => {
      if (rawCamera && rawRenderer) {
        rawCamera.aspect = window.innerWidth / window.innerHeight;
        rawCamera.updateProjectionMatrix();
        rawRenderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (rawRenderer && rawScene && rawCamera) {
        // 更新相机位置，跟随车辆
        updateCameraPosition();
        
        // 渲染场景
        rawRenderer.render(rawScene, rawCamera);
      }
    };
    
    // 更新相机位置，跟随车辆
    const updateCameraPosition = () => {
      if (carModel.value && rawCamera) {
        // 获取车辆当前位置并克隆
        const carPosition = carModel.value.position.clone();
        
        // 计算相机的目标位置（在车辆后方和上方）
        const cameraOffset = new THREE.Vector3(0, 3, 10); // 定义偏移量
        // 应用车辆当前的旋转来调整相机偏移量，使其保持在车后
        // cameraOffset.applyQuaternion(carModel.value.quaternion);
        // 暂时注释掉 applyQuaternion，看是否是它引起的问题

        const cameraTargetPosition = new THREE.Vector3().copy(carPosition).add(cameraOffset);
        
        // 平滑过渡相机位置
        rawCamera.position.lerp(cameraTargetPosition, 0.05);
        
        // 相机始终看向车辆位置 (使用克隆的位置)
        rawCamera.lookAt(carPosition); // lookAt 内部会处理，通常不需要克隆
      }
    };
    
    // 物理引擎准备好时的回调
    const onPhysicsReady = (physicsData) => {
      console.log("Track.vue: Physics ready. World received.");
      world.value = physicsData.world;
      // loading.value = false; // 不再在这里控制 loading
    };
    
    // 车辆位置更新时的回调 (修改，不再依赖 CarController)
    const onPositionUpdate = (data) => {
      // 这个函数现在应该由 Race.vue 中的 CarController 调用，
      // 这里暂时保留逻辑，但可能需要调整或移除，取决于 Race.vue 的实现
      speed.value = data.velocity.length();
      
      // 更新方向光源位置，跟随车辆
      if (rawDirectionalLight) {
        const lightPos = new THREE.Vector3().copy(data.position);
        lightPos.add(new THREE.Vector3(10, 20, 10));
        rawDirectionalLight.position.copy(lightPos);
      }
    };
    
    // 物理引擎更新时的回调 (修改，不再调用 carController)
    const onPhysicsUpdate = () => {
      // 这里不再需要调用 carController.handlePhysicsUpdate()
      // 物理更新的处理应该由 Race.vue 中的 CarController 负责
    };
    
    // 更新重力
    const updateGravity = () => {
      if (world.value) {
        world.value.gravity.set(0, -gravity.value, 0);
      }
    };
    
    // 修改 updateControls 函数为 emit 事件
    const emitEnginePowerUpdate = (event) => {
        emit('update:enginePower', Number(event.target.value));
    };
    const emitBrakeForceUpdate = (event) => {
        emit('update:brakeForce', Number(event.target.value));
    };
    const emitTurnStrengthUpdate = (event) => {
        emit('update:turnStrength', Number(event.target.value));
    };

    // 重置车辆位置 (修改，不再依赖 carController)
    const resetCar = () => {
      console.warn("Track.vue: resetCar called. Consider emitting event to Race.vue to handle reset.");
      // emit('reset-car'); // 例如
    };
    
    // 监听调试渲染选项变化
    watch(debugRender, (newValue) => {
      if (physicsEngine.value) {
        physicsEngine.value.debug = newValue;
      }
    });
    
    // 组件挂载时初始化
    onMounted(() => {
      console.log("Track.vue: onMounted - Start");
      initScene();
      console.log("Track.vue: initScene finished. Loading model...");
      loadSelectedCarModel(); // 移除 await，让模型在后台加载
      console.log("Track.vue: Model loading initiated. Starting animation loop...");
      animate();
      console.log("Track.vue: onMounted - End");
    });
    
    // 组件卸载时清理
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      
      // 清理Three.js资源
      if (rawRenderer) {
        rawRenderer.dispose();
      }
      // 可以在这里添加更多清理逻辑，例如移除场景中的对象，dispose 几何体和材质
      rawScene = null; // 释放引用
      rawCamera = null;
      rawRenderer = null;
      rawDirectionalLight = null;
    });
    
    return {
      canvas,
      scene,
      camera,
      world,
      carModel,
      speed,
      debugRender,
      gravity,
      physicsEngine,
      // 移除本地控制状态的导出
      // enginePower,
      // brakeForce,
      // turnStrength,
      // 导出 props 以在模板中使用
      enginePower: props.enginePower,
      brakeForce: props.brakeForce,
      turnStrength: props.turnStrength,
      onPhysicsReady,
      onPositionUpdate, // 暂时保留导出，可能 Race.vue 会用到
      onPhysicsUpdate, // 暂时保留导出
      updateGravity,
      // 导出新的 emit 函数
      emitEnginePowerUpdate,
      emitBrakeForceUpdate,
      emitTurnStrengthUpdate,
      resetCar, // 暂时保留导出
      // 不再需要导出 currentVehicle
      // currentVehicle 
    };
  }
};
</script>

<style scoped>
.track-view {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.track-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.controls-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 5px;
  min-width: 200px;
  z-index: 10;
}

.control-group {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
}

.control-group label {
  margin-bottom: 5px;
}

.speed-display {
  margin: 15px 0;
  font-size: 18px;
  font-weight: bold;
}

.reset-btn {
  background-color: #ff4d4d;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.reset-btn:hover {
  background-color: #ff3333;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 20;
}

.loader {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 2s linear infinite;
}

.loading-text {
  color: white;
  margin-top: 20px;
  font-size: 18px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 