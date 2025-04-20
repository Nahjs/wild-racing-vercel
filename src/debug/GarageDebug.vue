<template>
  <div class="debug-panel" :class="{ 'is-collapsed': !isOpen }">
    <div class="panel-header" @click="togglePanel">
      <span>调试与调优面板 ({{ isOpen ? '隐藏' : '显示' }})</span>
    </div>
    <div v-if="isOpen" class="panel-content">
      <!-- Vehicle Selection (Keep existing) -->
      <div class="control-group">
        <label for="vehicleSelect">选择车辆:</label>
        <select id="vehicleSelect" :value="currentVehicleId" @change="$emit('update:currentVehicleId', $event.target.value)">
          <option v-for="vehicle in vehicles" :key="vehicle.id" :value="vehicle.id">
            {{ vehicle.name }}
          </option>
        </select>
      </div>
      <hr>
      <h3>外观与基础</h3>
       <!-- Appearance Controls (Keep existing) -->
      <div class="control-group">
        <label for="carColor">车身颜色:</label>
        <input type="color" id="carColor" :value="carCoatColor" @input="$emit('update:carColor', $event.target.value)">
      </div>
      <div class="control-group">
        <label for="wheelColor">轮毂颜色:</label>
        <input type="color" id="wheelColor" :value="wheelColor" @input="$emit('update:wheelColor', $event.target.value)">
      </div>
       <!-- Transform Controls (Keep existing) -->
      <!-- <div class="control-group">
          <label>缩放: {{ scale?.toFixed(2) ?? 'N/A' }}</label>
          <input type="range" min="1" max="100" step="0.05" :value="scale" @input="$emit('update:scale', Number($event.target.value))">
      </div> -->
      <!-- <div class="control-group">
        <label>位置 X: {{ position?.[0]?.toFixed(2) ?? 'N/A' }}</label>
        <input type="range" min="-10" max="10" step="0.1" :value="position?.[0] ?? 0" @input="$emit('update:position', [Number($event.target.value), position?.[1] ?? 0, position?.[2] ?? 0])">
        <label>位置 Y: {{ position?.[1]?.toFixed(2) ?? 'N/A' }}</label>
        <input type="range" min="-2" max="10" step="0.1" :value="position?.[1] ?? 0" @input="$emit('update:position', [position?.[0] ?? 0, Number($event.target.value), position?.[2] ?? 0])">
        <label>位置 Z: {{ position?.[2]?.toFixed(2) ?? 'N/A' }}</label>
        <input type="range" min="-10" max="10" step="0.1" :value="position?.[2] ?? 0" @input="$emit('update:position', [position?.[0] ?? 0, position?.[1] ?? 0, Number($event.target.value)])">
      </div>
      <div class="control-group">
        <label>旋转 Y: {{ rotation?.toFixed(2) ?? 'N/A' }}</label>
        <input type="range" min="-3.14" max="3.14" step="0.01" :value="rotation" @input="$emit('update:rotation', Number($event.target.value))">
      </div> -->
      <!-- <div class="control-group">
        <label>视觉 Y 偏移: {{ visualOffsetY?.toFixed(2) ?? 'N/A' }}</label>
        <input type="range" min="-1.0" max="1.0" step="0.01" :value="visualOffsetY" @input="$emit('update:visualOffsetY', Number($event.target.value))">
      </div> -->
      <!-- Scene Controls (Keep existing) -->
      <div class="control-group checkbox-group">
        <label>
          <input type="checkbox" :checked="showPhysicsDebug" @change="$emit('update:showPhysicsDebug', $event.target.checked)"> 显示物理实体
        </label>
        <label>
          <input type="checkbox" :checked="autoRotate" @change="$emit('update:autoRotate', $event.target.checked)"> 旋转展示
        </label>
        <label>
          <input type="checkbox" :checked="showGrid" @change="$emit('update:showGrid', $event.target.checked)"> 显示网格
        </label>
        <label v-if="showGrid">
          网格大小:
          <input type="number" :value="gridSize" min="1" @input="$emit('update:gridSettings', { size: Number($event.target.value), divisions: gridDivisions })">
        </label>
        <label v-if="showGrid">
          网格分区:
          <input type="number" :value="gridDivisions" min="1" @input="$emit('update:gridSettings', { size: gridSize, divisions: Number($event.target.value) })">
        </label>
        <label>
          <input type="checkbox" :checked="showAxes" @change="$emit('update:showAxes', $event.target.checked)"> 显示坐标轴助手
        </label>
        <label v-if="showAxes">
           坐标轴大小:
           <input type="number" :value="axesSize" min="0.1" step="0.1" @input="$emit('update:axesSize', Number($event.target.value))">
        </label>
      </div>

      <hr>
      <h3>物理调优</h3>

      <!-- Vehicle Base Physics -->
      <div class="control-group">
        <label>车辆质量 ({{ vehicleMass }})</label>
        <input type="range" min="50" max="2000" step="10" :value="vehicleMass" @input="$emit('update:vehicleMass', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>线性阻尼 ({{ linearDamping?.toFixed(2) }})</label>
        <input type="range" min="0" max="0.99" step="0.01" :value="linearDamping" @input="$emit('update:linearDamping', Number($event.target.value))">
      </div>
      <div class="control-group">
        <label>角阻尼 ({{ angularDamping?.toFixed(2) }})</label>
        <input type="range" min="0" max="0.99" step="0.01" :value="angularDamping" @input="$emit('update:angularDamping', Number($event.target.value))">
      </div>
      <div class="control-group">
        <label>地面摩擦力 ({{ groundFriction?.toFixed(2) }})</label>
        <input type="range" min="0" max="2" step="0.05" :value="groundFriction" @input="$emit('update:groundFriction', Number($event.target.value))">
      </div>

      <!-- Control Forces -->
      <hr>
      <h4>控制力</h4>
      <div class="control-group">
        <label>驱动类型:</label>
        <select :value="driveType" @change="$emit('update:driveType', $event.target.value)">
          <option value="RWD">后驱 (RWD)</option>
          <option value="FWD">前驱 (FWD)</option>
          <option value="AWD">四驱 (AWD)</option>
        </select>
      </div>
      <div class="control-group">
        <label>引擎动力 ({{ enginePower }})</label>
        <input type="range" min="100" max="15000" step="100" :value="enginePower" @input="$emit('update:enginePower', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>转向力度 ({{ turnStrength?.toFixed(2) }})</label>
        <input type="range" min="0.1" max="1.5" step="0.05" :value="turnStrength" @input="$emit('update:turnStrength', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>刹车力度 ({{ brakePower }})</label>
        <input type="range" min="0" max="100" step="1" :value="brakePower" @input="$emit('update:brakePower', Number($event.target.value))">
      </div>
      <div class="control-group">
        <label>被动减速 ({{ slowDownForce?.toFixed(1) }})</label>
        <input type="range" min="0" max="50" step="0.5" :value="slowDownForce" @input="$emit('update:slowDownForce', Number($event.target.value))">
      </div>

      <!-- Suspension & Wheels -->
      <hr>
      <h4>悬挂与车轮</h4>
      <div class="control-group">
        <label>悬挂硬度 ({{ suspensionStiffness?.toFixed(1) }})</label>
        <input type="range" min="1" max="200" step="1" :value="suspensionStiffness" @input="$emit('update:suspensionStiffness', Number($event.target.value))">
      </div>
      <div class="control-group">
        <label>悬挂静止长度 ({{ suspensionRestLength?.toFixed(2) }})</label>
        <input type="range" min="0.1" max="1.5" step="0.05" :value="suspensionRestLength" @input="$emit('update:suspensionRestLength', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>最大悬挂行程 ({{ maxSuspensionTravel?.toFixed(2) }})</label>
        <input type="range" min="0.1" max="2" step="0.05" :value="maxSuspensionTravel" @input="$emit('update:maxSuspensionTravel', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>最大悬挂力 ({{ maxSuspensionForce }})</label>
        <input type="range" min="1000" max="50000" step="1000" :value="maxSuspensionForce" @input="$emit('update:maxSuspensionForce', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>悬挂阻尼(回弹) ({{ dampingRelaxation?.toFixed(2) }})</label>
        <input type="range" min="0.1" max="10" step="0.1" :value="dampingRelaxation" @input="$emit('update:dampingRelaxation', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>悬挂阻尼(压缩) ({{ dampingCompression?.toFixed(2) }})</label>
        <input type="range" min="0.1" max="10" step="0.1" :value="dampingCompression" @input="$emit('update:dampingCompression', Number($event.target.value))">
      </div>
      <div class="control-group">
        <label>车轮侧滑摩擦 ({{ frictionSlip?.toFixed(1) }})</label>
        <input type="range" min="1" max="100" step="1" :value="frictionSlip" @input="$emit('update:frictionSlip', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>侧倾影响 ({{ rollInfluence?.toFixed(3) }})</label>
        <input type="range" min="0" max="0.5" step="0.005" :value="rollInfluence" @input="$emit('update:rollInfluence', Number($event.target.value))">
      </div>
       <div class="control-group">
        <label>自定义滑动转速 ({{ customSlidingRotationalSpeed?.toFixed(1) }})</label>
        <input type="range" min="0" max="100" step="1" :value="customSlidingRotationalSpeed" @input="$emit('update:customSlidingRotationalSpeed', Number($event.target.value))">
      </div>

      <!-- Wheel Index Mapping -->
      <hr>
      <h4>车轮索引映射 (模型轮 -> 物理轮)</h4>
      <div class="control-group small-inputs">
        <label>FL:</label>
        <input type="number" min="0" max="3" step="1" :value="wheelIndices?.FL ?? 0" 
               @input="$emit('update:wheelIndices', { ...wheelIndices, FL: Number($event.target.value) })">
        <label>FR:</label>
        <input type="number" min="0" max="3" step="1" :value="wheelIndices?.FR ?? 1" 
               @input="$emit('update:wheelIndices', { ...wheelIndices, FR: Number($event.target.value) })">
        <label>BL:</label>
        <input type="number" min="0" max="3" step="1" :value="wheelIndices?.BL ?? 2" 
               @input="$emit('update:wheelIndices', { ...wheelIndices, BL: Number($event.target.value) })">
        <label>BR:</label>
        <input type="number" min="0" max="3" step="1" :value="wheelIndices?.BR ?? 3" 
               @input="$emit('update:wheelIndices', { ...wheelIndices, BR: Number($event.target.value) })">
      </div>

      <!-- Connection Points -->
      <hr>
      <h4>悬挂连接点 (本地坐标)</h4>
      <div v-for="(point, index) in connectionPoints" :key="index" class="control-group connection-point-group">
        <label class="point-label">{{ ['FL', 'FR', 'BL', 'BR'][index] }}:</label>
        <div class="axis-inputs">
          <label>X:</label>
          <input type="number" step="0.01" :value="point?.x ?? 0" 
                 @input="$emit('update:connectionPoints', updateConnectionPoint(index, 'x', $event.target.value))">
          <label>Y:</label>
          <input type="number" step="0.01" :value="point?.y ?? 0" 
                 @input="$emit('update:connectionPoints', updateConnectionPoint(index, 'y', $event.target.value))">
          <label>Z:</label>
          <input type="number" step="0.01" :value="point?.z ?? 0" 
                 @input="$emit('update:connectionPoints', updateConnectionPoint(index, 'z', $event.target.value))">
        </div>
      </div>

      <!-- Wheel Initial Rotation Debug -->
      <hr>
      <h4>车轮初始旋转</h4>
       <div class="control-group checkbox-group">
         <label>
           <input type="checkbox" :checked="showWheelAxes" @change="$emit('update:showWheelAxes', $event.target.checked)"> 显示车轮坐标轴
         </label>
       </div>
      <div class="control-group">
        <label>修正轴:</label>
        <select :value="initialCorrectionAxis" @change="$emit('update:initialCorrectionAxis', $event.target.value)">
          <option value="x">X</option>
          <option value="y">Y</option>
          <option value="z">Z</option>
        </select>
      </div>
      <div class="control-group">
        <label>修正角度 ({{ initialCorrectionAngle }}°):</label>
        <input type="range" min="-180" max="180" step="1" :value="initialCorrectionAngle" @input="$emit('update:initialCorrectionAngle', Number($event.target.value))">
      </div>

      <!-- Actions -->
      <hr>
      <div class="control-group action-buttons">
         <button class="import-btn" @click="$emit('configsImported')">导入/重载配置</button>
         <button class="save-btn" @click="$emit('save-tuning')" :disabled="isSavingTuning">
           {{ isSavingTuning ? '保存中...' : '保存调优' }}
         </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  vehicles: Array,
  currentVehicleId: String,
  // Appearance & Base Props (from Garage.vue state/refs)
  scale: Number,
  position: Array, // [x, y, z]
  rotation: Number, // y-rotation
  carCoatColor: String,
  wheelColor: String,
  visualOffsetY: Number,
  autoRotate: Boolean,
  showGrid: Boolean,
  gridSize: Number,
  gridDivisions: Number,
  showAxes: Boolean,
  axesSize: Number,
  showPhysicsDebug: Boolean,
  // Physics Tuning Parameters (from tuningStore)
  driveType: String,
  enginePower: Number,
  turnStrength: Number,
  vehicleMass: Number,
  linearDamping: Number,
  angularDamping: Number,
  groundFriction: Number,
  brakePower: Number,
  slowDownForce: Number,
  suspensionStiffness: Number,
  suspensionRestLength: Number,
  frictionSlip: Number,
  dampingRelaxation: Number,
  dampingCompression: Number,
  maxSuspensionForce: Number,
  rollInfluence: Number,
  maxSuspensionTravel: Number,
  customSlidingRotationalSpeed: Number,
  initialCorrectionAxis: String,
  initialCorrectionAngle: Number,
  showWheelAxes: Boolean,
  // 新增 props
  wheelIndices: Object, 
  connectionPoints: Array,
  // Saving State (from tuningStore)
  isSavingTuning: Boolean,
});

// Helper function to update connection points array immutably
const updateConnectionPoint = (index, axis, value) => {
  const newPoints = props.connectionPoints.map((point, i) => {
    if (i === index) {
      return { ...point, [axis]: Number(value) };
    }
    return point;
  });
  return newPoints;
};

// Define emits for all updatable props
defineEmits([
  'update:currentVehicleId',
  // Appearance & Base
  'update:scale',
  'update:position',
  'update:rotation',
  'update:carColor',
  'update:wheelColor',
  'update:visualOffsetY',
  'update:autoRotate',
  'update:showGrid',
  'update:gridSettings',
  'update:showAxes',
  'update:axesSize',
  'update:showPhysicsDebug',
  'configsImported', // Keep existing import/reload action
  // Physics Tuning Parameters
  'update:driveType',
  'update:enginePower',
  'update:turnStrength',
  'update:vehicleMass',
  'update:linearDamping',
  'update:angularDamping',
  'update:groundFriction',
  'update:brakePower',
  'update:slowDownForce',
  'update:suspensionStiffness',
  'update:suspensionRestLength',
  'update:frictionSlip',
  'update:dampingRelaxation',
  'update:dampingCompression',
  'update:maxSuspensionForce',
  'update:rollInfluence',
  'update:maxSuspensionTravel',
  'update:customSlidingRotationalSpeed',
  'update:initialCorrectionAxis',
  'update:initialCorrectionAngle',
  'update:showWheelAxes',
  // 新增 emits
  'update:wheelIndices',
  'update:connectionPoints',
  // Save Action
  'save-tuning'
]);

const isOpen = ref(true); // Panel starts open

const togglePanel = () => {
  isOpen.value = !isOpen.value;
};

</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 80px; /* Adjust as needed below nav */
  right: 10px;
  width: 320px; /* Slightly wider */
  background-color: rgba(40, 40, 40, 0.88);
  backdrop-filter: blur(8px);
  color: #f0f0f0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.35);
  z-index: 1010;
  transition: transform 0.3s ease-in-out;
  overflow: hidden; /* Needed for collapsing */
}

.debug-panel.is-collapsed {
  transform: translateX(calc(100% - 40px)); /* Keep header visible */
}

.panel-header {
  padding: 10px 15px;
  background-color: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  user-select: none; /* Prevent text selection on click */
}

.panel-content {
  padding: 15px;
  max-height: calc(90vh - 50px); /* Limit height and enable scrolling, adjust based on header */
  overflow-y: auto;
  /* Custom Scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.2);
}
.panel-content::-webkit-scrollbar {
  width: 6px;
}
.panel-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}
.panel-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}
.panel-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85em; /* Slightly smaller label */
  color: #ccc;
}

/* Style range inputs */
input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px; /* Slightly thicker */
  background: #555;
  outline: none;
  opacity: 0.8;
  -webkit-transition: .2s;
  transition: opacity .2s;
  border-radius: 3px;
  cursor: pointer;
}
input[type=range]:hover {
  opacity: 1;
}
/* Style slider thumb */
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4CAF50;
  cursor: pointer;
  border-radius: 50%;
}
input[type=range]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4CAF50;
  cursor: pointer;
  border-radius: 50%;
  border: none;
}

.control-group input[type="color"],
.control-group input[type="number"],
.control-group select {
  width: 100%;
  padding: 7px 10px; /* More padding */
  background-color: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f0f0f0;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 0.9em;
}
.control-group input[type="color"] {
    height: 35px; /* Consistent height */
    padding: 3px;
    cursor: pointer;
}

.control-group input[type="number"] {
    -moz-appearance: textfield;
}
.control-group input[type="number"]::-webkit-outer-spin-button,
.control-group input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

select {
    cursor: pointer;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  cursor: pointer;
  font-size: 0.9em;
  color: #ddd;
}

.checkbox-group input[type="checkbox"] {
  margin-right: 10px;
  width: 15px;
  height: 15px;
  cursor: pointer;
}

hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

h3, h4 {
    color: #4CAF50; /* Green headers */
    margin-top: 10px;
    margin-bottom: 15px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(76, 175, 80, 0.3);
    font-size: 1.1em;
}
h4 {
    color: #67c2f0; /* Lighter blue for sub-headers */
    border-bottom: none;
    margin-bottom: 12px;
    font-size: 0.95em;
}

button {
    width: 100%;
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s ease, transform 0.1s ease;
    margin-top: 5px; /* Space between buttons */
    font-size: 0.9em;
}
button:active:not(:disabled) {
    transform: scale(0.98);
}

.save-btn {
    background-color: #4CAF50;
    color: white;
}
.save-btn:hover:not(:disabled) {
    background-color: #45a049;
}
.save-btn:disabled {
    background-color: #cccccc;
    color: #666666;
    cursor: not-allowed;
}

.import-btn {
    background-color: #3498db;
    color: white;
}
.import-btn:hover:not(:disabled) {
    background-color: #2980b9;
}

.action-buttons {
    display: flex;
    gap: 10px; /* Space between buttons */
}

.action-buttons button {
    flex: 1; /* Make buttons share space */
}

.small-inputs label {
  display: inline-block;
  width: 30px; /* Adjust as needed */
  text-align: right;
  margin-right: 5px;
}

.small-inputs input[type="number"] {
  width: calc(25% - 40px); /* Adjust based on label width and margins */
  display: inline-block;
  margin-right: 10px; /* Space between inputs */
}

.connection-point-group {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.point-label {
  width: 35px; /* Fixed width for FL, FR, etc. */
  font-weight: bold;
  margin-right: 10px;
  flex-shrink: 0;
}

.axis-inputs {
  display: flex;
  align-items: center;
  flex-grow: 1;
}

.axis-inputs label {
  width: 20px; /* Width for X:, Y:, Z: */
  margin-right: 5px;
  text-align: right;
  flex-shrink: 0;
}

.axis-inputs input[type="number"] {
  flex-grow: 1; /* Inputs take remaining space */
  margin-right: 8px; /* Space between axis inputs */
  min-width: 40px; /* Prevent inputs from becoming too small */
}

.axis-inputs input[type="number"]:last-child {
  margin-right: 0;
}

</style> 