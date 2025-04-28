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
        friction: 0.1,      // 保持较低摩擦力
        restitution: 0.1,   // 保持较低反弹力
        contactEquationStiffness: 5e9,  // 大幅增加刚度
        contactEquationRelaxation: 2    // 再次减少松弛度
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
   * 通过边界盒创建护栏碰撞体 (现在使用 Trimesh)
   * 适用于单个护栏对象
   * 
   * @param {THREE.Mesh} railObject - 护栏对象 (必须是 Mesh)
   * @param {Object} options - 配置选项 (目前未使用)
   * @returns {CANNON.Body} 创建的物理body
   * @private
   */
  _createRailFromBoundingBox(railObject, options = {}) {
    console.log(`[CollisionShapes] _createRailFromBoundingBox (using Trimesh) called for ${railObject.name}`);

    if (!railObject.isMesh) {
      console.warn(`[CollisionShapes] Rail object ${railObject.name} is not a Mesh. Cannot create Trimesh.`);
      return null; 
    }

    const geometry = railObject.geometry;
    if (!geometry || !geometry.isBufferGeometry) {
      console.warn(`[CollisionShapes] Rail object ${railObject.name} has no valid BufferGeometry. Cannot create Trimesh.`);
      return null;
    }

    // 获取世界坐标和旋转，用于 Body
    const worldPositionTHREE = new THREE.Vector3();
    railObject.getWorldPosition(worldPositionTHREE);
    const bodyPosition = new CANNON.Vec3(worldPositionTHREE.x, worldPositionTHREE.y, worldPositionTHREE.z);

    const worldQuaternionTHREE = new THREE.Quaternion();
    railObject.getWorldQuaternion(worldQuaternionTHREE);
    const bodyQuaternion = new CANNON.Quaternion(worldQuaternionTHREE.x, worldQuaternionTHREE.y, worldQuaternionTHREE.z, worldQuaternionTHREE.w);

    let shape = null;
    try {
      // 提取顶点 (已经是局部坐标，相对于 Mesh 的原点)
      const positions = geometry.getAttribute('position').array; // 获取 Float32Array
      const vertices = [];
      // Cannon-es Trimesh 需要普通的 number 数组或 Float32Array
      // 直接传递 Float32Array 通常效率更高
      // for (let i = 0; i < positions.length; i += 3) {
      //   vertices.push(positions[i], positions[i+1], positions[i+2]);
      // }
      
      // 提取索引
      let indices;
      if (geometry.index) {
        indices = geometry.index.array; // 获取 Uint16Array or Uint32Array
        // Cannon-es Trimesh 也需要普通的 number 数组或相应的 TypedArray
        // 直接传递 TypedArray 效率更高
      } else {
         // 如果没有索引，需要根据顶点顺序生成 (假设是 non-indexed triangles)
         indices = [];
         for (let i = 0; i < positions.length / 3; i++) {
             indices.push(i);
         }
         console.warn(`[CollisionShapes] Geometry for ${railObject.name} has no indices. Generating indices assuming non-indexed triangles. This might be slow or incorrect.`);
      }

      if (!positions || positions.length === 0 || !indices || indices.length === 0) {
         console.warn(`[CollisionShapes] Invalid vertices or indices for ${railObject.name}. Falling back to Box.`);
         const bbox = new THREE.Box3().setFromObject(railObject);
         const size = bbox.getSize(new THREE.Vector3());
         const minSize = 0.1;
         shape = new CANNON.Box(new CANNON.Vec3(
           Math.max(size.x * 0.5, minSize), 
           Math.max(size.y * 0.5, minSize), 
           Math.max(size.z * 0.5, minSize)
         ));
      } else {
         // 创建 Trimesh 形状
         shape = new CANNON.Trimesh(positions, indices); // 直接传递 TypedArrays
         console.log(`[CollisionShapes] Created Trimesh for ${railObject.name} with ${positions.length / 3} vertices and ${indices.length / 3} triangles.`);
      }
    } catch (error) {
      console.error(`[CollisionShapes] Error creating Trimesh for ${railObject.name}:`, error);
      // 出现错误时回退到 Bounding Box
      const bbox = new THREE.Box3().setFromObject(railObject);
      const size = bbox.getSize(new THREE.Vector3());
      const minSize = 0.1;
      shape = new CANNON.Box(new CANNON.Vec3(
         Math.max(size.x * 0.5, minSize), 
         Math.max(size.y * 0.5, minSize), 
         Math.max(size.z * 0.5, minSize)
      ));
      console.warn(`[CollisionShapes] Falling back to Box shape for ${railObject.name} due to Trimesh error.`);
    }

    if (!shape) {
      console.error(`[CollisionShapes] Failed to create any shape for ${railObject.name}.`);
      return null;
    }

    // ★★★ 应用特定物体的偏移补偿 ★★★
    let finalBodyPosition = bodyPosition;
    let finalBodyQuaternion = bodyQuaternion;
    let finalShape = shape; // 默认使用原始 shape

    const compensationOffsets = {
      'Object_488': { x: 90.329, y: 13.03, z: 0.83155 },
      'Object_485': { x: 22.339, y: 43.556, z: 0.83481 },
      'Object_486': { x: -30.068, y: 116.13, z: 0.80514 }
    };

    if (compensationOffsets[railObject.name] && shape instanceof CANNON.Trimesh) {
      console.log(`[CollisionShapes] Applying position and vertex compensation for ${railObject.name}`);
      const offsetData = compensationOffsets[railObject.name];
      const localOffsetTHREE = new THREE.Vector3(offsetData.x, offsetData.y, offsetData.z);

      // 1. 计算几何中心的世界坐标
      const worldPositionTHREE = new THREE.Vector3();
      railObject.getWorldPosition(worldPositionTHREE); // 原点世界坐标
      const worldQuaternionTHREE = new THREE.Quaternion();
      railObject.getWorldQuaternion(worldQuaternionTHREE);

      const worldOffsetTHREE = localOffsetTHREE.clone().applyQuaternion(worldQuaternionTHREE);
      const centerWorldPosTHREE = worldPositionTHREE.clone().add(worldOffsetTHREE);

      // 更新 Body 的目标位置和旋转
      finalBodyPosition = new CANNON.Vec3(centerWorldPosTHREE.x, centerWorldPosTHREE.y, centerWorldPosTHREE.z);
      finalBodyQuaternion = new CANNON.Quaternion(worldQuaternionTHREE.x, worldQuaternionTHREE.y, worldQuaternionTHREE.z, worldQuaternionTHREE.w); // 旋转不变
      
      // ★★★ 添加详细日志 ★★★
      console.log(`[CollisionShapes] Compensating ${railObject.name}:`);
      console.log(`  - Local Offset:`, localOffsetTHREE);
      console.log(`  - Original World Pos (Origin):`, worldPositionTHREE);
      console.log(`  - Calculated Center World Pos:`, centerWorldPosTHREE);
      console.log(`  - Final Body Pos Set To:`, finalBodyPosition);
      // ★★★ 日志结束 ★★★

      // 2. 调整顶点坐标 (使其相对于几何中心)
      // 注意：shape.vertices 是原始的 Float32Array 引用
      const originalVertices = shape.vertices; // Float32Array [x0, y0, z0, x1, y1, z1, ...]
      const compensatedVertices = new Float32Array(originalVertices.length);

      for (let i = 0; i < originalVertices.length; i += 3) {
        compensatedVertices[i] = originalVertices[i] - localOffsetTHREE.x;
        compensatedVertices[i + 1] = originalVertices[i + 1] - localOffsetTHREE.y;
        compensatedVertices[i + 2] = originalVertices[i + 2] - localOffsetTHREE.z;
      }
      
      // 3. 创建使用补偿后顶点的新 Trimesh
      // 注意: shape.indices 保持不变
      finalShape = new CANNON.Trimesh(compensatedVertices, shape.indices);
      console.log(`[CollisionShapes] Compensated Trimesh created for ${railObject.name}`);
    }
    // ★★★ 补偿结束 ★★★

    const body = new CANNON.Body({
      mass: 0,
      position: finalBodyPosition,    // 使用最终确定的位置 (可能是补偿后的中心位置)
      quaternion: finalBodyQuaternion, // 使用最终确定的旋转
      material: this.railMaterial,
      collisionFilterGroup: GROUPS.RAIL,
      collisionFilterMask: GROUPS.VEHICLE,
      type: CANNON.Body.STATIC
    });

    // 添加形状到 Body (使用最终确定的 shape)
    // 这个 shape 的顶点现在是相对于 finalBodyPosition 定义的
    body.addShape(finalShape); // 不再需要 shape 偏移量

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