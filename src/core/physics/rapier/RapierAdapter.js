import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import RapierWorld from './RapierWorld';
import RapierLoader from './RapierLoader';
import { RapierRigidBodyFactory, RapierColliderFactory } from './RapierRigidBodyFactory';
import RapierShapeFactory from './shapes/RapierShapeFactory';
import RapierRailShape from './shapes/RapierRailShape';
import RapierTerrainShape from './shapes/RapierTerrainShape';

/**
 * Rapier适配器 - 提供从cannon-es迁移到Rapier的兼容层
 * 
 * 此适配器旨在简化从现有的cannon-es代码迁移到Rapier引擎，
 * 提供类似的API以减少代码更改量。
 */
export class RapierAdapter {
  constructor() {
    this.world = RapierWorld;
    this.initialized = false;
  }
  
  /**
   * 初始化Rapier物理引擎
   * @param {Object} options - 初始化选项
   * @returns {Promise} 初始化完成的Promise
   */
  async init(options = {}) {
    if (this.initialized) {
      return this;
    }
    
    try {
      // 使用RapierLoader确保WASM已正确加载
      await RapierLoader.init();
      
      // 初始化Rapier世界
      await this.world.init(options);
      
      this.initialized = true;
      console.log('[RapierAdapter] Rapier适配器初始化完成');
    } catch (error) {
      console.error('[RapierAdapter] Rapier初始化失败:', error);
      throw error;
    }
    
    return this;
  }
  
  /**
   * 从Three.js场景创建所有护栏碰撞体
   * 替代原有的CollisionShapes.createRailsColliders方法
   * 
   * @param {THREE.Scene} scene - Three.js场景
   * @param {Object} options - 配置选项
   * @returns {Array} 创建的护栏碰撞体信息
   */
  createRailsColliders(scene, options = {}) {
    if (!this.initialized) {
      console.error('[RapierAdapter] 适配器未初始化');
      return [];
    }
    
    
    // 使用RapierRailShape创建所有护栏碰撞体
    return this.world.createRailsFromScene(scene);
  }
  
  /**
   * 从Three.js场景创建所有地形碰撞体
   * 
   * @param {THREE.Scene} scene - Three.js场景
   * @param {Object} options - 配置选项
   * @returns {Array} 创建的地形碰撞体信息
   */
  createTerrainColliders(scene, options = {}) {
    if (!this.initialized) {
      console.error('[RapierAdapter] 适配器未初始化');
      return [];
    }
    
    // 使用RapierTerrainShape创建所有地形碰撞体
    return this.world.createTerrainFromScene(scene);
  }
  
  /**
   * 根据Three.js对象创建碰撞体
   * 
   * @param {THREE.Object3D} object - Three.js对象
   * @param {string} colliderType - 碰撞体类型 ('box', 'sphere', 'convex', 'trimesh')
   * @param {Object} bodyOptions - 刚体选项
   * @param {Object} colliderOptions - 碰撞体选项
   * @returns {Object} 包含刚体和碰撞体的对象
   */
  createColliderFromObject(object, colliderType = 'box', bodyOptions = {}, colliderOptions = {}) {
    if (!this.initialized || !object) {
      return null;
    }
    
    // 1. 创建刚体描述符
    const bodyDesc = RapierRigidBodyFactory.createBodyDescFromObject(object, bodyOptions);
    
    // 2. 创建刚体
    const rigidBody = this.world.createRigidBody(bodyDesc);
    
    // 3. 创建碰撞体描述符
    let colliderDesc;
    
    if (object.isMesh && object.geometry) {
      // 如果是网格对象，使用其几何体创建碰撞体
      colliderDesc = RapierColliderFactory.createFromGeometry(
        object.geometry, 
        colliderType, 
        colliderOptions
      );
    } else {
      // 否则创建简单的盒体碰撞体
      const bbox = new THREE.Box3().setFromObject(object);
      const size = bbox.getSize(new THREE.Vector3());
      
      colliderDesc = RapierColliderFactory.createBoxDesc({
        ...colliderOptions,
        hx: size.x * 0.5,
        hy: size.y * 0.5,
        hz: size.z * 0.5
      });
    }
    
    if (!colliderDesc) {
      console.error(`[RapierAdapter] 无法为对象 ${object.name} 创建碰撞体描述符`);
      this.world.removeRigidBody(rigidBody);
      return null;
    }
    
    // 4. 创建碰撞体
    const collider = this.world.createCollider(colliderDesc, rigidBody);
    
    // 5. 设置用户数据
    if (colliderOptions.userData) {
      collider.setUserData(colliderOptions.userData);
    }
    
    return {
      rigidBody,
      collider,
      objectId: object.id,
      name: object.name
    };
  }
  
  /**
   * 从现有的cannon.js Body转换为Rapier的刚体
   * 
   * @param {Object} cannonBody - cannon.js的Body对象
   * @returns {Object} 包含Rapier刚体和碰撞体的对象
   */
  convertFromCannonBody(cannonBody) {
    if (!this.initialized || !cannonBody) {
      return null;
    }
    
    // 1. 确定刚体类型
    let bodyDesc;
    if (cannonBody.type === 1) { // CANNON.Body.DYNAMIC
      bodyDesc = RapierRigidBodyFactory.createDynamicBodyDesc({
        position: new THREE.Vector3(
          cannonBody.position.x,
          cannonBody.position.y,
          cannonBody.position.z
        ),
        rotation: new THREE.Quaternion(
          cannonBody.quaternion.x,
          cannonBody.quaternion.y,
          cannonBody.quaternion.z,
          cannonBody.quaternion.w
        ),
        linearDamping: cannonBody.linearDamping,
        angularDamping: cannonBody.angularDamping
      });
    } else { // 静态刚体
      bodyDesc = RapierRigidBodyFactory.createStaticBodyDesc({
        position: new THREE.Vector3(
          cannonBody.position.x,
          cannonBody.position.y,
          cannonBody.position.z
        ),
        rotation: new THREE.Quaternion(
          cannonBody.quaternion.x,
          cannonBody.quaternion.y,
          cannonBody.quaternion.z,
          cannonBody.quaternion.w
        )
      });
    }
    
    // 2. 创建刚体
    const rigidBody = this.world.createRigidBody(bodyDesc);
    
    // 3. 为每个Shape创建碰撞体
    const colliders = [];
    
    cannonBody.shapes.forEach((shape, index) => {
      // 获取形状的局部位置和旋转
      const localPos = cannonBody.shapeOffsets[index] || { x: 0, y: 0, z: 0 };
      const localRot = cannonBody.shapeOrientations[index] || { x: 0, y: 0, z: 0, w: 1 };
      
      // 创建碰撞体描述符
      let colliderDesc;
      
      // 根据cannon.js的形状类型创建对应的Rapier碰撞体
      if (shape.type === 1) { // CANNON.Shape.SPHERE
        colliderDesc = RapierColliderFactory.createSphereDesc({
          radius: shape.radius,
          position: new THREE.Vector3(localPos.x, localPos.y, localPos.z),
          rotation: new THREE.Quaternion(localRot.x, localRot.y, localRot.z, localRot.w),
          friction: shape.material ? shape.material.friction : 0.3,
          restitution: shape.material ? shape.material.restitution : 0.3
        });
      } else if (shape.type === 4) { // CANNON.Shape.BOX
        colliderDesc = RapierColliderFactory.createBoxDesc({
          hx: shape.halfExtents.x,
          hy: shape.halfExtents.y,
          hz: shape.halfExtents.z,
          position: new THREE.Vector3(localPos.x, localPos.y, localPos.z),
          rotation: new THREE.Quaternion(localRot.x, localRot.y, localRot.z, localRot.w),
          friction: shape.material ? shape.material.friction : 0.3,
          restitution: shape.material ? shape.material.restitution : 0.3
        });
      } else if (shape.type === 5) { // CANNON.Shape.CONVEXPOLYHEDRON
        const vertices = [];
        shape.vertices.forEach(v => {
          vertices.push(v.x, v.y, v.z);
        });
        
        colliderDesc = RapierColliderFactory.createConvexHullDesc({
          vertices,
          position: new THREE.Vector3(localPos.x, localPos.y, localPos.z),
          rotation: new THREE.Quaternion(localRot.x, localRot.y, localRot.z, localRot.w),
          friction: shape.material ? shape.material.friction : 0.3,
          restitution: shape.material ? shape.material.restitution : 0.3
        });
      } else {
        console.warn(`[RapierAdapter] 不支持的形状类型: ${shape.type}`);
        return;
      }
      
      if (colliderDesc) {
        // 设置碰撞分组
        if (cannonBody.collisionFilterGroup !== undefined && cannonBody.collisionFilterMask !== undefined) {
          colliderDesc.setCollisionGroups(
            RAPIER.InteractionGroups.groupsWith(
              cannonBody.collisionFilterGroup,
              cannonBody.collisionFilterMask
            )
          );
        }
        
        // 创建碰撞体
        const collider = this.world.createCollider(colliderDesc, rigidBody);
        
        // 复制用户数据
        if (cannonBody.userData) {
          collider.setUserData(cannonBody.userData);
        }
        
        colliders.push(collider);
      }
    });
    
    return {
      rigidBody,
      colliders,
      originalBody: cannonBody
    };
  }
  
  /**
   * 在物理世界中进行射线检测
   * 
   * @param {THREE.Vector3} from - 射线起点
   * @param {THREE.Vector3} to - 射线终点
   * @param {Object} options - 选项
   * @returns {Object|null} 射线检测结果
   */
  raycastClosest(from, to, options = {}) {
    if (!this.initialized) {
      return null;
    }
    
    // 计算方向和长度
    const direction = new THREE.Vector3().subVectors(to, from).normalize();
    const distance = from.distanceTo(to);
    
    // 执行射线检测
    const result = this.world.castRay(from, direction, distance, options.skipBackfaces !== false);
    
    return result;
  }
  
  /**
   * 更新物理世界
   * 
   * @param {number} deltaTime - 时间步长（秒）
   */
  update(deltaTime) {
    if (!this.initialized) {
      return;
    }
    
    this.world.update(deltaTime);
  }
  
  /**
   * 注册碰撞事件回调
   * 
   * @param {Object} callbacks - 包含onContactStart和onContactEnd的回调对象
   */
  registerContactCallbacks(callbacks) {
    if (!this.initialized) {
      return;
    }
    
    this.world.addContactListener(callbacks);
  }
  
  /**
   * 启用或禁用调试绘制
   * 
   * @param {boolean} enabled - 是否启用调试绘制
   * @param {THREE.Scene} scene - Three.js场景
   */
  toggleDebugDraw(enabled, scene) {
    if (!this.initialized) {
      return;
    }
    
    if (scene) {
      this.world.setDebugScene(scene);
    }
    
    this.world.toggleDebugDraw(enabled);
  }
  
  /**
   * 清理物理世界资源
   */
  dispose() {
    if (!this.initialized) {
      return;
    }
    
    this.world.dispose();
    this.initialized = false;
  }
}

// 导出单例
export default new RapierAdapter(); 