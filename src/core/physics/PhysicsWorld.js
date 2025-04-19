import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// 物理世界初始化
export const createPhysicsWorld = () => {
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0); // 重力
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true; // 允许物体休眠以提高性能
  world.defaultContactMaterial.friction = 0.3;
  return world;
};

// 创建地面
export const createGround = (world) => {
  const groundMaterial = new CANNON.Material('ground');
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({
    mass: 0, // 质量为0表示静态物体
    material: groundMaterial
  });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // 使地面水平
  groundBody.position.set(0, -1, 0); // 设置地面 Y 坐标为 -1
  world.addBody(groundBody);
  return { groundBody, groundMaterial };
};

// 更新物理世界
export const updatePhysics = (world, deltaTime) => {
  const timeStep = 1/60;
  const maxSubSteps = 5;
  // 调用world.step并传入参数，可控制模拟精度和性能
  world.step(timeStep, deltaTime, maxSubSteps);
};

// 创建调试用的物理可视化
export class CannonDebugRenderer {
  constructor(scene, world, options = {}) {
    this.scene = scene;
    this.world = world;
    this.meshes = [];
    
    this.material = new THREE.MeshBasicMaterial({
      color: options.color || 0x00ff00,
      wireframe: options.wireframe !== undefined ? options.wireframe : true
    });
  }
  
  update() {
    // 移除旧的调试网格
    this.meshes.forEach(mesh => {
      this.scene.remove(mesh);
    });
    this.meshes = [];
    
    // 为每个物理体创建对应的可视化网格
    this.world.bodies.forEach(body => {
      body.shapes.forEach((shape, i) => {
        const mesh = this._createMesh(shape);
        if (mesh) {
          // 将网格位置和旋转与物理体同步
          mesh.position.copy(body.position);
          mesh.quaternion.copy(body.quaternion);
          this.scene.add(mesh);
          this.meshes.push(mesh);
        }
      });
    });
  }
  
  // 新增：清理所有调试网格的方法
  clearMeshes() {
    this.meshes.forEach(mesh => {
      this.scene.remove(mesh);
    });
    this.meshes = [];
    console.log("[CannonDebugRenderer] Cleared debug meshes.");
  }
  
  _createMesh(shape) {
    let geometry, mesh;
    
    // 根据形状类型创建相应的几何体
    switch(shape.type) {
      case CANNON.Shape.types.BOX:
        geometry = new THREE.BoxGeometry(
          shape.halfExtents.x * 2,
          shape.halfExtents.y * 2,
          shape.halfExtents.z * 2
        );
        mesh = new THREE.Mesh(geometry, this.material);
        break;
        
      case CANNON.Shape.types.SPHERE:
        geometry = new THREE.SphereGeometry(shape.radius);
        mesh = new THREE.Mesh(geometry, this.material);
        break;
        
      case CANNON.Shape.types.PLANE:
        geometry = new THREE.PlaneGeometry(10, 10);
        mesh = new THREE.Mesh(geometry, this.material);
        break;
        
      default:
        return null;
    }
    
    return mesh;
  }
} 