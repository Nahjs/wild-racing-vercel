import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

/**
 * Rapier刚体工厂 - 用于创建各种类型的刚体
 */
export class RapierRigidBodyFactory {
  /**
   * 创建动态刚体
   * 
   * @param {Object} options - 配置选项
   * @param {THREE.Vector3} options.position - 初始位置
   * @param {THREE.Quaternion} options.rotation - 初始旋转
   * @param {number} options.mass - 质量 (默认为1.0)
   * @param {Object} options.linearDamping - 线性阻尼 (默认为0.2)
   * @param {Object} options.angularDamping - 角速度阻尼 (默认为0.2)
   * @param {boolean} options.enableCcd - 是否启用连续碰撞检测 (默认为false)
   * @returns {RAPIER.RigidBodyDesc} 刚体描述符
   */
  static createDynamicBodyDesc(options = {}) {
    // 创建动态刚体描述符
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic();
    
    // 设置位置
    if (options.position) {
      bodyDesc.setTranslation(
        options.position.x,
        options.position.y,
        options.position.z
      );
    }
    
    // 设置旋转
    if (options.rotation) {
      bodyDesc.setRotation({
        x: options.rotation.x,
        y: options.rotation.y,
        z: options.rotation.z,
        w: options.rotation.w
      });
    }
    
    // 设置线性阻尼
    if (options.linearDamping !== undefined) {
      bodyDesc.setLinearDamping(options.linearDamping);
    } else {
      bodyDesc.setLinearDamping(0.2); // 默认线性阻尼
    }
    
    // 设置角速度阻尼
    if (options.angularDamping !== undefined) {
      bodyDesc.setAngularDamping(options.angularDamping);
    } else {
      bodyDesc.setAngularDamping(0.2); // 默认角速度阻尼
    }
    
    // 启用连续碰撞检测（对高速运动的物体很重要）
    if (options.enableCcd) {
      bodyDesc.setCcdEnabled(true);
    }
    
    return bodyDesc;
  }
  
  /**
   * 创建静态刚体
   * 
   * @param {Object} options - 配置选项
   * @param {THREE.Vector3} options.position - 初始位置
   * @param {THREE.Quaternion} options.rotation - 初始旋转
   * @returns {RAPIER.RigidBodyDesc} 刚体描述符
   */
  static createStaticBodyDesc(options = {}) {
    // 创建静态刚体描述符
    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    
    // 设置位置
    if (options.position) {
      bodyDesc.setTranslation(
        options.position.x,
        options.position.y,
        options.position.z
      );
    }
    
    // 设置旋转
    if (options.rotation) {
      bodyDesc.setRotation({
        x: options.rotation.x,
        y: options.rotation.y,
        z: options.rotation.z,
        w: options.rotation.w
      });
    }
    
    return bodyDesc;
  }
  
  /**
   * 创建运动刚体（可以移动但不受物理影响）
   * 
   * @param {Object} options - 配置选项
   * @param {THREE.Vector3} options.position - 初始位置
   * @param {THREE.Quaternion} options.rotation - 初始旋转
   * @returns {RAPIER.RigidBodyDesc} 刚体描述符
   */
  static createKinematicBodyDesc(options = {}) {
    // 创建运动刚体描述符
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    
    // 设置位置
    if (options.position) {
      bodyDesc.setTranslation(
        options.position.x,
        options.position.y,
        options.position.z
      );
    }
    
    // 设置旋转
    if (options.rotation) {
      bodyDesc.setRotation({
        x: options.rotation.x,
        y: options.rotation.y,
        z: options.rotation.z,
        w: options.rotation.w
      });
    }
    
    return bodyDesc;
  }
  
  /**
   * 从Three.js对象创建刚体
   * 
   * @param {THREE.Object3D} object - Three.js对象
   * @param {Object} options - 配置选项
   * @param {string} options.type - 刚体类型 ('dynamic', 'static', 'kinematic')
   * @param {number} options.mass - 质量 (仅对动态刚体有效)
   * @param {boolean} options.enableCcd - 是否启用连续碰撞检测
   * @returns {RAPIER.RigidBodyDesc} 刚体描述符
   */
  static createBodyDescFromObject(object, options = {}) {
    // 获取世界位置和旋转
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    
    const quaternion = new THREE.Quaternion();
    object.getWorldQuaternion(quaternion);
    
    // 合并选项
    const mergedOptions = {
      ...options,
      position,
      rotation: quaternion
    };
    
    // 根据类型创建适当的刚体描述符
    switch (options.type) {
      case 'dynamic':
        return this.createDynamicBodyDesc(mergedOptions);
      case 'kinematic':
        return this.createKinematicBodyDesc(mergedOptions);
      case 'static':
      default:
        return this.createStaticBodyDesc(mergedOptions);
    }
  }
}

/**
 * Rapier碰撞体工厂 - 用于创建各种形状的碰撞体
 */
export class RapierColliderFactory {
  /**
   * 创建盒体碰撞体描述符
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.hx - 半宽 (x方向)
   * @param {number} options.hy - 半高 (y方向)
   * @param {number} options.hz - 半深 (z方向)
   * @param {THREE.Vector3} options.position - 相对于刚体的位置
   * @param {THREE.Quaternion} options.rotation - 相对于刚体的旋转
   * @param {number} options.friction - 摩擦系数
   * @param {number} options.restitution - 弹性系数
   * @param {number} options.collisionGroup - 碰撞组
   * @param {number} options.collisionMask - 碰撞掩码
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createBoxDesc(options = {}) {
    // 创建盒体碰撞体描述符
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      options.hx || 0.5,
      options.hy || 0.5,
      options.hz || 0.5
    );
    
    // 应用通用配置
    this._applyCommonOptions(colliderDesc, options);
    
    return colliderDesc;
  }
  
  /**
   * 创建球体碰撞体描述符
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.radius - 球体半径
   * @param {THREE.Vector3} options.position - 相对于刚体的位置
   * @param {number} options.friction - 摩擦系数
   * @param {number} options.restitution - 弹性系数
   * @param {number} options.collisionGroup - 碰撞组
   * @param {number} options.collisionMask - 碰撞掩码
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createSphereDesc(options = {}) {
    // 创建球体碰撞体描述符
    const colliderDesc = RAPIER.ColliderDesc.ball(options.radius || 0.5);
    
    // 应用通用配置
    this._applyCommonOptions(colliderDesc, options);
    
    return colliderDesc;
  }
  
  /**
   * 创建胶囊体碰撞体描述符
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.halfHeight - 半高 (不包括半球端部)
   * @param {number} options.radius - 半径
   * @param {THREE.Vector3} options.position - 相对于刚体的位置
   * @param {THREE.Quaternion} options.rotation - 相对于刚体的旋转
   * @param {number} options.friction - 摩擦系数
   * @param {number} options.restitution - 弹性系数
   * @param {number} options.collisionGroup - 碰撞组
   * @param {number} options.collisionMask - 碰撞掩码
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createCapsuleDesc(options = {}) {
    // 创建胶囊体碰撞体描述符 (默认y轴向上)
    const colliderDesc = RAPIER.ColliderDesc.capsule(
      options.halfHeight || 0.5,
      options.radius || 0.5
    );
    
    // 应用通用配置
    this._applyCommonOptions(colliderDesc, options);
    
    return colliderDesc;
  }
  
  /**
   * 创建圆柱体碰撞体描述符
   * 
   * @param {Object} options - 配置选项
   * @param {number} options.halfHeight - 半高
   * @param {number} options.radius - 半径
   * @param {THREE.Vector3} options.position - 相对于刚体的位置
   * @param {THREE.Quaternion} options.rotation - 相对于刚体的旋转
   * @param {number} options.friction - 摩擦系数
   * @param {number} options.restitution - 弹性系数
   * @param {number} options.collisionGroup - 碰撞组
   * @param {number} options.collisionMask - 碰撞掩码
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createCylinderDesc(options = {}) {
    // 创建圆柱体碰撞体描述符 (默认y轴向上)
    const colliderDesc = RAPIER.ColliderDesc.cylinder(
      options.halfHeight || 0.5,
      options.radius || 0.5
    );
    
    // 应用通用配置
    this._applyCommonOptions(colliderDesc, options);
    
    return colliderDesc;
  }
  
  /**
   * 创建凸包碰撞体描述符
   * 
   * @param {Object} options - 配置选项
   * @param {Array<number>} options.vertices - 顶点数组 (格式: [x1, y1, z1, x2, y2, z2, ...])
   * @param {THREE.Vector3} options.position - 相对于刚体的位置
   * @param {THREE.Quaternion} options.rotation - 相对于刚体的旋转
   * @param {number} options.friction - 摩擦系数
   * @param {number} options.restitution - 弹性系数
   * @param {number} options.collisionGroup - 碰撞组
   * @param {number} options.collisionMask - 碰撞掩码
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createConvexHullDesc(options = {}) {
    if (!options.vertices || options.vertices.length < 12) { // 至少需要4个顶点
      console.error('创建凸包需要至少4个顶点');
      return null;
    }
    
    // 创建凸包碰撞体描述符
    const colliderDesc = RAPIER.ColliderDesc.convexHull(options.vertices);
    
    if (!colliderDesc) {
      console.error('创建凸包失败，顶点可能不合法');
      return null;
    }
    
    // 应用通用配置
    this._applyCommonOptions(colliderDesc, options);
    
    return colliderDesc;
  }
  
  /**
   * 创建三角网格碰撞体描述符
   * 
   * @param {Object} options - 配置选项
   * @param {Array<number>} options.vertices - 顶点数组 (格式: [x1, y1, z1, x2, y2, z2, ...])
   * @param {Array<number>} options.indices - 索引数组 (格式: [i1, i2, i3, i4, i5, i6, ...])
   * @param {THREE.Vector3} options.position - 相对于刚体的位置
   * @param {THREE.Quaternion} options.rotation - 相对于刚体的旋转
   * @param {number} options.friction - 摩擦系数
   * @param {number} options.restitution - 弹性系数
   * @param {number} options.collisionGroup - 碰撞组
   * @param {number} options.collisionMask - 碰撞掩码
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createTrimeshDesc(options = {}) {
    if (!options.vertices || !options.indices) {
      console.error('创建三角网格需要顶点和索引数据');
      return null;
    }
    
    // 创建三角网格碰撞体描述符
    const colliderDesc = RAPIER.ColliderDesc.trimesh(
      options.vertices,
      options.indices
    );
    
    if (!colliderDesc) {
      console.error('创建三角网格失败，数据可能不合法');
      return null;
    }
    
    // 应用通用配置
    this._applyCommonOptions(colliderDesc, options);
    
    return colliderDesc;
  }
  
  /**
   * 从Three.js几何体创建碰撞体描述符
   * 
   * @param {THREE.BufferGeometry} geometry - Three.js几何体
   * @param {string} type - 碰撞体类型 ('convex', 'trimesh', 'box', 'sphere')
   * @param {Object} options - 其他配置选项
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   */
  static createFromGeometry(geometry, type = 'convex', options = {}) {
    if (!geometry || !geometry.isBufferGeometry) {
      console.error('无效的几何体');
      return null;
    }
    
    // 获取顶点数据
    const positionAttribute = geometry.getAttribute('position');
    if (!positionAttribute) {
      console.error('几何体没有position属性');
      return null;
    }
    
    const vertices = Array.from(positionAttribute.array);
    
    switch (type) {
      case 'convex':
        return this.createConvexHullDesc({
          ...options,
          vertices
        });
        
      case 'trimesh':
        const indices = geometry.index ? Array.from(geometry.index.array) : null;
        if (!indices) {
          console.warn('几何体没有索引，无法创建trimesh，回退到凸包');
          return this.createConvexHullDesc({
            ...options,
            vertices
          });
        }
        
        return this.createTrimeshDesc({
          ...options,
          vertices,
          indices
        });
        
      case 'box':
        // 计算边界盒
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        return this.createBoxDesc({
          ...options,
          hx: size.x * 0.5,
          hy: size.y * 0.5,
          hz: size.z * 0.5,
          position: bbox.getCenter(new THREE.Vector3())
        });
        
      case 'sphere':
        // 计算边界球
        geometry.computeBoundingSphere();
        const bsphere = geometry.boundingSphere;
        
        return this.createSphereDesc({
          ...options,
          radius: bsphere.radius,
          position: bsphere.center
        });
        
      default:
        console.error(`未知的碰撞体类型: ${type}`);
        return null;
    }
  }
  
  /**
   * 应用通用配置选项
   * 
   * @param {RAPIER.ColliderDesc} colliderDesc - 碰撞体描述符
   * @param {Object} options - 配置选项
   * @private
   */
  static _applyCommonOptions(colliderDesc, options = {}) {
    // 设置位置
    if (options.position) {
      colliderDesc.setTranslation(
        options.position.x,
        options.position.y,
        options.position.z
      );
    }
    
    // 设置旋转
    if (options.rotation) {
      colliderDesc.setRotation({
        x: options.rotation.x,
        y: options.rotation.y,
        z: options.rotation.z,
        w: options.rotation.w
      });
    }
    
    // 设置材质属性
    if (options.friction !== undefined) {
      colliderDesc.setFriction(options.friction);
    }
    
    if (options.restitution !== undefined) {
      colliderDesc.setRestitution(options.restitution);
    }
    
    // 设置碰撞过滤
    if (options.collisionGroup !== undefined && options.collisionMask !== undefined) {
      // Directly compute the 32-bit integer for collision groups
      // (membership << 16) | filter
      const collisionValue = (options.collisionGroup << 16) | options.collisionMask;
      colliderDesc.setCollisionGroups(collisionValue);
    }
    
    // 设置密度
    if (options.density !== undefined) {
      colliderDesc.setDensity(options.density);
    }
    
    // 设置传感器标志
    if (options.isSensor === true) {
      colliderDesc.setSensor(true);
    }
  }
}

// 导出类
export default {
  RapierRigidBodyFactory,
  RapierColliderFactory
}; 