import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * 碰撞工具类 - 提供碰撞检测和物理转换的辅助功能
 */
class CollisionUtils {
  /**
   * 创建三角网格碰撞体
   * 从Three.js几何体生成CANNON.js的trimesh碰撞体
   * 
   * @param {THREE.BufferGeometry} geometry - Three.js缓冲几何体
   * @returns {CANNON.Trimesh} CANNON.js三角网格
   */
  static createTrimeshFromGeometry(geometry) {
    // 确保几何体是BufferGeometry
    if (!geometry.isBufferGeometry) {
      console.error('几何体必须是BufferGeometry');
      return null;
    }
    
    // 获取几何体的位置和索引属性
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    
    // 创建顶点和索引数组
    const vertices = [];
    for (let i = 0; i < position.count; i++) {
      vertices.push(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      );
    }
    
    // 如果有索引，使用索引；否则，按顺序创建三角形索引
    let indices = [];
    if (index) {
      for (let i = 0; i < index.count; i++) {
        indices.push(index.getX(i));
      }
    } else {
      for (let i = 0; i < position.count; i += 3) {
        indices.push(i, i + 1, i + 2);
      }
    }
    
    // 创建Trimesh
    return new CANNON.Trimesh(vertices, indices);
  }
  
  /**
   * 计算碰撞强度
   * 根据两个物体的相对速度和质量计算碰撞强度
   * 
   * @param {CANNON.Body} bodyA - 第一个物理体
   * @param {CANNON.Body} bodyB - 第二个物理体
   * @param {CANNON.ContactEquation} contact - 接触方程
   * @returns {Number} 碰撞强度值
   */
  static calculateCollisionImpact(bodyA, bodyB, contact) {
    // 计算相对速度
    const relativeVelocity = new CANNON.Vec3();
    bodyB.velocity.vsub(bodyA.velocity, relativeVelocity);
    
    // 获取碰撞法线方向
    const normal = contact.ni; // 碰撞法线
    
    // 计算法线方向的相对速度分量
    const normalVelocity = relativeVelocity.dot(normal);
    
    // 计算有效质量
    const invMassA = bodyA.invMass;
    const invMassB = bodyB.invMass;
    const effectiveMass = invMassA + invMassB === 0 ? 1 : 1 / (invMassA + invMassB);
    
    // 计算碰撞冲量
    const impulse = Math.abs(normalVelocity * effectiveMass);
    
    return impulse;
  }
  
  /**
   * 检测两个AABB是否相交
   * 用于快速碰撞检测
   * 
   * @param {Object} boxA - 第一个AABB {min: THREE.Vector3, max: THREE.Vector3}
   * @param {Object} boxB - 第二个AABB {min: THREE.Vector3, max: THREE.Vector3}
   * @returns {Boolean} 是否相交
   */
  static aabbIntersect(boxA, boxB) {
    return (
      boxA.min.x <= boxB.max.x && boxA.max.x >= boxB.min.x &&
      boxA.min.y <= boxB.max.y && boxA.max.y >= boxB.min.y &&
      boxA.min.z <= boxB.max.z && boxA.max.z >= boxB.min.z
    );
  }
  
  /**
   * 创建八叉树空间分区
   * 用于高效的碰撞检测
   * 
   * @param {THREE.Box3} bounds - 边界盒
   * @param {Number} depth - 最大深度
   * @returns {Object} 八叉树对象
   */
  static createOctree(bounds, depth = 3) {
    return {
      bounds,
      children: [],
      objects: [],
      depth,
      
      // 插入物体
      insert(object, aabb) {
        if (this.depth <= 0) {
          this.objects.push({ object, aabb });
          return;
        }
        
        // 如果没有子节点，创建子节点
        if (this.children.length === 0) {
          this._split();
        }
        
        // 尝试放入适合的子节点
        let placed = false;
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (CollisionUtils.aabbIntersect(child.bounds, aabb)) {
            child.insert(object, aabb);
            placed = true;
            break;
          }
        }
        
        // 如果不适合子节点，放在当前节点
        if (!placed) {
          this.objects.push({ object, aabb });
        }
      },
      
      // 分割节点
      _split() {
        const center = new THREE.Vector3();
        this.bounds.getCenter(center);
        
        const size = new THREE.Vector3();
        this.bounds.getSize(size);
        const halfSize = size.clone().multiplyScalar(0.5);
        
        // 创建8个子节点
        for (let x = -1; x <= 1; x += 2) {
          for (let y = -1; y <= 1; y += 2) {
            for (let z = -1; z <= 1; z += 2) {
              const childCenter = new THREE.Vector3(
                center.x + x * halfSize.x * 0.5,
                center.y + y * halfSize.y * 0.5,
                center.z + z * halfSize.z * 0.5
              );
              
              const childMin = new THREE.Vector3(
                childCenter.x - halfSize.x * 0.5,
                childCenter.y - halfSize.y * 0.5,
                childCenter.z - halfSize.z * 0.5
              );
              
              const childMax = new THREE.Vector3(
                childCenter.x + halfSize.x * 0.5,
                childCenter.y + halfSize.y * 0.5,
                childCenter.z + halfSize.z * 0.5
              );
              
              const childBounds = new THREE.Box3(childMin, childMax);
              
              this.children.push(CollisionUtils.createOctree(childBounds, this.depth - 1));
            }
          }
        }
      },
      
      // 查询与给定AABB相交的所有物体
      query(aabb, result = []) {
        // 检查当前节点中的物体
        for (let i = 0; i < this.objects.length; i++) {
          const obj = this.objects[i];
          if (CollisionUtils.aabbIntersect(obj.aabb, aabb)) {
            result.push(obj.object);
          }
        }
        
        // 检查子节点
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (CollisionUtils.aabbIntersect(child.bounds, aabb)) {
            child.query(aabb, result);
          }
        }
        
        return result;
      }
    };
  }
  
  /**
   * 从Three.js物体获取边界盒
   * 
   * @param {THREE.Object3D} object - Three.js物体
   * @returns {THREE.Box3} 边界盒
   */
  static getBoundingBox(object) {
    const box = new THREE.Box3().setFromObject(object);
    return box;
  }
  
  /**
   * 从Three.js边界盒创建CANNON.js的AABB
   * 
   * @param {THREE.Box3} box - Three.js边界盒
   * @returns {CANNON.AABB} CANNON.js AABB
   */
  static createCannonAABB(box) {
    const min = new CANNON.Vec3(box.min.x, box.min.y, box.min.z);
    const max = new CANNON.Vec3(box.max.x, box.max.y, box.max.z);
    return new CANNON.AABB(min, max);
  }
  
  /**
   * 将Three.js向量转换为CANNON.js向量
   * 
   * @param {THREE.Vector3} vector - Three.js向量
   * @returns {CANNON.Vec3} CANNON.js向量
   */
  static threeToCannonVector(vector) {
    return new CANNON.Vec3(vector.x, vector.y, vector.z);
  }
  
  /**
   * 将CANNON.js向量转换为Three.js向量
   * 
   * @param {CANNON.Vec3} vector - CANNON.js向量
   * @returns {THREE.Vector3} Three.js向量
   */
  static cannonToThreeVector(vector) {
    return new THREE.Vector3(vector.x, vector.y, vector.z);
  }
  
  /**
   * 将Three.js四元数转换为CANNON.js四元数
   * 
   * @param {THREE.Quaternion} quaternion - Three.js四元数
   * @returns {CANNON.Quaternion} CANNON.js四元数
   */
  static threeToCannonQuaternion(quaternion) {
    return new CANNON.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  
  /**
   * 将CANNON.js四元数转换为Three.js四元数
   * 
   * @param {CANNON.Quaternion} quaternion - CANNON.js四元数
   * @returns {THREE.Quaternion} Three.js四元数
   */
  static cannonToThreeQuaternion(quaternion) {
    return new THREE.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  
  /**
   * 创建可视化的碰撞形状
   * 用于调试碰撞体
   * 
   * @param {CANNON.Body} body - CANNON.js物理体
   * @param {Object} options - 配置选项
   * @returns {THREE.Object3D} 包含碰撞形状可视化的Three.js对象
   */
  static createCollisionVisualizer(body, options = {}) {
    const container = new THREE.Object3D();
    
    // 默认材质
    const material = new THREE.MeshBasicMaterial({
      color: options.color || 0x00ff00,
      wireframe: options.wireframe !== undefined ? options.wireframe : true,
      opacity: options.opacity || 0.5,
      transparent: true
    });
    
    // 为每个形状创建可视化
    body.shapes.forEach((shape, i) => {
      let geometry;
      let mesh;
      
      // 根据形状类型创建不同的几何体
      switch (shape.type) {
        case CANNON.Shape.types.BOX:
          geometry = new THREE.BoxGeometry(
            shape.halfExtents.x * 2,
            shape.halfExtents.y * 2,
            shape.halfExtents.z * 2
          );
          mesh = new THREE.Mesh(geometry, material);
          break;
          
        case CANNON.Shape.types.SPHERE:
          geometry = new THREE.SphereGeometry(shape.radius, 16, 16);
          mesh = new THREE.Mesh(geometry, material);
          break;
          
        case CANNON.Shape.types.CYLINDER:
          geometry = new THREE.CylinderGeometry(
            shape.radiusTop,
            shape.radiusBottom,
            shape.height,
            16
          );
          mesh = new THREE.Mesh(geometry, material);
          // 旋转以匹配CANNON.js的轴向
          mesh.rotation.x = Math.PI / 2;
          break;
          
        case CANNON.Shape.types.PLANE:
          geometry = new THREE.PlaneGeometry(10, 10);
          mesh = new THREE.Mesh(geometry, material);
          // 旋转以匹配CANNON.js的平面朝向
          mesh.quaternion.setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            -Math.PI / 2
          );
          break;
          
        case CANNON.Shape.types.CONVEXPOLYHEDRON:
          // 从顶点和面创建凸包几何体
          geometry = new THREE.BufferGeometry();
          
          // 创建凸包顶点
          const vertices = [];
          for (let v = 0; v < shape.vertices.length; v++) {
            const vertex = shape.vertices[v];
            vertices.push(vertex.x, vertex.y, vertex.z);
          }
          
          // 创建面索引
          const indices = [];
          for (let f = 0; f < shape.faces.length; f++) {
            const face = shape.faces[f];
            // 三角剖分，assuming convex faces
            for (let i = 1; i < face.length - 1; i++) {
              indices.push(face[0], face[i], face[i + 1]);
            }
          }
          
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          
          mesh = new THREE.Mesh(geometry, material);
          break;
          
        case CANNON.Shape.types.TRIMESH:
          // 从三角网格创建几何体
          geometry = new THREE.BufferGeometry();
          
          // 设置顶点
          const vertexBuffer = new Float32Array(shape.vertices);
          geometry.setAttribute('position', new THREE.BufferAttribute(vertexBuffer, 3));
          
          // 设置索引
          if (shape.indices.length > 0) {
            geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(shape.indices), 1));
          }
          
          geometry.computeVertexNormals();
          mesh = new THREE.Mesh(geometry, material);
          break;
          
        default:
          console.warn('未知的碰撞形状类型:', shape.type);
          return;
      }
      
      // 如果形状有位置偏移，应用到mesh
      if (body.shapeOffsets[i]) {
        mesh.position.copy(CollisionUtils.cannonToThreeVector(body.shapeOffsets[i]));
      }
      
      // 如果形状有旋转偏移，应用到mesh
      if (body.shapeOrientations[i]) {
        mesh.quaternion.copy(CollisionUtils.cannonToThreeQuaternion(body.shapeOrientations[i]));
      }
      
      // 添加到容器
      container.add(mesh);
    });
    
    // 更新函数
    container.userData.update = () => {
      container.position.copy(CollisionUtils.cannonToThreeVector(body.position));
      container.quaternion.copy(CollisionUtils.cannonToThreeQuaternion(body.quaternion));
    };
    
    // 首次更新位置和旋转
    container.userData.update();
    
    return container;
  }
}

export default CollisionUtils; 