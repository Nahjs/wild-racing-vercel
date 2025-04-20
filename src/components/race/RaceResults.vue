<template>
  <div class="race-results" v-if="show">
    <h2 class="results-title">比赛结束!</h2>
    
    <div class="results-data">
      <div class="result-item">
        <span class="result-label">总时间:</span>
        <span class="result-value">{{ formatTime(totalTime) }}</span>
      </div>
      
      <div class="result-item best-lap">
        <span class="result-label">最佳单圈:</span>
        <span class="result-value">{{ formatTime(bestLapTime) }}</span>
      </div>
      
      <div class="lap-times" v-if="showLapTimes">
        <h3>圈速记录</h3>
        <div v-for="(lapTime, index) in lapTimes" :key="index" class="lap-time-item" :class="{ 'best-lap': lapTime === bestLapTime }">
          <span>圈 {{ index + 1 }}:</span>
          <span>{{ formatTime(lapTime) }}</span>
        </div>
      </div>
    </div>
    
    <div class="results-actions">
      <button @click="onRestart" class="restart-btn">重新开始</button>
      <button @click="onExit" class="exit-btn">退出</button>
    </div>
  </div>
</template>

<script setup>
// 定义事件
const emit = defineEmits(['restart', 'exit']);

// 接收属性
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  totalTime: {
    type: Number,
    default: 0
  },
  bestLapTime: {
    type: Number,
    default: 0
  },
  lapTimes: {
    type: Array,
    default: () => []
  },
  showLapTimes: {
    type: Boolean,
    default: true
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

// 重新开始按钮点击事件
const onRestart = () => {
  emit('restart');
};

// 退出按钮点击事件
const onExit = () => {
  emit('exit');
};
</script>

<style scoped>
.race-results {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 25px;
  border-radius: 15px;
  text-align: center;
  min-width: 300px;
  max-width: 500px;
  pointer-events: auto;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.results-title {
  font-size: 28px;
  margin-bottom: 20px;
}

.results-data {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  font-size: 18px;
}

.result-label {
  font-weight: normal;
}

.result-value {
  font-weight: bold;
}

.best-lap {
  color: #4CAF50;
}

.lap-times {
  margin-top: 15px;
  text-align: left;
  max-height: 200px;
  overflow-y: auto;
}

.lap-times h3 {
  font-size: 18px;
  margin-bottom: 10px;
  text-align: center;
}

.lap-time-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.results-actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
}

.restart-btn, .exit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.restart-btn {
  background-color: #4CAF50;
  color: white;
}

.restart-btn:hover {
  background-color: #45a049;
}

.exit-btn {
  background-color: #f44336;
  color: white;
}

.exit-btn:hover {
  background-color: #d32f2f;
}
</style> 