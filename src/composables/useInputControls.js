import { ref, onMounted, onUnmounted } from 'vue';
// Assuming these are correctly located now in @/core/input/
import { ControlState, KeyboardController, TouchController } from '@/core/input/InputManager';

export function useInputControls() {
  const controlState = ref(new ControlState());
  let keyboardController = null;
  // let touchController = null; // Keep for future touch implementation

  function setupInputListeners() {
    // Setup Keyboard
    keyboardController = new KeyboardController(controlState.value);
    
    // Setup Touch (if/when implemented)
    // touchController = new TouchController(controlState.value);
    console.log("Input listeners setup.");
  }

  function removeInputListeners() {
    if (keyboardController) {
      keyboardController.removeListeners();
      keyboardController = null;
    }
    // if (touchController) {
    //   touchController.removeListeners();
    //   touchController = null;
    // }
    console.log("Input listeners removed.");
  }

  // Use onMounted/onUnmounted to automatically handle listeners
  // when the composable is used within a component's setup function.
  onMounted(() => {
    setupInputListeners();
  });

  onUnmounted(() => {
    removeInputListeners();
  });

  // Return the reactive state and potentially control methods if needed
  return {
    controlState,
    // Expose setup/remove functions if manual control is ever needed outside setup
    // setupInputListeners, 
    // removeInputListeners 
  };
} 