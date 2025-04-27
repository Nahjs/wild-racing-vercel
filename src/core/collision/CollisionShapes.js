import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import collisionManagerInstance from '@/core/collision/CollisionManager';

// 定义碰撞组 (与 VehiclePhysics.js 保持一致)
const GROUPS = {
  GROUND: 1,
  VEHICLE: 2,
  RAIL: 4,
  CHECKPOINT: 8,
  ALL: -1
};

/**
 * 碰撞形状管理类 - 负责为游戏对象创建和管理适当的碰撞体
 */
class CollisionShapes {
  constructor() {
    // 预设碰撞材质
    this.defaultMaterial = new CANNON.Material('default');
    this.railMaterial = new CANNON.Material('rail');
    
    // 设置材质接触参数
    this.railVehicleContactMaterial = new CANNON.ContactMaterial(
      this.railMaterial,
      this.defaultMaterial,
      {
        friction: 0.2,      // 较低的摩擦力
        restitution: 0.4,   // 中等反弹力
        contactEquationStiffness: 1e8,  // 较高的刚度
        contactEquationRelaxation: 3    // 中等松弛度
      }
    );
  }

  /**
   * 创建栏杆/护栏的碰撞体
   * 优化版：根据Three.js模型生成简化的碰撞体
   * 
   * @param {THREE.Object3D} railObject - Three.js中的护栏对象
   * @param {Object} options - 配置选项
   * @returns {CANNON.Body} 创建的物理body
   */
  createRailCollider(railObject, options = {}) {
    // 提取护栏的位置和旋转
    const position = new CANNON.Vec3().copy(railObject.position);
    const quaternion = new CANNON.Quaternion().copy(railObject.quaternion);
    
    // 如果是轨道类型，通过路径点创建碰撞体
    if (railObject.name.includes('Rails_')) {
      return this._createRailFromPath(railObject, position, quaternion, options);
    }
    
    // 否则，通过边界盒创建碰撞体
    return this._createRailFromBoundingBox(railObject, position, quaternion, options);
  }
  
  /**
   * 通过路径点创建护栏碰撞体
   * 适用于沿曲线排列的护栏
   * 
   * @param {THREE.Object3D} railObject - 护栏对象
   * @param {CANNON.Vec3} position - 位置
   * @param {CANNON.Quaternion} quaternion - 旋转
   * @param {Object} options - 配置选项
   * @returns {CANNON.Body} 创建的物理body
   * @private
   */
  _createRailFromPath(railObject, position, quaternion, options) {
    console.log(`[CollisionShapes] _createRailFromPath called for ${railObject.name}`);
    const railMeshes = [];
    railObject.traverse(child => {
      if (child.isMesh) {
        railMeshes.push(child);
      }
    });
    
    if (railMeshes.length === 0) {
      console.warn('Rail object has no meshes:', railObject.name);
      return null;
    }
    console.log(`[CollisionShapes] Found ${railMeshes.length} meshes for ${railObject.name}`);
    
    const pathIndex = parseInt(railObject.name.split('_')[1]) || 0;
    
    const body = new CANNON.Body({
      mass: 0,
      position,
      quaternion,
      material: this.railMaterial,
      collisionFilterGroup: GROUPS.RAIL,
      collisionFilterMask: GROUPS.VEHICLE,
      type: CANNON.Body.STATIC
    });
    
    body.userData = { 
      type: 'rail', 
      objectId: railObject.id,
      name: railObject.name,
      pathIndex
    };
    console.log(`[CollisionShapes] Set rail body (ID: ${body.id}, Name: ${railObject.name}) type to 'rail'. UserData:`, JSON.stringify(body.userData));
    
    // ★★★ 增加默认碰撞体尺寸 ★★★
    const railHeight = 1.5; // 显著增加高度
    const railWidth = 0.3;  // 稍微增加宽度
    const railDepth = 0.4;  // 稍微增加厚度
    
    railMeshes.forEach(mesh => {
      const bbox = new THREE.Box3().setFromObject(mesh);
      const size = bbox.getSize(new THREE.Vector3());
      
      // ★★★ 使用更大的半尺寸，并提供默认值 ★★★
      const shape = new CANNON.Box(new CANNON.Vec3(
        Math.max(size.x * 0.5, railWidth * 0.5), // 优先用计算值，但保底不小于默认值的一半
        railHeight * 0.5,                       // 直接使用固定高度的一半
        Math.max(size.z * 0.5, railDepth * 0.5) // 优先用计算值，但保底不小于默认值的一半
      ));
      
      const meshWorldPosition = new THREE.Vector3();
      mesh.getWorldPosition(meshWorldPosition);
      const localPosition = new THREE.Vector3()
        .copy(meshWorldPosition)
        .sub(railObject.position);
        
      body.addShape(shape, new CANNON.Vec3(
        localPosition.x,
        localPosition.y, // ★★★ 考虑是否需要调整 Y 偏移？暂时保持不变
        localPosition.z
      ));
    });
    
    return body;
  }
  
  /**
   * 通过边界盒创建护栏碰撞体
   * 适用于单个护栏对象
   * 
   * @param {THREE.Object3D} railObject - 护栏对象
   * @param {CANNON.Vec3} position - 位置
   * @param {CANNON.Quaternion} quaternion - 旋转
   * @param {Object} options - 配置选项
   * @returns {CANNON.Body} 创建的物理body
   * @private
   */
  _createRailFromBoundingBox(railObject, position, quaternion, options) {
    console.log(`[CollisionShapes] _createRailFromBoundingBox called for ${railObject.name}`);
    const bbox = new THREE.Box3().setFromObject(railObject);
    const size = bbox.getSize(new THREE.Vector3());
    
    // ★★★ 增加默认碰撞体尺寸 ★★★
    const railHeight = 1.5;
    const railWidth = 0.3;
    const railDepth = 0.4;
    const minSize = 0.1; // 保持最小尺寸
    
    // ★★★ 使用更大的半尺寸 ★★★
    const halfWidth = Math.max(size.x * 0.5, railWidth * 0.5, minSize);
    const halfHeight = Math.max(size.y * 0.5, railHeight * 0.5, minSize); // 使用 railHeight
    const halfDepth = Math.max(size.z * 0.5, railDepth * 0.5, minSize);
    
    const shape = new CANNON.Box(new CANNON.Vec3(
      halfWidth, halfHeight, halfDepth
    ));
    
    // ★★★ 获取网格的世界坐标作为 Body 的位置 ★★★
    const worldPositionTHREE = new THREE.Vector3();
    railObject.getWorldPosition(worldPositionTHREE);
    const bodyPosition = new CANNON.Vec3(worldPositionTHREE.x, worldPositionTHREE.y, worldPositionTHREE.z);
    console.log(`[CollisionShapes] Setting rail body position for ${railObject.name} to mesh world position:`, bodyPosition);

    // 获取网格的世界旋转
    const worldQuaternionTHREE = new THREE.Quaternion();
    railObject.getWorldQuaternion(worldQuaternionTHREE);
    const bodyQuaternion = new CANNON.Quaternion(worldQuaternionTHREE.x, worldQuaternionTHREE.y, worldQuaternionTHREE.z, worldQuaternionTHREE.w);
    
    const body = new CANNON.Body({
      mass: 0,
      position: bodyPosition, // ★★★ 使用网格的世界坐标 ★★★
      quaternion: bodyQuaternion, // ★★★ 使用网格的世界旋转 ★★★
      material: this.railMaterial,
      collisionFilterGroup: GROUPS.RAIL,
      collisionFilterMask: GROUPS.VEHICLE,
      type: CANNON.Body.STATIC
    });
    
    body.addShape(shape);
    
    body.userData = { 
      type: 'rail', 
      objectId: railObject.id,
      name: railObject.name
    };
    console.log(`[CollisionShapes] Set rail body (ID: ${body.id}, Name: ${railObject.name}) type to 'rail'. UserData:`, JSON.stringify(body.userData));
    
    return body;
  }
  
  /**
   * 为场景中的护栏对象创建碰撞体
   * @param {THREE.Object3D} scene - Three.js场景
   * @param {CANNON.World} world - Cannon.js物理世界
   * @returns {Array<CANNON.Body>} 创建的碰撞体数组
   */
  createRailsColliders(scene, world) {
    const railBodies = [];
    let foundRailParents = 0;
    let processedRailObjects = 0;
    console.log("[CollisionShapes] Starting to search for rail objects (children like Object_XXX under Rails_YYY)...");

    // 查找所有潜在的护栏父对象 (Rails_...)
    scene.traverse(parentObject => {
      if (parentObject.name.includes('Rails_')) {
        foundRailParents++;
        // 遍历父对象下的直接子对象
        parentObject.children.forEach(object => {
          // 假设实际的护栏网格是名为 Object_XXX 的子对象
          if (object.isMesh && object.name.startsWith('Object_')) { 
            processedRailObjects++;
            console.log(`[CollisionShapes] Found potential rail mesh object: ${object.name} (Parent: ${parentObject.name}, ID: ${object.id})`);
            
            // ★★★ 直接为这个子对象创建独立的碰撞体 ★★★
            // 使用 _createRailFromBoundingBox 因为它处理单个对象
            const railBody = this._createRailFromBoundingBox(object); 

            if (railBody) {
              console.log(`[CollisionShapes] Successfully created collider for ${object.name} (Body ID: ${railBody.id})`);
              // 设置碰撞类型 (之前是在 _setupColliders 中做的，移到这里更合适)
              const collisionManager = collisionManagerInstance.getInstance();
              if (collisionManager) {
                collisionManager.setAsRail(railBody);
              } else {
                 console.warn(`[CollisionShapes] CollisionManager not ready when creating collider for ${object.name}`);
              }
              // 添加到物理世界
              world.addBody(railBody);
              railBodies.push(railBody);
              
              // 关联Three.js对象和Cannon.js物理体 (可选，可能不需要)
              // object.userData.physicsBody = railBody; 
            } else {
              console.warn(`[CollisionShapes] Failed to create collider for ${object.name}`);
            }
          }
        });
      }
    });
    
    console.log(`[CollisionShapes] Finished searching. Found ${foundRailParents} potential rail parents, processed ${processedRailObjects} mesh objects, created ${railBodies.length} colliders.`);
    
    // 如果存在多个护栏物体，添加材质接触参数
    if (railBodies.length > 0) {
      // 检查材质是否已添加，避免重复添加 (使用更安全的检查方式)
      const worldMaterials = world.contactMaterials || []; // 获取数组，如果不存在则为空数组
      let found = false;
      for (let i = 0; i < worldMaterials.length; i++) {
        if (worldMaterials[i] === this.railVehicleContactMaterial) {
          found = true;
          break;
        }
      }
      if (!found) {
           world.addContactMaterial(this.railVehicleContactMaterial);
           console.log("[CollisionShapes] Added railVehicleContactMaterial to the world.");
      }
    }
    
    return railBodies;
  }
  
  /**
   * 从Three.js几何体创建Cannon.js凸包碰撞体
   * 用于复杂形状的碰撞检测
   * 
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Three.js几何体
   * @returns {CANNON.Shape} Cannon.js碰撞形状
   */
  createConvexHull(geometry) {
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
      vertices.push(new CANNON.Vec3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
    }
    
    // 创建凸包形状
    const convexShape = new CANNON.ConvexPolyhedron({ vertices });
    return convexShape;
  }
  
  /**
   * 创建简化的凸包碰撞体
   * 优化性能版本，使用点抽样
   * 
   * @param {THREE.Geometry|THREE.BufferGeometry} geometry - Three.js几何体
   * @param {Number} sampleSize - 采样点数量 (默认为8)
   * @returns {CANNON.Shape} Cannon.js碰撞形状
   */
  createSimplifiedConvexHull(geometry, sampleSize = 8) {
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
      vertices.push(new CANNON.Vec3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
    }
    
    // 如果采样点太少，返回null
    if (vertices.length < 4) {
      console.warn('几何体顶点不足以创建凸包');
      return null;
    }
    
    // 创建凸包形状
    const convexShape = new CANNON.ConvexPolyhedron({ vertices });
    return convexShape;
  }
}

// 导出单例
export default new CollisionShapes(); 