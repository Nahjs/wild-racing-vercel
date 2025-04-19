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
    tuningParams: ref({ ...defaultTuning }),
    isLoading: ref(false),
    isSaving: ref(false)
  }),
  actions: {
    async loadTuning(vehicleId) {
      if (!vehicleId) return;
      this.isLoading = true;
      this.currentVehicleId = vehicleId;
      try {
        const vehicleDataFromDB = await vehicleService.getVehicle(vehicleId);
        if (vehicleDataFromDB?.customSettings) {
          // Merge DB settings with defaults, ensuring all keys exist
          this.tuningParams = { 
            ...defaultTuning, 
            ...vehicleDataFromDB.customSettings 
          };
          console.log('Loaded tuning from DB for:', vehicleId, this.tuningParams);
        } else {
          // Reset to defaults if no custom settings found in DB
          this.tuningParams = { ...defaultTuning };
          console.log('No custom tuning found in DB for:', vehicleId, '. Using defaults.');
        }
      } catch (error) {
        console.error("Failed to load tuning from DB:", error);
        // Fallback to defaults on error
        this.tuningParams = { ...defaultTuning };
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
        // Pass only the tuningParams object as customSettings
        await vehicleService.batchUpdateVehicle(this.currentVehicleId, {
          customSettings: this.tuningParams
        });
        console.log('Tuning saved successfully for:', this.currentVehicleId);
        // Optional: Add success feedback (e.g., via another store or event)
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
        console.log(`TuningStore: Updated ${paramName} to ${value}`);
        // Here you could potentially trigger re-application logic if needed immediately
      } else {
        console.warn(`TuningStore: Attempted to update unknown parameter "${paramName}"`);
      }
    },
    resetToDefaults() {
      this.tuningParams = { ...defaultTuning };
      console.log('Tuning reset to defaults.');
    }
  }
}); 