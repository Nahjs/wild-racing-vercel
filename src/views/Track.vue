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
      <h3>车轮初始旋转调试</h3>
      <div class="control-group">
        <label>修正轴:</label>
        <select :value="initialCorrectionAxis" @change="emitInitialCorrectionAxisUpdate">
          <option value="x">X</option>
          <option value="y">Y</option>
          <option value="z">Z</option>
        </select>
      </div>
      <div class="control-group">
        <label>修正角度 ({{ initialCorrectionAngle }} 度):</label>
        <input type="range" min="-180" max="180" step="1" :value="initialCorrectionAngle" @input="emitInitialCorrectionAngleUpdate">
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
      'update:initialCorrectionAxis',
      'update:initialCorrectionAngle',
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
    initialCorrectionAxis: { type: String, required: true },
    initialCorrectionAngle: { type: Number, required: true },
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
      rawRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.value = rawRenderer;

      const hemisphereLight = markRaw(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));
      rawScene.add(hemisphereLight);

      const ambientLight = markRaw(new THREE.AmbientLight(0xffffff, 0.4));
      rawScene.add(ambientLight);

      rawDirectionalLight = markRaw(new THREE.DirectionalLight(0xffffff, 1.2));
      rawDirectionalLight.position.set(15, 30, 20);
      rawDirectionalLight.castShadow = true;
      rawDirectionalLight.shadow.mapSize.width = 2048;
      rawDirectionalLight.shadow.mapSize.height = 2048;
      rawDirectionalLight.shadow.camera.near = 0.5;
      rawDirectionalLight.shadow.camera.far = 500;
      rawDirectionalLight.shadow.camera.left = -80;
      rawDirectionalLight.shadow.camera.right = 80;
      rawDirectionalLight.shadow.camera.top = 80;
      rawDirectionalLight.shadow.camera.bottom = -80;
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
            const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
            const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
            carModel.value = markRaw(new THREE.Mesh(fallbackGeometry, fallbackMaterial));
            rawScene.add(carModel.value);
            return;
        }

        try {
            if (carModel.value) {
                rawScene.remove(carModel.value);
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

            const baseData = props.selectedVehicle;
            const customSettings = baseData.customSettings || {};

            const scale = customSettings.scale ?? baseData.scale ?? 1.0;

            loadedModel.scale.set(scale, scale, scale);

            // --- 获取车轮父节点名称 --- 
            // 优先从配置读取，否则使用默认值
            let wheelParentNames = props.selectedVehicle.wheelNodeNames || { 
                rl: 'WheelBL', // 默认后左
                rr: 'WheelBR', // 默认后右
                fl: 'WheelFL', // 默认前左
                fr: 'WheelFR'  // 默认前右
            };
            console.log("Track.vue: Initial wheel parent names from config/defaults:", wheelParentNames);

            wheelMeshRefs.value = { fl: null, fr: null, rl: null, rr: null };
            const foundWheels = { fl: false, fr: false, rl: false, rr: false };
            const potentialWheelNodes = []; // 用于存储自动识别的潜在车轮节点
            const nodeNames = []; // Store all node names for later fuzzy matching if needed

            loadedModel.traverse((child) => {
                nodeNames.push(child.name);
                let assigned = false;
                // 1. 优先使用配置中的名称 (精确匹配)
                if (wheelParentNames.fl && child.name === wheelParentNames.fl) { wheelMeshRefs.value.fl = child; foundWheels.fl = true; assigned = true; }
                else if (wheelParentNames.fr && child.name === wheelParentNames.fr) { wheelMeshRefs.value.fr = child; foundWheels.fr = true; assigned = true; }
                else if (wheelParentNames.rl && child.name === wheelParentNames.rl) { wheelMeshRefs.value.rl = child; foundWheels.rl = true; assigned = true; }
                else if (wheelParentNames.rr && child.name === wheelParentNames.rr) { wheelMeshRefs.value.rr = child; foundWheels.rr = true; assigned = true; }
                
                // 记录潜在节点 (用于日志和未来的改进)
                if (!assigned) {
                    const nameLower = child.name.toLowerCase();
                    const keywords = ['wheel', '轮', 'tire', 'tyre'];
                    const patterns = [/wheel.?fl/, /wheel.?fr/, /wheel.?rl/, /wheel.?rr/, /wheel.?bl/, /wheel.?br/, /front.?l/, /front.?r/, /back.?l/, /back.?r/, /rear.?l/, /rear.?r/]; 
                    
                    if (keywords.some(kw => nameLower.includes(kw)) || patterns.some(p => nameLower.match(p))) {
                        potentialWheelNodes.push(child.name); 
                    }
                }
            });

            // 2. 如果配置不完整，尝试基于常见模式自动识别
            if (!foundWheels.fl || !foundWheels.fr || !foundWheels.rl || !foundWheels.rr) {
                console.warn("Track.vue: Configuration incomplete/missing. Attempting automatic wheel detection...");
                const autoDetectedWheels = { fl: null, fr: null, rl: null, rr: null };
                const flPatterns = [/wheel.?fl/i, /front.?l/i];
                const frPatterns = [/wheel.?fr/i, /front.?r/i];
                const rlPatterns = [/wheel.?[br]l/i, /back.?l/i, /rear.?l/i]; // Include BL and RL
                const rrPatterns = [/wheel.?[br]r/i, /back.?r/i, /rear.?r/i]; // Include BR and RR

                loadedModel.traverse((child) => {
                    const nameLower = child.name.toLowerCase();
                    if (!autoDetectedWheels.fl && flPatterns.some(p => nameLower.match(p))) autoDetectedWheels.fl = child;
                    if (!autoDetectedWheels.fr && frPatterns.some(p => nameLower.match(p))) autoDetectedWheels.fr = child;
                    if (!autoDetectedWheels.rl && rlPatterns.some(p => nameLower.match(p))) autoDetectedWheels.rl = child;
                    if (!autoDetectedWheels.rr && rrPatterns.some(p => nameLower.match(p))) autoDetectedWheels.rr = child;
                });

                // 合并自动检测结果到 wheelMeshRefs (仅当配置中未找到时)
                if (!foundWheels.fl && autoDetectedWheels.fl) { wheelMeshRefs.value.fl = autoDetectedWheels.fl; foundWheels.fl = true; console.log(`Track.vue: Auto-detected FL wheel: ${autoDetectedWheels.fl.name}`); }
                if (!foundWheels.fr && autoDetectedWheels.fr) { wheelMeshRefs.value.fr = autoDetectedWheels.fr; foundWheels.fr = true; console.log(`Track.vue: Auto-detected FR wheel: ${autoDetectedWheels.fr.name}`); }
                if (!foundWheels.rl && autoDetectedWheels.rl) { wheelMeshRefs.value.rl = autoDetectedWheels.rl; foundWheels.rl = true; console.log(`Track.vue: Auto-detected RL/BL wheel: ${autoDetectedWheels.rl.name}`); }
                if (!foundWheels.rr && autoDetectedWheels.rr) { wheelMeshRefs.value.rr = autoDetectedWheels.rr; foundWheels.rr = true; console.log(`Track.vue: Auto-detected RR/BR wheel: ${autoDetectedWheels.rr.name}`); }
            }

            // 最终检查和日志记录
            const allWheelsFound = Object.values(foundWheels).every(found => found);
            if (allWheelsFound) {
                 console.log("Track.vue: Successfully found/assigned all wheel nodes:", wheelMeshRefs.value);
            } else {
                console.error("Track.vue: Failed to find all required wheel nodes after config and auto-detection.", foundWheels);
                // 记录所有节点名称以供调试
                console.warn("Track.vue: All node names in the model:", nodeNames);
                // 如果有潜在节点但未被自动识别，则记录下来
                if (potentialWheelNodes.length > 0) {
                    console.warn("Track.vue: Potential wheel nodes found by keyword/pattern (not automatically assigned):", [...new Set(potentialWheelNodes)]);
                }
                 // 即使不完整，也记录下已找到的部分
                 console.log("Track.vue: Partially found wheel nodes:", wheelMeshRefs.value);
            }
            
            // --- 添加坐标轴帮助器 --- 
            Object.values(wheelMeshRefs.value).forEach(wheelRef => {
              if (wheelRef) {
                // 移除旧的帮助器 (如果存在)
                const existingHelper = wheelRef.getObjectByName('axesHelper');
                if (existingHelper) {
                  wheelRef.remove(existingHelper);
                }
                const axesHelper = new THREE.AxesHelper(0.5); // 调整大小
                axesHelper.name = 'axesHelper'; // 命名以便查找
                wheelRef.add(axesHelper);
              }
            });
            // ----------------------
            
            carModel.value = markRaw(loadedModel);
            rawScene.add(carModel.value);
            console.log("Track.vue: Model loaded and added to scene.");

            emit('model-ready', carModel.value);

        } catch (error) {
            console.error('Track.vue: Failed to load selected model:', error);
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
    const emitInitialCorrectionAxisUpdate = (event) => { emit('update:initialCorrectionAxis', event.target.value); };
    const emitInitialCorrectionAngleUpdate = (event) => { emit('update:initialCorrectionAngle', Number(event.target.value)); };

    const resetCar = () => {
      console.warn("Track.vue: resetCar called. Consider emitting event to Race.vue to handle reset.");
    };
    
    watch(debugRender, (newValue) => {
      if (physicsEngine.value) { physicsEngine.value.debug = newValue; }
    });
    
    const showThirdPersonControls = computed(() => cameraMode.value === 'thirdPersonFollow');
    
   const updateWheelRotations = () => { 
    if (!props.wheelQuaternions || props.wheelQuaternions.length < 4 || !carModel.value) return;

    const chassisQuaternion = carModel.value.quaternion;
    const invChassisQuaternion = chassisQuaternion.clone().invert();
    const localWheelQuaternion = new THREE.Quaternion();
    const finalWheelQuaternion = new THREE.Quaternion(); // 用于存储最终组合旋转

    // --- 根据调试控件动态生成初始修正四元数 ---
    let axis;
    switch (props.initialCorrectionAxis) {
        case 'y': axis = new THREE.Vector3(0, 1, 0); break;
        case 'z': axis = new THREE.Vector3(0, 0, 1); break;
        default:  axis = new THREE.Vector3(1, 0, 0); // 默认为 X 轴
    }
    const angleRad = THREE.MathUtils.degToRad(props.initialCorrectionAngle);
    const initialCorrectionQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
    // --------------------------------------------

    try {
        const wheelRefsMap = {
            0: wheelMeshRefs.value.rl,
            1: wheelMeshRefs.value.rr,
            2: wheelMeshRefs.value.fl,
            3: wheelMeshRefs.value.fr 
        };

        for (let i = 0; i < props.wheelQuaternions.length; i++) {
            const wheelRef = wheelRefsMap[i];
            const physicsQuaternion = props.wheelQuaternions[i]; 

            if (wheelRef && physicsQuaternion instanceof THREE.Quaternion) {
                // 1. 计算局部物理旋转
                localWheelQuaternion.copy(invChassisQuaternion).multiply(physicsQuaternion);
                
                // 2. 组合旋转: final = localPhysics * initialCorrection
                finalWheelQuaternion.copy(initialCorrectionQuaternion).multiply(localWheelQuaternion);
                
                // 应用最终计算出的旋转到车轮模型
                wheelRef.quaternion.copy(finalWheelQuaternion);

                // // 调试: 确保坐标轴帮助器跟随旋转 (如果之前未添加)
                // const helper = wheelRef.getObjectByName('axesHelper');
                // if (!helper) {
                //   const axesHelper = new THREE.AxesHelper(0.5); 
                //   axesHelper.name = 'axesHelper'; 
                //   wheelRef.add(axesHelper);
                // }

            } else if (physicsQuaternion && !(physicsQuaternion instanceof THREE.Quaternion)) {
                console.warn(`Track.vue: wheelQuaternions[${i}] is not a THREE.Quaternion instance.`);
            }
        }
    } catch (error) {
        console.error("Track.vue: Error applying wheel quaternion:", error, props.wheelQuaternions);
    }
};

    
    onMounted(() => {
      console.log("Track.vue: onMounted - Start");
      initScene();
      console.log("Track.vue: initScene finished. Loading model...");
      loadSelectedCarModel();
      console.log("Track.vue: Model loading initiated. Starting animation loop...");
      animate();
      console.log("Track.vue: onMounted - End");
    });
    
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      
      if (rawRenderer) {
        rawRenderer.dispose();
      }
      if (orbitControls) {
          orbitControls.dispose();
      }
      if (rawScene) {
          rawScene.traverse(object => {
              if (object.geometry) {
                  object.geometry.dispose();
              }
              if (object.material) {
                  if (Array.isArray(object.material)) {
                      object.material.forEach(material => material.dispose());
                  } else {
                      object.material.dispose();
                  }
              }
          });
      }
      rawScene = null;
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
      emitInitialCorrectionAxisUpdate,
      emitInitialCorrectionAngleUpdate,
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
  min-width: 250px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 10;
}

.control-group {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.control-group label {
  margin-bottom: 5px;
  font-size: 14px;
}

.control-group input[type="range"] {
  width: 100%;
  cursor: pointer;
}
.control-group input[type="checkbox"] {
  align-self: flex-start;
  margin-top: 4px;
}

.control-group span {
  font-size: 12px;
  margin-left: 5px;
  align-self: flex-end;
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
  width: 100%;
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
  background-color: #4CAF50;
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