import * as THREE from 'three';
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';
import { DRACOLoader } from '@/utils/loaders/DRACOLoader';
import RapierAdapter from '@/core/physics/rapier/RapierAdapter';
import CollisionUtils from '@/core/utilities/CollisionUtils';
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
  async loadTrack(trackId, scene) {
    try {
      console.log(`[TrackManager] loadTrack called for trackId: ${trackId}.`);
      this.isLoading = true;
      this.scene = scene;
      this.physicsWorld = RapierAdapter.world; // Directly access the world from the adapter
      
      // 1. 检查是否已经加载过该赛道
      if (this.tracks.has(trackId)) {
        // 如果已加载，直接从缓存中获取
        const cachedTrack = this.tracks.get(trackId);
        this._setupTrack(cachedTrack, scene);
        this.currentTrack = cachedTrack;
        
        // 重新创建碰撞体
        this._setupColliders();
        
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
      this._setupColliders();
      
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
   * 设置赛道碰撞体 (Rapier 版本)
   * @private
   */
  _setupColliders() {
    console.log(`[TrackManager] _setupColliders called (Rapier). Current track loaded:`, !!this.currentTrack);
    // 1. 清除之前的碰撞体
    this._clearColliders();
    
    // 2. 如果没有加载赛道模型或物理世界未初始化，返回
    if (!this.currentTrack || !this.physicsWorld || !this.physicsWorld.isInitialized) {
      console.warn("[TrackManager] 赛道模型未加载或物理世界未初始化，无法创建碰撞体。");
      return;
    }
    
    // 3. 创建护栏碰撞体
    console.log(`[TrackManager] Calling RapierAdapter.createRailsColliders...`);
    this.railColliders = RapierAdapter.createRailsColliders(this.currentTrack);
    console.log(`[TrackManager] 创建了 ${this.railColliders.length} 个护栏碰撞体 (Rapier)`);

    // 4. 创建地形碰撞体
    console.log(`[TrackManager] Calling RapierAdapter.createTerrainColliders...`);
    this.terrainColliders = RapierAdapter.createTerrainColliders(this.currentTrack);
    console.log(`[TrackManager] 创建了 ${this.terrainColliders.length} 个地形碰撞体 (Rapier)`);
    
    // 5. 注册碰撞处理 (需要适配Rapier的事件系统)
    this._registerCollisionHandlers();
    
    // 6. 创建碰撞体可视化 (调试用)
    if (this.showColliders) {
      this._createCollisionVisualizers();
    }
  }
  
  /**
   * 注册碰撞处理器 (Rapier 版本)
   * @private
   */
  _registerCollisionHandlers() {
    if (!this.physicsWorld) return;

    // 定义碰撞处理回调
    const collisionHandler = {
      onContactStart: (collider1, collider2) => {
        const data1 = collider1.userData;
        const data2 = collider2.userData;

        // 检查车辆与护栏的碰撞
        if ((data1?.type === 'vehicle' && data2?.type === 'rail') || 
            (data1?.type === 'rail' && data2?.type === 'vehicle')) {
          const vehicleCollider = data1?.type === 'vehicle' ? collider1 : collider2;
          const railCollider = data1?.type === 'rail' ? collider1 : collider2;
          
          // 模拟旧的 event 结构 (可能需要调整)
          const event = {
            body: vehicleCollider.parent(), // 获取刚体
            target: railCollider.parent(), // 获取刚体
            contact: { /* Rapier不直接提供详细接触点信息，需要的话需额外查询 */ }
          };
          CollisionFeedback.handleRailCollision(event);
        }
        
        // 检查车辆与地形的碰撞 (可能不需要特别处理，除非有特殊逻辑)
        // if ((data1?.type === 'vehicle' && data2?.type === 'terrain') || 
        //     (data1?.type === 'terrain' && data2?.type === 'vehicle')) {
        //   // ...
        // }
      },
      onContactEnd: (collider1, collider2) => {
        // 处理接触结束事件 (如果需要)
      }
    };

    // 注册到 RapierWorld
    this.physicsWorld.addContactListener(collisionHandler);
    console.log("[TrackManager] Rapier 碰撞监听器已注册");
    
    // 保存引用以便后续移除
    this.currentCollisionHandler = collisionHandler;
  }
  
  /**
   * 创建碰撞体可视化 (Rapier 版本)
   * @private
   */
  _createCollisionVisualizers() {
    if (!this.scene) return;
    
    // 移除之前的可视化
    if (this.collisionVisualizerGroup) {
      this.scene.remove(this.collisionVisualizerGroup);
    }
    
    this.collisionVisualizerGroup = new THREE.Group();
    this.collisionVisualizerGroup.name = 'collision_visualizers';

    const visualize = (colliders, color) => {
      if (!colliders) return;
      colliders.forEach(colliderInfo => {
        if (!colliderInfo || !colliderInfo.rigidBody) return; 
        const visualizer = CollisionUtils.createCollisionVisualizer(colliderInfo.rigidBody, {
          color: color,
          opacity: 0.3,
          wireframe: true
        });
        this.collisionVisualizerGroup.add(visualizer);
      });
    };

    // 可视化护栏
    visualize(this.railColliders, 0xff5500); 
    // 可视化地形
    visualize(this.terrainColliders, 0x00ff55);
    
    this.scene.add(this.collisionVisualizerGroup);
  }
  
  /**
   * 更新碰撞体可视化 (Rapier 版本)
   */
  updateCollisionVisualizers() {
    // Rapier的调试绘制由RapierWorld统一处理，这里不再需要单独更新每个可视化对象
    // 如果需要自定义可视化，则需要在这里添加更新逻辑
    // 目前，切换显示/隐藏即可
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
   * 清除碰撞体 (Rapier 版本)
   * @private
   */
  _clearColliders() {
    console.log("[TrackManager] 清除碰撞体...");
    const removeColliders = (colliders) => {
       if (!colliders || !this.physicsWorld) return;
       colliders.forEach(colliderInfo => {
         if (colliderInfo && colliderInfo.rigidBody) {
           this.physicsWorld.removeRigidBody(colliderInfo.rigidBody);
         }
       });
    };

    removeColliders(this.railColliders);
    this.railColliders = [];
    removeColliders(this.terrainColliders);
    this.terrainColliders = [];

    // 移除碰撞监听器
    if (this.physicsWorld && this.currentCollisionHandler) {
        this.physicsWorld.removeContactListener(this.currentCollisionHandler);
        this.currentCollisionHandler = null;
    }
    
    // 移除可视化
    if (this.collisionVisualizerGroup) {
      this.scene?.remove(this.collisionVisualizerGroup);
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
      this._clearColliders();
    }
  }
  
  // 销毁所有资源
  dispose(scene) {
    console.log("[TrackManager] 销毁 TrackManager");
    this.unloadCurrentTrack(scene);
    this._clearColliders(); // 确保清理碰撞体
    this.tracks.clear();
    this.checkpoints = [];
    this.trackObjects = [];
    
    // 清理碰撞反馈
    CollisionFeedback.dispose();
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
export default new TrackManager(); 