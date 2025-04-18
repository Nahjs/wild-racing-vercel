import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class CheckpointSystem {
  constructor() {
    this.checkpoints = [];
    this.currentCheckpointIndex = 0;
    this.lapCount = 0;
    this.maxLaps = 3;
    this.isRaceActive = false;
    this.raceStartTime = 0;
    this.currentLapStartTime = 0;
    this.bestLapTime = 0;
    this.lapTimes = [];
    this.checkpointTriggers = [];
    this.onLapCompleted = null;
    this.onRaceCompleted = null;
    this.onCheckpointPassed = null;
  }
  
  // 初始化检查点系统
  initialize(checkpoints = [], options = {}) {
    this.checkpoints = [...checkpoints];
    this.currentCheckpointIndex = 0;
    this.lapCount = 0;
    this.maxLaps = options.maxLaps || 3;
    this.isRaceActive = false;
    this.lapTimes = [];
    
    // 清理旧的检查点触发器
    this._clearCheckpointTriggers();
    
    // 创建检查点触发器
    this._createCheckpointTriggers();
    
    console.log(`[CheckpointSystem] 初始化完成，检查点数量: ${this.checkpoints.length}`);
    
    return this;
  }
  
  // 创建检查点触发器
  _createCheckpointTriggers() {
    this.checkpointTriggers = this.checkpoints.map((checkpoint, index) => {
      const position = checkpoint.position;
      
      // 创建可视化效果（如果没有模型）
      if (!checkpoint.object) {
        const geometry = new THREE.RingGeometry(5, 5.5, 32);
        const material = new THREE.MeshBasicMaterial({
          color: index === 0 ? 0xffff00 : 0x00ff00,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5
        });
        
        const visual = new THREE.Mesh(geometry, material);
        visual.position.copy(position);
        visual.rotation.x = Math.PI / 2; // 水平放置
        
        checkpoint.object = visual;
      }
      
      // 返回触发器信息
      return {
        index,
        position: position.clone(),
        radius: 8, // 检查点触发半径
        isPassed: false,
        object: checkpoint.object,
        lastPassTime: 0
      };
    });
  }
  
  // 清理检查点触发器
  _clearCheckpointTriggers() {
    // 移除视觉对象
    this.checkpointTriggers.forEach(trigger => {
      if (trigger.scene && trigger.object) {
        trigger.scene.remove(trigger.object);
      }
    });
    
    this.checkpointTriggers = [];
  }
  
  // 开始比赛
  startRace() {
    this.isRaceActive = true;
    this.currentCheckpointIndex = 0;
    this.lapCount = 0;
    this.raceStartTime = Date.now();
    this.currentLapStartTime = Date.now();
    this.bestLapTime = 0;
    this.lapTimes = [];
    
    // 重置所有检查点状态
    this.checkpointTriggers.forEach(trigger => {
      trigger.isPassed = false;
      trigger.lastPassTime = 0;
      
      // 更新检查点视觉效果
      this._updateCheckpointVisual(trigger);
    });
    
    console.log('[CheckpointSystem] 比赛开始!');
  }
  
  // 停止比赛
  stopRace() {
    this.isRaceActive = false;
    
    // 计算最终成绩
    const totalTime = Date.now() - this.raceStartTime;
    
    console.log(`[CheckpointSystem] 比赛结束! 总时间: ${this._formatTime(totalTime)}`);
    
    // 触发比赛结束回调
    if (this.onRaceCompleted) {
      this.onRaceCompleted({
        totalTime,
        lapTimes: [...this.lapTimes],
        bestLapTime: this.bestLapTime,
        lapCount: this.lapCount
      });
    }
  }
  
  // 更新检查点系统
  update(playerPosition) {
    if (!this.isRaceActive || this.checkpointTriggers.length === 0) return;
    
    // 获取当前目标检查点
    const currentTarget = this.checkpointTriggers[this.currentCheckpointIndex];
    
    // 检查是否到达当前检查点
    const distance = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z
    ).distanceTo(currentTarget.position);
    
    // 如果到达检查点
    if (distance < currentTarget.radius && !currentTarget.isPassed) {
      this._passCheckpoint(this.currentCheckpointIndex);
    }
  }
  
  // 通过检查点
  _passCheckpoint(index) {
    const checkpoint = this.checkpointTriggers[index];
    checkpoint.isPassed = true;
    checkpoint.lastPassTime = Date.now();
    
    console.log(`[CheckpointSystem] 通过检查点 ${index+1}/${this.checkpointTriggers.length}`);
    
    // 更新检查点视觉效果
    this._updateCheckpointVisual(checkpoint);
    
    // 如果是最后一个检查点，完成一圈
    if (index === this.checkpointTriggers.length - 1) {
      this._completeLap();
    } else {
      // 移动到下一个检查点
      this.currentCheckpointIndex = (index + 1) % this.checkpointTriggers.length;
      
      // 触发检查点通过回调
      if (this.onCheckpointPassed) {
        this.onCheckpointPassed({
          checkpointIndex: index,
          nextCheckpointIndex: this.currentCheckpointIndex,
          lapCount: this.lapCount
        });
      }
    }
  }
  
  // 完成一圈
  _completeLap() {
    // 计算圈速
    const lapTime = Date.now() - this.currentLapStartTime;
    this.lapTimes.push(lapTime);
    
    // 更新最佳圈速
    if (this.bestLapTime === 0 || lapTime < this.bestLapTime) {
      this.bestLapTime = lapTime;
    }
    
    this.lapCount++;
    console.log(`[CheckpointSystem] 完成第 ${this.lapCount} 圈! 时间: ${this._formatTime(lapTime)}`);
    
    // 重置检查点状态
    this.checkpointTriggers.forEach(trigger => {
      trigger.isPassed = false;
      
      // 更新检查点视觉效果
      this._updateCheckpointVisual(trigger);
    });
    
    // 重置到第一个检查点
    this.currentCheckpointIndex = 0;
    
    // 更新当前圈开始时间
    this.currentLapStartTime = Date.now();
    
    // 触发圈完成回调
    if (this.onLapCompleted) {
      this.onLapCompleted({
        lapTime,
        lapCount: this.lapCount,
        bestLapTime: this.bestLapTime
      });
    }
    
    // 检查是否完成所有圈数
    if (this.lapCount >= this.maxLaps) {
      this.stopRace();
    }
  }
  
  // 更新检查点视觉效果
  _updateCheckpointVisual(checkpoint) {
    const visual = checkpoint.object;
    if (!visual) return;
    
    // 仅更新颜色材质（如果存在）
    if (visual.material) {
      const isCurrentTarget = checkpoint.index === this.currentCheckpointIndex;
      const isPassed = checkpoint.isPassed;
      
      if (isCurrentTarget && !isPassed) {
        // 当前目标：黄色
        visual.material.color.setHex(0xffff00);
        visual.material.opacity = 0.8;
      } else if (isPassed) {
        // 已通过：绿色
        visual.material.color.setHex(0x00ff00);
        visual.material.opacity = 0.3;
      } else {
        // 未通过：蓝色
        visual.material.color.setHex(0x0088ff);
        visual.material.opacity = 0.5;
      }
    }
  }
  
  // 格式化时间显示
  _formatTime(timeMs) {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    const ms = Math.floor((timeMs % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  // 添加检查点到场景
  addCheckpointsToScene(scene) {
    this.checkpointTriggers.forEach(trigger => {
      if (trigger.object && !trigger.scene) {
        scene.add(trigger.object);
        trigger.scene = scene;
      }
    });
  }
  
  // 从场景移除检查点
  removeCheckpointsFromScene() {
    this.checkpointTriggers.forEach(trigger => {
      if (trigger.scene && trigger.object) {
        trigger.scene.remove(trigger.object);
        trigger.scene = null;
      }
    });
  }
  
  // 获取当前比赛状态
  getRaceStatus() {
    if (!this.isRaceActive) {
      return {
        status: 'inactive',
        message: '比赛未开始'
      };
    }
    
    return {
      status: 'active',
      lapCount: this.lapCount,
      maxLaps: this.maxLaps,
      currentCheckpoint: this.currentCheckpointIndex + 1,
      totalCheckpoints: this.checkpointTriggers.length,
      bestLapTime: this.bestLapTime,
      currentLapTime: Date.now() - this.currentLapStartTime,
      totalRaceTime: Date.now() - this.raceStartTime
    };
  }
  
  // 获取当前检查点位置
  getCurrentCheckpointPosition() {
    if (this.checkpointTriggers.length === 0 || !this.isRaceActive) {
      return null;
    }
    
    return this.checkpointTriggers[this.currentCheckpointIndex].position.clone();
  }
  
  // 清理资源
  dispose() {
    this.removeCheckpointsFromScene();
    this.checkpoints = [];
    this.checkpointTriggers = [];
    this.isRaceActive = false;
  }
}

// 创建单例
export const checkpointSystem = new CheckpointSystem(); 