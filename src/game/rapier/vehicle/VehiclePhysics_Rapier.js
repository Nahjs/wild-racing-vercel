import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import RapierWorld from '@/core/physics/rapier/RapierWorld';
import { RapierRigidBodyFactory, RapierColliderFactory } from '@/core/physics/rapier/RapierRigidBodyFactory';
import { COLLISION_GROUPS } from '@/core/physics/rapier/shapes/RapierShapeFactory';
// 引入tuning默认参数
import { useTuningStore } from '@/store/tuning';

// 获取tuning默认参数
const tuningStore = useTuningStore();
const tuningDefaults = tuningStore.tuningParams;

// 默认车辆物理参数 (基于tuning默认值)
const defaultVehicleParams = {
  // 从tuning参数映射
  chassisMass: tuningDefaults.vehicleMass || 653, // kg
  chassisDimensions: { x: 2.5, y: 0.8, z: 4.5 }, // Meters
  chassisOffset: { x: 0, y: -0.4, z: 0 }, // 相对于模型原点的偏移
  wheelRadius: 0.34, // m
  wheelWidth: 0.2, // m (用于可视化和可能的未来碰撞)
  suspensionRestLength: tuningDefaults.suspensionRestLength || 0.4, // m
  suspensionStiffness: tuningDefaults.suspensionStiffness || 60, // N/m
  suspensionDamping: tuningDefaults.dampingRelaxation || 5, // Ns/m
  suspensionCompressionDamping: tuningDefaults.dampingCompression || 3, // Ns/m
  maxSuspensionTravel: tuningDefaults.maxSuspensionTravel || 0.2, // m
  maxSuspensionForce: tuningDefaults.maxSuspensionForce || 15000, // N
  frictionSlip: tuningDefaults.frictionSlip || 1.8, // 横向摩擦力系数
  maxSteeringAngle: Math.PI / 6, // 最大转向角 (30度)
  engineForce: tuningDefaults.enginePower || 1500, // N (最大引擎力)
  brakeForce: tuningDefaults.brakePower || 100, // N (每个轮子的刹车力)
  // 使用tuning中的车轮位置
  wheelPositions: tuningDefaults.connectionPoints || [
    { x: -0.85, y: -0.15, z: 1.4 }, // FL
    { x: 0.85, y: -0.15, z: 1.4 }, // FR
    { x: -0.85, y: -0.15, z: -1.4 }, // BL
    { x: 0.85, y: -0.15, z: -1.4 }  // BR
  ],
  // 阻尼参数
  downforceCoefficient: 0.3, // 下压力系数
  linearDamping: tuningDefaults.linearDamping || 0.1,
  angularDamping: tuningDefaults.angularDamping || 0.5,
  // 视觉偏移 (新增)
  visualOffsetY: tuningDefaults.visualOffsetY || 0.0, // 从 tuning 读取，默认为 0
  // 驱动类型参数
  driveType: tuningDefaults.driveType || 'RWD', // 默认为后轮驱动
  // 角度校正
  initialCorrectionAngle: (tuningDefaults.initialCorrectionAngle * Math.PI) / 180, // 转换为弧度
  // 其他参数
  autoAdjustWheelPositions: true,
  // 记录调试参数
  debugLog: true
};


/**
 * 基于Rapier引擎的车辆物理实现
 * 使用DynamicRayCastVehicleController实现更可靠的车辆物理
 */
export class VehiclePhysicsRapier {
  constructor(vehicleObject, params = {}) {
    this.vehicleObject = vehicleObject; // Three.js 车辆模型对象
    
    // 转换tuningParams为物理参数格式
    const physicsParams = this._convertTuningToPhysicsParams(params);
    this.params = { ...defaultVehicleParams, ...physicsParams };
    
    // 记录最终使用的参数
    if (this.params.debugLog) {
      console.log("[VehiclePhysicsRapier] 最终使用的物理参数:", this.params);
    }
    
    this.world = RapierWorld.world; // 获取已初始化的Rapier世界
    if (!this.world) {
      throw new Error("RapierWorld尚未初始化！");
    }
    
    this.rigidBody = null; // Rapier 刚体
    this.collider = null;  // Rapier 碰撞体 (主要用于底盘)
    this.controller = null; // Rapier 车辆控制器
    
    this.wheelsInfo = []; // 存储每个轮子的信息
    
    // 车辆控制状态
    this.steering = 0;
    this.throttle = 0;
    this.brake = 0;
    
    // 初始化车辆物理
    this._initialize();
  }
  
  /**
   * 将tuningStore参数转换为物理引擎所需的格式
   * @param {Object} tuningParams - 从tuningStore或customSettings获取的参数
   * @returns {Object} 物理引擎参数
   * @private
   */
  _convertTuningToPhysicsParams(tuningParams) {
    // 默认返回原始参数
    if (!tuningParams || typeof tuningParams !== 'object') {
      console.warn('[VehiclePhysicsRapier] 无效的调优参数，使用默认值');
      return {};
    }
    
    
    const physicsParams = {};
    
    // --- 转换质量 ---
    if (tuningParams.vehicleMass) {
      physicsParams.chassisMass = tuningParams.vehicleMass;
    }
    
    // --- 转换悬挂参数 ---
    if (tuningParams.suspensionStiffness) {
      physicsParams.suspensionStiffness = tuningParams.suspensionStiffness;
    }
    
    if (tuningParams.suspensionRestLength) {
      physicsParams.suspensionRestLength = tuningParams.suspensionRestLength;
    }
    
    if (tuningParams.dampingRelaxation) {
      physicsParams.suspensionDamping = tuningParams.dampingRelaxation;
    }
    
    if (tuningParams.dampingCompression) {
      physicsParams.suspensionCompressionDamping = tuningParams.dampingCompression;
    }
    
    if (tuningParams.maxSuspensionTravel) {
      physicsParams.maxSuspensionTravel = tuningParams.maxSuspensionTravel;
    }
    
    if (tuningParams.maxSuspensionForce) {
      physicsParams.maxSuspensionForce = tuningParams.maxSuspensionForce;
    }
    
    // --- 转换轮胎参数 ---
    if (tuningParams.frictionSlip) {
      physicsParams.frictionSlip = tuningParams.frictionSlip;
    }
    
    // --- 转换引擎参数 ---
    if (tuningParams.enginePower) {
      physicsParams.engineForce = tuningParams.enginePower;
    }
    
    // --- 转换制动参数 ---
    if (tuningParams.brakePower) {
      physicsParams.brakeForce = tuningParams.brakePower;
    }
    
    // --- 转换阻尼参数 ---
    if (tuningParams.linearDamping) {
      physicsParams.linearDamping = tuningParams.linearDamping;
    }
    
    if (tuningParams.angularDamping) {
      physicsParams.angularDamping = tuningParams.angularDamping;
    }
    
    // --- 转换初始角度修正 ---
    if (tuningParams.initialCorrectionAngle !== undefined) {
      // 将角度从度转换为弧度
      physicsParams.initialCorrectionAngle = (tuningParams.initialCorrectionAngle * Math.PI) / 180;
    }
    
    // --- 转换车轮位置 ---
    if (tuningParams.connectionPoints && Array.isArray(tuningParams.connectionPoints) && tuningParams.connectionPoints.length >= 4) {
      physicsParams.wheelPositions = tuningParams.connectionPoints;
    }
    
    // --- 转换视觉偏移 --- 
    if (tuningParams.visualOffsetY !== undefined) {
      physicsParams.visualOffsetY = tuningParams.visualOffsetY;
    }
    
    return physicsParams;
  }
  
  /**
   * 初始化车辆物理
   * @private
   */
  _initialize() {
    // 在创建刚体前纠正车身朝向和调整高度
    this._correctVehicleOrientation();
    this._adjustVehicleHeight(); // 确保在获取最终位置前调整高度
    
    // 1. 创建底盘刚体 - 使用正确的API
    // 在Rapier 0.16.0中，推荐使用RigidBodyDesc.dynamic()而不是createDynamicBodyDesc
    let chassisDesc;
    const initialPosition = {
        x: this.vehicleObject.position.x + this.params.chassisOffset.x,
        y: this.vehicleObject.position.y + this.params.chassisOffset.y, // 使用调整后的模型Y + 偏移
        z: this.vehicleObject.position.z + this.params.chassisOffset.z
    };
    const initialRotation = {
        x: this.vehicleObject.quaternion.x,
        y: this.vehicleObject.quaternion.y,
        z: this.vehicleObject.quaternion.z,
        w: this.vehicleObject.quaternion.w
    };

    if (typeof RAPIER.RigidBodyDesc?.dynamic === 'function') {
      // 使用新的API格式
      chassisDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(initialPosition.x, initialPosition.y, initialPosition.z)
        .setRotation(initialRotation);
        
      // 设置阻尼
      chassisDesc.setLinearDamping(this.params.linearDamping || 0.1)
                 .setAngularDamping(this.params.angularDamping || 0.5);
      
      // 启用CCD
      chassisDesc.setCcdEnabled(true);
    } else {
      // 使用旧的API（通过RapierRigidBodyFactory） - 确保传递正确参数
      chassisDesc = RapierRigidBodyFactory.createDynamicBodyDesc({
        position: new THREE.Vector3(initialPosition.x, initialPosition.y, initialPosition.z),
        rotation: new THREE.Quaternion(initialRotation.x, initialRotation.y, initialRotation.z, initialRotation.w),
        linearDamping: this.params.linearDamping || 0.1,
        angularDamping: this.params.angularDamping || 0.5,
        enableCcd: true // 高速运动，启用CCD
      });
    }
    
    this.rigidBody = this.world.createRigidBody(chassisDesc);
    
    // 确保初始速度为零
    this.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // 2. ★★★ 恢复创建底盘碰撞体 ★★★
    let chassisColliderDesc;
    if (typeof RAPIER.ColliderDesc?.cuboid === 'function') {
      // 使用新的API格式
      chassisColliderDesc = RAPIER.ColliderDesc.cuboid(
        this.params.chassisDimensions.x * 0.5,
        this.params.chassisDimensions.y * 0.5,
        this.params.chassisDimensions.z * 0.5
      );
      chassisColliderDesc.setMass(this.params.chassisMass);
      const membership = COLLISION_GROUPS.VEHICLE;
      const filter = COLLISION_GROUPS.GROUND | COLLISION_GROUPS.RAIL | COLLISION_GROUPS.ALL;
      chassisColliderDesc.setCollisionGroups((membership << 16) | filter);
      console.log(`[VehiclePhysicsRapier] Configured Chassis Collision Group: Membership=${membership}, Filter=${filter.toString(2)}`);
    } 
    
    this.collider = this.world.createCollider(chassisColliderDesc, this.rigidBody);
    if (this.collider) { 
        this.collider.userData = { type: 'vehicle', objectId: this.vehicleObject.id };
        console.log("[VehiclePhysicsRapier] 底盘碰撞体已创建并恢复。");
    } else {
        console.error("[VehiclePhysicsRapier] 创建底盘碰撞体失败！");
        // Consider if returning here is still appropriate
    }
    // ★★★ 结束恢复 ★★★
    
    // 3. 创建DynamicRayCastVehicleController
    try {
      // 在 Rapier 0.16.0 中，DynamicRayCastVehicleController 构造函数需要4个参数
      if (!RAPIER.DynamicRayCastVehicleController) {
        console.error("[VehiclePhysicsRapier] 当前 Rapier 版本不包含 DynamicRayCastVehicleController，回退到基础实现");
        throw new Error("DynamicRayCastVehicleController not available");
      }
      
      // --- ★★★ 强制使用构造函数创建控制器 ★★★ ---
      console.log("[VehiclePhysicsRapier] 强制使用完整构造函数创建控制器...");
      if (this.world && this.world.bodies && this.world.colliders && this.world.queryPipeline) {
          this.controller = new RAPIER.DynamicRayCastVehicleController(
            this.rigidBody,
            this.world.bodies,
            this.world.colliders,
            this.world.queryPipeline
          );
          console.log("[VehiclePhysicsRapier] 已尝试通过完整构造函数创建控制器。");
      } else {
          console.error("[VehiclePhysicsRapier] FATAL: 无法获取创建控制器所需的世界组件 (bodies, colliders, queryPipeline)!");
          throw new Error("缺少用于车辆控制器构造函数的世界组件");
      }
      // --- ★★★ 结束强制构造函数 ★★★ ---

      // 检查控制器是否成功创建 (现有日志)
      if (this.controller) {
        console.log("[VehiclePhysicsRapier] 车辆控制器对象创建成功 (尝试使用构造函数):", this.controller);
      } else {
        console.error("[VehiclePhysicsRapier] FATAL: 车辆控制器对象创建失败！(尝试使用构造函数)");
        throw new Error("Failed to create vehicle controller object using constructor."); 
      }

      // ★★★ 重置初始控制状态 ★★★
      this.steering = 0;
      this.throttle = 0;
      this.brake = 0;
      console.log("[VehiclePhysicsRapier] 初始控制状态已重置为0");
      
      // 4. 配置车轮
      this.params.wheelPositions.forEach((pos, index) => {
        const isFrontWheel = index < 2;
        
        try {
          // 创建轮子连接点 - 确保使用正确的Vector类
          const chassisConnectionPoint = new RAPIER.Vector3(pos.x, pos.y, pos.z);
          // 轮子的悬挂方向 (向下)
          const wheelDirection = new RAPIER.Vector3(0, -1, 0);
          // 轮子的侧向轴
          const wheelAxle = new RAPIER.Vector3(1, 0, 0);
          
          // ★★★ 添加详细参数日志 ★★★
          console.log(`[VehiclePhysicsRapier] Attempting addWheel for visual index ${index} with params:`);
          console.log(`  -> chassisConnectionPoint: { x: ${chassisConnectionPoint.x}, y: ${chassisConnectionPoint.y}, z: ${chassisConnectionPoint.z} } (Type: ${chassisConnectionPoint?.constructor?.name})`);
          console.log(`  -> wheelDirection: { x: ${wheelDirection.x}, y: ${wheelDirection.y}, z: ${wheelDirection.z} } (Type: ${wheelDirection?.constructor?.name})`);
          console.log(`  -> wheelAxle: { x: ${wheelAxle.x}, y: ${wheelAxle.y}, z: ${wheelAxle.z} } (Type: ${wheelAxle?.constructor?.name})`);
          console.log(`  -> suspensionRestLength: ${this.params.suspensionRestLength} (Type: ${typeof this.params.suspensionRestLength})`);
          console.log(`  -> wheelRadius: ${this.params.wheelRadius} (Type: ${typeof this.params.wheelRadius})`);
          // ★★★ 结束详细参数日志 ★★★

          // ★★★ 直接调用 addWheel，不期待返回值 ★★★
          if (typeof this.controller.addWheel === 'function') {
              this.controller.addWheel(
                  chassisConnectionPoint,
                  wheelDirection,
                  wheelAxle,
                  this.params.suspensionRestLength,
                  this.params.wheelRadius
              );
              console.log(`[VehiclePhysicsRapier] Attempted to add wheel for visual index ${index}.`);

              // ★★★ 使用循环的 'index' 来配置轮子参数 ★★★
              try {
                  console.log(`[VehiclePhysicsRapier] Configuring wheel with index ${index}.`);
                  this.controller.setWheelSuspensionStiffness(index, this.params.suspensionStiffness);
                  this.controller.setWheelSuspensionRelaxation(index, this.params.suspensionDamping);
                  this.controller.setWheelSuspensionCompression(index, this.params.suspensionCompressionDamping);
                  this.controller.setWheelMaxSuspensionTravel(index, this.params.maxSuspensionTravel);
                  this.controller.setWheelMaxSuspensionForce(index, this.params.maxSuspensionForce);
                  this.controller.setWheelFrictionSlip(index, this.params.frictionSlip);
                  console.log(`[VehiclePhysicsRapier] 设置轮子 #${index} 摩擦力: ${this.params.frictionSlip.toFixed(2)}`);
                  if (typeof this.controller.setWheelSideFrictionStiffness === 'function') {
                      this.controller.setWheelSideFrictionStiffness(index, 1.0);
                  }
              } catch (error) {
                  console.warn(`[VehiclePhysicsRapier] 配置轮子参数失败 (Index: ${index}): ${error.message}`);
              }
              // ★★★ 结束使用循环 'index' ★★★

          } else { 
            console.error("[VehiclePhysicsRapier] 当前 Rapier 版本不支持添加轮子");
            throw new Error("addWheel method not available");
          }
          
          // ★★★ 存储正确的循环 'index' ★★★
          this.wheelsInfo.push({
            position: new THREE.Vector3(pos.x, pos.y, pos.z), 
            worldPosition: new THREE.Vector3(), 
            worldRotation: new THREE.Quaternion(), 
            radius: this.params.wheelRadius,
            width: this.params.wheelWidth,
            index: index, // Store the loop index (0, 1, 2, 3)
            isFrontWheel: isFrontWheel,
            isInContact: false 
          });
          // ★★★ 结束存储 'index' ★★★

        } catch (error) {
          console.error(`[VehiclePhysicsRapier] 添加或配置轮子失败 (visual index ${index}): ${error.message}`);
        }
      });
      
      // 不需要将控制器添加到物理世界，DynamicRayCastVehicleController在构造时已经接收了必要的引用
      console.log(`[VehiclePhysicsRapier] 车辆控制器创建成功，添加了 ${this.wheelsInfo.length} 个车轮`);
    } catch (error) {
      console.error(`[VehiclePhysicsRapier] 创建车辆控制器时捕获到错误:`, error);
      // 重新抛出错误，确保上层知道初始化失败
      throw error;
    }
    
    console.log(`[VehiclePhysicsRapier] 车辆初始化完成 (RigidBody Handle: ${this.rigidBody.handle})`);
  }
  
  /**
   * 自动调整车辆高度，确保在地面上
   * @private
   */
  _adjustVehicleHeight() {
    // 简化：直接设置一个略高于地面的初始Y值
    // 假设地面在Y=0附近
    // ★★★ 提高目标初始高度 ★★★
    const targetInitialY = 3.2; // 之前是 0.8，增加到 3.2，给悬挂更多空间
    
    // 计算偏移量
    const offsetY = targetInitialY - this.vehicleObject.position.y;

    // 只有当偏移量显著时才进行调整
    if (Math.abs(offsetY) > 0.05) {
      console.log(`[VehiclePhysicsRapier] 调整车辆初始高度: 原始Y: ${this.vehicleObject.position.y.toFixed(2)}, 目标Y: ${targetInitialY.toFixed(2)}, 偏移: ${offsetY.toFixed(2)}`);
      
      // 调整车辆模型位置
      this.vehicleObject.position.y += offsetY;
      
      console.log(`[VehiclePhysicsRapier] 车辆初始位置已调整，新的Y位置: ${this.vehicleObject.position.y.toFixed(2)}`);
    } else {
        console.log(`[VehiclePhysicsRapier] 车辆初始高度 (${this.vehicleObject.position.y.toFixed(2)}) 接近目标值 (${targetInitialY.toFixed(2)})，无需调整。`);
    }
  }
  
  /**
   * 纠正车辆的初始朝向
   * @private
   */
  _correctVehicleOrientation() {
    // ★★★ 恢复 +90 度旋转 ★★★
    const targetCorrectionAngle = Math.PI / 2; // +90 degrees
    
    console.log(`[VehiclePhysicsRapier] 应用初始朝向修正: ${targetCorrectionAngle} 弧度`);
    
    // 设置模型和物理方向正确
    const forward = new THREE.Vector3(0, 0, 1); // Z 轴正向为车辆前进方向
    const tempVector = new THREE.Vector3();
    
    // 应用当前旋转到前进向量，检查车辆面向
    tempVector.copy(forward).applyQuaternion(this.vehicleObject.quaternion);
    console.log("[VehiclePhysicsRapier] 车辆前进方向矢量:", tempVector);
    
    // 检查车轮位置是否合理
    const boundingBox = new THREE.Box3().setFromObject(this.vehicleObject);
    const modelSize = boundingBox.getSize(new THREE.Vector3());
    
    console.log("[VehiclePhysicsRapier] 车辆模型尺寸:", modelSize);
    
    // 根据模型大小自动调整车轮位置
    if (this.params.autoAdjustWheelPositions !== false) {
      const wheelBase = modelSize.z * 0.7; // 轴距约为车长的70%
      const trackWidth = modelSize.x * 0.8; // 轮距约为车宽的80%
      
      // 只有当车轮位置明显不合理时才自动调整
      if (
        Math.abs(this.params.wheelPositions[0].z - this.params.wheelPositions[2].z) < wheelBase * 0.5 ||
        Math.abs(this.params.wheelPositions[0].x - this.params.wheelPositions[1].x) < trackWidth * 0.5
      ) {
        console.log("[VehiclePhysicsRapier] 自动调整车轮位置");
        
        // 计算前轮和后轮的Z位置 (前后)
        const frontZ = modelSize.z * 0.35; // 前轮位于车身前部35%处
        const rearZ = -modelSize.z * 0.35; // 后轮位于车身后部35%处
        
        // 计算左轮和右轮的X位置 (左右)
        const leftX = -modelSize.x * 0.4; // 左轮位于车身左侧40%处
        const rightX = modelSize.x * 0.4; // 右轮位于车身右侧40%处
        
        // 更新车轮位置
        this.params.wheelPositions = [
          { x: leftX, y: 0, z: frontZ },   // 左前轮
          { x: rightX, y: 0, z: frontZ },  // 右前轮
          { x: leftX, y: 0, z: rearZ },    // 左后轮
          { x: rightX, y: 0, z: rearZ }    // 右后轮
        ];
        
        console.log("[VehiclePhysicsRapier] 调整后的车轮位置:", this.params.wheelPositions);
      }
    }
    
    console.log("[VehiclePhysicsRapier] 修正后的车辆朝向:", {
      targetCorrectionAngle: targetCorrectionAngle.toFixed(3),
      currentRotation: this.vehicleObject.quaternion.w.toFixed(3)
    });
    
    // 设置模型和物理方向正确
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 0), targetCorrectionAngle);
    
    // ★★★ 强制旋转 ★★★
     this.vehicleObject.quaternion.multiply(targetQuat); 
  }
  
  /**
   * 更新车辆控制状态
   * @param {object} controls - 控制输入 { steering, throttle, brake }
   */
  updateControls(controls) {
    this.steering = controls.steering || 0;
    this.throttle = controls.throttle || 0;
    this.brake = controls.brake || 0;
  }
  
  /**
   * 更新物理状态 (每帧调用)
   * @param {number} deltaTime - 时间步长
   */
  update(deltaTime) {
    if (!this.rigidBody || !this.controller) return;
    
    try {
      // 将控制输入应用到车辆控制器
      this.wheelsInfo.forEach((wheel) => {
        try {
            // ★★★ 确保只对有效索引的轮子操作 ★★★
            if (wheel.index === undefined) {
                // console.warn(`[PhysicsUpdate] Skipping wheel with undefined index.`); // Optional log
                return; // 跳过这个无效的轮子
            }

            // 设置转向 (仅前轮)
            if (wheel.isFrontWheel && typeof this.controller.setWheelSteering === 'function') {
                // ★★★ 反转转向角度的符号 ★★★
                const steeringAngle = -this.steering * this.params.maxSteeringAngle;   
              this.controller.setWheelSteering(wheel.index, steeringAngle);
            }
            
            // 设置驱动力 (处理正负油门)
            if (typeof this.controller.setWheelEngineForce === 'function') {
                if (this.throttle !== 0) {
                    const driveType = this.params.driveType || 'RWD';
                    let applyForce = false;
                    if (driveType === 'RWD' && !wheel.isFrontWheel) applyForce = true;
                    else if (driveType === 'FWD' && wheel.isFrontWheel) applyForce = true;
                    else if (driveType === 'AWD') applyForce = true;

                    if (applyForce) {
                        const wheelCount = driveType === 'AWD' ? 4 : 2;
                        // 修复后退问题：确保throttle正负值正确应用
                        // 正throttle（前进）应用负力，负throttle（后退）应用正力
                        const calculatedForce = -this.throttle * this.params.engineForce / wheelCount; 
                        this.controller.setWheelEngineForce(wheel.index, calculatedForce);
                        
                        // 记录应用的驱动力方向用于调试
                        if (Math.abs(calculatedForce) > 1.0) {
                            wheel.lastAppliedForce = calculatedForce;
                        }
                    } else {
                        this.controller.setWheelEngineForce(wheel.index, 0);
                    }
                } else {
                    this.controller.setWheelEngineForce(wheel.index, 0);
                }
            }
            
            // 设置刹车力 (基于刹车输入)
            if (typeof this.controller.setWheelBrake === 'function') {
                 const brakeForceValue = this.brake * this.params.brakeForce;
                 // ★★★ 移除刹车力测试日志或减少频率 ★★★
                 // if (brakeForceValue > 0) { console.log(...) }
                 this.controller.setWheelBrake(wheel.index, brakeForceValue);
            }
        } catch (error) {
            console.warn(`[VehiclePhysicsRapier] 设置轮子参数失败 (index ${wheel.index}):`, error);
        }
      });
      
      // 更新车辆控制器 (内部执行射线检测、计算悬挂和轮胎力等)
      this.controller.updateVehicle(deltaTime);
      // ★★★ 添加日志确认 updateVehicle 执行 ★★★
      // console.log("[VehiclePhysicsRapier] controller.updateVehicle executed."); 
      
      // 检查和记录每个车轮的悬挂状态
      this.wheelsInfo.forEach((wheel, index) => {
        try {
          // 尝试获取悬挂长度和力
          const suspensionLength = typeof this.controller.wheelSuspensionLength === 'function'
                                 ? this.controller.wheelSuspensionLength(wheel.index)
                                 : null;
          const suspensionForce = typeof this.controller.wheelSuspensionForce === 'function'
                                ? this.controller.wheelSuspensionForce(wheel.index)
                                : null;
                                
          // 推断接触状态：如果悬挂被压缩或有力施加，则认为接触
          // 注意：这可能不完全准确，但比调用不存在的函数要好
          wheel.isInContact = (suspensionLength !== null && suspensionLength < this.params.suspensionRestLength - 0.01) || 
                            (suspensionForce !== null && suspensionForce > 1.0);
        } catch (e) {
          console.warn(`[VehiclePhysicsRapier] Error getting wheel ${index} state: ${e.message}`);
          wheel.isInContact = false; // 发生错误时假定未接触
        }
      });
      
      // 更新轮子的世界位置和旋转
      this._updateWheelsTransform(deltaTime);
      
      // 应用下压力 (防止高速飞行)
      this._applyDownforce();
    } catch (error) {
      console.error("[VehiclePhysicsRapier] 更新车辆物理时出错:", error);
    }
  }
  
  /**
   * 更新轮子的世界变换
   * @private
   * @param {number} deltaTime - 时间步长
   */
  _updateWheelsTransform(deltaTime) {
    if (!this.controller) return;
    
    this.wheelsInfo.forEach((wheel) => {
      try {
        // 获取轮子的世界位置
        // 根据API使用正确的方法名
        let hardPointUpdated = false;
        
        if (typeof this.controller.wheelHardPoint === 'function') {
          // 正确的API方法名是wheelHardPoint (没有get前缀)
          const hardPoint = this.controller.wheelHardPoint(wheel.index);
          if (hardPoint) {
            wheel.worldPosition.set(hardPoint.x, hardPoint.y, hardPoint.z);
            hardPointUpdated = true;
          }
        } else if (typeof this.controller.getWheelHardpointWorld === 'function') {
          // 尝试旧的 API 名称
          const hardPoint = this.controller.getWheelHardpointWorld(wheel.index);
          if (hardPoint) {
            wheel.worldPosition.set(hardPoint.x, hardPoint.y, hardPoint.z);
            hardPointUpdated = true;
          }
        }
        
        // 如果无法通过 API 获取位置，则使用刚体位置 + 轮子相对位置
        if (!hardPointUpdated) {
          const bodyPosition = this.rigidBody.translation();
          const bodyRotation = this.rigidBody.rotation();
          const bodyQuat = new THREE.Quaternion(
            bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w
          );
          
          // 计算轮子世界位置
          const wheelPos = new THREE.Vector3(wheel.position.x, wheel.position.y, wheel.position.z);
          wheelPos.applyQuaternion(bodyQuat);
          wheel.worldPosition.set(
            bodyPosition.x + wheelPos.x,
            bodyPosition.y + wheelPos.y,
            bodyPosition.z + wheelPos.z
          );
        }
        
        // 获取轮子的旋转
        const chassisRotation = this.rigidBody.rotation();
        
        // 创建底盘的四元数
        const chassisQuat = new THREE.Quaternion(
          chassisRotation.x, 
          chassisRotation.y, 
          chassisRotation.z, 
          chassisRotation.w
        );
        
        // 组合旋转
        wheel.worldRotation.copy(chassisQuat);
        
        // 如果有转向和旋转角度，应用到四元数
        let steeringAngle = 0;
        let rotationAngle = 0;

        // 获取转向角 - 使用正确的API方法名
        if (typeof this.controller.wheelSteering === 'function') {
          steeringAngle = this.controller.wheelSteering(wheel.index);
        } else if (typeof this.controller.getWheelSteering === 'function') {
          steeringAngle = this.controller.getWheelSteering(wheel.index);
        }

        // 获取轮子自转角度 - 使用正确的API方法名，并手动计算轮子旋转角度
        if (typeof this.controller.wheelRotation === 'function') {
          rotationAngle = this.controller.wheelRotation(wheel.index);
        } else if (typeof this.controller.getWheelRotation === 'function') {
          rotationAngle = this.controller.getWheelRotation(wheel.index);
        }

        // 手动计算轮子旋转角度 - 更真实的车轮旋转动画
        // 1. 判断车轮是否接触地面
        const isGrounded = wheel.isInContact || false;

        // 2. 获取车辆线性速度和角速度
        const velocity = this.rigidBody.linvel();
        const angVelocity = this.rigidBody.angvel();

        // 3. 创建刚体到车轮的变换矩阵
        const bodyToWheelMatrix = new THREE.Matrix4().makeRotationFromQuaternion(
          new THREE.Quaternion().copy(chassisQuat).invert()
        );
        if (steeringAngle !== 0) {
          bodyToWheelMatrix.multiply(
            new THREE.Matrix4().makeRotationY(steeringAngle)
          );
        }

        // 4. 将车辆速度转换到车轮局部坐标系
        const localVel = new THREE.Vector3(velocity.x, velocity.y, velocity.z)
          .applyMatrix4(bodyToWheelMatrix);

        // 5. 计算车轮在其轴向上的角速度贡献
        const angVelContribution = new THREE.Vector3(angVelocity.x, angVelocity.y, angVelocity.z)
          .applyMatrix4(bodyToWheelMatrix);

        // 6. 获取车轮参数
        const wheelRadius = wheel.radius || this.params.wheelRadius;
        const frictionSlip = this.params.frictionSlip || 1.8;

        // 7. 计算真实的轮子旋转速度 (考虑接地状态和滑动)
        let rotationSpeed = 0;

        if (isGrounded) {
          // 接地时：
          // a. 计算基于车辆前进速度的理想旋转速度
          // 注意符号：localVel.z 为正表示向后移动，为负表示向前移动
          // 当向前移动时，轮子应该向前滚动(正旋转)
          // 当向后移动时，轮子应该向后滚动(负旋转)
          const idealRotationSpeed = localVel.z / wheelRadius; // 修正符号，确保方向正确
          
          // b. 计算基于角速度的附加旋转
          const angularContribution = angVelContribution.x;
          
          // c. 计算打滑因子 (根据侧向速度和油门/刹车状态)
          const slipRatio = Math.min(Math.abs(localVel.x) / (Math.abs(localVel.z) + 0.01), 1.0);
          const brakeFactor = this.brake > 0.1 ? Math.min(this.brake * 2, 1.0) : 0;
          const throttleFactor = Math.abs(this.throttle) > 0.8 ? 0.2 : 0;
          
          // d. 打滑时减少轮子转速 (模拟轮胎打滑)
          const slipFactor = Math.max(slipRatio * 0.8, brakeFactor, throttleFactor);
          
          // e. 结合所有因素计算最终旋转速度
          rotationSpeed = idealRotationSpeed * (1.0 - slipFactor) + angularContribution;

        } else {
          // 空中时：
          // 如果车轮离地，仅考虑发动机力的影响，缓慢减速
          if (wheel.rotationSpeed) {
            // 模拟空气阻力，缓慢减速
            rotationSpeed = wheel.rotationSpeed * 0.98;
          } else if (this.throttle !== 0) {
            // 油门踩下且车轮离地时，模拟发动机影响
            // 修改：确保方向与油门保持一致
            rotationSpeed = this.throttle * 5.0; // 修正符号
          }
        }

        // 8. 存储当前旋转速度用于下次参考
        wheel.rotationSpeed = rotationSpeed;

        // 9. 累积角度增量 (添加平滑因子)
        if (!wheel.rotationAngle) wheel.rotationAngle = 0;
        wheel.rotationAngle += rotationSpeed * deltaTime;

        // 10. 使用计算的旋转角度
        rotationAngle = wheel.rotationAngle;

        // 应用转向
        if (steeringAngle !== 0) {
          const steeringQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            steeringAngle
          );
          wheel.worldRotation.multiply(steeringQuat);
        }

        // 应用轮子自转
        if (rotationAngle !== 0) {
          const rotationQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            rotationAngle
          );
          wheel.worldRotation.multiply(rotationQuat);
        }
      } catch (error) {
        console.warn(`[VehiclePhysicsRapier] 更新轮子变换失败:`, error);
      }
    });
  }
  
  /**
   * 应用下压力 (可选功能，防止车辆在高速时飞起)
   * @private
   */
  _applyDownforce() {
    if (!this.rigidBody) return;

    // 获取线性速度 - 这个API没有变化
    const velocity = this.rigidBody.linvel();
    const speedSquared = velocity.x**2 + velocity.z**2; // 只考虑水平面速度

    // 只有在速度较高时才应用下压力
    if (speedSquared > 100) { // 阈值可调整
      // 计算下压力大小 
      const downforceMagnitude = speedSquared * this.params.downforceCoefficient;
      
      // 使用正确的API添加力 - 确保参数格式正确
      // addForce(force: Vector, wakeUp: boolean)
      this.rigidBody.addForce(
        { x: 0, y: -downforceMagnitude, z: 0 }, 
        true // 是否唤醒刚体
      );
    }
  }

  /**
   * 将物理状态同步到Three.js模型
   */
  syncVisuals() {
    if (!this.rigidBody || !this.vehicleObject) return;
    
    // 获取位置和旋转
    const position = this.rigidBody.translation();
    const rotation = this.rigidBody.rotation(); // Rapier Quaternion {x, y, z, w}
    
    // ★★★ 创建 Three.js 四元数用于变换 ★★★
    const bodyQuaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

    // 计算总的本地视觉偏移向量 (Y 轴合并 chassisOffset.y 和 visualOffsetY)
    const visualOffsetY = this.params.visualOffsetY || 0.0;
    const totalVisualOffsetY = this.params.chassisOffset.y + visualOffsetY;
    const localVisualOffset = new THREE.Vector3(
        this.params.chassisOffset.x, 
        totalVisualOffsetY, 
        this.params.chassisOffset.z
    );

    // ★★★ 将本地偏移向量根据刚体旋转转换到世界坐标 ★★★
    const worldVisualOffset = localVisualOffset.clone().applyQuaternion(bodyQuaternion);

    // ★★★ 从刚体世界位置减去旋转后的世界偏移向量 ★★★
    const visualPosition = new THREE.Vector3(position.x, position.y, position.z)
                                        .sub(worldVisualOffset); 
    
    // 更新Three.js对象位置
    this.vehicleObject.position.copy(visualPosition);
    
    // 更新Three.js对象旋转 (直接使用物理引擎的旋转)
    this.vehicleObject.quaternion.copy(bodyQuaternion); // 直接复制已创建的Three.js四元数
  }
  
  /**
   * 清理资源
   */
  dispose() {
    if (this.controller) {
      try {
        // 释放控制器资源 - 正确的API方法是free
        if (typeof this.controller.free === 'function') {
          this.controller.free();
        } else if (typeof this.controller.delete === 'function') {
          this.controller.delete();
        } else if (typeof this.controller.dispose === 'function') {
          this.controller.dispose();
        }
      } catch (error) {
        console.warn("[VehiclePhysicsRapier] 释放车辆控制器资源时出错:", error);
      } finally {
        this.controller = null;
      }
    }
    
    if (this.rigidBody) {
      try {
      this.world.removeRigidBody(this.rigidBody);
      } catch (error) {
        console.warn("[VehiclePhysicsRapier] 移除刚体时出错:", error);
      } finally {
      this.rigidBody = null;
      this.collider = null; // 碰撞体随刚体移除
    }
    }
    
    this.wheelsInfo = [];
  }
} 