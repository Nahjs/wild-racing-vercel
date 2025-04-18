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
  suspensionRestLength: 0.5,
  frictionSlip: 30,
  dampingRelaxation: 2.3,
  dampingCompression: 4.3,
  maxSuspensionForce: 10000,
  rollInfluence: 0.01,
  maxSuspensionTravel: 1,
  initialCorrectionAxis: 'x',
  initialCorrectionAngle: 90,
  showWheelAxes: false,
  // Add other tunable parameters if needed (e.g., customSlidingRotationalSpeed, wheelRadius)
};

export const useTuningStore = defineStore('tuning', () => {
  // State: Use refs for individual parameters
  const currentVehicleId = ref(null);
  const tuningParams = ref({ ...defaultTuning });
  const isLoading = ref(false);
  const isSaving = ref(false);

  // Actions
  async function loadTuning(vehicleId) {
    if (!vehicleId) return;
    isLoading.value = true;
    currentVehicleId.value = vehicleId;
    try {
      const vehicleDataFromDB = await vehicleService.getVehicle(vehicleId);
      if (vehicleDataFromDB?.customSettings) {
        // Merge DB settings with defaults, ensuring all keys exist
        tuningParams.value = { 
          ...defaultTuning, 
          ...vehicleDataFromDB.customSettings 
        };
        console.log('Loaded tuning from DB for:', vehicleId, tuningParams.value);
      } else {
        // Reset to defaults if no custom settings found in DB
        tuningParams.value = { ...defaultTuning };
        console.log('No custom tuning found in DB for:', vehicleId, '. Using defaults.');
      }
    } catch (error) {
      console.error("Failed to load tuning from DB:", error);
      // Fallback to defaults on error
      tuningParams.value = { ...defaultTuning };
    } finally {
      isLoading.value = false;
    }
  }

  async function saveTuning() {
    if (!currentVehicleId.value) {
      console.warn("Cannot save tuning: No current vehicle ID set.");
      return;
    }
    isSaving.value = true;
    try {
      // Pass only the tuningParams object as customSettings
      await vehicleService.batchUpdateVehicle(currentVehicleId.value, {
        customSettings: tuningParams.value
      });
      console.log('Tuning saved successfully for:', currentVehicleId.value);
      // Optional: Add success feedback (e.g., via another store or event)
    } catch (error) {
      console.error("Failed to save tuning:", error);
      // Optional: Add error feedback
    } finally {
      isSaving.value = false;
    }
  }

  // Update individual tuning parameter
  function updateParam(paramName, value) {
    if (tuningParams.value.hasOwnProperty(paramName)) {
      tuningParams.value[paramName] = value;
    } else {
      console.warn(`Trying to update non-existent tuning parameter: ${paramName}`);
    }
  }
  
  // Reset tuning to defaults
  function resetToDefaults() {
      tuningParams.value = { ...defaultTuning };
      console.log('Tuning reset to defaults.');
  }

  return {
    currentVehicleId,
    tuningParams,
    isLoading,
    isSaving,
    loadTuning,
    saveTuning,
    updateParam,
    resetToDefaults
  };
}); 