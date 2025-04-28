import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

// 定义碰撞组 (与原系统保持一致)
export const COLLISION_GROUPS = {
  GROUND: 1,
  VEHICLE: 2,
  RAIL: 4,
  CHECKPOINT: 8,
  ALL: 0xFFFF
};

/**
 * Rapier物理引擎的形状工厂 - 负责为游戏对象创建和管理适当的碰撞形状
 */
class RapierShapeFactory {
  constructor() {
    // 材质参数（在Rapier中通过ColliderDesc设置）
    this.defaultFriction = 0.5;
    this.defaultRestitution = 0.2;
    
    // 护栏材质参数
    this.railFriction = 0.1;
    this.railRestitution = 0.1;
  }

  /**
   * 从Three.js网格创建盒体碰撞形状
   * 
   * @param {THREE.Object3D} object - Three.js对象
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   */
  createBoxColliderDesc(object) {
    // 获取物体的边界盒
    const bbox = new THREE.Box3().setFromObject(object);
    const size = bbox.getSize(new THREE.Vector3());
    
    // 确保尺寸不为零
    const halfWidth = Math.max(size.x * 0.5, 0.1);
    const halfHeight = Math.max(size.y * 0.5, 0.1);
    const halfDepth = Math.max(size.z * 0.5, 0.1);
    
    // 创建碰撞体描述符
    const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth);
    
    // 设置默认材质参数
    colliderDesc.setFriction(this.defaultFriction);
    colliderDesc.setRestitution(this.defaultRestitution);
    
    return colliderDesc;
  }

  /**
   * 为护栏对象创建碰撞描述符
   * 
   * @param {THREE.Object3D} railObject - Three.js中的护栏对象
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   */
  createRailColliderDesc(railObject) {
    
    // 如果是轨道类型，通过路径点创建碰撞体
    if (railObject.name.includes('Rails_')) {
      return this._createRailFromPath(railObject);
    }
    
    // 否则，通过网格创建碰撞体
    return this._createRailFromMesh(railObject);
  }
  
  /**
   * 通过路径点创建护栏碰撞描述符
   * 适用于沿曲线排列的护栏
   * 
   * @param {THREE.Object3D} railObject - 护栏对象
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   * @private
   */
  _createRailFromPath(railObject) {
    
    const railMeshes = [];
    railObject.traverse(child => {
      if (child.isMesh) {
        railMeshes.push(child);
      }
    });
    
    if (railMeshes.length === 0) {
      console.warn('护栏对象没有网格:', railObject.name);
      return null;
    }
    
    // 护栏高度和宽度（与原系统保持一致）
    const railHeight = 1.5;
    const railWidth = 0.3;
    const railDepth = 0.4;
    
    // 使用第一个网格来创建碰撞体
    const mesh = railMeshes[0];
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = bbox.getSize(new THREE.Vector3());
    
    // 创建盒体描述符
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      Math.max(size.x * 0.5, railWidth * 0.5),
      railHeight * 0.5,
      Math.max(size.z * 0.5, railDepth * 0.5)
    );
    
    // 设置材质参数
    colliderDesc.setFriction(this.railFriction);
    colliderDesc.setRestitution(this.railRestitution);
    
    return colliderDesc;
  }
  
  /**
   * 通过网格创建护栏碰撞描述符
   * Rapier版本使用凸包替代原来的Trimesh
   * 
   * @param {THREE.Mesh} railObject - 护栏网格对象
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   * @private
   */
  _createRailFromMesh(railObject) {
    
    if (!railObject.isMesh) {
      console.warn(`[RapierShapeFactory] 护栏对象 ${railObject.name} 不是网格。无法创建凸包。`);
      return null;
    }
    
    const geometry = railObject.geometry;
    if (!geometry || !geometry.isBufferGeometry) {
      console.warn(`[RapierShapeFactory] 护栏对象 ${railObject.name} 没有有效的BufferGeometry。无法创建凸包。`);
      return null;
    }
    
    let colliderDesc = null;
    
    try {
      // 尝试创建凸包碰撞体
      const positions = geometry.getAttribute('position').array;
      
      // Rapier需要顶点数组作为输入（每三个数字代表一个顶点）
      // 我们需要简化数据以提高性能，采样点数不超过100个
      const maxVertices = 100;
      const stride = Math.max(1, Math.floor(positions.length / 3 / maxVertices));
      
      const vertices = [];
      for (let i = 0; i < positions.length; i += 3 * stride) {
        if (i + 2 < positions.length) {
          vertices.push(
            positions[i],
            positions[i + 1],
            positions[i + 2]
          );
        }
      }
      
      if (vertices.length >= 12) { // 至少需要4个顶点才能创建凸包
        // 使用Rapier的凸包创建方法
        colliderDesc = RAPIER.ColliderDesc.convexHull(vertices);
        console.log(`[RapierShapeFactory] 为 ${railObject.name} 创建了凸包碰撞体，使用了 ${vertices.length / 3} 个顶点。`);
      } else {
        throw new Error("顶点数量不足");
      }
    } catch (error) {
      console.error(`[RapierShapeFactory] 为 ${railObject.name} 创建凸包时出错:`, error);
      
      // 创建失败时回退到盒体
      const bbox = new THREE.Box3().setFromObject(railObject);
      const size = bbox.getSize(new THREE.Vector3());
      const minSize = 0.1;
      
      colliderDesc = RAPIER.ColliderDesc.cuboid(
        Math.max(size.x * 0.5, minSize),
        Math.max(size.y * 0.5, minSize),
        Math.max(size.z * 0.5, minSize)
      );
      
      console.warn(`[RapierShapeFactory] 由于凸包创建失败，为 ${railObject.name} 创建了盒体碰撞体作为备选。`);
    }
    
    if (!colliderDesc) {
      console.error(`[RapierShapeFactory] 无法为 ${railObject.name} 创建任何碰撞体。`);
      return null;
    }
    
    // 设置材质参数
    colliderDesc.setFriction(this.railFriction);
    colliderDesc.setRestitution(this.railRestitution);
    
    // ★★★ 设置正确的护栏碰撞组 ★★★
    // 护栏属于 RAIL 组，只与 VEHICLE 组碰撞
    colliderDesc.setCollisionGroups(
      (COLLISION_GROUPS.RAIL << 16) | COLLISION_GROUPS.VEHICLE 
    );
    
    return colliderDesc;
  }
  
  /**
   * 为场景中的护栏对象创建碰撞描述符数组
   * 
   * @param {THREE.Object3D} scene - Three.js场景
   * @returns {Array<Object>} 碰撞描述符和位置信息的数组
   */
  createRailsCollidersDesc(scene) {
    const railCollidersInfo = [];
    let foundRailParents = 0;
    let processedRailObjects = 0;
    
    
    // 查找所有潜在的护栏父对象 (Rails_...)
    scene.traverse(parentObject => {
      if (parentObject.name.includes('Rails_')) {
        foundRailParents++;
        
        // 遍历父对象下的直接子对象
        parentObject.children.forEach(object => {
          // 假设实际的护栏网格是名为 Object_XXX 的子对象
          if (object.isMesh && object.name.startsWith('Object_')) { 
            processedRailObjects++;
            
            // 为这个子对象创建碰撞体描述符
            const colliderDesc = this._createRailFromMesh(object);
            
            if (colliderDesc) {
              // 获取世界坐标
              const worldPos = new THREE.Vector3();
              object.getWorldPosition(worldPos);
              
              // 获取世界旋转
              const worldQuat = new THREE.Quaternion();
              object.getWorldQuaternion(worldQuat);
              
              // 保存碰撞体描述符和变换信息
              railCollidersInfo.push({
                desc: colliderDesc,
                position: worldPos,
                rotation: worldQuat,
                objectId: object.id,
                name: object.name
              });
              
            } else {
              console.warn(`[RapierShapeFactory] 为 ${object.name} 创建碰撞体描述符失败`);
            }
          }
        });
      }
    });
    
    console.log(`[RapierShapeFactory] 搜索完成。找到 ${foundRailParents} 个潜在护栏父对象，处理了 ${processedRailObjects} 个网格对象，创建了 ${railCollidersInfo.length} 个碰撞体描述符。`);
    
    return railCollidersInfo;
  }
  
  /**
   * 从Three.js几何体创建Rapier凸包碰撞描述符
   * 
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Three.js几何体
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   */
  createConvexHullDesc(geometry) {
    // 确保几何体是BufferGeometry
    if (!geometry.isBufferGeometry) {
      console.error('几何体必须是BufferGeometry');
      return null;
    }
    
    // 获取顶点数据
    const positions = geometry.getAttribute('position');
    const vertices = [];
    
    // 提取顶点坐标
    for (let i = 0; i < positions.count; i++) {
      vertices.push(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
    }
    
    // 创建凸包形状描述符
    const convexDesc = RAPIER.ColliderDesc.convexHull(vertices);
    if (!convexDesc) {
      console.error('无法创建凸包，顶点可能不足或无效');
      return null;
    }
    
    return convexDesc;
  }
  
  /**
   * 创建简化的凸包碰撞描述符
   * 优化性能版本，使用点抽样
   * 
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Three.js几何体
   * @param {Number} sampleSize - 采样点数量 (默认为8)
   * @returns {RAPIER.ColliderDesc} Rapier碰撞描述符
   */
  createSimplifiedConvexHullDesc(geometry, sampleSize = 8) {
    // 确保几何体是BufferGeometry
    if (!geometry.isBufferGeometry) {
      console.error('几何体必须是BufferGeometry');
      return null;
    }
    
    // 获取顶点数据
    const positions = geometry.getAttribute('position');
    const vertices = [];
    
    // 计算采样步长
    const step = Math.max(1, Math.floor(positions.count / sampleSize));
    
    // 采样顶点坐标
    for (let i = 0; i < positions.count; i += step) {
      vertices.push(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
    }
    
    // 如果采样点太少，返回null
    if (vertices.length < 12) { // 至少需要4个顶点 (4 * 3 = 12个坐标值)
      console.warn('几何体顶点不足以创建凸包');
      return null;
    }
    
    // 创建凸包形状描述符
    const convexDesc = RAPIER.ColliderDesc.convexHull(vertices);
    if (!convexDesc) {
      console.error('无法创建凸包，顶点可能无效');
      return null;
    }
    
    return convexDesc;
  }
}

// 导出单例
export default new RapierShapeFactory(); 