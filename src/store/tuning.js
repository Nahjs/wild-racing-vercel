import { defineStore } from 'pinia';
import { ref } from 'vue';
import { vehicleService } from '@/services/vehicleService';

// Define default tuning values (consider moving to config/tuningDefaults.js)
const defaultTuning = {
  enginePower: 2750,
  turnStrength: 0.5,
  vehicleMass: 653,
  linearDamping: 0.1,
  angularDamping: 0.5,
  groundFriction: 0.3,
  brakePower: 36,
  slowDownForce: 19.6,
  suspensionStiffness: 55,
  suspensionRestLength: 0.6,
  frictionSlip: 30,
  dampingRelaxation: 2.3,
  dampingCompression: 4.3,
  maxSuspensionForce: 10000,
  rollInfluence: 0.01,
  maxSuspensionTravel: 1.2,
  customSlidingRotationalSpeed: 30,
  initialCorrectionAxis: 'x',
  initialCorrectionAngle: 90,
  showWheelAxes: false,
  // 新增：驱动类型 ('RWD', 'FWD', 'AWD')
  driveType: 'RWD',
  // 新增：视觉 Y 偏移量
  visualOffsetY: -1.0,
  // 新增：车轮索引映射 (确保键与 Garage.vue 中使用的 wheelMeshRefs 一致)
  wheelIndices: { FL: 1, FR: 0, BL: 3, BR: 2 }, 
  // 调整默认悬挂连接点以匹配新尺寸和更低的位置
  connectionPoints: [ 
    { x: -0.85, y: -0.15, z:  1.4 }, // FL
    { x:  0.85, y: -0.15, z:  1.4 }, // FR
    { x: -0.85, y: -0.15, z: -1.4 }, // BL
    { x:  0.85, y: -0.15, z: -1.4 }  // BR
  ],
  // 新增：手刹相关参数
  handbrakePower: 65,             // 手刹力度 (降低以减小锁死效果)
  handbrakeSlipFactor: 0.3,       // 手刹状态下的摩擦系数倍率
  driftFrictionSlip: 12.0,        // 漂移时的轮胎摩擦系数 (增加以减小过度漂移)
  normalFrictionSlip: 30,         // 正常行驶的轮胎摩擦系数
  // 阿克曼转向相关参数
  baseSteeringRadius: 8,          // 基础转向半径
  speedSteeringFactor: 0.1,       // 车速对转向半径的影响因子
  wheelBase: 2.8,                 // 轴距值
  trackWidth: 1.7,                // 轮距值
  // 新增：默认颜色设置
  colors: {
    body: "#2f426f",  // 默认车身颜色
    wheel: "#1a1a1a"  // 默认轮毂颜色
  }
};

export const useTuningStore = defineStore('tuning', {
  state: () => ({
    currentVehicleId: ref(null),
    // Initialize with defaults, will be overwritten by setInitialParams
    tuningParams: ref({ ...defaultTuning }), 
    isLoading: ref(false),
    isSaving: ref(false)
  }),
  actions: {
    // New action to directly set tuning parameters from a source object
    setInitialParams(initialSettings, vehicleId) {
      // Set the current vehicle ID first
      if (vehicleId) {
        this.currentVehicleId = vehicleId;
      } else {
        console.warn('[TuningStore] setInitialParams called without a vehicleId.');
        this.currentVehicleId = null; // Ensure it's null if no ID provided
      }
      
      if (initialSettings && typeof initialSettings === 'object') {
        // 处理特殊的嵌套对象，如colors
        const processedSettings = { ...initialSettings };
        
        // 如果提供了colors对象，确保其正确合并
        if (initialSettings.colors) {
          processedSettings.colors = {
            ...defaultTuning.colors,  // 默认颜色
            ...initialSettings.colors  // 用户定义颜色覆盖默认值
          };
        }
        
        // Ensure all default keys are present, merging initialSettings over defaults
        this.tuningParams = { ...defaultTuning, ...processedSettings };
       } else {
        // Fallback to defaults if initialSettings are invalid
        this.tuningParams = { ...defaultTuning };
        console.warn(`[TuningStore] Invalid initialSettings provided for ${vehicleId}, falling back to defaults.`);
      }
    },

    // We will no longer call loadTuning directly from Garage for initial load
    // Keeping it might be useful for other potential scenarios, but clean up reset logic
    async _internalLoadFromDB(vehicleId) { // Renamed to avoid confusion
      if (!vehicleId) return null; // Return null if no ID
      this.isLoading = true;
      this.currentVehicleId = vehicleId;
      try {
        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleId);
        if (vehicleDataFromDB?.customSettings) {
          // Return the settings found in DB, merged with defaults for safety
          return { ...defaultTuning, ...vehicleDataFromDB.customSettings }; 
        } else {
          return null; // Return null if not found
        }
      } catch (error) {
        console.error("Failed to load tuning from DB:", error);
        return null; // Return null on error
      } finally {
        this.isLoading = false;
      }
    },

    async saveTuning() {
      if (!this.currentVehicleId) {
        console.warn("Cannot save tuning: No current vehicle ID set.");
        return;
      }
      this.isSaving = true;
      try {
        // --- 添加日志记录以方便复制 ---
        console.log(`[TuningStore Save] Preparing to save tuningParams for ${this.currentVehicleId}:`, JSON.parse(JSON.stringify(this.tuningParams))); 
        // 使用 JSON.parse(JSON.stringify(...)) 来获取纯净的 JS 对象副本，方便复制
        // --- 日志记录结束 ---

        // Pass only the tuningParams object as customSettings
        await vehicleService.batchUpdateVehicle(this.currentVehicleId, {
          customSettings: this.tuningParams // 整个 tuningParams 作为 customSettings 保存
        });
      } catch (error) {
        console.error("Failed to save tuning:", error);
        // Optional: Add error feedback
      } finally {
        this.isSaving = false;
      }
    },
    updateParam(paramName, value) {
      if (this.tuningParams.hasOwnProperty(paramName)) {
        this.tuningParams[paramName] = value;
        // Here you could potentially trigger re-application logic if needed immediately
      } else {
        console.warn(`TuningStore: Attempted to update unknown parameter "${paramName}"`);
      }
    },
    resetToDefaults() {
      this.tuningParams = { ...defaultTuning };
    }
  }
}); 