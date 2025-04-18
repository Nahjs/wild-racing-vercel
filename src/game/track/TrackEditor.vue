<template>
  <div class="track-editor" :class="{ 'track-editor-collapsed': isCollapsed }">
    <div class="editor-header">
      <h3>赛道编辑器</h3>
      <button class="collapse-btn" @click="toggleCollapse">
        {{ isCollapsed ? '展开' : '折叠' }}
      </button>
    </div>
    
    <div v-if="!isCollapsed" class="editor-content">
      <div class="editor-section">
        <h4>赛道类型</h4>
        <div class="editor-control">
          <select v-model="trackType">
            <option value="preset">预设赛道</option>
            <option value="generated">生成赛道</option>
          </select>
        </div>
      </div>
      
      <template v-if="trackType === 'preset'">
        <div class="editor-section">
          <h4>预设赛道</h4>
          <div class="editor-control">
            <select v-model="selectedPresetTrack">
              <option v-for="track in presetTracks" :key="track.id" :value="track.id">
                {{ track.name }}
              </option>
            </select>
          </div>
          <button class="action-btn" @click="loadPresetTrack">加载赛道</button>
        </div>
      </template>
      
      <template v-else>
        <div class="editor-section">
          <h4>生成参数</h4>
          
          <div class="editor-control">
            <label>赛道形状:</label>
            <select v-model="generationOptions.trackType">
              <option value="loop">环形</option>
              <option value="straight">直线</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          
          <div class="editor-control">
            <label>路段数量:</label>
            <input type="range" v-model.number="generationOptions.segmentCount" min="6" max="24" step="1">
            <span>{{ generationOptions.segmentCount }}</span>
          </div>
          
          <div class="editor-control">
            <label>半径:</label>
            <input type="range" v-model.number="generationOptions.radius" min="20" max="100" step="5">
            <span>{{ generationOptions.radius }}</span>
          </div>
          
          <div class="editor-control">
            <label>复杂度:</label>
            <input type="range" v-model.number="generationOptions.complexity" min="0" max="1" step="0.1">
            <span>{{ generationOptions.complexity.toFixed(1) }}</span>
          </div>
          
          <div class="editor-control">
            <label>高度变化:</label>
            <input type="range" v-model.number="generationOptions.height" min="0" max="20" step="1">
            <span>{{ generationOptions.height }}</span>
          </div>
          
          <div class="editor-control">
            <label>赛道宽度:</label>
            <input type="range" v-model.number="generationOptions.trackWidth" min="5" max="20" step="0.5">
            <span>{{ generationOptions.trackWidth }}</span>
          </div>
          
          <div class="editor-control">
            <label>添加护栏:</label>
            <input type="checkbox" v-model="generationOptions.withBarriers">
          </div>
          
          <div class="editor-control">
            <label>添加检查点:</label>
            <input type="checkbox" v-model="generationOptions.withCheckpoints">
          </div>
          
          <button class="action-btn" @click="generateTrack">生成赛道</button>
        </div>
        
        <div class="editor-section">
          <h4>障碍物和道具</h4>
          
          <div class="editor-control">
            <label>选择物体:</label>
            <select v-model="selectedObject">
              <option value="CONE">锥桶</option>
              <option value="BARRIER">路障</option>
              <option value="TREE">树</option>
              <option value="RAMP">坡道</option>
              <option value="BOOST">加速道具</option>
            </select>
          </div>
          
          <div class="editor-control">
            <button class="action-btn" @click="enterPlacementMode" :disabled="isPlacingObject">
              放置物体
            </button>
            <button class="action-btn" @click="exitPlacementMode" :disabled="!isPlacingObject">
              取消放置
            </button>
          </div>
          
          <div class="editor-control">
            <button class="action-btn danger" @click="clearAllObjects">清除所有物体</button>
          </div>
        </div>
      </template>
      
      <div class="editor-section">
        <h4>检查点控制</h4>
        <div class="editor-control">
          <label>圈数:</label>
          <input type="number" v-model.number="maxLaps" min="1" max="10">
        </div>
        
        <div class="race-controls">
          <button class="action-btn success" @click="startRace" :disabled="isRaceActive">开始比赛</button>
          <button class="action-btn danger" @click="stopRace" :disabled="!isRaceActive">结束比赛</button>
        </div>
      </div>
      
      <div class="editor-section">
        <h4>保存与加载</h4>
        <div class="editor-control">
          <label>赛道名称:</label>
          <input type="text" v-model="trackName" placeholder="输入赛道名称">
        </div>
        
        <div class="editor-control">
          <button class="action-btn" @click="saveTrack" :disabled="!trackName">保存赛道</button>
          <button class="action-btn" @click="exportTrack" :disabled="!trackName">导出配置</button>
        </div>
      </div>
    </div>
    
    <div v-if="isPlacingObject" class="placement-tooltip">
      点击场景中的位置放置物体，按ESC取消
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';
import * as THREE from 'three';
import { trackManager } from './TrackManager';
import { trackGenerator } from './TrackGenerator';
import { trackObjects } from './TrackObjects';
import { checkpointSystem } from './CheckpointSystem';

export default {
  name: 'TrackEditor',
  props: {
    scene: {
      type: Object,
      required: true
    },
    physicsWorld: {
      type: Object,
      required: true
    },
    renderer: {
      type: Object,
      required: true
    },
    camera: {
      type: Object,
      required: true
    }
  },
  emits: [
    'track-loaded',
    'track-generated',
    'race-started',
    'race-stopped',
    'object-placed'
  ],
  setup(props, { emit }) {
    // 编辑器状态
    const isCollapsed = ref(false);
    const trackType = ref('preset');
    const selectedPresetTrack = ref('default');
    const isPlacingObject = ref(false);
    const selectedObject = ref('CONE');
    const isRaceActive = ref(false);
    const maxLaps = ref(3);
    const trackName = ref('');
    
    // 预设赛道列表
    const presetTracks = ref([
      { id: 'default', name: '默认赛道' },
      { id: 'mountain', name: '山地赛道' },
      { id: 'city', name: '城市赛道' }
    ]);
    
    // 生成选项
    const generationOptions = reactive({
      trackType: 'loop',
      segmentCount: 12,
      radius: 50,
      complexity: 0.5,
      height: 5,
      trackWidth: 10,
      withBarriers: true,
      withCheckpoints: true
    });
    
    // 鼠标射线用于物体放置
    let raycaster = null;
    let mouse = null;
    let placementPlane = null;
    
    // 切换编辑器折叠状态
    const toggleCollapse = () => {
      isCollapsed.value = !isCollapsed.value;
    };
    
    // 加载预设赛道
    const loadPresetTrack = async () => {
      try {
        // 先停止当前比赛
        stopRace();
        
        // 使用赛道管理器加载赛道
        await trackManager.loadTrack(selectedPresetTrack.value, props.scene);
        
        // 初始化检查点系统
        const checkpoints = trackManager.getCheckpoints();
        checkpointSystem.initialize(checkpoints, {
          maxLaps: maxLaps.value
        });
        checkpointSystem.addCheckpointsToScene(props.scene);
        
        // 发出事件
        emit('track-loaded', {
          trackId: selectedPresetTrack.value,
          checkpoints
        });
      } catch (error) {
        console.error('[TrackEditor] 加载预设赛道失败:', error);
      }
    };
    
    // 生成赛道
    const generateTrack = async () => {
      try {
        // 先停止当前比赛
        stopRace();
        
        // 初始化生成器
        trackGenerator.initialize(props.scene, props.physicsWorld);
        
        // 生成赛道
        const track = trackGenerator.generateTrack(generationOptions);
        
        // 初始化物体管理器
        trackObjects.initialize(props.scene, props.physicsWorld);
        
        // 初始化检查点系统
        const checkpoints = trackGenerator.getCheckpoints();
        checkpointSystem.initialize(checkpoints, {
          maxLaps: maxLaps.value
        });
        checkpointSystem.addCheckpointsToScene(props.scene);
        
        // 发出事件
        emit('track-generated', {
          options: { ...generationOptions },
          checkpoints
        });
      } catch (error) {
        console.error('[TrackEditor] 生成赛道失败:', error);
      }
    };
    
    // 进入物体放置模式
    const enterPlacementMode = () => {
      isPlacingObject.value = true;
      
      // 创建一个半透明平面用于放置物体
      if (!placementPlane) {
        const geometry = new THREE.PlaneGeometry(1000, 1000);
        const material = new THREE.MeshBasicMaterial({ 
          visible: false
        });
        placementPlane = new THREE.Mesh(geometry, material);
        placementPlane.rotation.x = -Math.PI / 2; // 水平放置
        placementPlane.position.y = 0.01; // 略高于地面
        props.scene.add(placementPlane);
      }
      
      // 初始化射线和鼠标
      if (!raycaster) {
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
      }
      
      // 添加事件监听器
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('click', onMouseClick);
      window.addEventListener('keydown', onKeyDown);
    };
    
    // 退出物体放置模式
    const exitPlacementMode = () => {
      isPlacingObject.value = false;
      
      // 移除事件监听器
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onMouseClick);
      window.removeEventListener('keydown', onKeyDown);
      
      // 从场景中移除平面
      if (placementPlane) {
        props.scene.remove(placementPlane);
        placementPlane.geometry.dispose();
        placementPlane.material.dispose();
        placementPlane = null;
      }
    };
    
    // 鼠标移动处理
    const onMouseMove = (event) => {
      // 将鼠标位置归一化为 -1 到 1 之间
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    };
    
    // 鼠标点击处理
    const onMouseClick = async (event) => {
      // 避免与UI元素交互时触发
      if (event.target.closest('.track-editor')) {
        return;
      }
      
      // 从相机发射射线
      raycaster.setFromCamera(mouse, props.camera);
      
      // 计算与放置平面的交点
      const intersects = raycaster.intersectObject(placementPlane);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        
        // 放置物体
        const object = await trackObjects.addObject(
          selectedObject.value,
          { x: point.x, y: 0.5, z: point.z }
        );
        
        if (object) {
          console.log(`[TrackEditor] 放置物体 ${selectedObject.value} 在位置: `, point);
          
          // 发出事件
          emit('object-placed', {
            type: selectedObject.value,
            position: point,
            object
          });
        }
      }
    };
    
    // 键盘按键处理
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && isPlacingObject.value) {
        exitPlacementMode();
      }
    };
    
    // 清除所有物体
    const clearAllObjects = () => {
      if (confirm('确定要清除所有物体吗？')) {
        trackObjects.clearObjects();
      }
    };
    
    // 开始比赛
    const startRace = () => {
      checkpointSystem.startRace();
      isRaceActive.value = true;
      emit('race-started');
    };
    
    // 停止比赛
    const stopRace = () => {
      checkpointSystem.stopRace();
      isRaceActive.value = false;
      emit('race-stopped');
    };
    
    // 保存赛道
    const saveTrack = () => {
      if (!trackName.value) {
        alert('请输入赛道名称');
        return;
      }
      
      const trackData = {
        name: trackName.value,
        type: trackType.value,
        options: trackType.value === 'generated' ? { ...generationOptions } : null,
        presetId: trackType.value === 'preset' ? selectedPresetTrack.value : null,
        objects: trackObjects.objects.map(obj => ({
          type: obj.preset,
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, w: obj.rotation.w }
        }))
      };
      
      // 保存到本地存储
      try {
        const savedTracks = JSON.parse(localStorage.getItem('savedTracks') || '[]');
        const existingIndex = savedTracks.findIndex(t => t.name === trackName.value);
        
        if (existingIndex !== -1) {
          if (confirm(`赛道 "${trackName.value}" 已存在，是否覆盖？`)) {
            savedTracks[existingIndex] = trackData;
          } else {
            return;
          }
        } else {
          savedTracks.push(trackData);
        }
        
        localStorage.setItem('savedTracks', JSON.stringify(savedTracks));
        alert('赛道保存成功');
      } catch (error) {
        console.error('[TrackEditor] 保存赛道失败:', error);
        alert('保存失败: ' + error.message);
      }
    };
    
    // 导出赛道配置
    const exportTrack = () => {
      if (!trackName.value) {
        alert('请输入赛道名称');
        return;
      }
      
      const trackData = {
        name: trackName.value,
        type: trackType.value,
        options: trackType.value === 'generated' ? { ...generationOptions } : null,
        presetId: trackType.value === 'preset' ? selectedPresetTrack.value : null,
        objects: trackObjects.objects.map(obj => ({
          type: obj.preset,
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z, w: obj.rotation.w }
        }))
      };
      
      // 转换为 JSON
      const dataStr = JSON.stringify(trackData, null, 2);
      
      // 创建下载链接
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trackName.value.replace(/\s+/g, '_').toLowerCase()}_track.json`;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    };
    
    // 监听赛道类型变化
    watch(trackType, (newValue) => {
      if (newValue === 'preset') {
        // 清理生成的赛道
        trackGenerator.clearTrack();
        trackObjects.clearObjects();
      } else {
        // 卸载预设赛道
        trackManager.unloadCurrentTrack(props.scene);
      }
    });
    
    // 监听最大圈数变化
    watch(maxLaps, (newValue) => {
      if (checkpointSystem) {
        checkpointSystem.maxLaps = newValue;
      }
    });
    
    // 组件卸载时清理资源
    onUnmounted(() => {
      if (isPlacingObject.value) {
        exitPlacementMode();
      }
      
      if (placementPlane) {
        props.scene.remove(placementPlane);
        placementPlane.geometry.dispose();
        placementPlane.material.dispose();
      }
    });
    
    return {
      isCollapsed,
      trackType,
      selectedPresetTrack,
      presetTracks,
      generationOptions,
      isPlacingObject,
      selectedObject,
      isRaceActive,
      maxLaps,
      trackName,
      toggleCollapse,
      loadPresetTrack,
      generateTrack,
      enterPlacementMode,
      exitPlacementMode,
      clearAllObjects,
      startRace,
      stopRace,
      saveTrack,
      exportTrack
    };
  }
};
</script>

<style scoped>
.track-editor {
  position: fixed;
  left: 20px;
  top: 20px;
  width: 300px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  color: white;
  z-index: 1000;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.track-editor-collapsed {
  width: 200px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.editor-header h3 {
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

.editor-content {
  padding: 12px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.editor-section {
  margin-bottom: 16px;
}

.editor-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #aaa;
}

.editor-control {
  margin-bottom: 8px;
}

.editor-control label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}

.editor-control input[type="range"],
.editor-control input[type="text"],
.editor-control input[type="number"],
.editor-control select {
  width: 100%;
  padding: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
}

.editor-control span {
  margin-left: 4px;
  font-size: 12px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 6px 12px;
  margin-top: 4px;
  margin-right: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.danger {
  background: rgba(255, 59, 48, 0.5);
}

.action-btn.danger:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.7);
}

.action-btn.success {
  background: rgba(52, 199, 89, 0.5);
}

.action-btn.success:hover:not(:disabled) {
  background: rgba(52, 199, 89, 0.7);
}

.race-controls {
  display: flex;
  margin-top: 8px;
}

.placement-tooltip {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  z-index: 1000;
}

/* 滚动条样式 */
.editor-content::-webkit-scrollbar {
  width: 6px;
}

.editor-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.editor-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.editor-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
</style> 