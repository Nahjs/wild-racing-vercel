<template>
  <div class="race-hud">
    <!-- 速度显示 -->
    <div class="speedometer-container">
      <Speedometer :speed="speed" :use-kmh="useKmh" />
    </div>
    
    <!-- 圈速信息 -->
    <div class="lap-timer-container" v-if="showLapInfo">
      <LapTimer 
        :current-lap="currentLap"
        :total-laps="totalLaps"
        :current-lap-time="currentLapTime"
        :best-lap-time="bestLapTime"
        :total-time="totalTime"
        :format-time="formatTime"
      />
    </div>
    
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
  bottom: 30px;
  right: 30px;
  pointer-events: auto;
}

.lap-timer-container {
  position: absolute;
  top: 20px;
  left: 20px;
  pointer-events: auto;
}
</style> 