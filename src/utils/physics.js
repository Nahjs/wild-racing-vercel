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
  world.addBody(groundBody);
  return { groundBody, groundMaterial };
};

// 创建车辆主体
export const createVehicle = (world, options = {}) => {
  const defaultOptions = {
    mass: 100, // Default mass
    linearDamping: 0.01, // Default damping
    angularDamping: 0.01, // Default damping
    position: new CANNON.Vec3(0, 1, 0),
    dimensions: { length: 4.5, width: 2, height: 1.2 }
  };
  
  // Merge provided options with defaults
  const config = { ...defaultOptions, ...options };
  
  const chassisMaterial = new CANNON.Material('chassis');
  const { length, width, height } = config.dimensions;
  const chassisShape = new CANNON.Box(new CANNON.Vec3(length / 2, height / 2, width / 2));
  
  // 创建车身刚体, 使用 config 中的值
  const chassisBody = new CANNON.Body({
    mass: config.mass, // Use mass from config
    position: config.position,
    material: chassisMaterial,
    linearDamping: config.linearDamping, // Use linearDamping from config
    angularDamping: config.angularDamping // Use angularDamping from config
  });
  // Log the applied values
  console.log(`Vehicle Body Created - Mass: ${chassisBody.mass}, LinearDamping: ${chassisBody.linearDamping}, AngularDamping: ${chassisBody.angularDamping}`);
  
  chassisBody.addShape(chassisShape);
  world.addBody(chassisBody);
  
  return { chassisBody, chassisMaterial };
};

// 创建车轮
export const createWheel = (world, chassisBody, position, radius, options = {}) => {
  const defaultOptions = {
    mass: 30,
    material: new CANNON.Material('wheel')
  };
  
  const config = { ...defaultOptions, ...options };
  
  // 创建车轮形状
  const wheelShape = new CANNON.Sphere(radius);
  
  // 创建车轮刚体
  const wheelBody = new CANNON.Body({
    mass: config.mass,
    material: config.material
  });
  wheelBody.addShape(wheelShape);
  wheelBody.position.copy(chassisBody.position).vadd(position);
  world.addBody(wheelBody);
  
  // 创建约束
  const constraint = new CANNON.HingeConstraint(chassisBody, wheelBody, {
    pivotA: position,
    axisA: new CANNON.Vec3(1, 0, 0),
    pivotB: new CANNON.Vec3(0, 0, 0),
    axisB: new CANNON.Vec3(0, 1, 0)
  });
  world.addConstraint(constraint);
  
  return { wheelBody, constraint };
};

// 更新物理世界
export const updatePhysics = (world, deltaTime) => {
  const timeStep = 1/60;
  const maxSubSteps = 5;
  // 调用world.step并传入参数，可控制模拟精度和性能
  world.step(timeStep, deltaTime, maxSubSteps);
};

// 应用驾驶控制
export const applyDriveControls = (chassisBody, wheelBodies, controls) => {
  const { accelerate, brake, turnLeft, turnRight } = controls;
  
  let appliedForce = false;
  let appliedTorque = false;

  // 应用加速力
  if (accelerate) {
    const force = new CANNON.Vec3(0, 0, controls.power);
    const forcePoint = new CANNON.Vec3(0, -0.3, 0); 
    chassisBody.applyLocalForce(force, forcePoint); 
    appliedForce = true;
  }
  
  // 应用刹车/后退力
  if (brake) {
    const brakeForceVec = new CANNON.Vec3(0, 0, -controls.brakeForce);
    const brakePoint = new CANNON.Vec3(0, -0.3, 0);
    chassisBody.applyLocalForce(brakeForceVec, brakePoint);
    appliedForce = true;
  }
  
  // 应用转向
  const turnValue = (turnLeft ? 1 : 0) - (turnRight ? 1 : 0);
  if (turnValue !== 0) {
    const turnTorque = new CANNON.Vec3(0, controls.turnStrength * turnValue, 0); 
    chassisBody.applyTorque(turnTorque);
    appliedTorque = true;
  }
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