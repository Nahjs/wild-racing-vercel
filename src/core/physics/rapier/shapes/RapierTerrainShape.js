import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { COLLISION_GROUPS } from './RapierShapeFactory';

/**
 * Rapier地形形状生成器 - 专门处理赛道地形的碰撞形状
 */
export class RapierTerrainShape {
  constructor() {
    // 地形材质参数
    this.groundFriction = 0.8;     // 较高的摩擦力提供更好的抓地力
    this.groundRestitution = 0.2;  // 低弹性
  }

  /**
   * 从高度图创建地形碰撞体
   * 
   * @param {Float32Array|number[]} heightData - 高度图数据
   * @param {number} width - 地形宽度（x方向尺寸）
   * @param {number} depth - 地形深度（z方向尺寸）
   * @param {number} widthSegments - 宽度细分数
   * @param {number} depthSegments - 深度细分数
   * @param {number} scale - 高度缩放系数
   * @param {RAPIER.World} world - Rapier物理世界
   * @returns {RAPIER.Collider} 创建的地形碰撞体
   */
  createHeightfieldTerrain(heightData, width, depth, widthSegments, depthSegments, scale, world) {
    
    // 创建静态刚体
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, 0, 0);
    const rigidBody = world.createRigidBody(bodyDesc);
    
    // 计算高度场尺寸
    const nRows = depthSegments + 1;
    const nCols = widthSegments + 1;
    
    // 确保高度数据格式正确
    if (heightData.length !== nRows * nCols) {
      console.error(`[RapierTerrainShape] 高度数据长度不匹配：${heightData.length} vs 预期的 ${nRows * nCols}`);
      return null;
    }
    
    // 创建高度场碰撞体描述符
    // Rapier中的高度场坐标轴与Three.js有所不同，需要适当调整
    const colliderDesc = RAPIER.ColliderDesc.heightfield(
      nRows - 1,     // Rapier使用行数减1
      nCols - 1,     // Rapier使用列数减1
      heightData,    // 高度数据数组
      { x: width, y: scale, z: depth }  // 缩放因子
    );
    
    // 配置碰撞属性
    this._configureTerrainColliderDesc(colliderDesc);
    
    // 创建碰撞体
    const collider = world.createCollider(colliderDesc, rigidBody);
    
    // 设置用户数据
    collider.setUserData({
      type: 'terrain',
      name: 'terrain'
    });
    
    
    return {
      rigidBody,
      collider
    };
  }
  
  /**
   * 从平面网格创建地形碰撞体 - 修改为始终创建大型平坦地面
   * 
   * @param {THREE.Mesh} terrainMesh - 地形网格 (仅用于获取位置和名称)
   * @param {RAPIER.World} world - Rapier物理世界
   * @returns {Object|null} 创建的地形碰撞体信息 { rigidBody, collider }
   */
  createMeshTerrain(terrainMesh, world) {
    
    if (!terrainMesh.isMesh) {
      console.error('[RapierTerrainShape] 提供的对象不是网格');
      return null;
    }
    
    console.log(`[RapierTerrainShape] Creating flat ground plane collider for object: ${terrainMesh.name}`);

    // 获取对象的世界位置，我们将把平面放在这个位置附近，但Y轴固定为0
    const worldPos = new THREE.Vector3();
    terrainMesh.getWorldPosition(worldPos);
    
    // 创建静态刚体，位置固定在Y=0
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(worldPos.x, 0, worldPos.z); // 固定Y=0
    const rigidBody = world.createRigidBody(bodyDesc);
    
    // ★★★ 创建一个非常大的、薄的立方体作为地面 ★★★
    const planeSize = 1000; // 地面大小 (米)
    const planeThickness = 0.1; // 地面厚度
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
        planeSize * 0.5, 
        planeThickness * 0.5, 
        planeSize * 0.5
    );

    // 配置碰撞属性
    this._configureTerrainColliderDesc(colliderDesc); 

    // 创建碰撞体
    const collider = world.createCollider(colliderDesc, rigidBody);

    // 设置用户数据
    collider.userData = {
      type: 'terrain_FLAT_PLANE', // 加上标记以便区分
      name: `flat_ground_for_${terrainMesh.name}`,
      objectId: terrainMesh.id
    };

    console.log(`[RapierTerrainShape] Flat ground plane created for ${terrainMesh.name} at Y=0`);

    return {
      rigidBody,
      collider
    };
  }
  
  /**
   * 配置地形碰撞体描述符的共同属性
   * 
   * @param {RAPIER.ColliderDesc} colliderDesc - 碰撞体描述符
   * @private
   */
  _configureTerrainColliderDesc(colliderDesc) {
    // 设置材质参数
    colliderDesc.setFriction(this.groundFriction);
    colliderDesc.setRestitution(this.groundRestitution);
    
    // 设置碰撞组
    // 地形属于 GROUND 组，与 VEHICLE 组碰撞
    // ★★★ 确保过滤器包含 VEHICLE 组 ★★★
    const membership = COLLISION_GROUPS.GROUND;
    const filter = COLLISION_GROUPS.VEHICLE | COLLISION_GROUPS.RAIL; // 与车辆和护栏碰撞
    colliderDesc.setCollisionGroups((membership << 16) | filter);
    console.log(`[RapierTerrainShape] Configured Terrain Collision Group: Membership=${membership}, Filter=${filter.toString(2)}`);
  }
  
  /**
   * 为场景中的地形对象创建碰撞体
   * 
   * @param {THREE.Scene} scene - Three.js场景
   * @param {RAPIER.World} world - Rapier物理世界
   * @returns {Array<Object>} 创建的碰撞体信息数组
   */
  createAllTerrainColliders(scene, world) {
    const terrainColliders = [];
    let processedTerrainObjects = 0;
    
    
    // 查找所有潜在的地形对象
    scene.traverse(object => {
      // 基于名称识别地形对象
      if (object.isMesh && (
          // Check object name OR parent name for terrain keywords
          ['terrain', 'ground', 'floor', 'road', 'track'].some(keyword => 
            object.name.toLowerCase().includes(keyword) || 
            (object.parent && object.parent.name.toLowerCase().includes(keyword))
          )
        )) {
        processedTerrainObjects++;
        
        // 创建地形碰撞体
        const terrainInfo = this.createMeshTerrain(object, world);
        
        if (terrainInfo) {
          terrainColliders.push(terrainInfo);
        }
      }
    });
    
    console.log(`[RapierTerrainShape] 搜索完成。处理了 ${processedTerrainObjects} 个地形对象，创建了 ${terrainColliders.length} 个碰撞体。`);
    
    return terrainColliders;
  }
}

// 导出单例
export default new RapierTerrainShape(); 