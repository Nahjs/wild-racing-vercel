import { ref, onMounted, onUnmounted, onBeforeMount, shallowRef } from 'vue';
import { ControlState, KeyboardController } from '@/core/input/InputManager';
import { useDeviceDetection } from '@/composables/useDeviceDetection';

// --- Singleton Implementation --- 
let instance = null;

function createInputControls() {
  console.log("===== CREATE INPUT CONTROLS SINGLETON =====");
  const controlState = ref(new ControlState()); // Use ref instead of shallowRef
  const { isMobile } = useDeviceDetection();
  let keyboardControllerInstance = null;
  let listenersInitialized = false;

  // Make setup/remove functions internal to the singleton scope
  function setupInputListenersInternal() {
    if (listenersInitialized) {
      console.log("createInputControls: Listeners already initialized, skipping setup.");
      return;
    }
    console.log("createInputControls: Setting up input listeners...");
    console.log(`createInputControls: Device Type - ${isMobile.value ? 'Mobile' : 'Desktop'}`);

    // Reset state before setting up
    controlState.value.reset();

    // Keyboard controller only for desktop
    if (!isMobile.value) {
      if (keyboardControllerInstance) {
         keyboardControllerInstance.removeListeners();
         keyboardControllerInstance = null;
      }
      console.log("createInputControls: Creating KeyboardController (Desktop)");
      keyboardControllerInstance = new KeyboardController();
      keyboardControllerInstance.controlState = controlState.value; 
    } else {
       if (keyboardControllerInstance) {
         keyboardControllerInstance.removeListeners();
         keyboardControllerInstance = null;
       }
      console.log("createInputControls: Mobile device detected. KeyboardController inactive.");
    }

    // Global focus/blur handling (can affect state)
    const handleFocus = () => {
      console.log("createInputControls: Window focused. Resetting control state.");
      controlState.value.reset();
      if (keyboardControllerInstance) {
        keyboardControllerInstance.resetKeyState();
      }
    };
    const handleBlur = () => {
      console.log("createInputControls: Window blurred. Resetting control state.");
      controlState.value.reset();
       if (keyboardControllerInstance) {
        keyboardControllerInstance.resetKeyState();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('visibilitychange', handleBlur);

    listenersInitialized = true;
    console.log("createInputControls: Listeners initialized.");

    // Return cleanup function
    return () => {
      console.log("createInputControls: Cleaning up input listeners...");
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('visibilitychange', handleBlur);
      if (keyboardControllerInstance) {
        keyboardControllerInstance.dispose();
        keyboardControllerInstance = null;
      }
      listenersInitialized = false;
      console.log("createInputControls: Input listeners cleaned up.");
    };
  }

  // Initial setup call
  const cleanupListeners = setupInputListenersInternal();

  // Method to re-check device and re-setup if needed (e.g., for HMR or drastic changes)
  // Typically not needed for production runtime
  function reinitialize() {
     console.warn("createInputControls: Reinitializing input controls singleton...");
     cleanupListeners(); 
     // Re-running setup implicitly happens on next access if needed, 
     // but let's be explicit for clarity if the composable itself is called again.
     // Note: This might cause issues if called mid-game. Use with caution.
     // cleanupListeners = setupInputListenersInternal(); 
  }

  return {
    controlState,
    isMobile, // Expose isMobile for convenience
    // Expose reinitialize carefully, maybe only for debugging
    // reinitializeInputControls: reinitialize 
     cleanup: cleanupListeners // Provide a way to manually clean up if needed outside components
  };
}
// --- End Singleton Implementation ---

export function useInputControls() {
  if (!instance) {
    instance = createInputControls();
  }
  // Always return the same instance
  return instance;
} 