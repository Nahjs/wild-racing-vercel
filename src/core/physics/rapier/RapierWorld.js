import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import RapierLoader from './RapierLoader';
import RapierShapeFactory from './shapes/RapierShapeFactory';
import RapierRailShape from './shapes/RapierRailShape';
import RapierTerrainShape from './shapes/RapierTerrainShape';

/**
 * Rapier物理世界管理类 - 负责物理世界的初始化、更新和管理
 */
export class RapierWorld {
  constructor(options = {}) {
    // 默认选项
    this.options = Object.assign({
      gravity: { x: 0, y: -9.81, z: 0 },
      timeStep: 1/60,
      debugDraw: false
    }, options);
    
    // 物理世界是否已初始化
    this.isInitialized = false;
    
    // 物理世界
    this.world = null;
    
    // 事件回调
    this.contactListeners = [];
    
    // 存储创建的碰撞体，用于清理
    this.colliders = {
      rails: [],
      terrain: [],
      vehicles: [],
      checkpoints: [],
      others: []
    };
    
    // DebugDraw相关
    this.debugDrawer = null;
    this.debugMesh = null;
    this.debugScene = null;
  }
  
  /**
   * 初始化Rapier物理引擎
   * @returns {Promise<RapierWorld>} 初始化完成的Promise
   */
  async init() {
    if (this.isInitialized) {
      console.warn('[RapierWorld] 物理世界已经初始化');
      return this;
    }
    
    
    try {
      // 使用RapierLoader确保WASM已加载
      await RapierLoader.init();
      
      // 创建物理世界
      try {
        // 在Rapier 0.16.0中，World构造函数的参数格式发生了变化
        if (typeof RAPIER.World === 'function') {
          // 检查版本
          const versionStr = RapierLoader.getVersion();
          let isVersion016 = versionStr && versionStr.startsWith('0.16');
          
          if (isVersion016) {
            try {
              // 创建重力向量对象 (使用对象字面量而不是Vector3)
              const gravityVec = { x: this.options.gravity.x, y: this.options.gravity.y, z: this.options.gravity.z };
              console.log('[RapierWorld] 重力向量:', gravityVec);
              
              // 直接使用重力向量创建World，不再需要手动创建IntegrationParameters
              // API文档: new World(gravity: Vector, rawIntegrationParameters?: RawIntegrationParameters, ...)
              this.world = new RAPIER.World(gravityVec);
              
              console.log('[RapierWorld] World创建成功:', this.world);
              
              // 设置参数 (通过世界实例而不是构造函数)
              if (this.world) {
                console.log('[RapierWorld] 设置集成参数');
                this.world.timestep = this.options.timeStep;
                this.world.numSolverIterations = this.options.solverIterations || 4;
                this.world.numVelocityIterations = this.options.velocityIterations || 1;
                this.world.numPositionIterations = this.options.positionIterations || 1;
                
                // 如果可能，调整其他参数
                if (typeof this.world.setERP === 'function') {
                  this.world.setERP(0.2);
                }
              }
            } catch (e) {
              console.error('[RapierWorld] 使用0.16.0 API创建World失败:', e);
              
              // 尝试替代方法 - 检查是否有工厂方法
              if (typeof RAPIER.createWorld === 'function') {
                const gravityVec = { x: this.options.gravity.x, y: this.options.gravity.y, z: this.options.gravity.z };
                this.world = RAPIER.createWorld(gravityVec);
              } else {
                throw new Error('无法创建物理世界，没有可用的创建方法');
              }
            }
          } else {
            // 旧版本创建物理世界的方式
            const gravity = new RAPIER.Vector3(
              this.options.gravity.x,
              this.options.gravity.y,
              this.options.gravity.z
            );
            this.world = new RAPIER.World(gravity);
          }
        } else {
          throw new Error('RAPIER.World 不是一个函数，可能库没有正确加载');
        }
        
        // 检查世界是否成功创建
        if (!this.world) {
          throw new Error('物理世界创建失败');
        }
        
        console.log('[RapierWorld] Rapier物理世界创建成功');
        this.isInitialized = true;
      } catch (error) {
        console.error('[RapierWorld] 物理世界创建失败:', error);
        throw error;
      }
      
      // 设置默认的事件队列和接触对配置
      this.eventQueue = new RAPIER.EventQueue(true);
      
      // 检查必要的对象/集合是否可用（用于车辆控制器构造）
      // @ts-ignore
      this.bodies = this.world.bodies;
      // @ts-ignore
      this.colliders = this.world.colliders;
      // @ts-ignore
      this.queryPipeline = this.world.queryPipeline;
      // @ts-ignore
      this.vehicleControllers = this.world.vehicleControllers;
      
      // 初始化调试绘制（如果启用）
      if (this.options.debugDraw) {
        this._initDebugDraw();
      }
      
      return this;
    } catch (error) {
      console.error('[RapierWorld] Rapier初始化失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新物理世界
   * @param {number} deltaTime - 时间步长（秒）
   */
  update(deltaTime) {
    if (!this.isInitialized || !this.world) {
      return;
    }
    
    // 使用固定时间步长更新物理
    const timeStep = this.options.timeStep;
    
    // 步进物理世界
    this.world.step(this.eventQueue);
    
    // 处理接触事件
    this._processContactEvents();
    
    // 更新调试绘制（如果启用）
    if (this.options.debugDraw && this.debugDrawer) {
      this._updateDebugDraw();
    }
  }
  
  /**
   * 处理接触事件
   * @private
   */
  _processContactEvents() {
    // 处理事件队列中的所有事件
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      const collider1 = this.world.getCollider(handle1);
      const collider2 = this.world.getCollider(handle2);
      
      // 遍历所有注册的接触监听器
      for (const listener of this.contactListeners) {
        if (started) {
          if (listener.onContactStart) {
            listener.onContactStart(collider1, collider2);
          }
        } else {
          if (listener.onContactEnd) {
            listener.onContactEnd(collider1, collider2);
          }
        }
      }
    });
  }
  
  /**
   * 添加接触事件监听器
   * @param {Object} listener - 包含onContactStart和onContactEnd方法的对象
   */
  addContactListener(listener) {
    if (!listener) return;
    
    if (typeof listener.onContactStart !== 'function' && 
        typeof listener.onContactEnd !== 'function') {
      console.warn('[RapierWorld] 接触监听器必须至少包含onContactStart或onContactEnd方法');
      return;
    }
    
    this.contactListeners.push(listener);
  }
  
  /**
   * 移除接触事件监听器
   * @param {Object} listener - 要移除的监听器
   */
  removeContactListener(listener) {
    const index = this.contactListeners.indexOf(listener);
    if (index !== -1) {
      this.contactListeners.splice(index, 1);
    }
  }
  
  /**
   * 从Three.js场景创建所有护栏碰撞体
   * @param {THREE.Scene} scene - Three.js场景
   * @returns {Array} 创建的护栏碰撞体信息
   */
  createRailsFromScene(scene) {
    if (!this.isInitialized || !this.world) {
      console.error('[RapierWorld] 物理世界未初始化');
      return [];
    }
    
    
    // 使用RapierRailShape创建所有护栏碰撞体
    const railColliders = RapierRailShape.createAllRailColliders(scene, this.world);
    
    // 存储创建的护栏碰撞体
    this.colliders.rails = railColliders;
    
    console.log(`[RapierWorld] 成功创建 ${railColliders.length} 个护栏碰撞体`);
    
    return railColliders;
  }
  
  /**
   * 从Three.js场景创建所有地形碰撞体
   * @param {THREE.Scene} scene - Three.js场景
   * @returns {Array} 创建的地形碰撞体信息
   */
  createTerrainFromScene(scene) {
    if (!this.isInitialized || !this.world) {
      console.error('[RapierWorld] 物理世界未初始化');
      return [];
    }
    
    
    // 使用RapierTerrainShape创建所有地形碰撞体
    const terrainColliders = RapierTerrainShape.createAllTerrainColliders(scene, this.world);
    
    // 存储创建的地形碰撞体
    this.colliders.terrain = terrainColliders;
    
    console.log(`[RapierWorld] 成功创建 ${terrainColliders.length} 个地形碰撞体`);
    
    return terrainColliders;
  }
  
  /**
   * 向物理世界添加刚体
   * @param {RAPIER.RigidBodyDesc} rigidBodyDesc - 刚体描述符
   * @returns {RAPIER.RigidBody} 创建的刚体
   */
  createRigidBody(rigidBodyDesc) {
    if (!this.isInitialized || !this.world) {
      console.error('[RapierWorld] 物理世界未初始化');
      return null;
    }
    
    return this.world.createRigidBody(rigidBodyDesc);
  }
  
  /**
   * 向刚体添加碰撞体
   * @param {RAPIER.ColliderDesc} colliderDesc - 碰撞体描述符
   * @param {RAPIER.RigidBody} rigidBody - 刚体
   * @returns {RAPIER.Collider} 创建的碰撞体
   */
  createCollider(colliderDesc, rigidBody) {
    if (!this.isInitialized || !this.world) {
      console.error('[RapierWorld] 物理世界未初始化');
      return null;
    }
    
    return this.world.createCollider(colliderDesc, rigidBody);
  }
  
  /**
   * 从物理世界移除刚体
   * @param {RAPIER.RigidBody} rigidBody - 要移除的刚体
   */
  removeRigidBody(rigidBody) {
    if (!this.isInitialized || !this.world || !rigidBody) {
      return;
    }
    
    this.world.removeRigidBody(rigidBody);
  }
  
  /**
   * 执行射线检测
   * @param {THREE.Vector3} origin - 射线起点
   * @param {THREE.Vector3} direction - 射线方向
   * @param {number} maxToi - 最大检测距离
   * @param {boolean} solid - 是否只检测实心碰撞体
   * @returns {Object|null} 射线检测结果
   */
  castRay(origin, direction, maxToi = 100, solid = true) {
    if (!this.isInitialized || !this.world) {
      console.error('[RapierWorld] 物理世界未初始化');
      return null;
    }
    
    const rayOrigin = new RAPIER.Vector3(origin.x, origin.y, origin.z);
    const rayDir = new RAPIER.Vector3(direction.x, direction.y, direction.z);
    
    // 创建射线
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    
    // 执行射线检测
    const hit = this.world.castRay(ray, maxToi, solid);
    
    if (hit) {
      // 获取碰撞点
      const hitPoint = ray.pointAt(hit.toi);
      const collider = this.world.getCollider(hit.colliderHandle);
      
      return {
        collider,
        toi: hit.toi,
        point: new THREE.Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
        normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z)
      };
    }
    
    return null;
  }
  
  /**
   * 初始化调试绘制
   * @private
   */
  _initDebugDraw() {
    if (!this.debugScene) {
      console.warn('[RapierWorld] 未设置调试场景，无法初始化调试绘制');
      return;
    }
    
    // 创建调试绘制器
    this.debugDrawer = new RapierDebugDrawer(this.world);
    
    // 创建调试网格并添加到场景
    const debugMesh = this.debugDrawer.createDebugMesh();
    this.debugScene.add(debugMesh);
    this.debugMesh = debugMesh;
    
    console.log('[RapierWorld] 调试绘制初始化完成');
  }
  
  /**
   * 设置调试场景
   * @param {THREE.Scene} scene - Three.js场景
   */
  setDebugScene(scene) {
    this.debugScene = scene;
    
    if (this.options.debugDraw && !this.debugDrawer) {
      this._initDebugDraw();
    }
  }
  
  /**
   * 更新调试绘制
   * @private
   */
  _updateDebugDraw() {
    if (!this.debugDrawer || !this.debugMesh) {
      return;
    }
    
    this.debugDrawer.update();
  }
  
  /**
   * 切换调试绘制
   * @param {boolean} enabled - 是否启用调试绘制
   */
  toggleDebugDraw(enabled) {
    this.options.debugDraw = enabled;
    
    if (enabled && !this.debugDrawer && this.debugScene) {
      this._initDebugDraw();
    }
    
    if (this.debugMesh) {
      this.debugMesh.visible = enabled;
    }
  }
  
  /**
   * 清理物理世界
   */
  dispose() {
    if (!this.isInitialized) {
      return;
    }
    
    console.log('[RapierWorld] 清理物理世界资源...');
    
    // 清空事件队列
    this.eventQueue.clear();
    
    // 清空接触监听器
    this.contactListeners = [];
    
    // 清理车辆控制器
    if (this.vehicleControllers && this.vehicleControllers.size > 0) {
      console.log(`[RapierWorld] 清理 ${this.vehicleControllers.size} 个车辆控制器`);
      // 在Rapier 0.16.0中，车辆控制器会随世界一起被清理
    }
    
    // 清空碰撞体集合
    this.colliders = {
      rails: [],
      terrain: [],
      vehicles: [],
      checkpoints: [],
      others: []
    };
    
    // 移除调试网格
    if (this.debugMesh && this.debugScene) {
      this.debugScene.remove(this.debugMesh);
      this.debugMesh.geometry.dispose();
      this.debugMesh = null;
    }
    
    // 清理调试绘制器
    if (this.debugDrawer) {
      this.debugDrawer.dispose();
      this.debugDrawer = null;
    }
    
    // 销毁物理世界
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    
    this.isInitialized = false;
    console.log('[RapierWorld] 物理世界已清理');
  }
}

/**
 * Rapier调试绘制器 - 用于可视化物理世界
 * 这是一个简单的调试工具，用于开发和调试
 */
class RapierDebugDrawer {
  constructor(world) {
    this.world = world;
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      vertexColors: true
    });
    
    // 初始化调试数据
    this.vertices = [];
    this.colors = [];
    this.indices = [];
  }
  
  /**
   * 创建调试网格
   * @returns {THREE.LineSegments} 调试网格
   */
  createDebugMesh() {
    this.update();
    const mesh = new THREE.LineSegments(this.geometry, this.material);
    mesh.name = 'rapier-debug';
    mesh.frustumCulled = false; // 防止被视锥体剔除
    return mesh;
  }
  
  /**
   * 更新调试绘制
   */
  update() {
    // 清空数据
    this.vertices = [];
    this.colors = [];
    this.indices = [];
    
    // 绘制所有刚体
    const buffers = this.world.debugRender();
    
    if (!buffers) {
      return;
    }
    
    // Rapier的debugRender返回顶点和颜色数据
    const { vertices, colors } = buffers;
    
    // 创建顶点索引
    const indices = [];
    for (let i = 0; i < vertices.length / 3; i++) {
      indices.push(i);
    }
    
    // 更新几何体
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    this.geometry.setIndex(indices);
    
    // 通知Three.js几何体已更新
    this.geometry.computeBoundingSphere();
  }
  
  /**
   * 清理资源
   */
  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    
    if (this.material) {
      this.material.dispose();
    }
  }
}

// 导出单例
export default new RapierWorld(); 