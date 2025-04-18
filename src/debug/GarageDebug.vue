<template>
  <div class="debug-panel" :class="{ 'debug-panel-collapsed': isCollapsed }">
    <div class="debug-panel-header">
      <h3>调试面板</h3>
      <button class="collapse-btn" @click="toggleCollapse">
        {{ isCollapsed ? '展开' : '折叠' }}
      </button>
    </div>
    
    <div class="debug-panel-content" v-if="!isCollapsed">
      <div class="debug-section vehicle-selection-section">
        <h4>车辆选择</h4>
        <div class="vehicle-selector-controls">
          <button class="vehicle-arrow-btn" @click="changeVehicle(-1)" :disabled="vehicles.length <= 1">
            &lt;
          </button>
          <span class="current-vehicle-name">{{ currentVehicleName }}</span>
          <button class="vehicle-arrow-btn" @click="changeVehicle(1)" :disabled="vehicles.length <= 1">
            &gt;
          </button>
        </div>
      </div>

      <div class="debug-section">
        <h4>模型变换</h4>
        <div class="debug-control">
          <label>缩放:</label>
          <input type="number" v-model="debugScale" step="0.1" @change="updateScale" />
        </div>
        <div class="debug-control">
          <label>位置:</label>
          <div class="vector-input">
            <input type="number" v-model="debugPosition[0]" step="0.1" @change="updatePosition" placeholder="X" />
            <input type="number" v-model="debugPosition[1]" step="0.1" @change="updatePosition" placeholder="Y" />
            <input type="number" v-model="debugPosition[2]" step="0.1" @change="updatePosition" placeholder="Z" />
          </div>
        </div>
        <div class="debug-control">
          <label>旋转:</label>
          <input type="number" v-model="debugRotationY" step="0.1" @change="updateRotation" />
        </div>
      </div>

      <div class="debug-section">
        <h4>轨道控制器</h4>
         <div class="debug-control">
           <label>自动旋转:</label>
           <input type="checkbox" :checked="autoRotate" @change="$emit('update:autoRotate', $event.target.checked)" />
         </div>
         <!-- Add other OrbitControls related settings if needed -->
      </div>

      <div class="debug-section">
        <h4>辅助工具</h4>
        <div class="debug-control">
          <label>显示网格:</label>
          <input type="checkbox" v-model="showGrid" @change="toggleGridHelper" />
        </div>
        <div class="debug-control" v-if="showGrid">
          <label>网格大小:</label>
          <input type="number" v-model="gridSize" step="1" @change="updateGridHelper" />
        </div>
        <div class="debug-control" v-if="showGrid">
          <label>网格分割:</label>
          <input type="number" v-model="gridDivisions" step="1" @change="updateGridHelper" />
        </div>
        <div class="debug-control">
          <label>显示坐标轴:</label>
          <input type="checkbox" v-model="showAxes" @change="toggleAxesHelper" />
        </div>
        <div class="debug-control" v-if="showAxes">
          <label>坐标轴大小:</label>
          <input type="number" v-model="axesSize" step="0.1" @change="updateAxesHelper" />
        </div>
      </div>

      <div class="debug-section">
        <h4>颜色设置</h4>
        <div class="debug-control">
          <label>车身颜色:</label>
          <input type="color" v-model="carCoatColor" @change="updateCarColor" />
        </div>
        <div class="debug-control">
          <label>轮毂颜色:</label>
          <input type="color" v-model="wheelColor" @change="updateWheelColor" />
        </div>
      </div>

      <div class="debug-section">
        <h4>配置管理</h4>
        <div class="debug-control">
          <button @click="saveSettings">保存设置</button>
        </div>
        <div class="debug-control">
          <button @click="resetSettings">重置设置</button>
        </div>
        <div class="debug-control">
          <button @click="importConfigs">导入配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { vehicleService } from '../services/vehicleService';

const props = defineProps({
  vehicles: {
    type: Array,
    required: true
  },
  currentVehicleId: {
    type: String,
    required: true
  },
  currentVehicle: {
    type: Object,
    required: true
  },
  carCoatColor: {
    type: String,
    required: true
  },
  wheelColor: {
    type: String,
    required: true
  },
  autoRotate: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'update:scale',
  'update:position',
  'update:rotation',
  'update:autoRotate',
  'update:showGrid',
  'update:showAxes',
  'update:gridSettings',
  'update:axesSize',
  'update:carColor',
  'update:wheelColor',
  'configsImported',
  'update:currentVehicleId',
]);

// 面板状态
const isCollapsed = ref(false);

// 调试参数
const debugScale = ref(1.0);
const debugPosition = ref([0, 0, 0]);
const debugRotationY = ref(0);
const autoRotate = ref(props.autoRotate);
const showGrid = ref(false);
const showAxes = ref(false);
const gridSize = ref(10);
const gridDivisions = ref(10);
const axesSize = ref(1);

// 颜色
const carCoatColor = ref(props.carCoatColor);
const wheelColor = ref(props.wheelColor);

// 计算当前车辆名称
const currentVehicleName = computed(() => {
  const vehicle = props.vehicles.find(v => v.id === props.currentVehicleId);
  return vehicle ? vehicle.name : '未知车辆';
});

// 监听 currentVehicleId 变化
watch(() => props.currentVehicleId, (newId) => {
    const vehicle = props.vehicles.find(v => v.id === newId);
    if (vehicle) {
        debugScale.value = vehicle.customSettings?.scale ?? vehicle.scale ?? 1.0;
        debugPosition.value = vehicle.customSettings?.position ?? [...(vehicle.position ?? [0,0,0])];
        debugRotationY.value = vehicle.customSettings?.rotation ?? 0;
    }
}, { immediate: true });

// 监听颜色变化
watch(() => props.carCoatColor, (newVal) => {
  carCoatColor.value = newVal;
});

watch(() => props.wheelColor, (newVal) => {
  wheelColor.value = newVal;
});

watch(() => props.autoRotate, (newVal) => {
  autoRotate.value = newVal;
});

// 切换折叠状态
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

// 更新模型缩放
const updateScale = () => {
  emit('update:scale', debugScale.value);
};

// 更新模型位置
const updatePosition = () => {
  emit('update:position', [...debugPosition.value]);
};

// 更新模型旋转
const updateRotation = () => {
  emit('update:rotation', debugRotationY.value);
};

// 切换网格显示
const toggleGridHelper = () => {
  emit('update:showGrid', showGrid.value);
};

// 切换坐标轴显示
const toggleAxesHelper = () => {
  emit('update:showAxes', showAxes.value);
};

// 更新网格设置
const updateGridHelper = () => {
  emit('update:gridSettings', {
    size: gridSize.value,
    divisions: gridDivisions.value
  });
};

// 更新坐标轴大小
const updateAxesHelper = () => {
  emit('update:axesSize', axesSize.value);
};

// 更新车身颜色
const updateCarColor = () => {
  emit('update:carColor', carCoatColor.value);
};

// 更新轮毂颜色
const updateWheelColor = () => {
  emit('update:wheelColor', wheelColor.value);
};

// 保存设置
const saveSettings = async () => {
  try {
    const settings = {
      id: props.currentVehicle.id,
      customSettings: {
        scale: debugScale.value,
        position: [...debugPosition.value],
        rotation: debugRotationY.value,
        colors: {
          body: carCoatColor.value,
          wheel: wheelColor.value
        }
      }
    };
    
    await vehicleService.updateVehicle(settings);
    
    showNotification('设置已保存', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showNotification('保存设置失败', 'error');
  }
};

// 重置设置
const resetSettings = () => {
  const vehicle = props.currentVehicle;
  if (!vehicle) return;

  debugScale.value = vehicle.customSettings?.scale ?? vehicle.scale ?? 1.0;
  debugPosition.value = vehicle.customSettings?.position ?? [...(vehicle.position ?? [0,0,0])];
  debugRotationY.value = 0; // 重置通常将旋转设为0
  carCoatColor.value = vehicle.customSettings?.colors?.body ?? vehicle.colors?.body ?? "#2f426f";
  wheelColor.value = vehicle.customSettings?.colors?.wheel ?? vehicle.colors?.wheel ?? "#1a1a1a";

  emit('update:scale', debugScale.value);
  emit('update:position', [...debugPosition.value]);
  emit('update:rotation', debugRotationY.value);
  emit('update:carColor', carCoatColor.value);
  emit('update:wheelColor', wheelColor.value);
  
  showNotification('设置已重置', 'info');
};

// 导入配置
const importConfigs = async () => {
  try {
    await vehicleService.initializeVehicles();
    emit('configsImported');
  } catch (error) {
    console.error('导入配置失败:', error);
    showNotification('导入配置失败', 'error');
  }
};

// 在 DebugPanel 内部切换车辆
const changeVehicle = (direction) => {
  const currentIndex = props.vehicles.findIndex(v => v.id === props.currentVehicleId);
  let nextIndex = currentIndex + direction;

  if (nextIndex < 0) {
    nextIndex = props.vehicles.length - 1;
  } else if (nextIndex >= props.vehicles.length) {
    nextIndex = 0;
  }

  const nextVehicleId = props.vehicles[nextIndex].id;
  emit('update:currentVehicleId', nextVehicleId);
};

// 显示通知
const showNotification = (message, type = 'info', duration = 3000) => {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
};
</script>

<style scoped>
.debug-panel {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 300px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  color: white;
  z-index: 1000;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.debug-panel-collapsed {
  width: 200px;
}

.debug-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-panel-header h3 {
  margin: 0;
  font-size: 16px;
}

.collapse-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.debug-panel-content {
  padding: 12px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.debug-section {
  margin-bottom: 16px;
}

.debug-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #aaa;
}

.debug-control {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.debug-control label {
  width: 80px;
  font-size: 12px;
}

.debug-control input[type="number"],
.debug-control input[type="text"] {
  width: 60px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
}

.debug-control input[type="color"] {
  width: 40px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.vector-input {
  display: flex;
  gap: 4px;
}

.vector-input input {
  width: 50px;
}

.debug-control button {
  width: 100%;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.debug-control button:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 滚动条样式 */
.debug-panel-content::-webkit-scrollbar {
  width: 6px;
}

.debug-panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.debug-panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.debug-panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 车辆选择区域样式 */
.vehicle-selection-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 15px;
  margin-bottom: 15px; /* Add margin below selection */
}

.vehicle-selector-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 12px;
  border-radius: 4px;
}

.vehicle-arrow-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.vehicle-arrow-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.vehicle-arrow-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.current-vehicle-name {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  flex-grow: 1;
  margin: 0 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.camera-settings-section {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 15px;
    margin-top: 15px;
}

.camera-settings-section small {
    display: block;
    margin-top: 10px;
    color: #aaa;
    text-align: center;
    font-size: 11px;
}
</style> 