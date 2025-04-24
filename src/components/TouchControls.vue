<template>
  <div>
    <!-- 横屏警告 - 移到外层容器，与touch-controls分开 -->
    <div class="orientation-warning" v-if="isMobile && !isLandscape">
      <div class="warning-content">
        <div class="rotate-icon">⟳</div>
        <div class="warning-text">请横屏游戏以获得最佳体验</div>
      </div>
    </div>
    
    <!-- 全屏切换按钮 - 移到外层容器 -->
    <div class="fullscreen-control" v-if="isMobile">
      <button
        class="fullscreen-btn"
        @touchstart.prevent="handleFullscreenToggle"
        @mousedown.prevent="handleFullscreenToggle">
        <img 
          :src="isFullscreen ? '/assets/images/fullscreen-exit.svg' : '/assets/images/fullscreen.svg'" 
          :alt="isFullscreen ? '退出全屏' : '全屏'" 
          class="control-icon" 
          onerror="this.src=isFullscreen ? '/assets/images/fullscreen-exit.png' : '/assets/images/fullscreen.png';this.onerror=null;">
      </button>
    </div>
    
    <!-- 触摸控制按钮 -->
    <div class="touch-controls" v-if="isMobile || debugMode">
      <!-- 视角切换按钮 -->
      <div class="camera-controls">
        <button 
          class="camera-btn" 
          @touchstart.prevent="switchCamera"
          @mousedown.prevent="switchCamera">
          <img src="/assets/images/camera-switch.svg" alt="切换视角" class="control-icon" onerror="this.src='/assets/images/camera-switch.png';this.onerror=null;">
          <span class="camera-mode-name">{{ cameraModeNames[currentCameraMode] || '视角' }}</span>
        </button>
      </div>
      
      <div class="control-container">
        <!-- 左侧方向控制 -->
        <div class="direction-controls">
          <button 
            class="control-btn left-btn" 
            @touchstart="handleTouchStart('left')"
            @touchend="handleTouchEnd('left')"
            @touchcancel="handleTouchEnd('left')"
            @mousedown.prevent="handleTouchStart('left')"
            @mouseup.prevent="handleTouchEnd('left')"
            @mouseleave.prevent="handleTouchEnd('left')"
            @contextmenu.prevent>
            <img src="/assets/images/turn-left.svg" alt="左转" class="control-icon" onerror="this.src='/assets/images/turn-left.png';this.onerror=null;">
          </button>
          <button 
            class="control-btn right-btn" 
            @touchstart="handleTouchStart('right')"
            @touchend="handleTouchEnd('right')"
            @touchcancel="handleTouchEnd('right')"
            @mousedown.prevent="handleTouchStart('right')"
            @mouseup.prevent="handleTouchEnd('right')"
            @mouseleave.prevent="handleTouchEnd('right')"
            @contextmenu.prevent>
            <img src="/assets/images/turn-right.svg" alt="右转" class="control-icon" onerror="this.src='/assets/images/turn-right.png';this.onerror=null;">
          </button>
        </div>
        
        <!-- 右侧油门/刹车控制 -->
        <div class="acceleration-controls">
          <button 
            class="control-btn accelerate-btn" 
            @touchstart="handleTouchStart('accelerate')"
            @touchend="handleTouchEnd('accelerate')"
            @touchcancel="handleTouchEnd('accelerate')"
            @mousedown.prevent="handleTouchStart('accelerate')"
            @mouseup.prevent="handleTouchEnd('accelerate')"
            @mouseleave.prevent="handleTouchEnd('accelerate')"
            @contextmenu.prevent>
            <img src="/assets/images/accelerate.svg" alt="加速" class="control-icon" onerror="this.src='/assets/images/accelerate.png';this.onerror=null;">
          </button>
          <button 
            class="control-btn brake-btn" 
            @touchstart="handleTouchStart('brake')"
            @touchend="handleTouchEnd('brake')"
            @touchcancel="handleTouchEnd('brake')"
            @mousedown.prevent="handleTouchStart('brake')"
            @mouseup.prevent="handleTouchEnd('brake')"
            @contextmenu.prevent>
            <img src="/assets/images/brake.svg" alt="刹车" class="control-icon" onerror="this.src='/assets/images/brake.png';this.onerror=null;">
          </button>
        </div>
        
        <!-- 新增手刹按钮 -->
        <div class="handbrake-control">
          <button 
            class="control-btn handbrake-btn" 
            @touchstart="handleTouchStart('handbrake')"
            @mousedown.prevent="handleTouchStart('handbrake')"
            @touchend="handleTouchEnd('handbrake')"
            @mouseup.prevent="handleTouchEnd('handbrake')"
            @touchcancel="handleTouchEnd('handbrake')"
            @contextmenu.prevent>
            <img src="/assets/images/handbrake.svg" alt="手刹" class="control-icon" onerror="this.src='/assets/images/handbrake.png';this.onerror=null;">
            <span class="control-label">漂移</span>
          </button>
        </div>
      </div>
      
      <!-- 调试模式切换按钮 (仅在非移动设备上显示) -->
      <!-- <div class="debug-toggle" v-if="!isMobile">
        <button @click="toggleDebugMode" class="debug-btn">
          {{ debugMode ? '关闭调试模式' : '开启调试模式' }}
        </button>
      </div> -->
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, toRaw } from 'vue';
import { useDeviceDetection } from '@/composables/useDeviceDetection';

export default {
  name: 'TouchControls',
  props: {
    controlState: {
      type: Object,
      required: true
    },
    // 新增当前相机模式和切换方法props
    currentCameraMode: {
      type: Number,
      default: 0
    },
    switchCameraMode: {
      type: Function,
      default: () => console.warn('相机切换功能未提供')
    }
  },
  setup(props, { emit }) {
    const { isMobile, isLandscape, isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen } = useDeviceDetection();
    const debugMode = ref(false);
    
    // 视角模式名称映射
    const cameraModeNames = {
      0: '自由视角',
      1: '跟随视角',
      2: '驾驶视角',
      3: '追逐视角',
      4: '俯视视角',
      5: '电影视角'
    };

    // 处理全屏切换，添加错误回调
    const handleFullscreenToggle = () => {
      toggleFullscreen((error) => {
      });
    };

    // 切换调试模式
    const toggleDebugMode = () => {
      debugMode.value = !debugMode.value;
    };
    
    // 切换相机视角
    const switchCamera = () => {
      if (typeof props.switchCameraMode === 'function') {
        props.switchCameraMode();
      } else {
        console.warn('相机切换功能未提供');
      }
    };

    onMounted(() => {
      // 检查URL参数，如果包含debug=true则自动开启调试模式
      if (window.location.search.includes('debug=true')) {
        debugMode.value = true;
      }
    });
    
    onUnmounted(() => {
    });

    const handleTouchStart = (control) => {
      if (!props.controlState) {
        console.error('[TouchControls DEBUG] ERROR: controlState is undefined/null during touch start!');
        return;
      }

      if (navigator.vibrate) {
        navigator.vibrate(20);
      }

      try {
        switch(control) {
          case 'left':
            props.controlState.turnLeft = true;
            break;
          case 'right':
            props.controlState.turnRight = true;
            break;
          case 'accelerate':
            props.controlState.accelerate = true;
            break;
          case 'brake':
            props.controlState.brake = true;
            break;
          case 'handbrake': // 添加手刹控制
            props.controlState.handbrake = true;
            break;
        }
      } catch (error) {
        console.error(`[TouchControls DEBUG] ERROR during handleTouchStart (${control}):`, error);
      }
    };

    const handleTouchEnd = (control) => {
       if (!props.controlState) {
        console.error('[TouchControls DEBUG] ERROR: controlState is undefined/null during touch end!');
        return;
      }

      try {
        switch(control) {
          case 'left':
            props.controlState.turnLeft = false;
            break;
          case 'right':
            props.controlState.turnRight = false;
            break;
          case 'accelerate':
            props.controlState.accelerate = false;
            break;
          case 'brake':
            props.controlState.brake = false;
            break;
          case 'handbrake': // 添加手刹控制
            props.controlState.handbrake = false;
            break;
        }

      } catch (error) {
        console.error(`[TouchControls DEBUG] ERROR during handleTouchEnd (${control}):`, error);
      }
    };

    return {
      isMobile,
      isLandscape,
      isFullscreen,
      debugMode,
      cameraModeNames,
      toggleDebugMode,
      handleTouchStart,
      handleTouchEnd,
      switchCamera,
      handleFullscreenToggle
    };
  }
};
</script>

<style scoped>
.touch-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 40vh; /* 增加控制区域高度 */
  z-index: 1001;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.orientation-warning {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* 确保在最顶层 */
  pointer-events: auto;
}

.warning-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
}

.rotate-icon {
  font-size: 48px;
  animation: rotate 2s infinite linear;
}

.warning-text {
  margin-top: 10px;
  font-size: 18px;
  text-align: center;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.control-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

/* 视角控制按钮 */
.camera-controls {
  width: 36px;
  height: 36px;
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  z-index: 1001;
}

.camera-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  background-image: linear-gradient(135deg, rgba(30, 30, 30, 0.7) 0%, rgba(60, 60, 60, 0.6) 100%);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 30px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.1);
  touch-action: none;
  user-select: none;
  backdrop-filter: blur(2px);
}

.camera-btn:active {
  background-color: rgba(0, 0, 0, 0.8);
  transform: scale(0.98);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.15);
}

.camera-mode-name {
  margin-left: 5px;
  font-size: 12px;
}

/* 全屏控制按钮 */
.fullscreen-control {
  position: fixed;
  bottom: 20px;
  left: 20px;
  pointer-events: none;
  z-index: 1001;
}

.fullscreen-btn {
  pointer-events: auto;
  z-index: 1002;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  background-image: linear-gradient(135deg, rgba(60, 60, 60, 0.8) 0%, rgba(30, 30, 30, 0.8) 100%);
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.15), 0 0 8px rgba(0, 128, 255, 0.5);
  touch-action: none;
  user-select: none;
  backdrop-filter: blur(3px);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.15), 0 0 8px rgba(0, 128, 255, 0.5);
  }
  50% {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(255, 255, 255, 0.2), 0 0 15px rgba(0, 128, 255, 0.7);
  }
  100% {
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.15), 0 0 8px rgba(0, 128, 255, 0.5);
  }
}

.fullscreen-btn:active {
  background-color: rgba(0, 0, 0, 0.9);
  transform: scale(0.92);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.15);
  animation: none;
}

.fullscreen-btn img {
  width: 65%;
  height: 65%;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.direction-controls {
  position: absolute;
  bottom: 80px; /* 降低位置 */
  left: 30px;
  display: flex;
  flex-direction: row;
  gap: 30px; /* 增加按钮之间的间距 */
  pointer-events: auto;
  z-index: 1001;
}

.acceleration-controls {
  position: absolute;
  bottom: 80px; /* 降低位置 */
  right: 30px;
  display: flex;
  flex-direction: row;
  gap: 30px; /* 增加按钮之间的间距 */
  pointer-events: auto;
  z-index: 1001;
}

/* 新增手刹按钮样式 */
.handbrake-control {
  position: absolute;
  bottom: 40px;
  right: 30px;
  pointer-events: auto;
  z-index: 1001;
}

.control-label {
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  text-align: center;
  color: white;
  font-size: 12px;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

/* --- 修改控制按钮样式 --- */
.control-btn {
  border-radius: 50%;
  /* 修改背景为半透明灰色 */
  background-color: rgba(255, 255, 255, 0.2); 
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  /* 简化阴影 */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  touch-action: none;
  user-select: none;
  padding: 0;
  overflow: hidden;
  transition: background-color 0.15s ease, transform 0.15s ease; /* 简化过渡 */
  backdrop-filter: blur(3px);
  pointer-events: auto !important;
  z-index: 1003;
  transform: scale(1);
  -webkit-touch-callout: none; /* iOS Safari */
  -webkit-user-select: none; /* Safari */
  -khtml-user-select: none; /* Konqueror HTML */
  -moz-user-select: none; /* Old versions of Firefox */
  -ms-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
}

.control-btn:active,
.control-btn.active { /* 保留 .active 以防万一，但主要依赖 :active */
  transform: scale(0.90); /* 调整按下缩放效果 */
  /* 按下时背景更亮一点 */
  background-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

/* 移除特定按钮的背景色和渐变 */
.left-btn, .right-btn,
.accelerate-btn,
.brake-btn,
.handbrake-btn {
  background-color: rgba(255, 255, 255, 0.2); 
  background-image: none; 
}

.control-icon {
  width: 60%;
  height: 60%;
  object-fit: contain;
  filter: invert(1) contrast(0) brightness(2); /* 假设图标是深色，强制变白 */
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}
/* --- 结束修改控制按钮样式 --- */

/* 调试模式切换按钮 */
.debug-toggle {
  position: fixed;
  top: 10px;
  right: 10px;
  pointer-events: auto;
  z-index: 1100;
}

.debug-btn {
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  z-index: 1001;
}

/* 适配不同设备尺寸 */
@media (max-height: 500px) {
  .direction-controls, .acceleration-controls {
    width: 300px;
    height: 150px;
    bottom: 12px; /* 在低高度设备上调整底部间距 */
    gap: 10px;
  }
  
  .direction-controls {
    left: 15px;
  }
  
  .acceleration-controls {
    right: 15px;
  }
  
  .handbrake-control {
    bottom: 155px;
    right: 15px;
  }
  
  .control-btn {
    width: 120px;
    height: 120px;
    z-index: 1001;
  }
  
  .camera-controls {
    top: 10px;
  }
  
  .camera-btn {
    padding: 4px 8px;
    font-size: 10px;
    z-index: 1001;
  }
  
  .fullscreen-control {
    top: 10px;
    right: 10px;
  }
  
  .fullscreen-btn {
    width: 32px;
    height: 32px;
    z-index: 1001;
  }
}

/* 添加更多响应式样式 */
@media (max-width: 768px) {
  .camera-controls {
    top: 10px;
  }
  
  .camera-btn {
    padding: 5px 10px;
    font-size: 11px;
    background-color: rgba(30, 30, 30, 0.8);
  }
  
  .camera-mode-name {
    font-size: 11px;
  }
  
  .direction-controls {
    bottom: 150px; /* 增加距离底部的空间，不挡住速度计 */
  }
  
  .acceleration-controls {
    bottom: 150px; /* 增加距离底部的空间，不挡住速度计 */
  }
  
  .handbrake-control {
    bottom: 40px;
  }
  
  .fullscreen-control {
    top: 15px;
    right: 15px;
  }
}

.fullscreen-tip {
  position: absolute;
  white-space: nowrap;
  left: 60px;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 12px;
  backdrop-filter: blur(3px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  animation: fadeInOut 2.5s infinite;
  pointer-events: none;
}

@keyframes fadeInOut {
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
}

/* 为指示按钮按下状态添加脉冲动画 */
@keyframes buttonPulse {
  0% {
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow: 0 5px 25px rgba(255, 255, 255, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.4);
  }
  100% {
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.2);
  }
}

.control-btn.active {
  animation: buttonPulse 0.5s infinite;
}
</style> 