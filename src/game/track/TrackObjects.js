import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from '@/utils/loaders/GLTFLoader';

// 赛道物体类型
const OBJECT_TYPES = {
  DECORATION: 'decoration', // 装饰物，无物理
  OBSTACLE: 'obstacle',     // 障碍物，有物理
  POWERUP: 'powerup',       // 道具，有触发效果
  TRIGGER: 'trigger'        // 触发器，无物理但有事件
};

// 物体预设
const OBJECT_PRESETS = {
  CONE: {
    type: OBJECT_TYPES.OBSTACLE,
    model: '/models/objects/cone.glb',
    scale: 1,
    mass: 5,
    physicsShape: 'cylinder',
    physicsParams: { radius: 0.3, height: 0.7 }
  },
  BARRIER: {
    type: OBJECT_TYPES.OBSTACLE,
    model: '/models/objects/barrier.glb',
    scale: 1,
    mass: 15,
    physicsShape: 'box',
    physicsParams: { width: 1.2, height: 0.5, depth: 0.3 }
  },
  TREE: {
    type: OBJECT_TYPES.DECORATION,
    model: '/models/objects/tree.glb',
    scale: 1
  },
  RAMP: {
    type: OBJECT_TYPES.OBSTACLE,
    model: '/models/objects/ramp.glb',
    scale: 1,
    mass: 0, // 静态物体
    physicsShape: 'trimesh',
    physicsParams: { }
  },
  BOOST: {
    type: OBJECT_TYPES.POWERUP,
    model: '/models/objects/boost.glb',
    scale: 1,
    effect: 'boost',
    duration: 3000
  }
};

class TrackObjects {
  constructor() {
    this.objects = [];
    this.scene = null;
    this.physicsWorld = null;
    this.modelCache = new Map();
  }
  
  // 初始化
  initialize(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.objects = [];
    
    return this;
  }
  
  // 添加物体
  async addObject(objectType, position, rotation = { x: 0, y: 0, z: 0 }, options = {}) {
    try {
      if (!this.scene) {
        console.error('[TrackObjects] 未初始化场景');
        return null;
      }
      
      const preset = OBJECT_PRESETS[objectType] || {};
      const type = options.type || preset.type || OBJECT_TYPES.DECORATION;
      
      // 加载模型
      const model = await this._loadModel(options.model || preset.model);
      if (!model) {
        console.error(`[TrackObjects] 无法加载模型: ${options.model || preset.model}`);
        return null;
      }
      
      // 设置位置和旋转
      model.position.set(position.x, position.y, position.z);
      
      // 处理旋转，可以是欧拉角或四元数
      if (rotation.isQuaternion) {
        model.quaternion.copy(rotation);
      } else {
        model.rotation.set(
          rotation.x || 0,
          rotation.y || 0,
          rotation.z || 0
        );
      }
      
      // 设置缩放
      const scale = options.scale || preset.scale || 1;
      model.scale.set(scale, scale, scale);
      
      // 设置阴影
      model.traverse(node => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      
      // 添加到场景
      this.scene.add(model);
      
      // 创建物理体（如果需要）
      let body = null;
      
      if (type === OBJECT_TYPES.OBSTACLE && this.physicsWorld) {
        body = this._createPhysicsBody(
          preset,
          model.position,
          model.quaternion,
          options
        );
        
        if (body) {
          this.physicsWorld.addBody(body);
        }
      }
      
      // 创建对象记录
      const object = {
        id: this._generateId(),
        type,
        model,
        body,
        position: model.position.clone(),
        rotation: model.quaternion.clone(),
        options: { ...options },
        preset: objectType
      };
      
      this.objects.push(object);
      
      return object;
    } catch (error) {
      console.error(`[TrackObjects] 添加物体失败: ${error.message}`);
      return null;
    }
  }
  
  // 批量添加物体
  async addObjects(objectsData) {
    const promises = objectsData.map(data => {
      return this.addObject(
        data.type,
        data.position,
        data.rotation,
        data.options
      );
    });
    
    return Promise.all(promises);
  }
  
  // 移除物体
  removeObject(objectId) {
    const index = this.objects.findIndex(obj => obj.id === objectId);
    
    if (index !== -1) {
      const object = this.objects[index];
      
      // 从场景中移除
      if (object.model && this.scene) {
        this.scene.remove(object.model);
      }
      
      // 从物理世界中移除
      if (object.body && this.physicsWorld) {
        this.physicsWorld.removeBody(object.body);
      }
      
      // 从数组中移除
      this.objects.splice(index, 1);
      
      return true;
    }
    
    return false;
  }
  
  // 清除所有物体
  clearObjects() {
    this.objects.forEach(object => {
      // 从场景中移除
      if (object.model && this.scene) {
        this.scene.remove(object.model);
      }
      
      // 从物理世界中移除
      if (object.body && this.physicsWorld) {
        this.physicsWorld.removeBody(object.body);
      }
    });
    
    this.objects = [];
  }
  
  // 更新物体物理位置
  updatePhysics() {
    this.objects.forEach(object => {
      if (object.model && object.body) {
        // 更新模型位置
        object.model.position.copy(object.body.position);
        object.model.quaternion.copy(object.body.quaternion);
      }
    });
  }
  
  // 检查与道具的碰撞
  checkPowerupCollisions(position, radius) {
    const collisions = [];
    
    this.objects.forEach(object => {
      if (object.type === OBJECT_TYPES.POWERUP) {
        const distance = object.model.position.distanceTo(new THREE.Vector3(
          position.x,
          position.y,
          position.z
        ));
        
        // 如果距离小于半径之和，则发生碰撞
        if (distance < (radius + 1)) {
          collisions.push(object);
        }
      }
    });
    
    return collisions;
  }
  
  // 消费道具
  consumePowerup(objectId) {
    const object = this.objects.find(obj => obj.id === objectId);
    
    if (object && object.type === OBJECT_TYPES.POWERUP) {
      // 隐藏模型
      if (object.model) {
        object.model.visible = false;
      }
      
      // 延时恢复
      setTimeout(() => {
        if (object.model) {
          object.model.visible = true;
        }
      }, 10000);
      
      // 返回道具效果
      return {
        effect: object.options.effect || object.preset?.effect,
        duration: object.options.duration || object.preset?.duration
      };
    }
    
    return null;
  }
  
  // 加载模型
  async _loadModel(modelPath) {
    if (!modelPath) {
      console.warn('[TrackObjects] 未提供模型路径');
      return null;
    }
    
    // 检查缓存
    if (this.modelCache.has(modelPath)) {
      // 返回克隆的模型
      const cachedModel = this.modelCache.get(modelPath);
      return cachedModel.clone();
    }
    
    // 加载模型
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelPath);
      
      // 缓存模型
      this.modelCache.set(modelPath, gltf.scene.clone());
      
      return gltf.scene;
    } catch (error) {
      console.error(`[TrackObjects] 加载模型失败: ${modelPath}`, error);
      return null;
    }
  }
  
  // 创建物理体
  _createPhysicsBody(preset, position, quaternion, options) {
    if (!this.physicsWorld) return null;
    
    const physicsShape = options.physicsShape || preset.physicsShape;
    const physicsParams = { ...preset.physicsParams, ...options.physicsParams };
    const mass = options.mass !== undefined ? options.mass : preset.mass;
    
    let shape;
    
    switch (physicsShape) {
      case 'box':
        shape = new CANNON.Box(new CANNON.Vec3(
          physicsParams.width / 2 || 0.5,
          physicsParams.height / 2 || 0.5,
          physicsParams.depth / 2 || 0.5
        ));
        break;
      
      case 'sphere':
        shape = new CANNON.Sphere(physicsParams.radius || 0.5);
        break;
      
      case 'cylinder':
        shape = new CANNON.Cylinder(
          physicsParams.radiusTop || physicsParams.radius || 0.5,
          physicsParams.radiusBottom || physicsParams.radius || 0.5,
          physicsParams.height || 1,
          physicsParams.segments || 8
        );
        break;
      
      default:
        console.warn(`[TrackObjects] 不支持的物理形状: ${physicsShape}`);
        return null;
    }
    
    const body = new CANNON.Body({
      mass: mass || 0,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      quaternion: new CANNON.Quaternion(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      ),
      shape: shape
    });
    
    return body;
  }
  
  // 生成唯一ID
  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  // 销毁
  dispose() {
    this.clearObjects();
    this.modelCache.clear();
    this.scene = null;
    this.physicsWorld = null;
  }
}

// 创建单例
export const trackObjects = new TrackObjects(); 