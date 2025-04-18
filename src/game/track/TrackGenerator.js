import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class TrackGenerator {
  constructor() {
    this.segments = [];
    this.checkpoints = [];
    this.trackWidth = 10;
    this.trackGroup = null;
    this.physicsWorld = null;
    this.trackBodies = [];
  }
  
  // 初始化生成器
  initialize(scene, physicsWorld) {
    this.trackGroup = new THREE.Group();
    this.trackGroup.name = 'generated_track';
    scene.add(this.trackGroup);
    
    this.physicsWorld = physicsWorld;
    
    this.segments = [];
    this.checkpoints = [];
    this.trackBodies = [];
    
    return this.trackGroup;
  }
  
  // 生成赛道
  generateTrack(options = {}) {
    const {
      trackType = 'loop',
      segmentCount = 12,
      radius = 50,
      complexity = 0.5,
      height = 0,
      trackWidth = 10,
      withBarriers = true,
      withCheckpoints = true,
    } = options;
    
    // 清除现有赛道
    this.clearTrack();
    
    this.trackWidth = trackWidth;
    
    // 根据赛道类型生成路径点
    let pathPoints = [];
    
    if (trackType === 'loop') {
      pathPoints = this._generateLoopTrack(segmentCount, radius, complexity, height);
    } else if (trackType === 'straight') {
      pathPoints = this._generateStraightTrack(segmentCount, length);
    } else if (trackType === 'custom') {
      pathPoints = options.customPath || [];
    }
    
    // 根据路径点创建赛道段
    this._createTrackSegments(pathPoints, trackWidth);
    
    // 创建障碍物（如果需要）
    if (withBarriers) {
      this._createTrackBarriers(trackWidth);
    }
    
    // 创建检查点（如果需要）
    if (withCheckpoints) {
      this._createCheckpoints(pathPoints);
    }
    
    return this.trackGroup;
  }
  
  // 生成环形赛道路径点
  _generateLoopTrack(segmentCount, radius, complexity, height) {
    const pathPoints = [];
    
    // 基础圆形路径
    for (let i = 0; i < segmentCount; i++) {
      const angle = (i / segmentCount) * Math.PI * 2;
      
      // 添加随机变化使赛道更自然
      const radiusVariation = 1 + (Math.random() * 2 - 1) * complexity * 0.3;
      const currentRadius = radius * radiusVariation;
      
      // 计算点坐标
      const x = Math.cos(angle) * currentRadius;
      const z = Math.sin(angle) * currentRadius;
      
      // 添加高度变化
      const heightVariation = Math.sin(angle * 2) * height * complexity;
      const y = heightVariation;
      
      pathPoints.push(new THREE.Vector3(x, y, z));
    }
    
    // 闭合路径
    pathPoints.push(pathPoints[0].clone());
    
    return pathPoints;
  }
  
  // 生成直线赛道路径点
  _generateStraightTrack(segmentCount, length) {
    const pathPoints = [];
    
    for (let i = 0; i < segmentCount; i++) {
      const ratio = i / (segmentCount - 1);
      const x = (ratio - 0.5) * length;
      pathPoints.push(new THREE.Vector3(x, 0, 0));
    }
    
    return pathPoints;
  }
  
  // 创建赛道段
  _createTrackSegments(pathPoints, trackWidth) {
    if (pathPoints.length < 2) return;
    
    // 计算路径曲线
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const curvePoints = curve.getPoints(pathPoints.length * 4);
    
    // 创建赛道几何体
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const pointA = curvePoints[i];
      const pointB = curvePoints[i + 1];
      
      // 计算段的方向向量
      const direction = new THREE.Vector3().subVectors(pointB, pointA).normalize();
      
      // 计算垂直于方向的向量（用于赛道宽度）
      const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
      
      // 计算赛道段的四个角点
      const halfWidth = trackWidth / 2;
      const a1 = new THREE.Vector3().addVectors(pointA, side.clone().multiplyScalar(halfWidth));
      const a2 = new THREE.Vector3().subVectors(pointA, side.clone().multiplyScalar(halfWidth));
      const b1 = new THREE.Vector3().addVectors(pointB, side.clone().multiplyScalar(halfWidth));
      const b2 = new THREE.Vector3().subVectors(pointB, side.clone().multiplyScalar(halfWidth));
      
      // 创建赛道段网格
      const geometry = new THREE.BufferGeometry();
      
      // 顶点
      const vertices = new Float32Array([
        a1.x, a1.y, a1.z,
        a2.x, a2.y, a2.z,
        b1.x, b1.y, b1.z,
        b2.x, b2.y, b2.z
      ]);
      
      // 顶点索引（2个三角形组成一个矩形）
      const indices = [
        0, 1, 2,
        2, 1, 3
      ];
      
      geometry.setIndex(indices);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      
      const mesh = new THREE.Mesh(geometry, trackMaterial);
      mesh.receiveShadow = true;
      
      this.trackGroup.add(mesh);
      this.segments.push(mesh);
      
      // 添加物理刚体
      if (this.physicsWorld) {
        this._addTrackPhysics(a1, a2, b1, b2);
      }
    }
  }
  
  // 添加赛道物理
  _addTrackPhysics(a1, a2, b1, b2) {
    // 创建地面刚体
    const groundShape = new CANNON.Box(new CANNON.Vec3(
      this.trackWidth / 2,
      0.1, // 厚度
      Math.max(
        new THREE.Vector3().subVectors(b1, a1).length(),
        new THREE.Vector3().subVectors(b2, a2).length()
      ) / 2
    ));
    
    const groundBody = new CANNON.Body({
      mass: 0, // 质量为0表示静态物体
      material: new CANNON.Material({ friction: 0.3 })
    });
    
    // 计算中心点和旋转角度
    const center = new THREE.Vector3()
      .add(a1).add(a2).add(b1).add(b2)
      .divideScalar(4);
    
    // 设置位置
    groundBody.position.set(center.x, center.y, center.z);
    
    // 设置方向
    const direction = new THREE.Vector3().subVectors(
      new THREE.Vector3().addVectors(b1, b2).multiplyScalar(0.5),
      new THREE.Vector3().addVectors(a1, a2).multiplyScalar(0.5)
    ).normalize();
    
    // 计算从 z 轴到 direction 的四元数
    const upVector = new THREE.Vector3(0, 1, 0);
    const rotationAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), direction).normalize();
    const angle = Math.acos(new THREE.Vector3(0, 0, 1).dot(direction));
    
    const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
    groundBody.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    
    // 添加形状
    groundBody.addShape(groundShape);
    
    // 添加到物理世界
    this.physicsWorld.addBody(groundBody);
    this.trackBodies.push(groundBody);
  }
  
  // 创建赛道护栏
  _createTrackBarriers(trackWidth) {
    // 根据赛道段创建护栏
    // 实现略...这部分可以参考赛道段创建的方法，并在赛道两侧添加护栏几何体
  }
  
  // 创建检查点
  _createCheckpoints(pathPoints) {
    if (pathPoints.length < 2) return;
    
    // 等分路径创建检查点
    const checkpointCount = Math.max(3, Math.floor(pathPoints.length / 3));
    
    for (let i = 0; i < checkpointCount; i++) {
      const index = Math.floor((i / checkpointCount) * (pathPoints.length - 1));
      const position = pathPoints[index].clone();
      
      // 创建检查点可视化
      const checkpointGeometry = new THREE.RingGeometry(this.trackWidth * 0.7, this.trackWidth * 0.8, 16);
      const checkpointMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
      });
      
      // 创建垂直于赛道的圆环
      const checkpoint = new THREE.Mesh(checkpointGeometry, checkpointMaterial);
      checkpoint.position.copy(position);
      
      // 确定方向：如果是最后一个检查点，使用最后两个点
      let direction;
      if (i < checkpointCount - 1) {
        const nextIndex = Math.floor(((i + 1) / checkpointCount) * (pathPoints.length - 1));
        direction = new THREE.Vector3().subVectors(pathPoints[nextIndex], position).normalize();
      } else {
        const prevIndex = Math.floor(((i - 1) / checkpointCount) * (pathPoints.length - 1));
        direction = new THREE.Vector3().subVectors(position, pathPoints[prevIndex]).normalize();
      }
      
      // 旋转圆环使其垂直于赛道
      checkpoint.lookAt(position.clone().add(direction));
      
      // 添加到场景
      this.trackGroup.add(checkpoint);
      
      // 记录检查点数据
      this.checkpoints.push({
        id: `checkpoint_${i}`,
        position: position.clone(),
        object: checkpoint
      });
    }
  }
  
  // 清除赛道
  clearTrack() {
    // 从场景中移除所有段
    if (this.trackGroup) {
      while (this.trackGroup.children.length > 0) {
        const object = this.trackGroup.children[0];
        this.trackGroup.remove(object);
        
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    }
    
    // 从物理世界中移除
    if (this.physicsWorld) {
      this.trackBodies.forEach(body => {
        this.physicsWorld.removeBody(body);
      });
    }
    
    this.segments = [];
    this.checkpoints = [];
    this.trackBodies = [];
  }
  
  // 销毁生成器
  dispose(scene) {
    this.clearTrack();
    
    if (this.trackGroup && scene) {
      scene.remove(this.trackGroup);
    }
    
    this.trackGroup = null;
    this.physicsWorld = null;
  }
  
  // 获取生成的检查点
  getCheckpoints() {
    return [...this.checkpoints];
  }
}

// 创建单例
export const trackGenerator = new TrackGenerator(); 