<template>
  <div class="controls-panel" :class="{ 'controls-panel-collapsed': isCollapsed }">
    <div class="panel-header">
      <h3>物理调试控制面板</h3>
      <button class="collapse-btn" @click="toggleCollapse">
        {{ isCollapsed ? '展开' : '折叠' }}
      </button>
    </div>
    
    <div v-if="!isCollapsed" class="panel-content">
      <div class="control-group">
        <h4>基本控制</h4>
        <div class="control-row">
          <label>引擎功率:</label>
          <input 
            type="range" 
            min="500" 
            max="5000" 
            step="50"
            :value="enginePower"
            @input="$emit('update:engine-power', Number($event.target.value))" 
          />
          <span>{{ enginePower }}</span>
        </div>
        
        <div class="control-row">
          <label>转向强度:</label>
          <input 
            type="range" 
            min="0.1" 
            max="2" 
            step="0.1" 
            :value="turnStrength"
            @input="$emit('update:turn-strength', Number($event.target.value))" 
          />
          <span>{{ turnStrength.toFixed(1) }}</span>
        </div>
        
        <div class="control-row">
          <label>质量 (kg):</label>
          <input 
            type="number" 
            min="100" 
            max="5000" 
            step="10" 
            :value="vehicleMass"
            @input="$emit('update:vehicle-mass', Number($event.target.value))" 
          />
        </div>
      </div>
      
      <div class="control-group">
        <h4>阻尼设置</h4>
        <div class="control-row">
          <label>线性阻尼:</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            :value="linearDamping"
            @input="$emit('update:linear-damping', Number($event.target.value))" 
          />
          <span>{{ linearDamping.toFixed(2) }}</span>
        </div>
        
        <div class="control-row">
          <label>角阻尼:</label>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            :value="angularDamping"
            @input="$emit('update:angular-damping', Number($event.target.value))" 
          />
          <span>{{ angularDamping.toFixed(2) }}</span>
        </div>
      </div>
      
      <div class="control-group">
        <h4>摩擦力设置</h4>
        <div class="control-row">
          <label>地面摩擦:</label>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="0.05" 
            :value="groundFriction"
            @input="$emit('update:ground-friction', Number($event.target.value))" 
          />
          <span>{{ groundFriction.toFixed(2) }}</span>
        </div>
      </div>
      
      <div class="control-group">
        <h4>制动控制</h4>
        <div class="control-row">
          <label>刹车力:</label>
          <input 
            type="range" 
            min="1" 
            max="100" 
            step="1" 
            :value="brakePower"
            @input="$emit('update:brake-power', Number($event.target.value))" 
          />
          <span>{{ brakePower }}</span>
        </div>
        
        <div class="control-row">
          <label>减速力:</label>
          <input 
            type="range" 
            min="1" 
            max="100" 
            step="1" 
            :value="slowDownForce"
            @input="$emit('update:slow-down-force', Number($event.target.value))" 
          />
          <span>{{ slowDownForce }}</span>
        </div>
      </div>
      
      <div class="control-group">
        <h4>悬挂设置</h4>
        <div class="control-row">
          <label>悬挂刚度:</label>
          <input 
            type="range" 
            min="10" 
            max="100" 
            step="1" 
            :value="suspensionStiffness"
            @input="$emit('update:suspension-stiffness', Number($event.target.value))" 
          />
          <span>{{ suspensionStiffness }}</span>
        </div>
        
        <div class="control-row">
          <label>悬挂长度:</label>
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.05" 
            :value="suspensionRestLength"
            @input="$emit('update:suspension-rest-length', Number($event.target.value))" 
          />
          <span>{{ suspensionRestLength.toFixed(2) }}</span>
        </div>
        
        <div class="control-row">
          <label>轮胎摩擦:</label>
          <input 
            type="range" 
            min="1" 
            max="100" 
            step="1" 
            :value="frictionSlip"
            @input="$emit('update:friction-slip', Number($event.target.value))" 
          />
          <span>{{ frictionSlip }}</span>
        </div>
        
        <div class="control-row">
          <label>阻尼松弛:</label>
          <input 
            type="range" 
            min="0.1" 
            max="10" 
            step="0.1" 
            :value="dampingRelaxation"
            @input="$emit('update:damping-relaxation', Number($event.target.value))" 
          />
          <span>{{ dampingRelaxation.toFixed(1) }}</span>
        </div>
        
        <div class="control-row">
          <label>阻尼压缩:</label>
          <input 
            type="range" 
            min="0.1" 
            max="10" 
            step="0.1" 
            :value="dampingCompression"
            @input="$emit('update:damping-compression', Number($event.target.value))" 
          />
          <span>{{ dampingCompression.toFixed(1) }}</span>
        </div>
        
        <div class="control-row">
          <label>最大悬挂力:</label>
          <input 
            type="range" 
            min="1000" 
            max="30000" 
            step="1000" 
            :value="maxSuspensionForce"
            @input="$emit('update:max-suspension-force', Number($event.target.value))" 
          />
          <span>{{ maxSuspensionForce }}</span>
        </div>
        
        <div class="control-row">
          <label>翻滚影响:</label>
          <input 
            type="range" 
            min="0.01" 
            max="0.5" 
            step="0.01" 
            :value="rollInfluence"
            @input="$emit('update:roll-influence', Number($event.target.value))" 
          />
          <span>{{ rollInfluence.toFixed(2) }}</span>
        </div>
        
        <div class="control-row">
          <label>悬挂行程:</label>
          <input 
            type="range" 
            min="0.1" 
            max="2" 
            step="0.1" 
            :value="maxSuspensionTravel"
            @input="$emit('update:max-suspension-travel', Number($event.target.value))" 
          />
          <span>{{ maxSuspensionTravel.toFixed(1) }}</span>
        </div>
      </div>
      
      <div class="control-group">
        <h4>车轮旋转修正</h4>
        <div class="control-row">
          <label>修正轴:</label>
          <select 
            :value="initialCorrectionAxis"
            @change="$emit('update:initial-correction-axis', $event.target.value)"
          >
            <option value="x">X轴</option>
            <option value="y">Y轴</option>
            <option value="z">Z轴</option>
          </select>
        </div>
        
        <div class="control-row">
          <label>修正角度:</label>
          <input 
            type="range" 
            min="0" 
            max="180" 
            step="5" 
            :value="initialCorrectionAngle"
            @input="$emit('update:initial-correction-angle', Number($event.target.value))" 
          />
          <span>{{ initialCorrectionAngle }}°</span>
        </div>
      </div>
      
      <!-- 新增: 车轮辅助线控制 -->
      <div class="control-group">
        <h4>调试辅助</h4>
        <div class="control-row">
          <label>显示车轮辅助线:</label>
          <input 
            type="checkbox" 
            :checked="showWheelAxes"
            @change="$emit('update:show-wheel-axes', $event.target.checked)" 
          />
        </div>
      </div>
      
      <!-- New Camera Controls Section -->
      <div class="control-group camera-controls">
        <h4>相机控制 (模式: {{ cameraModeName }})</h4>
        <div v-if="currentCameraMode === 0 || currentCameraMode === 1"> <!-- NEAR_FOLLOW or FAR_FOLLOW -->
          <div class="control-row">
            <label>距离:</label>
            <input type="number" :value="cameraParams.distance" @input="$emit('update:cameraParam', { mode: currentCameraMode, param: 'distance', value: $event.target.valueAsNumber })" step="0.1" />
            <span>{{ cameraParams.distance?.toFixed(1) }}</span>
          </div>
          <div class="control-row">
            <label>高度:</label>
            <input type="number" :value="cameraParams.height" @input="$emit('update:cameraParam', { mode: currentCameraMode, param: 'height', value: $event.target.valueAsNumber })" step="0.1" />
             <span>{{ cameraParams.height?.toFixed(1) }}</span>
          </div>
          <div class="control-row">
            <label>视场(FOV):</label>
            <input type="number" :value="cameraParams.fov" @input="$emit('update:cameraParam', { mode: currentCameraMode, param: 'fov', value: $event.target.valueAsNumber })" step="1" min="10" max="120" />
             <span>{{ cameraParams.fov }}</span>
          </div>
          <div class="control-row">
            <label>阻尼:</label>
            <input type="number" :value="cameraParams.damping" @input="$emit('update:cameraParam', { mode: currentCameraMode, param: 'damping', value: $event.target.valueAsNumber })" step="0.01" min="0" max="0.2" />
            <span>{{ cameraParams.damping?.toFixed(2) }}</span>
          </div>
          <div class="control-row">
            <label>视点偏移:</label>
            <div class="vector-input">
              <input type="number" :value="cameraParams.lookAtOffset[0]" @input="$emit('update:cameraLookAtOffset', { mode: currentCameraMode, index: 0, value: $event.target.valueAsNumber })" step="0.1" placeholder="X" />
              <input type="number" :value="cameraParams.lookAtOffset[1]" @input="$emit('update:cameraLookAtOffset', { mode: currentCameraMode, index: 1, value: $event.target.valueAsNumber })" step="0.1" placeholder="Y" />
              <input type="number" :value="cameraParams.lookAtOffset[2]" @input="$emit('update:cameraLookAtOffset', { mode: currentCameraMode, index: 2, value: $event.target.valueAsNumber })" step="0.1" placeholder="Z" />
            </div>
            <span>[{{ cameraParams.lookAtOffset?.map(n => n.toFixed(1)).join(", ") }}]</span>
          </div>
        </div>
         <div v-else-if="currentCameraMode === 2"> <!-- FREE_LOOK -->
           <p>自由视角模式。</p>
            <div class="control-row">
              <label>视场(FOV):</label>
              <input type="number" :value="cameraParams.fov" @input="$emit('update:cameraParam', { mode: currentCameraMode, param: 'fov', value: $event.target.valueAsNumber })" step="1" min="10" max="120" />
               <span>{{ cameraParams.fov }}</span>
            </div>
           <!-- No OrbitControls specific options here, maybe enable/disable? -->
         </div>
         <button @click="$emit('saveCameraSettings')" :disabled="isSavingCameraSettings">{{ isSavingCameraSettings ? "保存中..." : "保存相机设置" }}</button>
         <small>按 "V" 切换视角</small>
      </div>
      
      <div class="control-actions">
        <button class="save-btn" @click="$emit('save-tuning')" :disabled="isSavingTuning">
          {{ isSavingTuning ? '保存中...' : '保存调校设置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RaceDebug',
  props: {
    enginePower: {
      type: Number,
      default: 2750
    },
    turnStrength: {
      type: Number,
      default: 0.5
    },
    vehicleMass: {
      type: Number,
      default: 653
    },
    linearDamping: {
      type: Number,
      default: 0.1
    },
    angularDamping: {
      type: Number,
      default: 0.5
    },
    groundFriction: {
      type: Number,
      default: 0.3
    },
    brakePower: {
      type: Number,
      default: 36
    },
    slowDownForce: {
      type: Number,
      default: 19.6
    },
    suspensionStiffness: {
      type: Number,
      default: 55
    },
    suspensionRestLength: {
      type: Number,
      default: 0.5
    },
    frictionSlip: {
      type: Number,
      default: 30
    },
    dampingRelaxation: {
      type: Number,
      default: 2.3
    },
    dampingCompression: {
      type: Number,
      default: 4.3
    },
    maxSuspensionForce: {
      type: Number,
      default: 10000
    },
    rollInfluence: {
      type: Number,
      default: 0.01
    },
    maxSuspensionTravel: {
      type: Number,
      default: 1
    },
    initialCorrectionAxis: {
      type: String,
      default: 'x'
    },
    initialCorrectionAngle: {
      type: Number,
      default: 90
    },
    showWheelAxes: {
      type: Boolean,
      default: false
    },
    isSavingTuning: {
      type: Boolean,
      default: false
    },
    currentCameraMode: {
      type: Number,
      required: true
    },
    cameraParams: {
      type: Object,
      required: true
    },
    isSavingCameraSettings: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'update:engine-power',
    'update:turn-strength',
    'update:vehicle-mass',
    'update:linear-damping',
    'update:angular-damping',
    'update:ground-friction',
    'update:brake-power',
    'update:slow-down-force',
    'update:suspension-stiffness',
    'update:suspension-rest-length',
    'update:friction-slip',
    'update:damping-relaxation',
    'update:damping-compression',
    'update:max-suspension-force',
    'update:roll-influence',
    'update:max-suspension-travel',
    'update:initial-correction-axis',
    'update:initial-correction-angle',
    'update:show-wheel-axes',
    'save-tuning',
    'update:cameraParam',
    'update:cameraLookAtOffset',
    'saveCameraSettings'
  ],
  data() {
    return {
      isCollapsed: false
    };
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    }
  },
  computed: {
    cameraModeName() {
      switch (this.currentCameraMode) {
        case 0: return "近景跟随";
        case 1: return "远景跟随";
        case 2: return "自由视角";
        default: return "未知";
      }
    }
  }
};
</script>

<style scoped>
.controls-panel {
  position: fixed;
  left: 20px;
  top: 20px;
  width: 320px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  color: white;
  z-index: 1000;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.controls-panel-collapsed {
  width: 200px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
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

.panel-content {
  padding: 12px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.control-group {
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 12px;
}

.control-group:last-child {
  border-bottom: none;
}

.control-group h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #aaa;
}

.control-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.control-row label {
  width: 100px;
  font-size: 12px;
}

.control-row input[type="range"] {
  flex: 1;
  margin: 0 10px;
}

.control-row input[type="number"] {
  width: 70px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
}

.control-row input[type="checkbox"] {
  margin-left: 10px;
}

.control-row select {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  padding: 4px 8px;
}

.control-row span {
  width: 45px;
  text-align: right;
  font-size: 12px;
}

.control-actions {
  margin-top: 20px;
  text-align: center;
}

.save-btn {
  background: rgba(52, 199, 89, 0.7);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
}

.save-btn:hover:not(:disabled) {
  background: rgba(52, 199, 89, 0.9);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.vector-input span {
  width: auto; /* Allow span in vector input to resize */
  margin-left: 5px;
}

.camera-controls {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 15px;
    margin-top: 15px;
}

.camera-controls p {
    font-size: 12px;
    color: #ccc;
    margin-bottom: 10px;
}

.camera-controls button {
    background: rgba(0, 122, 255, 0.7);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
    margin-top: 10px;
}

.camera-controls button:hover:not(:disabled) {
    background: rgba(0, 122, 255, 0.9);
}

.camera-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.camera-controls small {
    display: block;
    margin-top: 10px;
    color: #aaa;
    text-align: center;
    font-size: 11px;
}
</style> 