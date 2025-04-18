<template>
  <div class="track-renderer">
    <!-- 渲染器没有视觉UI，它只负责在提供的场景中渲染赛道 -->
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { trackManager } from './TrackManager';
import { trackGenerator } from './TrackGenerator';
import { checkpointSystem } from './CheckpointSystem';
import { trackObjects } from './TrackObjects';

export default {
  name: 'TrackRenderer',
  props: {
    scene: {
      type: Object,
      required: true
    },
    physicsWorld: {
      type: Object,
      required: true
    },
    trackId: {
      type: String,
      default: 'default'
    },
    customGeneration: {
      type: Boolean,
      default: false
    },
    generationOptions: {
      type: Object,
      default: () => ({})
    },
    useCheckpoints: {
      type: Boolean,
      default: true
    },
    maxLaps: {
      type: Number,
      default: 3
    }
  },
  emits: [
    'track-loaded',
    'track-error',
    'checkpoint-passed',
    'lap-completed',
    'race-completed'
  ],
  setup(props, { emit }) {
    const trackModel = ref(null);
    const isLoading = ref(false);
    const currentTrackId = ref(props.trackId);
    
    // 当赛道ID变化时，加载新赛道
    watch(() => props.trackId, (newTrackId) => {
      if (newTrackId !== currentTrackId.value) {
        currentTrackId.value = newTrackId;
        loadTrack();
      }
    });
    
    // 加载赛道
    const loadTrack = async () => {
      try {
        isLoading.value = true;
        
        // 先清理现有赛道
        unloadTrack();
        
        if (props.customGeneration) {
          // 使用赛道生成器
          await loadGeneratedTrack();
        } else {
          // 加载预设赛道
          await loadPredefinedTrack();
        }
        
        // 设置检查点系统
        if (props.useCheckpoints) {
          setupCheckpointSystem();
        }
        
        isLoading.value = false;
        emit('track-loaded', {
          trackId: currentTrackId.value,
          model: trackModel.value
        });
      } catch (error) {
        console.error('[TrackRenderer] 加载赛道失败:', error);
        isLoading.value = false;
        emit('track-error', error);
      }
    };
    
    // 加载预设赛道
    const loadPredefinedTrack = async () => {
      // 使用赛道管理器加载模型赛道
      trackModel.value = await trackManager.loadTrack(currentTrackId.value, props.scene);
    };
    
    // 生成程序化赛道
    const loadGeneratedTrack = async () => {
      // 初始化生成器
      trackGenerator.initialize(props.scene, props.physicsWorld);
      
      // 生成赛道
      trackModel.value = trackGenerator.generateTrack({
        trackType: props.generationOptions.trackType || 'loop',
        segmentCount: props.generationOptions.segmentCount || 12,
        radius: props.generationOptions.radius || 50,
        complexity: props.generationOptions.complexity || 0.5,
        height: props.generationOptions.height || 0,
        trackWidth: props.generationOptions.trackWidth || 10,
        withBarriers: props.generationOptions.withBarriers !== false,
        withCheckpoints: props.generationOptions.withCheckpoints !== false
      });
      
      // 初始化物体管理器
      trackObjects.initialize(props.scene, props.physicsWorld);
      
      // 如果提供了障碍物配置，添加障碍物
      if (props.generationOptions.obstacles && Array.isArray(props.generationOptions.obstacles)) {
        await trackObjects.addObjects(props.generationOptions.obstacles);
      }
    };
    
    // 设置检查点系统
    const setupCheckpointSystem = () => {
      let checkpoints = [];
      
      // 获取检查点，优先使用生成的检查点
      if (props.customGeneration) {
        checkpoints = trackGenerator.getCheckpoints();
      } else {
        checkpoints = trackManager.getCheckpoints();
      }
      
      if (checkpoints.length === 0) {
        console.warn('[TrackRenderer] 没有找到检查点');
        return;
      }
      
      // 初始化检查点系统
      checkpointSystem.initialize(checkpoints, {
        maxLaps: props.maxLaps
      });
      
      // 添加检查点到场景
      checkpointSystem.addCheckpointsToScene(props.scene);
      
      // 设置事件回调
      checkpointSystem.onCheckpointPassed = (data) => {
        emit('checkpoint-passed', data);
      };
      
      checkpointSystem.onLapCompleted = (data) => {
        emit('lap-completed', data);
      };
      
      checkpointSystem.onRaceCompleted = (data) => {
        emit('race-completed', data);
      };
    };
    
    // 卸载赛道
    const unloadTrack = () => {
      // 清理检查点系统
      checkpointSystem.removeCheckpointsFromScene();
      
      // 卸载现有赛道模型
      if (props.customGeneration) {
        trackGenerator.clearTrack();
        trackObjects.clearObjects();
      } else {
        trackManager.unloadCurrentTrack(props.scene);
      }
      
      trackModel.value = null;
    };
    
    // 获取起始位置
    const getStartPosition = () => {
      if (props.customGeneration) {
        // 对于生成的赛道，从第一个检查点获取起始位置
        const checkpoints = trackGenerator.getCheckpoints();
        if (checkpoints.length > 0) {
          return checkpoints[0].position.clone();
        }
      } else {
        // 对于预设赛道，使用赛道管理器
        return trackManager.getStartPosition();
      }
      
      // 默认起始位置
      return { x: 0, y: 0.5, z: 0 };
    };
    
    // 更新检查点系统
    const updateCheckpoints = (playerPosition) => {
      if (props.useCheckpoints && checkpointSystem) {
        checkpointSystem.update(playerPosition);
      }
    };
    
    // 开始比赛
    const startRace = () => {
      if (props.useCheckpoints && checkpointSystem) {
        checkpointSystem.startRace();
      }
    };
    
    // 停止比赛
    const stopRace = () => {
      if (props.useCheckpoints && checkpointSystem) {
        checkpointSystem.stopRace();
      }
    };
    
    // 获取比赛状态
    const getRaceStatus = () => {
      if (props.useCheckpoints && checkpointSystem) {
        return checkpointSystem.getRaceStatus();
      }
      return { status: 'inactive' };
    };
    
    // 组件挂载时加载赛道
    onMounted(() => {
      loadTrack();
    });
    
    // 组件卸载时清理资源
    onUnmounted(() => {
      unloadTrack();
      
      if (props.customGeneration) {
        trackGenerator.dispose(props.scene);
        trackObjects.dispose();
      }
    });
    
    // 暴露方法给父组件
    return {
      loadTrack,
      unloadTrack,
      getStartPosition,
      updateCheckpoints,
      startRace,
      stopRace,
      getRaceStatus,
      isLoading
    };
  }
};
</script>

<style scoped>
.track-renderer {
  display: none;
}
</style> 