import { ref, onMounted, onUnmounted, onBeforeMount } from 'vue';
import { ControlState, KeyboardController, TouchController } from '@/core/input/InputManager';
import { useDeviceDetection } from '@/composables/useDeviceDetection';

// 创建单例控制器实例
let keyboardControllerInstance = null;
let touchControllerInstance = null;

export function useInputControls() {
  const controlState = ref(new ControlState());
  const { isMobile } = useDeviceDetection();
  const controllersInitialized = ref(false);

  // 添加手动按键处理函数
  const handleDirectKeyPress = (event) => {
    // 只有在控制器初始化后才处理按键
    if (!controllersInitialized.value) return;

    const key = event.key.toLowerCase();
    
    console.log(`[useInputControls] 直接处理键盘事件 ${event.type}: ${key}`);
    
    if (event.type === 'keydown') {
      // 按键按下时处理
      switch (key) {
        case 'w':
        case 'arrowup':
          controlState.value.accelerate = true;
          break;
        case 's':
        case 'arrowdown':
          controlState.value.brake = true;
          break;
        case 'a':
        case 'arrowleft':
          controlState.value.turnLeft = true;
          break;
        case 'd':
        case 'arrowright':
          controlState.value.turnRight = true;
          break;
        case ' ': // 空格键
          controlState.value.handbrake = true;
          break;
      }
    } else if (event.type === 'keyup') {
      // 按键释放时处理
      switch (key) {
        case 'w':
        case 'arrowup':
          controlState.value.accelerate = false;
          break;
        case 's':
        case 'arrowdown':
          controlState.value.brake = false;
          break;
        case 'a':
        case 'arrowleft':
          controlState.value.turnLeft = false;
          break;
        case 'd':
        case 'arrowright':
          controlState.value.turnRight = false;
          break;
        case ' ': // 空格键
          controlState.value.handbrake = false;
          break;
      }
    }
    
    // 记录控制状态变化
    console.log('[useInputControls] 控制状态更新:', JSON.stringify(controlState.value));
  };

  function setupInputListeners() {
    // 添加更详细的日志
    console.log("useInputControls: 设置输入监听器");
    console.log(`useInputControls: 设备类型 - ${isMobile.value ? '移动设备' : '桌面设备'}`);
    
    // 如果控制器已经初始化，先移除现有的
    if (controllersInitialized.value) {
      console.log("useInputControls: 控制器已初始化，先移除现有监听器");
      removeInputListeners();
    }
    
    // 确保控制状态使用正确的布尔值
    // 重置所有控制值为布尔false
    const resetControlState = () => {
      controlState.value.accelerate = false;
      controlState.value.brake = false;
      controlState.value.turnLeft = false;
      controlState.value.turnRight = false;
      controlState.value.handbrake = false;
      controlState.value.gearUp = false;
      controlState.value.gearDown = false;
      // 保持数值型属性不变
    };
    
    // 重置控制状态，确保所有值都是布尔型
    resetControlState();
    
    // 键盘控制器处理
    if (keyboardControllerInstance) {
      console.log("useInputControls: 清理现有键盘控制器");
      keyboardControllerInstance.removeListeners();
      keyboardControllerInstance = null; // 完全清除旧实例
    }
    
    // 创建新的键盘控制器实例
    console.log("useInputControls: 创建新的键盘控制器");
    keyboardControllerInstance = new KeyboardController();
    keyboardControllerInstance.controlState = controlState.value;
    
    // 添加直接事件监听器作为备份
    window.addEventListener('keydown', handleDirectKeyPress);
    window.addEventListener('keyup', handleDirectKeyPress);
    console.log("useInputControls: 添加了直接键盘事件处理函数");
    
    // 如果是移动设备，添加触摸控制
    if (isMobile.value) {
      console.log("useInputControls: 移动设备检测到，初始化触摸控制器");
      
      const touchElement = document.body; // 使用整个页面作为触摸区域
      
      if (touchControllerInstance) {
        console.log("useInputControls: 清理现有触摸控制器");
        touchControllerInstance.removeListeners();
        touchControllerInstance = null; // 完全清除旧实例
      }
      
      console.log("useInputControls: 创建新的触摸控制器");
      touchControllerInstance = new TouchController(controlState.value, touchElement);
      
      // 启用自动触摸控制
      touchControllerInstance.setEnabled(true);
      console.log("useInputControls: 触摸控制器已启用");
    } else if (touchControllerInstance) {
      // 如果不是移动设备但存在触摸控制器，禁用并移除它
      console.log("useInputControls: 桌面设备，禁用并移除现有触摸控制器");
      touchControllerInstance.setEnabled(false);
      touchControllerInstance.removeListeners();
      touchControllerInstance = null; // 完全清除触摸控制器
    }
    
    controllersInitialized.value = true;
    
    // 为调试增加一个焦点事件监听器
    window.addEventListener('focus', () => {
      console.log("useInputControls: 窗口获得焦点，检查控制器状态");
      if (keyboardControllerInstance) {
        keyboardControllerInstance.resetKeyState();
      }
    });
    
    // 测试控制状态是否正确
    console.log("useInputControls: 控制状态初始值:", JSON.stringify(controlState.value));
    
    return { 
      keyboardController: keyboardControllerInstance, 
      touchController: touchControllerInstance 
    };
  }

  function removeInputListeners() {
    console.log("useInputControls: 移除输入监听器");
    
    // 移除直接事件监听器
    window.removeEventListener('keydown', handleDirectKeyPress);
    window.removeEventListener('keyup', handleDirectKeyPress);
    
    if (keyboardControllerInstance) {
      keyboardControllerInstance.removeListeners();
      console.log("useInputControls: 键盘控制器监听器已移除");
    }
    
    if (touchControllerInstance) {
      touchControllerInstance.setEnabled(false);
      touchControllerInstance.removeListeners();
      console.log("useInputControls: 触摸控制器监听器已移除");
    }
    
    controllersInitialized.value = false;
  }

  function reinitializeInputControls() {
    console.log("useInputControls: 强制重新初始化输入控制");
    removeInputListeners();
    // 延迟一帧重新设置，确保清理完成
    setTimeout(() => {
      setupInputListeners();
    }, 0);
  }

  // 在组件挂载前就开始设置监听器
  onBeforeMount(() => {
    console.log("useInputControls: 组件挂载前，设置输入监听器");
    setupInputListeners();
  });

  // 在组件挂载时确保监听器已设置
  onMounted(() => {
    console.log("useInputControls: 组件挂载，确认输入监听器已设置");
    if (!controllersInitialized.value) {
      setupInputListeners();
    }
    
    // 组件挂载后，发送一个测试键盘事件，检查事件处理是否正常
    setTimeout(() => {
      console.log("useInputControls: 发送测试键盘事件...");
      const testEvent = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true });
      window.dispatchEvent(testEvent);
    }, 1000);
  });

  // 在组件卸载时移除监听器
  onUnmounted(() => {
    console.log("useInputControls: 组件卸载，移除输入监听器");
    removeInputListeners();
  });

  // 返回响应式状态和控制方法
  return {
    controlState,
    isMobile,
    setupInputListeners,
    removeInputListeners,
    reinitializeInputControls  // 新增：提供重新初始化方法
  };
} 