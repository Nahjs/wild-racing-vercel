<template>
  <div v-if="showPrompt" class="race-start-prompt" @click="startRaceWithFullscreen">
    <div class="prompt-content">
      <h2>准备开始比赛</h2>
      <div class="start-button">
        <span class="button-text">点击开始</span>
        <div class="button-icon">
          <img src="/assets/images/fullscreen.svg" alt="全屏" class="fullscreen-icon" onerror="this.src='/assets/images/fullscreen.png';this.onerror=null;">
        </div>
      </div>
      <p class="prompt-text">点击开始比赛并进入全屏模式</p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useDeviceDetection } from '@/composables/useDeviceDetection';
import { useInputControls } from '@/composables/useInputControls';

export default {
  name: 'RaceStartPrompt',
  props: {
    raceStatus: {
      type: String,
      required: true
    }
  },
  emits: ['race-start'],
  setup(props, { emit }) {
    const { isMobile, enterFullscreen, fullscreenRequested } = useDeviceDetection();
    const { reinitializeInputControls } = useInputControls();
    const showPrompt = ref(true);
    
    // 处理用户点击"开始比赛"按钮
    const startRaceWithFullscreen = async () => {
      showPrompt.value = false;
      
      // 在用户交互时重新初始化输入控制，确保干净的控制状态
      console.log('[RaceStartPrompt] 用户点击开始，重新初始化输入控制...');
      reinitializeInputControls();
      
      // 如果是移动设备，尝试请求全屏
      if (isMobile.value) {
        try {
          // 在用户交互事件中调用enterFullscreen应该会成功
          await enterFullscreen();
        } catch (error) {
          console.warn('进入全屏失败，但继续开始比赛:', error);
        }
      }
      
      // 无论全屏是否成功，都发出比赛开始事件
      emit('race-start');
    };
    
    return {
      showPrompt,
      startRaceWithFullscreen
    };
  }
}
</script>

<style scoped>
.race-start-prompt {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2001;
  cursor: pointer;
}

.prompt-content {
  background-color: rgba(30, 30, 30, 0.9);
  padding: 30px;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.3);
  max-width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

h2 {
  color: #fff;
  margin-bottom: 20px;
  font-size: 24px;
}

.start-button {
  background: linear-gradient(145deg, #3498db, #2980b9);
  padding: 16px 32px;
  border-radius: 50px;
  color: white;
  font-size: 20px;
  font-weight: bold;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
  animation: pulse 2s infinite;
}

.start-button:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.button-text {
  margin-right: 10px;
}

.button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-icon {
  width: 24px;
  height: 24px;
}

.prompt-text {
  color: #ccc;
  font-size: 14px;
  margin-top: 15px;
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 4px 25px rgba(52, 152, 219, 0.6);
  }
  100% {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  }
}
</style> 