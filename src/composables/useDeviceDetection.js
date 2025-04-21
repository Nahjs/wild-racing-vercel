import { ref, onMounted, onUnmounted } from 'vue';

export function useDeviceDetection() {
  const isMobile = ref(false);
  const isLandscape = ref(false);
  
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
  
  // 监听屏幕方向变化的处理函数
  const handleOrientationChange = () => {
    setTimeout(checkOrientation, 100); // 添加延迟确保获取正确的值
  };
  
  onMounted(() => {
    checkDevice();
    
    // 监听窗口大小变化，更新屏幕方向
    window.addEventListener('resize', checkOrientation);
    
    // 监听屏幕方向变化事件
    window.addEventListener('orientationchange', handleOrientationChange);
  });
  
  onUnmounted(() => {
    // 清理事件监听
    window.removeEventListener('resize', checkOrientation);
    window.removeEventListener('orientationchange', handleOrientationChange);
  });
  
  return {
    isMobile,
    isLandscape,
    checkDevice,
    checkOrientation
  };
} 