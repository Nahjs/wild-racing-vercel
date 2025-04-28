import * as THREE from 'three';
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';
import { DRACOLoader } from '@/utils/loaders/DRACOLoader';
import CollisionShapes from '@/core/collision/CollisionShapes';
import CollisionUtils from '@/core/utilities/CollisionUtils';
import collisionManagerInstance from '@/core/collision/CollisionManager';
import CollisionFeedback from '@/core/feedback/CollisionFeedback';

class TrackManager {
  constructor() {
    this.tracks = new Map(); // 存储所有赛道模型
    this.currentTrack = null; // 当前加载的赛道
    this.checkpoints = []; // 检查点列表
    this.trackObjects = []; // 赛道上的物体
    this.isLoading = false; // 加载状态
    this.defaultTrackPath = '/track/default_track.glb';
    
    // 碰撞相关
    this.railColliders = []; // 护栏碰撞体
    this.collisionVisualizerGroup = null; // 碰撞体可视化组
    this.showColliders = false; // 是否显示碰撞体
  }

  // 加载赛道模型
  async loadTrack(trackId, scene, physicsWorld) {
    try {
      console.log(`[TrackManager] loadTrack called for trackId: ${trackId}. Physics world provided:`, !!physicsWorld);
      this.isLoading = true;
      this.scene = scene;
      this.physicsWorld = physicsWorld;
      
      // 1. 检查是否已经加载过该赛道
      if (this.tracks.has(trackId)) {
        // 如果已加载，直接从缓存中获取
        const cachedTrack = this.tracks.get(trackId);
        this._setupTrack(cachedTrack, scene);
        this.currentTrack = cachedTrack;
        
        // 重新创建碰撞体
        this._setupColliders(physicsWorld);
        
        this.isLoading = false;
        return cachedTrack;
      }
      
      // 2. 获取赛道模型路径
      const trackPath = this._getTrackPath(trackId);

      const dracoLoader = new DRACOLoader().setDecoderPath('/libs/draco/');
      const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
      
      const gltf = await gltfLoader.loadAsync(trackPath);
      const trackModel = gltf.scene;
      
      // 4. 处理模型（设置阴影、提取检查点等）
      this._processTrackModel(trackModel);
      
      // ★★★ 先设置 currentTrack
      this.currentTrack = trackModel;
      
      // 5. 将模型添加到场景
      this._setupTrack(trackModel, scene);
      
      // 6. 创建赛道的物理碰撞体
      if (physicsWorld) {
        this._setupColliders(physicsWorld);
      }
      
      // 7. 初始化碰撞反馈
      CollisionFeedback.init(scene);
      
      // 8. 缓存赛道模型 (currentTrack 已在上面设置)
      this.tracks.set(trackId, trackModel);
      this.isLoading = false;
      return trackModel;
    } catch (error) {
      console.error('[TrackManager] 加载赛道失败:', error);
      this.isLoading = false;
      throw error;
    }
  }
  
  // 获取赛道路径
  _getTrackPath(trackId) {
    // 可以从配置文件或API获取赛道路径
    // 这里暂时返回默认路径
    if (trackId === 'default') {
      return this.defaultTrackPath;
    }
    return `/track/drift_race_track_free.glb`;
  }
  
  // 处理赛道模型
  _processTrackModel(trackModel) {
    // 设置阴影
    trackModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    
    // 提取检查点
    this.checkpoints = [];
    trackModel.traverse(node => {
      if (node.name.startsWith('checkpoint_')) {
        this.checkpoints.push({
          id: node.name,
          position: node.position.clone(),
          rotation: node.rotation.clone(),
          object: node
        });
      }
    });
    
    // 排序检查点
    this.checkpoints.sort((a, b) => {
      const aIndex = parseInt(a.id.split('_')[1]);
      const bIndex = parseInt(b.id.split('_')[1]);
      return aIndex - bIndex;
    });
  }
  
  // 设置赛道到场景中
  _setupTrack(trackModel, scene) {
    if (this.currentTrack && scene.getObjectById(this.currentTrack.id)) {
      scene.remove(this.currentTrack);
    }
    
    // 在这里放大赛道模型
    const scaleFactor = 1.0; // 放大系数
    trackModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

    scene.add(trackModel);
  }
  
  /**
   * 设置赛道碰撞体
   * @param {CANNON.World} world - 物理世界
   * @private
   */
  _setupColliders(world) {
    console.log(`[TrackManager] _setupColliders called. Current track loaded:`, !!this.currentTrack);
    // 1. 清除之前的碰撞体
    this._clearColliders(world);
    
    // 2. 如果没有加载赛道模型，返回
    if (!this.currentTrack) return;
    
    // 3. 初始化碰撞管理器
    const collisionManager = collisionManagerInstance.init(world);
    
    // 4. 创建护栏碰撞体
    console.log(`[TrackManager] Calling CollisionShapes.createRailsColliders with world:`, !!world, `and currentTrack:`, !!this.currentTrack);
    this.railColliders = CollisionShapes.createRailsColliders(this.currentTrack, world);
    
    // 5. 为所有护栏设置碰撞类型
    this.railColliders.forEach(railBody => {
      collisionManager.setAsRail(railBody);
    });
    
    // 6. 注册护栏碰撞处理
    this._registerCollisionHandlers(collisionManager);
    
    // 7. 创建碰撞体可视化 (调试用)
    if (this.showColliders) {
      this._createCollisionVisualizers();
    }
    
    console.log(`[TrackManager] 已创建 ${this.railColliders.length} 个护栏碰撞体`);
  }
  
  /**
   * 注册碰撞处理器
   * @param {Object} collisionManager - 碰撞管理器
   * @private
   */
  _registerCollisionHandlers(collisionManager) {
    // 注册车辆与护栏的碰撞处理
    collisionManager.registerCollisionHandler(
      collisionManager.collisionTypes.VEHICLE,
      collisionManager.collisionTypes.RAIL,
      (event) => {
        // 处理车辆撞护栏
        CollisionFeedback.handleRailCollision(event);
      }
    );
  }
  
  /**
   * 创建碰撞体可视化 (调试用)
   * @private
   */
  _createCollisionVisualizers() {
    // 移除之前的可视化
    if (this.collisionVisualizerGroup) {
      this.scene.remove(this.collisionVisualizerGroup);
    }
    
    // 创建新的可视化组
    this.collisionVisualizerGroup = new THREE.Group();
    this.collisionVisualizerGroup.name = 'collision_visualizers';
    
    // 为每个护栏碰撞体创建可视化
    this.railColliders.forEach(railBody => {
      const visualizer = CollisionUtils.createCollisionVisualizer(railBody, {
        color: 0xff5500,
        opacity: 0.3,
        wireframe: true
      });
      
      this.collisionVisualizerGroup.add(visualizer);
    });
    
    // 添加到场景
    this.scene.add(this.collisionVisualizerGroup);
  }
  
  /**
   * 更新碰撞体可视化
   * 在动画循环中调用
   */
  updateCollisionVisualizers() {
    if (!this.collisionVisualizerGroup) return;
    
    this.collisionVisualizerGroup.children.forEach(visualizer => {
      if (visualizer.userData.update) {
        visualizer.userData.update();
      }
    });
  }
  
  /**
   * 显示/隐藏碰撞体可视化
   * @param {Boolean} show - 是否显示
   */
  toggleCollisionVisualizers(show) {
    this.showColliders = show;
    
    if (show && !this.collisionVisualizerGroup) {
      this._createCollisionVisualizers();
    }
    
    if (this.collisionVisualizerGroup) {
      this.collisionVisualizerGroup.visible = show;
    }
  }
  
  /**
   * 清除碰撞体
   * @param {CANNON.World} world - 物理世界
   * @private
   */
  _clearColliders(world) {
    // 移除护栏碰撞体
    this.railColliders.forEach(body => {
      if (world.bodies.includes(body)) {
        world.removeBody(body);
      }
    });
    
    this.railColliders = [];
    
    // 移除碰撞体可视化
    if (this.collisionVisualizerGroup) {
      this.scene.remove(this.collisionVisualizerGroup);
      this.collisionVisualizerGroup = null;
    }
  }
  
  // 获取起始位置
  getStartPosition() {
    const defaultStart = new THREE.Vector3(0, 0.2, 8);
    
    if (!this.currentTrack) return defaultStart;
    
    // 查找起始位置标记
    let startMarker = null;
    this.currentTrack.traverse(node => {
      if (node.name.toLowerCase().includes('start')) {
        startMarker = node;
      }
    });
    
    if (startMarker) {
      return startMarker.position.clone().add(new THREE.Vector3(0, 0.3, 0));
    }
    
    // 如果没有找到起始位置标记，使用第一个检查点的位置
    if (this.checkpoints.length > 0) {
      return this.checkpoints[0].position.clone().add(new THREE.Vector3(0, 0.3, 0));
    }
    
    return defaultStart;
  }
  
  // 获取检查点
  getCheckpoints() {
    return [...this.checkpoints];
  }
  
  // 卸载当前赛道
  unloadCurrentTrack(scene) {
    if (this.currentTrack && scene.getObjectById(this.currentTrack.id)) {
      scene.remove(this.currentTrack);
      this.currentTrack = null;
    }
    
    // 清除碰撞体
    if (this.physicsWorld) {
      this._clearColliders(this.physicsWorld);
    }
  }
  
  // 销毁所有资源
  dispose(scene) {
    this.unloadCurrentTrack(scene);
    this.tracks.clear();
    this.checkpoints = [];
    this.trackObjects = [];
    
    // 清除碰撞相关资源
    if (this.physicsWorld) {
      this._clearColliders(this.physicsWorld);
    }
    
    // 清理碰撞反馈
    CollisionFeedback.dispose();
    
    // 获取碰撞管理器并清理
    const collisionManager = collisionManagerInstance.getInstance();
    if (collisionManager) {
      collisionManager.clearAllListeners();
    }
  }
  
  /**
   * 更新方法，在渲染循环中调用
   * @param {Number} deltaTime - 帧时间间隔
   */
  update(deltaTime) {
    // 更新碰撞体可视化
    if (this.showColliders && this.collisionVisualizerGroup) {
      this.updateCollisionVisualizers();
    }
    
    // 更新碰撞反馈系统
    if (CollisionFeedback.initialized) {
      CollisionFeedback.update(deltaTime);
    }
  }
}

// 创建单例
export const trackManager = new TrackManager(); 