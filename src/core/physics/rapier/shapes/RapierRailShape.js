import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { COLLISION_GROUPS } from './RapierShapeFactory';

/**
 * Rapier护栏形状生成器 - 专门处理赛道护栏的碰撞形状
 */
export class RapierRailShape {
  constructor() {
    // 护栏材质参数
    this.railFriction = 0.1;      // 保持较低摩擦力
    this.railRestitution = 0.1;   // 保持较低反弹力
    
    // 护栏默认尺寸（与原系统保持一致）
    this.defaultHeight = 1.5;  // 高度
    this.defaultWidth = 0.3;   // 宽度
    this.defaultDepth = 0.4;   // 厚度
    
    // 特殊处理的护栏对象名称映射
    this.specialRails = {
      // 这些护栏需要特殊处理的位置偏移
      'Object_488': { x: 90.329, y: 13.03, z: 0.83155 },
      'Object_485': { x: 22.339, y: 43.556, z: 0.83481 },
      'Object_486': { x: -30.068, y: 116.13, z: 0.80514 }
    };
  }

  /**
   * 创建单个护栏的碰撞体
   * 
   * @param {THREE.Mesh} railMesh - 护栏网格对象
   * @param {RAPIER.World} world - Rapier物理世界
   * @param {RAPIER.RigidBodyDesc} bodyDesc - 刚体描述符（如果需要创建新的刚体）
   * @returns {Object} 包含碰撞体和刚体的信息
   */
  createRailCollider(railMesh, world, bodyDesc = null) {
    
    if (!railMesh.isMesh) {
      console.warn(`[RapierRailShape] 护栏对象 ${railMesh.name} 不是网格。无法创建碰撞体。`);
      return null;
    }
    
    // 获取世界变换
    const worldPos = new THREE.Vector3();
    railMesh.getWorldPosition(worldPos);
    
    const worldQuat = new THREE.Quaternion();
    railMesh.getWorldQuaternion(worldQuat);
    
    // 如果没有提供刚体描述符，创建一个新的静态刚体描述符
    if (!bodyDesc) {
      bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldPos.x, worldPos.y, worldPos.z)
        .setRotation({x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w});
    }
    
    // 创建刚体
    const rigidBody = world.createRigidBody(bodyDesc);
    
    // 获取碰撞形状描述符
    const colliderDesc = this._createRailColliderDesc(railMesh);
    if (!colliderDesc) {
      console.error(`[RapierRailShape] 无法为 ${railMesh.name} 创建碰撞体描述符`);
      return null;
    }
    
    // 创建碰撞体
    const collider = world.createCollider(colliderDesc, rigidBody);
    
    // Directly assign userData as a property
    if (collider) {
      collider.userData = { type: 'rail', objectId: railMesh.id, name: railMesh.name };
    } else {
      console.error(`[RapierRailShape] Failed to create collider for ${railMesh.name}`);
    }
    
    return {
      rigidBody,
      collider,
      objectId: railMesh.id,
      name: railMesh.name
    };
  }
  
  /**
   * 为护栏对象创建碰撞体描述符
   * 
   * @param {THREE.Mesh} railMesh - 护栏网格对象
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   * @private
   */
  _createRailColliderDesc(railMesh) {
    const geometry = railMesh.geometry;
    if (!geometry || !geometry.isBufferGeometry) {
      console.warn(`[RapierRailShape] 护栏对象 ${railMesh.name} 没有有效的BufferGeometry`);
      return this._createBoxColliderDescFromObject(railMesh);
    }
    
    // 检查是否是特殊处理的护栏
    const isSpecial = this.specialRails[railMesh.name] !== undefined;
    
    // 如果是特殊护栏，使用凸包；否则默认使用盒体
    return isSpecial 
      ? this._createConvexHullColliderDesc(railMesh, geometry)
      : this._createBoxColliderDescFromObject(railMesh);
  }
  
  /**
   * 从网格几何体创建凸包碰撞体描述符
   * 
   * @param {THREE.Mesh} railMesh - 护栏网格对象
   * @param {THREE.BufferGeometry} geometry - 几何体
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   * @private
   */
  _createConvexHullColliderDesc(railMesh, geometry) {
    try {
      
      const positions = geometry.getAttribute('position').array;
      
      // 获取特殊处理的偏移量
      const offset = this.specialRails[railMesh.name];
      
      // 限制顶点数量以提高性能
      const maxVertices = 100;
      const stride = Math.max(1, Math.floor(positions.length / 3 / maxVertices));
      
      const vertices = [];
      
      // 收集顶点并应用偏移（如果有）
      for (let i = 0; i < positions.length; i += 3 * stride) {
        if (i + 2 < positions.length) {
          if (offset) {
            // 应用偏移补偿
            vertices.push(
              positions[i] - offset.x,
              positions[i + 1] - offset.y,
              positions[i + 2] - offset.z
            );
          } else {
            vertices.push(
              positions[i],
              positions[i + 1],
              positions[i + 2]
            );
          }
        }
      }
      
      if (vertices.length < 12) { // 至少需要4个顶点
        throw new Error("顶点数量不足以创建凸包");
      }
      
      // 创建凸包
      const colliderDesc = RAPIER.ColliderDesc.convexHull(vertices);
      if (!colliderDesc) {
        throw new Error("无法创建凸包碰撞体");
      }
      
      // 设置碰撞属性
      this._configureColliderDesc(colliderDesc);
      
      // 如果有特殊偏移，需要在碰撞体相对于刚体的位置上进行补偿
      if (offset) {
        colliderDesc.setTranslation(offset.x, offset.y, offset.z);
      }
      
      console.log(`[RapierRailShape] 凸包碰撞体创建成功，使用了 ${vertices.length / 3} 个顶点`);
      return colliderDesc;
      
    } catch (error) {
      console.error(`[RapierRailShape] 创建凸包失败，原因: ${error.message}. 回退到盒体碰撞体`);
      return this._createBoxColliderDescFromObject(railMesh);
    }
  }
  
  /**
   * 从物体边界创建盒体碰撞体描述符
   * 
   * @param {THREE.Object3D} railObject - 护栏对象
   * @returns {RAPIER.ColliderDesc} 碰撞体描述符
   * @private
   */
  _createBoxColliderDescFromObject(railObject) {
    
    // 获取边界盒
    const bbox = new THREE.Box3().setFromObject(railObject);
    const size = bbox.getSize(new THREE.Vector3());
    
    // 确保最小尺寸
    const halfWidth = Math.max(size.x * 0.5, this.defaultWidth * 0.5);
    const halfHeight = Math.max(size.y * 0.5, this.defaultHeight * 0.5);
    const halfDepth = Math.max(size.z * 0.5, this.defaultDepth * 0.5);
    
    // 创建盒体描述符
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth);
    
    // 设置碰撞属性
    this._configureColliderDesc(colliderDesc);
    
    return colliderDesc;
  }
  
  /**
   * 通过网格创建护栏碰撞描述符
   * 优先使用 Trimesh
   * 
   * @param {THREE.Mesh} railObject - 护栏网格对象
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   * @private
   */
  _createRailFromMesh(railObject) {
    
    if (!railObject.isMesh) {
      console.warn(`[RapierRailShape] 护栏对象 ${railObject.name} 不是网格。`);
      return null;
    }
    
    const geometry = railObject.geometry;
    if (!geometry || !geometry.isBufferGeometry) {
      console.warn(`[RapierRailShape] 护栏对象 ${railObject.name} 没有有效的BufferGeometry。`);
      return null;
    }
    
    let colliderDesc = null;
    const positions = geometry.getAttribute('position')?.array;
    const indices = geometry.index?.array;

    // ★★★ 优先尝试创建 Trimesh ★★★
    if (positions && indices && indices.length >= 3) {
        try {
            // 验证数据有效性 (可选但推荐)
            // ... (可以添加 NaN/Infinity/out-of-bounds 检查) ...

            colliderDesc = RAPIER.ColliderDesc.trimesh(positions, indices);
            console.log(`[RapierRailShape] 为 ${railObject.name} 创建了 Trimesh 碰撞体。`);
        } catch (error) {
            console.error(`[RapierRailShape] 为 ${railObject.name} 创建 Trimesh 时出错: ${error.message}。 尝试回退...`);
            colliderDesc = null; // 标记创建失败
        }
    } else {
        console.warn(`[RapierRailShape] ${railObject.name} 缺少顶点或索引数据，无法创建 Trimesh。尝试回退...`);
    }

    // ★★★ Trimesh 创建失败，尝试回退到 ConvexHull ★★★
    if (!colliderDesc && positions && positions.length >= 12) { // 凸包至少需要4个顶点
        try {
            // 同样可以简化顶点数据
            const maxVertices = 100;
            const stride = Math.max(1, Math.floor(positions.length / 3 / maxVertices));
            const sampledVertices = [];
            for (let i = 0; i < positions.length; i += 3 * stride) {
                if (i + 2 < positions.length) {
                    sampledVertices.push(positions[i], positions[i + 1], positions[i + 2]);
                }
            }

            if (sampledVertices.length >= 12) {
                colliderDesc = RAPIER.ColliderDesc.convexHull(sampledVertices);
                console.log(`[RapierRailShape] 为 ${railObject.name} 创建了 Convex Hull (回退)。`);
            } else {
                 console.warn(`[RapierRailShape] ${railObject.name} 顶点不足，无法创建 Convex Hull (回退)。`);
            }
        } catch (error) {
            console.error(`[RapierRailShape] 为 ${railObject.name} 创建 Convex Hull (回退) 时出错: ${error.message}。`);
            colliderDesc = null;
        }
    }

    // ★★★ 如果 Trimesh 和 ConvexHull 都失败，最终回退到 Box ★★★
    if (!colliderDesc) {
        const bbox = new THREE.Box3().setFromObject(railObject);
        const size = bbox.getSize(new THREE.Vector3());
        const minSize = 0.1;
        
        colliderDesc = RAPIER.ColliderDesc.cuboid(
            Math.max(size.x * 0.5, minSize),
            Math.max(size.y * 0.5, minSize),
            Math.max(size.z * 0.5, minSize)
        );
        console.warn(`[RapierRailShape] 为 ${railObject.name} 创建了 Box (最终回退)。`);
    }

    if (!colliderDesc) {
      console.error(`[RapierRailShape] 无法为 ${railObject.name} 创建任何碰撞体。`);
      return null;
    }
    
    // 配置通用属性
    this._configureColliderDesc(colliderDesc); 
    
    return colliderDesc;
  }
  
  /**
   * 配置碰撞体描述符的共同属性
   * 
   * @param {RAPIER.ColliderDesc} colliderDesc - 碰撞体描述符
   * @private
   */
  _configureColliderDesc(colliderDesc) {
    // 设置材质参数
    colliderDesc.setFriction(this.railFriction);
    colliderDesc.setRestitution(this.railRestitution);
    
    // 设置碰撞组 - 护栏属于 RAIL 组，只与 VEHICLE 组碰撞
    colliderDesc.setCollisionGroups(
      (COLLISION_GROUPS.RAIL << 16) | COLLISION_GROUPS.VEHICLE 
    );
  }
  
  /**
   * 为场景中所有护栏创建碰撞体
   * 
   * @param {THREE.Scene} scene - Three.js场景
   * @param {RAPIER.World} world - Rapier物理世界
   * @returns {Array<Object>} 创建的碰撞体信息数组
   */
  createAllRailColliders(scene, world) {
    const railColliders = [];
    let foundRailParents = 0;
    let processedRailObjects = 0;
    
    
    // 查找所有护栏父对象
    scene.traverse(parentObject => {
      if (parentObject.name.includes('Rails_')) {
        foundRailParents++;
        
        // 遍历直接子对象
        parentObject.children.forEach(object => {
          if (object.isMesh && object.name.startsWith('Object_')) {
            processedRailObjects++;
            
            // 创建护栏碰撞体
            const railInfo = this.createRailCollider(object, world);
            
            if (railInfo) {
              railColliders.push(railInfo);
            }
          }
        });
      }
    });
    
    console.log(`[RapierRailShape] 搜索完成。找到 ${foundRailParents} 个护栏父对象，处理了 ${processedRailObjects} 个网格，创建了 ${railColliders.length} 个碰撞体。`);
    
    return railColliders;
  }
}

// 导出单例
export default new RapierRailShape(); 