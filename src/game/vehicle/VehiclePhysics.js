import * as CANNON from 'cannon-es';

// 定义碰撞组
const GROUPS = {
  GROUND: 1,
  VEHICLE: 2,
  RAIL: 4,
  CHECKPOINT: 8,
  ALL: -1
};

// 创建车辆主体
export const createVehicleChassis = (world, options = {}) => {
  const defaultOptions = {
    mass: 100, // Default mass
    linearDamping: 0.01, // Default damping
    angularDamping: 0.01, // Default damping
    position: new CANNON.Vec3(0, 1 , 0),
    dimensions: { length: 4.5, width: 2.0, height: 1.2 }
  };

  // Merge provided options with defaults
  const config = { ...defaultOptions, ...options };

  const chassisMaterial = new CANNON.Material('chassis');
  const { length, width, height } = config.dimensions;
  const chassisShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, length / 2));

  // 创建车身刚体, 使用 config 中的值
  const chassisBody = new CANNON.Body({
    mass: config.mass, // Use mass from config
    position: config.position,
    material: chassisMaterial,
    linearDamping: config.linearDamping, // Use linearDamping from config
    angularDamping: config.angularDamping, // Use angularDamping from config
    quaternion: config.quaternion || new CANNON.Quaternion(), // Apply initial quaternion
    collisionFilterGroup: GROUPS.VEHICLE, // 设置车辆碰撞组
    collisionFilterMask: GROUPS.GROUND | GROUPS.RAIL | GROUPS.CHECKPOINT // 设置车辆碰撞掩码 (与地面、护栏、检查点碰撞)
  });
  chassisBody.addShape(chassisShape);
  world.addBody(chassisBody);

  // 只返回 Body 和 Material
  return { chassisBody, chassisMaterial };
}; 