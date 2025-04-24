import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue';
import { ControlState, KeyboardController } from '@/core/input/InputManager';
import { useDeviceDetection } from '@/composables/useDeviceDetection';

// --- Singleton Implementation --- 
let instance = null;

function createInputControls() {
  const controlState = ref(new ControlState()); // Keep using ref
  const { isMobile } = useDeviceDetection();
  let keyboardControllerInstance = null;
  let listenersInitialized = false;
  let cleanupGlobalListeners = null;

  function setupInputListenersInternal() {
    if (listenersInitialized) {
      return;
    }

    // Watch for isMobile changes
    const stopWatch = watch(isMobile, (newValue, oldValue) => {
      // Clean up keyboard controller if switching TO mobile or already mobile
      if (newValue && keyboardControllerInstance) {
        // keyboardControllerInstance.removeListeners(); // dispose calls removeListeners
        keyboardControllerInstance.dispose();
        keyboardControllerInstance = null;
      }
      // Create keyboard controller if switching TO desktop AND no instance exists
      else if (!newValue && !keyboardControllerInstance) {
        keyboardControllerInstance = new KeyboardController();
        // Assign the shared controlState ref to the keyboard controller
        if (keyboardControllerInstance) {
            keyboardControllerInstance.controlState = controlState.value;
        } else {
             console.error("[useInputControls] Failed to create KeyboardController instance.");
        }
      }
    }, { immediate: true }); // immediate: true ensures it runs on initial setup

    // Global focus/blur handling
    const handleFocus = () => {
      controlState.value.reset();
      if (keyboardControllerInstance) {
        keyboardControllerInstance.resetKeyState();
      }
    };
    const handleBlur = () => {
      controlState.value.reset();
       if (keyboardControllerInstance) {
        keyboardControllerInstance.resetKeyState();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('visibilitychange', handleBlur);

    listenersInitialized = true;

    // Cleanup function for listeners added HERE
    cleanupGlobalListeners = () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('visibilitychange', handleBlur);
      stopWatch(); // Stop watching isMobile
      // Cleanup keyboard controller if it exists
      if (keyboardControllerInstance) {
        keyboardControllerInstance.dispose();
        keyboardControllerInstance = null;
      }
      listenersInitialized = false;
    };

     return cleanupGlobalListeners;
  }

  const cleanupListeners = setupInputListenersInternal();

  // 添加 reinitializeInputControls 方法
  const reinitializeInputControls = () => {
    console.log('[useInputControls] Reinitializing input controls...');
    // 清理旧的监听器和实例
    if (cleanupListeners) {
      cleanupListeners();
    }
    if (keyboardControllerInstance) {
       keyboardControllerInstance.dispose();
       keyboardControllerInstance = null;
    }
    listenersInitialized = false; // 重置初始化标志
    // 重新设置监听器
    setupInputListenersInternal();
    console.log('[useInputControls] Input controls reinitialized.');
  };

  return {
    controlState,
    isMobile,
    reinitializeInputControls, // 暴露 reinitialize 方法
    cleanup: () => {
        if (cleanupListeners) {
            cleanupListeners();
        }
        instance = null; // 清除单例引用
    }
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