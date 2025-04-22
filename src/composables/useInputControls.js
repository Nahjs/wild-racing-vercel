import { ref, onMounted, onUnmounted } from 'vue';
import { ControlState, KeyboardController, TouchController } from '@/core/input/InputManager';
import { useDeviceDetection } from '@/composables/useDeviceDetection';

export function useInputControls() {
  const controlState = ref(new ControlState());
  let keyboardController = null;
  let touchController = null; // 启用触摸控制器
  
  const { isMobile } = useDeviceDetection();

  function setupInputListeners() {
    // 始终设置键盘控制（桌面设备或桌面浏览器上）
    keyboardController = new KeyboardController(controlState.value);
    
    // 如果是移动设备，添加触摸控制（启用自动触摸控制）
    if (isMobile.value) {
      console.log("移动设备检测到，初始化触摸控制器（自动模式已启用）");
      const touchElement = document.body; // 使用整个页面作为触摸区域
      touchController = new TouchController(controlState.value, touchElement);
      
      // 启用自动触摸控制
      touchController.setEnabled(true);
    }
  }

  function removeInputListeners() {
    if (keyboardController) {
      keyboardController.removeListeners();
      keyboardController = null;
    }
    if (touchController) {
      touchController.removeListeners();
      touchController = null;
    }
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
    isMobile
    // Expose setup/remove functions if manual control is ever needed outside setup
    // setupInputListeners, 
    // removeInputListeners 
  };
} 