<template>
  <div class="speedometer">
    <span class="speed-value">{{ displaySpeed }}</span>
    <small class="speed-unit">km/h</small>
  </div>
</template>

<script setup>
import { computed } from 'vue';

// 接收速度属性，默认值为0
const props = defineProps({
  speed: {
    type: Number,
    default: 0
  },
  // 是否使用km/h（默认）或mph
  useKmh: {
    type: Boolean,
    default: true
  }
});

// 计算要显示的速度值
const displaySpeed = computed(() => {
  // 如果速度是m/s，转换为km/h
  const speedKmh = props.speed * 3.6;
  
  // 如果需要显示mph，将km/h转换为mph
  const speedValue = props.useKmh ? speedKmh : speedKmh * 0.621371;
  
  // 四舍五入到整数
  return Math.floor(speedValue);
});
</script>

<style scoped>
.speedometer {
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.speed-value {
  font-size: 36px;
  font-weight: bold;
}

.speed-unit {
  font-size: 14px;
  margin-top: 5px;
}
</style> 