<template>
  <div class="lap-timer">
    <div class="lap-count">
      <span>圈数:</span> {{ currentLap }}/{{ totalLaps }}
    </div>
    <div class="lap-time">
      <span>当前圈速:</span> {{ formatTime(currentLapTime) }}
    </div>
    <div class="best-lap-time">
      <span>最佳圈速:</span> {{ formatTime(bestLapTime) }}
    </div>
    <div class="total-time">
      <span>总时间:</span> {{ formatTime(totalTime) }}
    </div>
  </div>
</template>

<script setup>
// 接收属性
const props = defineProps({
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
  formatTime: {
    type: Function,
    default: (time) => {
      if (time === 0) return '00:00.000';
      
      const minutes = Math.floor(time / 60000);
      const seconds = Math.floor((time % 60000) / 1000);
      const ms = time % 1000;
      
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
  }
});
</script>

<style scoped>
.lap-timer {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 16px;
  min-width: 200px;
}

.lap-count {
  font-weight: bold;
}

.best-lap-time {
  color: #4CAF50;
}
</style> 