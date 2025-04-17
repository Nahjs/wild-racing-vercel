<template>
  <div class="track-view">
    <canvas ref="canvas" class="track-canvas"></canvas>
    
    <div v-if="showControls" class="controls-panel">
      <h3>物理引擎调试面板</h3>
      
      <!-- 基本控制 -->
      <div class="control-group">
        <label>显示调试</label>
        <input type="checkbox" v-model="debugRender">
      </div>
      <div class="control-group">
        <label>重力</label>
        <input type="range" min="0" max="30" step="0.1" v-model.number="gravity" @input="updateGravity">
        <span>{{ gravity.toFixed(1) }}</span>
      </div>
      <div class="control-group">
        <label>地面摩擦力 ({{ groundFriction.toFixed(2) }})</label>
        <input type="range" min="0" max="1" step="0.05" :value="groundFriction" @input="emitGroundFrictionUpdate">
      </div>
      
      <hr>
      <h3>车辆参数</h3>
      <!-- 车辆基础 -->
      <div class="control-group">
        <label>车辆质量 ({{ vehicleMass }})</label>
        <input type="range" min="50" max="2000" step="10" :value="vehicleMass" @input="emitVehicleMassUpdate">
      </div>
       <div class="control-group">
        <label>线性阻尼 ({{ linearDamping.toFixed(2) }})</label>
        <input type="range" min="0" max="0.99" step="0.01" :value="linearDamping" @input="emitLinearDampingUpdate">
      </div>
      <div class="control-group">
        <label>角阻尼 ({{ angularDamping.toFixed(2) }})</label>
        <input type="range" min="0" max="0.99" step="0.01" :value="angularDamping" @input="emitAngularDampingUpdate">
      </div>
      
      <!-- 控制力 -->
      <div class="control-group">
        <label>最大作用力 (引擎) ({{ enginePower }})</label>
        <input type="range" min="100" max="15000" step="100" :value="enginePower" @input="emitEnginePowerUpdate">
      </div>
       <div class="control-group">
        <label>最大转向值 ({{ turnStrength.toFixed(2) }})</label>
        <input type="range" min="0.1" max="1.5" step="0.05" :value="turnStrength" @input="emitTurnStrengthUpdate">
      </div>
       <div class="control-group">
        <label>刹车力 ({{ brakePower }})</label>
        <input type="range" min="0" max="100" step="1" :value="brakePower" @input="emitBrakePowerUpdate">
      </div>
      <div class="control-group">
        <label>被动减速力 ({{ slowDownForce.toFixed(1) }})</label>
        <input type="range" min="0" max="50" step="0.5" :value="slowDownForce" @input="emitSlowDownForceUpdate">
      </div>
            <div class="control-group">
        <label>视角模式</label>
        <select v-model="cameraMode">
           <option value="freeOrbit">自由视角</option>
          <option value="thirdPersonFollow">后方跟随</option>
          <option value="firstPerson">第一人称</option>
        </select>
      </div>
      <div class="control-group">
        <button class="save-btn" @click="$emit('save-tuning')" :disabled="isSavingTuning">
          {{ isSavingTuning ? '保存中...' : '保存调校' }}
        </button>
      </div>
      <!-- RaycastVehicle WheelInfos -->
      <hr>
      <h3>悬挂与车轮</h3>
      <div class="control-group">
        <label>悬挂刚度 ({{ suspensionStiffness.toFixed(1) }})</label>
        <input type="range" min="1" max="200" step="1" :value="suspensionStiffness" @input="emitSuspensionStiffnessUpdate">
      </div>
      <div class="control-group">
        <label>悬挂静止长度 ({{ suspensionRestLength.toFixed(2) }})</label>
        <input type="range" min="0.1" max="1.5" step="0.05" :value="suspensionRestLength" @input="emitSuspensionRestLengthUpdate">
      </div>
       <div class="control-group">
        <label>最大悬挂行程 ({{ maxSuspensionTravel.toFixed(2) }})</label>
        <input type="range" min="0.1" max="2" step="0.05" :value="maxSuspensionTravel" @input="emitMaxSuspensionTravelUpdate">
      </div>
       <div class="control-group">
        <label>最大悬挂力 ({{ maxSuspensionForce }})</label>
        <input type="range" min="1000" max="50000" step="1000" :value="maxSuspensionForce" @input="emitMaxSuspensionForceUpdate">
      </div>
       <div class="control-group">
        <label>悬挂阻尼 (松弛) ({{ dampingRelaxation.toFixed(2) }})</label>
        <input type="range" min="0.1" max="10" step="0.1" :value="dampingRelaxation" @input="emitDampingRelaxationUpdate">
      </div>
       <div class="control-group">
        <label>悬挂阻尼 (压缩) ({{ dampingCompression.toFixed(2) }})</label>
        <input type="range" min="0.1" max="10" step="0.1" :value="dampingCompression" @input="emitDampingCompressionUpdate">
      </div>
      <div class="control-group">
        <label>摩擦系数 (滑动) ({{ frictionSlip.toFixed(1) }})</label>
        <input type="range" min="1" max="100" step="1" :value="frictionSlip" @input="emitFrictionSlipUpdate">
      </div>
       <div class="control-group">
        <label>侧倾影响 ({{ rollInfluence.toFixed(3) }})</label>
        <input type="range" min="0" max="0.5" step="0.005" :value="rollInfluence" @input="emitRollInfluenceUpdate">
      </div>
     
      <hr>
    
     
      <h3>视角控制</h3>

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

  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, defineEmits, computed } from 'vue';
import * as THREE from 'three';
import PhysicsEngine from '../components/PhysicsEngine.vue';
import { vehiclesList } from '@/config/vehicles';
import { markRaw } from 'vue';
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';
import { DRACOLoader } from '@/utils/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default {
  name: 'Track',
  emits: [
      'scene-ready',
      'model-ready',
      'update:enginePower',
      'update:brakePower', 
      'update:slowDownForce', 
      'update:turnStrength',
      'update:vehicleMass',
      'update:linearDamping',
      'update:angularDamping',
      'update:groundFriction',
      'update:suspensionStiffness',
      'update:suspensionRestLength',
      'update:frictionSlip',
      'update:dampingRelaxation',
      'update:dampingCompression',
      'update:maxSuspensionForce',
      'update:rollInfluence',
      'update:maxSuspensionTravel',
      'save-tuning'
  ],
  components: {
    PhysicsEngine,
  },
  props: {
    showControls: { type: Boolean, default: true },
    trackName: { type: String, default: 'default' },
    selectedVehicle: { type: Object, required: true },
    isLoading: { type: Boolean, required: true },
    enginePower: { type: Number, required: true }, 
    turnStrength: { type: Number, required: true }, 
    vehicleMass: { type: Number, required: true },
    linearDamping: { type: Number, required: true },
    angularDamping: { type: Number, required: true },
    groundFriction: { type: Number, required: true },
    brakePower: { type: Number, required: true }, 
    slowDownForce: { type: Number, required: true }, 
    suspensionStiffness: { type: Number, required: true },
    suspensionRestLength: { type: Number, required: true },
    frictionSlip: { type: Number, required: true },
    dampingRelaxation: { type: Number, required: true },
    dampingCompression: { type: Number, required: true },
    maxSuspensionForce: { type: Number, required: true },
    rollInfluence: { type: Number, required: true },
    maxSuspensionTravel: { type: Number, required: true },
    wheelQuaternions: { type: Array, default: () => [] },
    wheelPositions: { type: Array, default: () => [] }, 
    isSavingTuning: { type: Boolean, default: false }
  },
  setup(props, { emit }) {
    const canvas = ref(null);
    const scene = ref(null);
    const camera = ref(null);
    const renderer = ref(null);
    const directionalLight = ref(null);
    const physicsEngine = ref(null);
    const world = ref(null);
    const carModel = ref(null);
    let rawScene, rawCamera, rawRenderer, rawDirectionalLight;
    const debugRender = ref(false);
    const gravity = ref(9.82);
    let orbitControls;
    const cameraMode = ref('freeOrbit');
    const cameraDistance = ref(8);
    const cameraHeight = ref(4);
    const wheelMeshRefs = ref({ fl: null, fr: null, rl: null, rr: null });
    
    const initScene = () => {
      rawScene = markRaw(new THREE.Scene());
      rawScene.background = new THREE.Color(0x111111); 
      rawCamera = markRaw(new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000));
      rawCamera.position.set(0, 5, 10);
      camera.value = rawCamera;
      rawRenderer = markRaw(new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true }));
      rawRenderer.setSize(window.innerWidth, window.innerHeight);
      rawRenderer.setPixelRatio(window.devicePixelRatio);
      rawRenderer.shadowMap.enabled = true;
      renderer.value = rawRenderer;
      const ambientLight = markRaw(new THREE.AmbientLight(0xffffff, 0.6));
      rawScene.add(ambientLight);
      rawDirectionalLight = markRaw(new THREE.DirectionalLight(0xffffff, 0.8));
      rawDirectionalLight.position.set(10, 20, 10);
      rawDirectionalLight.castShadow = true;
      rawScene.add(rawDirectionalLight);
      directionalLight.value = rawDirectionalLight;
      const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
      const ground = markRaw(new THREE.Mesh(groundGeometry, groundMaterial));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      rawScene.add(ground);
      const gridHelper = markRaw(new THREE.GridHelper(1000, 100));
      rawScene.add(gridHelper);
      
      window.addEventListener('resize', handleResize);
      emit('scene-ready', rawScene);
      orbitControls = markRaw(new OrbitControls(rawCamera, rawRenderer.domElement));
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.1;
      orbitControls.enabled = false;
    };
    
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
                    // --- 调试：打印所有 Mesh 名称 ---
                    // console.log(`Track.vue: Found mesh name: ${child.name}`);
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

            // --- 更新查找逻辑: 目标是车轮的父级对象/组 ---
            const wheelParentNames = { 
                // 根据 Blender 截图更新名称
                rl: 'WheelBL', // 后左
                rr: 'WheelBR', // 后右
                fl: 'WheelFL', // 前左
                fr: 'WheelFR'  // 前右
            }; 
            wheelMeshRefs.value = { fl: null, fr: null, rl: null, rr: null }; // 重置 refs
            
            console.log("Track.vue: Searching for wheel parent objects:", wheelParentNames);
            loadedModel.traverse((child) => {
                // 仍然打印所有 Mesh 名称以供调试
                // if (child.isMesh) { 
                //     console.log(`Track.vue: Found mesh name: ${child.name}`);
                // }
                
                // 查找父级对象 (不一定是 Mesh)
                if (child.name === wheelParentNames.fl) wheelMeshRefs.value.fl = child;
                else if (child.name === wheelParentNames.fr) wheelMeshRefs.value.fr = child;
                else if (child.name === wheelParentNames.rl) wheelMeshRefs.value.rl = child;
                else if (child.name === wheelParentNames.rr) wheelMeshRefs.value.rr = child;
            });
            // --- 更新日志以反映查找的是父对象 ---
            console.log("Found wheel parent objects:", { 
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
    
    const handleResize = () => {
      if (rawCamera && rawRenderer) { 
          rawCamera.aspect = window.innerWidth / window.innerHeight;
          rawCamera.updateProjectionMatrix();
          rawRenderer.setSize(window.innerWidth, window.innerHeight);
       }
    };
    
    const animate = () => {
      requestAnimationFrame(animate);
      if (orbitControls?.enabled) orbitControls.update();
      if (rawRenderer && rawScene && rawCamera) {
        updateCameraPosition();
        updateWheelRotations(); 
        rawRenderer.render(rawScene, rawCamera);
      }
    };
    
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
             const firstPersonOffset = new THREE.Vector3(0, 0.8, 0.3); 
             const worldPosition = carModel.value.localToWorld(firstPersonOffset.clone());
             rawCamera.position.copy(worldPosition);
             const lookDirectionOffset = new THREE.Vector3(0, 0.7, 5);
             const lookAtWorld = carModel.value.localToWorld(lookDirectionOffset.clone());
             rawCamera.lookAt(lookAtWorld);
             orbitControls.target.copy(carPosition);
        } else if (cameraMode.value === 'freeOrbit') {
            orbitControls.target.lerp(carPosition, 0.1); 
        }
    };
    
    const onPhysicsReady = (physicsData) => {
      world.value = physicsData.world;
    };
    
    const updateGravity = () => {
      if (world.value) { world.value.gravity.set(0, -gravity.value, 0); }
    };
    
    const emitEnginePowerUpdate = (event) => { emit('update:enginePower', Number(event.target.value)); };
    const emitTurnStrengthUpdate = (event) => { emit('update:turnStrength', Number(event.target.value)); };
    const emitVehicleMassUpdate = (event) => { emit('update:vehicleMass', Number(event.target.value)); };
    const emitLinearDampingUpdate = (event) => { emit('update:linearDamping', Number(event.target.value)); };
    const emitAngularDampingUpdate = (event) => { emit('update:angularDamping', Number(event.target.value)); };
    const emitGroundFrictionUpdate = (event) => { emit('update:groundFriction', Number(event.target.value)); };
    const emitBrakePowerUpdate = (event) => { emit('update:brakePower', Number(event.target.value)); };
    const emitSlowDownForceUpdate = (event) => { emit('update:slowDownForce', Number(event.target.value)); };
    const emitSuspensionStiffnessUpdate = (event) => { emit('update:suspensionStiffness', Number(event.target.value)); };
    const emitSuspensionRestLengthUpdate = (event) => { emit('update:suspensionRestLength', Number(event.target.value)); };
    const emitFrictionSlipUpdate = (event) => { emit('update:frictionSlip', Number(event.target.value)); };
    const emitDampingRelaxationUpdate = (event) => { emit('update:dampingRelaxation', Number(event.target.value)); };
    const emitDampingCompressionUpdate = (event) => { emit('update:dampingCompression', Number(event.target.value)); };
    const emitMaxSuspensionForceUpdate = (event) => { emit('update:maxSuspensionForce', Number(event.target.value)); };
    const emitRollInfluenceUpdate = (event) => { emit('update:rollInfluence', Number(event.target.value)); };
    const emitMaxSuspensionTravelUpdate = (event) => { emit('update:maxSuspensionTravel', Number(event.target.value)); };

    const resetCar = () => {
      console.warn("Track.vue: resetCar called. Consider emitting event to Race.vue to handle reset.");
      // emit('reset-car'); // 例如
    };
    
    watch(debugRender, (newValue) => {
      if (physicsEngine.value) { physicsEngine.value.debug = newValue; }
    });
    
    const showThirdPersonControls = computed(() => cameraMode.value === 'thirdPersonFollow');
    
    const updateWheelRotations = () => {
        if (!props.wheelQuaternions || props.wheelQuaternions.length < 4) return;
        try {
            // Rear wheels (usually no steering correction needed)
            if(wheelMeshRefs.value.rl) wheelMeshRefs.value.rl.quaternion.copy(props.wheelQuaternions[0]);
            if(wheelMeshRefs.value.rr) wheelMeshRefs.value.rr.quaternion.copy(props.wheelQuaternions[1]);

            // Front wheels - Apply correction
            if(wheelMeshRefs.value.fl) wheelMeshRefs.value.fl.quaternion.copy(props.wheelQuaternions[2]);
            if(wheelMeshRefs.value.fr) wheelMeshRefs.value.fr.quaternion.copy(props.wheelQuaternions[3]);
        } catch (error) {
            console.error("Error copying wheel quaternion:", error, props.wheelQuaternions);
        }
    };
    
    onMounted(() => {
      console.log("Track.vue: onMounted - Start");
      initScene();
      console.log("Track.vue: initScene finished. Loading model...");
      loadSelectedCarModel(); // 移除 await，让模型在后台加载
      console.log("Track.vue: Model loading initiated. Starting animation loop...");
      animate();
      console.log("Track.vue: onMounted - End");
    });
    
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
      debugRender,
      gravity,
      physicsEngine,
      enginePower: props.enginePower,
      turnStrength: props.turnStrength,
      vehicleMass: props.vehicleMass,
      linearDamping: props.linearDamping,
      angularDamping: props.angularDamping,
      groundFriction: props.groundFriction,
      brakePower: props.brakePower,
      slowDownForce: props.slowDownForce,
      suspensionStiffness: props.suspensionStiffness,
      suspensionRestLength: props.suspensionRestLength,
      frictionSlip: props.frictionSlip,
      dampingRelaxation: props.dampingRelaxation,
      dampingCompression: props.dampingCompression,
      maxSuspensionForce: props.maxSuspensionForce,
      rollInfluence: props.rollInfluence,
      maxSuspensionTravel: props.maxSuspensionTravel,
      onPhysicsReady,
      updateGravity,
      emitEnginePowerUpdate,
      emitTurnStrengthUpdate,
      emitVehicleMassUpdate,
      emitLinearDampingUpdate,
      emitAngularDampingUpdate,
      emitGroundFrictionUpdate,
      emitBrakePowerUpdate,
      emitSlowDownForceUpdate,
      emitSuspensionStiffnessUpdate,
      emitSuspensionRestLengthUpdate,
      emitFrictionSlipUpdate,
      emitDampingRelaxationUpdate,
      emitDampingCompressionUpdate,
      emitMaxSuspensionForceUpdate,
      emitRollInfluenceUpdate,
      emitMaxSuspensionTravelUpdate,
      resetCar,
      cameraMode,
      cameraDistance,
      cameraHeight,
      showThirdPersonControls,
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

.save-btn {
  background-color: #4CAF50; /* Green */
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  margin-top: 10px;
  transition: background-color 0.2s ease;
}

.save-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.save-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style> 