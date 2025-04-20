import * as THREE from 'three';
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';
import { DRACOLoader } from '@/utils/loaders/DRACOLoader';

class TrackManager {
  constructor() {
    this.tracks = new Map(); // 存储所有赛道模型
    this.currentTrack = null; // 当前加载的赛道
    this.checkpoints = []; // 检查点列表
    this.trackObjects = []; // 赛道上的物体
    this.isLoading = false; // 加载状态
    this.defaultTrackPath = '/track/default_track.glb';
  }

  // 加载赛道模型
  async loadTrack(trackId, scene) {
    try {
      this.isLoading = true;
      
      // 1. 检查是否已经加载过该赛道
      if (this.tracks.has(trackId)) {
        // 如果已加载，直接从缓存中获取
        const cachedTrack = this.tracks.get(trackId);
        this._setupTrack(cachedTrack, scene);
        this.currentTrack = cachedTrack;
        this.isLoading = false;
        return cachedTrack;
      }
      
      // 2. 获取赛道模型路径
      const trackPath = this._getTrackPath(trackId);
      
      // 3. 加载赛道模型
      console.log(`[TrackManager] 开始加载赛道: ${trackId}, 路径: ${trackPath}`);
      const dracoLoader = new DRACOLoader().setDecoderPath('/libs/draco/');
      const gltfLoader = new GLTFLoader().setDRACOLoader(dracoLoader);
      
      const gltf = await gltfLoader.loadAsync(trackPath);
      const trackModel = gltf.scene;
      
      // 4. 处理模型（设置阴影、提取检查点等）
      this._processTrackModel(trackModel);
      
      // 5. 将模型添加到场景
      this._setupTrack(trackModel, scene);
      
      // 6. 缓存赛道模型
      this.tracks.set(trackId, trackModel);
      this.currentTrack = trackModel;
      
      console.log(`[TrackManager] 赛道加载完成: ${trackId}`);
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
    return `/track/karting_club_lider__karting_race_track_early.glb`;
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
    
    console.log(`[TrackManager] 检查点数量: ${this.checkpoints.length}`);
  }
  
  // 设置赛道到场景中
  _setupTrack(trackModel, scene) {
    if (this.currentTrack && scene.getObjectById(this.currentTrack.id)) {
      scene.remove(this.currentTrack);
    }
    
    scene.add(trackModel);
  }
  
  // 获取起始位置
  getStartPosition() {
    const defaultStart = new THREE.Vector3(0, 0.3, 0);
    
    if (!this.currentTrack) return defaultStart;
    
    // 查找起始位置标记
    let startMarker = null;
    this.currentTrack.traverse(node => {
      if (node.name.toLowerCase().includes('start')) {
        console.log(`[TrackManager] 找到起点标记: ${node.name}`, node.position);
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
  }
  
  // 销毁所有资源
  dispose(scene) {
    this.unloadCurrentTrack(scene);
    this.tracks.clear();
    this.checkpoints = [];
    this.trackObjects = [];
  }
}

// 创建单例
export const trackManager = new TrackManager(); 