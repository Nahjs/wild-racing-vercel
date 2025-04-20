<template>
  <div class="race-countdown" v-if="show">
    <div class="countdown-value">{{ countdown }}</div>
    <div class="countdown-text" v-if="countdown <= 0">开始!</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

// 接收属性
const props = defineProps({
  countdown: {
    type: Number,
    default: 3
  },
  show: {
    type: Boolean,
    default: true
  }
});
</script>

<style scoped>
.race-countdown {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.countdown-value {
  font-size: 100px;
  font-weight: bold;
  color: white;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
}

.countdown-text {
  font-size: 50px;
  font-weight: bold;
  color: #4CAF50;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
  margin-top: 20px;
}
</style> 