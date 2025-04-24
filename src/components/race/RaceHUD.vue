<template>
  <div class="race-hud">
    <!-- 速度显示 -->
    <div class="speedometer-container">
      <Speedometer :speed="speed" :use-kmh="useKmh" />
    </div>
    
    <!-- 圈速信息 -->
    <!-- <div class="lap-timer-container" v-if="showLapInfo">
      <LapTimer 
        :current-lap="currentLap"
        :total-laps="totalLaps"
        :current-lap-time="currentLapTime"
        :best-lap-time="bestLapTime"
        :total-time="totalTime"
        :format-time="formatTime"
      />
    </div> -->
    
    <!-- 倒计时 -->
    <RaceCountdown 
      v-if="isCountingDown"
      :countdown="countdown"
      :show="true"
    />
    
    <!-- 比赛结果 -->
    <RaceResults 
      v-if="isFinished"
      :show="true"
      :total-time="totalTime"
      :best-lap-time="bestLapTime"
      :lap-times="lapTimes"
      :format-time="formatTime"
      @restart="$emit('restart')"
      @exit="$emit('exit')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import Speedometer from './Speedometer.vue';
import LapTimer from './LapTimer.vue';
import RaceCountdown from './RaceCountdown.vue';
import RaceResults from './RaceResults.vue';

// 定义事件
const emit = defineEmits(['restart', 'exit']);

// 接收属性
const props = defineProps({
  // 速度相关
  speed: {
    type: Number,
    default: 0
  },
  useKmh: {
    type: Boolean,
    default: true
  },
  
  // 比赛状态
  raceStatus: {
    type: String,
    default: 'waiting' // waiting, countdown, racing, finished
  },
  countdown: {
    type: Number,
    default: 3
  },
  
  // 圈速相关
  showLapInfo: {
    type: Boolean,
    default: true
  },
  currentLap: {
    type: Number,
    default: 0
  },
  totalLaps: {
    type: Number,
    default: 3
  },
  currentLapTime: {
    type: Number,
    default: 0
  },
  bestLapTime: {
    type: Number,
    default: 0
  },
  totalTime: {
    type: Number,
    default: 0
  },
  lapTimes: {
    type: Array,
    default: () => []
  },
  
  // 格式化时间的方法
  formatTime: {
    type: Function,
    required: true
  }
});

// 计算属性：判断比赛状态
const isCountingDown = computed(() => props.raceStatus === 'countdown');
const isRacing = computed(() => props.raceStatus === 'racing');
const isFinished = computed(() => props.raceStatus === 'finished');
</script>

<style scoped>
.race-hud {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.speedometer-container {
  position: absolute;
  top: 20px;
  right: 30px;
  pointer-events: auto;
}

.lap-timer-container {
  position: absolute;
  top: 20px;
  left: 20px;
  pointer-events: auto;
}

/* 移动端专用样式 */
@media (max-width: 768px) {
  .speedometer-container {
    position: absolute !important;
    top: 20px !important; /* 增加距离底部的高度，避免被触摸控制遮挡 */
    right: 50% !important;
    transform: translateX(50%) !important; /* 水平居中 */
    z-index: 900 !important;
    background-color: transparent !important; /* 移除背景 */
    border-radius: 10px !important;
    padding: 0 !important;
  }
  
  .lap-timer-container {
    position: absolute !important;
    top: 10px !important;
    left: 10px !important;
    z-index: 900 !important;
    background-color: rgba(0, 0, 0, 0.5) !important;
    border-radius: 10px !important;
    padding: 8px !important;
  }
  
  .countdown {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    font-size: 80px !important;
    color: white !important;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.8) !important;
    z-index: 1000 !important;
  }
  
  .race-status {
    position: fixed !important;
    top: 40% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    font-size: 40px !important;
    color: white !important;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.8) !important;
    z-index: 1000 !important;
  }
}
</style> 