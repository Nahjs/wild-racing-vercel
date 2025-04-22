import { ref, onMounted, onUnmounted } from 'vue';

export function useDeviceDetection() {
  const isMobile = ref(false);
  const isLandscape = ref(false);
  const isFullscreen = ref(false);
  const fullscreenRequested = ref(false);
  
  const checkOrientation = () => {
    isLandscape.value = window.innerWidth > window.innerHeight;
    console.log(`屏幕方向: ${isLandscape.value ? '横屏' : '竖屏'}`);
  };
  
  const checkDevice = () => {
    isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    checkOrientation();
    console.log(`设备类型: ${isMobile.value ? '移动设备' : '桌面设备'}`);
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
        console.log('提示：全屏模式需要用户交互触发，请点击按钮');
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
          console.log('屏幕已锁定为横屏模式');
        } catch (orientationError) {
          // 屏幕方向锁定失败不应该中断全屏流程
          console.warn('无法锁定屏幕方向:', orientationError);
          console.log('提示：请手动将设备旋转为横屏获得最佳体验');
        }
      } else {
        console.log('此设备不支持屏幕方向锁定，请手动将设备旋转为横屏');
      }
      
      isFullscreen.value = true;
      fullscreenRequested.value = false; // 重置请求标记
      console.log('进入全屏模式成功');
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
      console.log('退出全屏模式成功');
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