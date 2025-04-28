<template>
  <div v-if="debugData" class="vehicle-debug-ui">
    <h4>车辆物理调试 (Rapier)</h4>
    <div class="debug-params">
      <!-- TODO: Rework tuning based on how params are passed or managed -->
      <p>(参数调整功能待定)</p>
      <!--
      <div v-for="(value, key) in tuningState" :key="key" class="param-item">
        <label :for="`param-${key}`">{{ paramLabels[key] || key }}:</label>
        <input 
          :id="`param-${key}`" 
          type="range" 
          :min="paramRanges[key]?.min || 0" 
          :max="paramRanges[key]?.max || 100" 
          :step="paramRanges[key]?.step || 0.1" 
          :value="value" 
          @input="updateParam(key, $event.target.valueAsNumber)" 
        />
        <span>{{ value?.toFixed ? value.toFixed(2) : value }}</span>
      </div>
      -->
    </div>
    <div class="debug-info">
      <h5>实时信息:</h5>
      <p>速度 (km/h): {{ (debugData.linearVelocity ? Math.sqrt(debugData.linearVelocity.x**2 + debugData.linearVelocity.y**2 + debugData.linearVelocity.z**2) * 3.6 : 0).toFixed(1) }}</p>
      <p>位置: {{ debugData.position?.x?.toFixed(1) || 'N/A' }}, {{ debugData.position?.y?.toFixed(1) || 'N/A' }}, {{ debugData.position?.z?.toFixed(1) || 'N/A' }}</p>
      <!-- Add other relevant info directly from debugData -->
      <!-- <p>悬挂接触: {{ debugData.wheelsContact?.join(', ') }}</p> -->
      <!-- <p>悬挂力: {{ debugData.wheelsSuspensionForce?.map(f => f.toFixed(0)).join(', ') }}</p> -->
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  debugData: {
    type: Object,
    default: null
  }
});

</script>

<style scoped>
.vehicle-debug-ui {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 300px;
  z-index: 100;
}

.debug-params, .debug-info {
  margin-bottom: 10px;
}

.param-item {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.param-item label {
  min-width: 100px;
  margin-right: 10px;
}

.param-item input[type="range"] {
  flex-grow: 1;
  margin-right: 10px;
}

.param-item span {
  min-width: 40px;
  text-align: right;
}
</style> 