import { ref, onMounted, onUnmounted } from 'vue';

export function useDeviceDetection() {
  const isMobile = ref(false);
  const isLandscape = ref(false);
  const isFullscreen = ref(false);
  const fullscreenRequested = ref(false);
  
  const checkOrientation = () => {
    isLandscape.value = window.innerWidth > window.innerHeight;
  };
  
  const checkDevice = () => {
    // 增强设备检测逻辑
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    
    // 同时检查触摸点数量、用户代理和屏幕尺寸
    isMobile.value = mobileRegex.test(userAgent) || 
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
                     window.matchMedia("(max-width: 768px)").matches;

    
    checkOrientation();
  };
  
  // 进入全屏模式
  const enterFullscreen = async (onErrorCallback) => {
    try {
      const docEl = document.documentElement;
      
      // 检查是否在用户交互事件处理程序中
      const isUserActivated = navigator.userActivation ? 
        navigator.userActivation.isActive : 
        true; // 如果不支持userActivation API，假设允许
      
      if (!isUserActivated) {
        fullscreenRequested.value = true; // 标记已请求全屏
        if (onErrorCallback && typeof onErrorCallback === 'function') {
          onErrorCallback(new Error('需要用户交互'));
        }
        return Promise.reject(new Error('需要用户交互'));
      }
      
      // 尝试请求全屏
      try {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) { /* Safari */
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) { /* IE11 */
          await docEl.msRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) { /* Firefox */
          await docEl.mozRequestFullScreen();
        }
      } catch (fullscreenError) {
        console.warn('进入全屏模式失败:', fullscreenError);
        if (onErrorCallback && typeof onErrorCallback === 'function') {
          onErrorCallback(fullscreenError);
        }
        return Promise.reject(fullscreenError);
      }
      
      // 锁定屏幕方向为横屏（如果支持）
      if (screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock('landscape');
        } catch (orientationError) {
          // 屏幕方向锁定失败不应该中断全屏流程
          console.warn('无法锁定屏幕方向:', orientationError);
        }
      } else {
      }
      
      isFullscreen.value = true;
      fullscreenRequested.value = false; // 重置请求标记
      return Promise.resolve();
    } catch (error) {
      console.warn('进入全屏模式失败:', error);
      if (onErrorCallback && typeof onErrorCallback === 'function') {
        onErrorCallback(error);
      }
      return Promise.reject(error);
    }
  };
  
  // 退出全屏模式
  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { /* Safari */
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE11 */
        await document.msExitFullscreen();
      } else if (document.mozCancelFullScreen) { /* Firefox */
        await document.mozCancelFullScreen();
      }
      
      isFullscreen.value = false;
    } catch (error) {
      console.warn('退出全屏模式失败:', error);
    }
  };
  
  // 切换全屏模式
  const toggleFullscreen = (onErrorCallback) => {
    if (!isFullscreen.value) {
      return enterFullscreen(onErrorCallback);
    } else {
      return exitFullscreen();
    }
  };
  
  // 检查是否处于全屏状态
  const checkFullscreenState = () => {
    isFullscreen.value = !!(
      document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement || 
      document.msFullscreenElement
    );
  };
  
  // 监听屏幕方向变化的处理函数
  const handleOrientationChange = () => {
    setTimeout(checkOrientation, 100); // 添加延迟确保获取正确的值
  };
  
  // 监听全屏状态变化
  const handleFullscreenChange = () => {
    checkFullscreenState();
  };
  
  onMounted(() => {
    checkDevice();
    checkFullscreenState();
    
    // 监听窗口大小变化，更新屏幕方向
    window.addEventListener('resize', checkOrientation);
    
    // 监听屏幕方向变化事件
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // 监听全屏状态变化事件
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  });
  
  onUnmounted(() => {
    // 清理事件监听
    window.removeEventListener('resize', checkOrientation);
    window.removeEventListener('orientationchange', handleOrientationChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
  });
  
  return {
    isMobile,
    isLandscape,
    isFullscreen,
    fullscreenRequested,
    checkDevice,
    checkOrientation,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen
  };
} 