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
  // Add other tunable parameters if needed (e.g., customSlidingRotationalSpeed, wheelRadius)
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
    setInitialParams(initialSettings) {
      if (initialSettings && typeof initialSettings === 'object') {
        // Ensure all default keys are present, merging initialSettings over defaults
        this.tuningParams = { ...defaultTuning, ...initialSettings };
        console.log('[TuningStore] Initialized tuningParams with provided settings:', this.tuningParams);
      } else {
        // Fallback to defaults if initialSettings are invalid
        this.tuningParams = { ...defaultTuning };
        console.warn('[TuningStore] Invalid initialSettings provided, falling back to defaults.');
      }
      // We don't need isLoading here as it's synchronous initialization
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
          console.log('Loaded tuning from DB for:', vehicleId);
          // Return the settings found in DB, merged with defaults for safety
          return { ...defaultTuning, ...vehicleDataFromDB.customSettings }; 
        } else {
          console.log('No custom tuning found in DB for:', vehicleId);
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