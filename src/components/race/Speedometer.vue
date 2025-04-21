<template>
  <div class="speedometer">
    <div class="speed-value">{{ formattedSpeed }}</div>
    <div class="speed-unit">{{ useKmh ? 'km/h' : 'mph' }}</div>
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
  },
  digitsAfterDecimal: {
    type: Number,
    default: 0
  }
});

// 计算要显示的速度值
const formattedSpeed = computed(() => {
  // Convert m/s to km/h or mph
  let speedInUnits = props.useKmh 
    ? props.speed * 3.6 // m/s to km/h 
    : props.speed * 2.23694; // m/s to mph
  
  // Format to specified decimal places
  return speedInUnits.toFixed(props.digitsAfterDecimal);
});
</script>

<style scoped>
.speedometer {
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 10px;
  color: white;
  padding: 15px;
  text-align: center;
  font-family: 'Digital', sans-serif;
  width: 100px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.speed-value {
  font-size: 36px;
  font-weight: bold;
}

.speed-unit {
  font-size: 14px;
  margin-top: 5px;
  opacity: 0.7;
}

/* 移动端样式优化 */
@media (max-width: 768px) {
  .speedometer {
    width: 90px;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    margin-bottom: 50px; /* 添加底部边距，确保不被控制按钮遮挡 */
  }
  
  .speed-value {
    font-size: 32px;
  }
  
  .speed-unit {
    font-size: 12px;
    margin-top: 2px;
  }
}
</style> 