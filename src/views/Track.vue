<template>
  <div class="track-view">
    <canvas ref="canvas" class="track-canvas"></canvas>
    
    <div v-if="showControls" class="controls-panel">
      <h3>物理引擎调试面板</h3>
      <div class="control-group">
        <label>显示调试</label>
        <input type="checkbox" v-model="debugRender">
      </div>
      <div class="control-group">
        <label>重力</label>
        <input type="range" min="0" max="30" v-model.number="gravity" @input="updateGravity">
        <span>{{ gravity }}</span>
      </div>
      <div class="control-group">
        <label>加速力 ({{ enginePower }})</label>
        <input type="range" min="1000" max="15000" :value="enginePower" @input="emitEnginePowerUpdate">
      </div>
      <div class="control-group">
        <label>刹车力 ({{ brakeForce }})</label>
        <input type="range" min="1000" max="15000" :value="brakeForce" @input="emitBrakeForceUpdate">
      </div>
      <div class="control-group">
        <label>转向强度 ({{ turnStrength }})</label>
        <input type="range" min="5000" max="15000" :value="turnStrength" @input="emitTurnStrengthUpdate">
      </div>
      <div class="control-group">
        <label>车辆质量 ({{ vehicleMass }})</label>
        <input type="range" min="50" max="1000" step="10" :value="vehicleMass" @input="emitVehicleMassUpdate">
      </div>
      <div class="control-group">
        <label>线性阻尼 ({{ linearDamping }})</label>
        <input type="range" min="0" max="0.5" step="0.01" :value="linearDamping" @input="emitLinearDampingUpdate">
      </div>
      <div class="control-group">
        <label>角阻尼 ({{ angularDamping }})</label>
        <input type="range" min="0" max="0.5" step="0.01" :value="angularDamping" @input="emitAngularDampingUpdate">
      </div>
      <div class="control-group">
        <label>地面摩擦力 ({{ groundFriction }})</label>
        <input type="range" min="0" max="1" step="0.05" :value="groundFriction" @input="emitGroundFrictionUpdate">
      </div>
      <hr>
      <h3>视角控制</h3>
      <div class="control-group">
        <label>视角模式</label>
        <select v-model="cameraMode">
          <option value="thirdPersonFollow">后方跟随</option>
          <option value="firstPerson">第一人称</option>
          <option value="freeOrbit">自由视角</option>
        </select>
      </div>
      <div v-if="showThirdPersonControls" class="control-group">
        <label>相机距离 ({{ cameraDistance.toFixed(1) }})</label>
        <input type="range" min="3" max="25" step="0.5" v-model.number="cameraDistance">
      </div>
      <div v-if="showThirdPersonControls" class="control-group">
        <label>相机高度 ({{ cameraHeight.toFixed(1) }})</label>
        <input type="range" min="1" max="15" step="0.5" v-model.number="cameraHeight">
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
import { ref, onMounted, onUnmounted, watch, defineEmits, computed } from 'vue';
import * as THREE from 'three';
import PhysicsEngine from '../components/PhysicsEngine.vue';
// 移除 CarController 导入
// import CarController from '../components/CarController.vue';
import { vehiclesList } from '@/config/vehicles';
import { markRaw } from 'vue';
// 添加加载器导入
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';
import { DRACOLoader } from '@/utils/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default {
  name: 'Track',
  // 定义要 emit 的事件，包括新的 update:* 事件
  emits: ['scene-ready', 'model-ready', 'update:enginePower', 'update:brakeForce', 'update:turnStrength', 'update:vehicleMass', 'update:linearDamping', 'update:angularDamping', 'update:groundFriction'],
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
    groundFriction: {
        type: Number,
        required: true
    },
    wheelQuaternions: { type: Array, default: () => [] }, // --- 新增 prop ---
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
    const chassis = ref(0);
    const speed = ref(0);
    
    // 将 Three.js 核心对象标记为非响应式
    let rawScene, rawCamera, rawRenderer, rawDirectionalLight;
    
    // UI状态
    // const loading = ref(true); // 移除本地 loading 状态
    const debugRender = ref(false);
    const gravity = ref(9.82);
    
    let orbitControls;
    const cameraMode = ref('thirdPersonFollow');
    const cameraDistance = ref(8);
    const cameraHeight = ref(4);
    
    const wheelMeshRefs = ref({ fl: null, fr: null, rl: null, rr: null }); // Store wheel meshes
    
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
      const groundGeometry = new THREE.PlaneGeometry(1000, 1000); // 增大地面尺寸
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

      // 设置 OrbitControls
      orbitControls = markRaw(new OrbitControls(rawCamera, rawRenderer.domElement));
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.1;
      orbitControls.enabled = false;
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

        // --- 查找车轮网格 (假设名称) ---
        const wheelNames = {
            fl: 'Wheel_FL', // Adjust these names based on your actual GLTF model
            fr: 'Wheel_FR',
            rl: 'Wheel_RL',
            rr: 'Wheel_RR'
        };
        loadedModel.traverse((child) => {
            if (child.isMesh) {
                if (child.name === wheelNames.fl) wheelMeshRefs.value.fl = child;
                else if (child.name === wheelNames.fr) wheelMeshRefs.value.fr = child;
                else if (child.name === wheelNames.rl) wheelMeshRefs.value.rl = child;
                else if (child.name === wheelNames.rr) wheelMeshRefs.value.rr = child;
            }
        });
        console.log("Found wheel meshes:", {
            fl: !!wheelMeshRefs.value.fl,
            fr: !!wheelMeshRefs.value.fr,
            rl: !!wheelMeshRefs.value.rl,
            rr: !!wheelMeshRefs.value.rr,
        }); 
        
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
      
      if (orbitControls?.enabled) orbitControls.update();
      
      if (rawRenderer && rawScene && rawCamera) {
        // 更新相机位置，跟随车辆
        updateCameraPosition();
        
        // --- 更新车轮旋转 ---
        updateWheelRotations();
        
        // 渲染场景
        rawRenderer.render(rawScene, rawCamera);
      }
    };
    
    // 更新相机位置，跟随车辆
    const updateCameraPosition = () => {
      if (!carModel.value || !rawCamera) return;

      const carPosition = carModel.value.position;
      const carQuaternion = carModel.value.quaternion;

      orbitControls.enabled = (cameraMode.value === 'freeOrbit');
      
      if (cameraMode.value === 'thirdPersonFollow') {
        const cameraOffset = new THREE.Vector3(0, cameraHeight.value, -cameraDistance.value);
        const worldOffset = cameraOffset.applyQuaternion(carQuaternion);
        const cameraTargetPosition = new THREE.Vector3().copy(carPosition).add(worldOffset);
        rawCamera.position.lerp(cameraTargetPosition, 0.1);
        const lookAtTarget = carPosition.clone().add(new THREE.Vector3(0, 0.5, 0));
        rawCamera.lookAt(lookAtTarget);
        orbitControls.target.copy(carPosition);
      } else if (cameraMode.value === 'firstPerson') {
        // 调整第一人称视角的偏移量和目标点
        const firstPersonOffset = new THREE.Vector3(0, 0.8, 0.3); // Lower and slightly forward
        const worldPosition = carModel.value.localToWorld(firstPersonOffset.clone());
        rawCamera.position.copy(worldPosition);

        const lookDirectionOffset = new THREE.Vector3(0, 0.7, 5); // Look slightly lower and further ahead
        const lookAtWorld = carModel.value.localToWorld(lookDirectionOffset.clone());
        rawCamera.lookAt(lookAtWorld);
        orbitControls.target.copy(carPosition);
      } else if (cameraMode.value === 'freeOrbit') {
        // OrbitControls handles the camera when enabled.
        // Keep the target updated to orbit around the car
         orbitControls.target.lerp(carPosition, 0.1); 
      }
    };
    
    // 物理引擎准备好时的回调
    const onPhysicsReady = (physicsData) => {
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
        // 更新光源目标点，使其始终指向车辆附近
        rawDirectionalLight.target.position.copy(data.position);
        rawDirectionalLight.target.updateMatrixWorld(); // 更新目标矩阵
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
    const emitVehicleMassUpdate = (event) => {
        emit('update:vehicleMass', Number(event.target.value));
    };
    const emitLinearDampingUpdate = (event) => {
        emit('update:linearDamping', Number(event.target.value));
    };
    const emitAngularDampingUpdate = (event) => {
        emit('update:angularDamping', Number(event.target.value));
    };
    const emitGroundFrictionUpdate = (event) => {
        emit('update:groundFriction', Number(event.target.value));
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
    
    // 计算属性，用于在模板中隐藏/显示相机距离/高度滑块
    const showThirdPersonControls = computed(() => cameraMode.value === 'thirdPersonFollow');
    
    // --- 新增：更新车轮旋转的函数 ---
    const updateWheelRotations = () => {
        // Ensure we have the refs and the data (props.wheelQuaternions should be an array of 4)
        if (!wheelMeshRefs.value.fl || !props.wheelQuaternions || props.wheelQuaternions.length < 4) {
            // console.warn("Wheel meshes or quaternions not ready for update.");
            return; 
        }

        // --- 添加日志 ---
        // console.log("Updating wheel rotations. Quaternions:", props.wheelQuaternions);

        // Apply rotations - mapping might need adjustment based on CarController wheel order
        // Assuming order from CarController: FL, FR, RL, RR
        // The physics sphere rotation might not directly map 1:1 visually.
        // We might only want the rotation around the axle.
        // Let's try direct copy first.
        try {
            if(wheelMeshRefs.value.fl) wheelMeshRefs.value.fl.quaternion.copy(props.wheelQuaternions[0]);
            if(wheelMeshRefs.value.fr) wheelMeshRefs.value.fr.quaternion.copy(props.wheelQuaternions[1]);
            if(wheelMeshRefs.value.rl) wheelMeshRefs.value.rl.quaternion.copy(props.wheelQuaternions[2]);
            if(wheelMeshRefs.value.rr) wheelMeshRefs.value.rr.quaternion.copy(props.wheelQuaternions[3]);
        } catch (error) {
            console.error("Error copying wheel quaternion:", error, props.wheelQuaternions);
        }
    };
    
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
      if (orbitControls) {
          orbitControls.dispose(); // 清理 OrbitControls
      }
      // 可以在这里添加更多清理逻辑，例如移除场景中的对象，dispose 几何体和材质
      if (rawScene) {
          // 遍历并清理场景中的对象
          rawScene.traverse(object => {
              if (object.geometry) {
                  object.geometry.dispose();
              }
              if (object.material) {
                  // 如果材质是数组
                  if (Array.isArray(object.material)) {
                      object.material.forEach(material => material.dispose());
                  } else {
                      object.material.dispose();
                  }
              }
          });
      }
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
      vehicleMass: props.vehicleMass,
      linearDamping: props.linearDamping,
      angularDamping: props.angularDamping,
      groundFriction: props.groundFriction,
      onPhysicsReady,
      onPositionUpdate, // 暂时保留导出，可能 Race.vue 会用到
      onPhysicsUpdate, // 暂时保留导出
      updateGravity,
      // 导出新的 emit 函数
      emitEnginePowerUpdate,
      emitBrakeForceUpdate,
      emitTurnStrengthUpdate,
      emitVehicleMassUpdate,
      emitLinearDampingUpdate,
      emitAngularDampingUpdate,
      emitGroundFrictionUpdate,
      resetCar, // 暂时保留导出
      // 不再需要导出 currentVehicle
      // currentVehicle 
      cameraMode,
      cameraDistance,
      cameraHeight,
      showThirdPersonControls,
      wheelMeshRefs, // (wheelMeshRefs is internal, no need to return unless template needs it)
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
  min-width: 250px; /* Increased width slightly */
  max-height: 90vh; /* Limit height */
  overflow-y: auto; /* Add scroll if content overflows */
  z-index: 10;
}

.control-group {
  margin-bottom: 12px; /* Increased spacing */
  display: flex;
  flex-direction: column; /* Keep as column */
  align-items: flex-start; /* Align items left */
}

.control-group label {
  margin-bottom: 5px;
  font-size: 14px; /* Slightly smaller font */
}

.control-group input[type="range"] {
  width: 100%; /* Make range inputs full width */
  cursor: pointer;
}
.control-group input[type="checkbox"] {
  align-self: flex-start; /* Align checkbox left */
  margin-top: 4px;
}

.control-group span {
  font-size: 12px; /* Smaller font for value display */
  margin-left: 5px; /* Add space before value */
  align-self: flex-end; /* Align value to the right */
}

.control-group select {
    width: 100%;
    padding: 5px;
    border-radius: 3px;
    background: #333;
    color: white;
    border: 1px solid #555;
}

hr {
    border: none;
    border-top: 1px solid #555;
    margin: 15px 0;
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
  width: 100%; /* Make button full width */
  margin-top: 10px;
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

/* Style scrollbar for controls panel */
.controls-panel::-webkit-scrollbar {
  width: 8px;
}

.controls-panel::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.controls-panel::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.controls-panel::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.7);
}
</style> 