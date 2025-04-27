import * as CANNON from 'cannon-es';

/**
 * 碰撞管理器 - 负责管理所有碰撞事件和回调
 * 采用事件驱动模式，降低系统耦合度
 */
class CollisionManager {
  constructor(world) {
    // 物理世界引用
    this.world = world;
    
    // 碰撞回调映射表 - 按碰撞对象类型分类存储
    this.collisionHandlers = new Map();
    
    // 已注册的碰撞事件监听器
    this.registeredListeners = new Set();
    
    // 碰撞历史记录 - 用于防止重复触发
    this.collisionHistory = new Map();
    
    // 碰撞冷却时间 (毫秒)
    this.collisionCooldown = 500;

    // 碰撞类型定义
    this.collisionTypes = {
      RAIL: 'rail',      // 护栏/围栏
      WALL: 'wall',      // 墙壁
      VEHICLE: 'vehicle', // 车辆
      CHECKPOINT: 'checkpoint', // 检查点
      TERRAIN: 'terrain', // 地形
      OBJECT: 'object'   // 其它物体
    };
    
    // 启动碰撞监听
    this._setupCollisionEvents();
  }

  /**
   * 设置碰撞事件监听
   * @private
   */
  _setupCollisionEvents() {
    // 添加碰撞开始事件监听
    this.world.addEventListener('beginContact', (event) => {
      this._handleCollision(event, 'begin');
    });
    
    // 添加碰撞结束事件监听
    this.world.addEventListener('endContact', (event) => {
      this._handleCollision(event, 'end');
    });
  }

  /**
   * 处理碰撞事件
   * @param {Object} event - Cannon.js碰撞事件对象
   * @param {String} phase - 碰撞阶段 (begin/end)
   * @private
   */
  _handleCollision(event, phase) {
    const bodyA = event.bodyA;
    const bodyB = event.bodyB;
    
    // 跳过没有关联游戏对象的碰撞体
    if (!bodyA.userData || !bodyB.userData) return;
    
    // 获取碰撞对象的类型
    const typeA = bodyA.userData.type;
    const typeB = bodyB.userData.type;
    
    // ---> 新增日志 <-----
    console.log(`[CollisionManager] Handling collision (${phase}) between Body ${bodyA.id} (Type: ${typeA || 'none'}) and Body ${bodyB.id} (Type: ${typeB || 'none'})`);
    // ---> 结束新增日志 <-----
    
    // 如果两个物体都没有类型，跳过处理
    if (!typeA && !typeB) return;
    
    // 创建碰撞事件对象
    const collisionEvent = {
      bodyA,
      bodyB,
      contact: event.contact,
      phase,
      timestamp: Date.now()
    };
    
    // 防止短时间内重复触发同一对象的碰撞
    const collisionPairId = `${bodyA.id}-${bodyB.id}`;
    if (phase === 'begin') {
      const lastCollisionTime = this.collisionHistory.get(collisionPairId);
      const currentTime = Date.now();
      
      if (lastCollisionTime && (currentTime - lastCollisionTime < this.collisionCooldown)) {
        return; // 冷却期内，忽略碰撞
      }
      
      this.collisionHistory.set(collisionPairId, currentTime);
    }
    
    // 分发碰撞事件到注册的处理器
    this._dispatchCollisionEvent(typeA, typeB, collisionEvent);
  }

  /**
   * 分发碰撞事件到对应的处理器
   * @param {String} typeA - 第一个碰撞体类型
   * @param {String} typeB - 第二个碰撞体类型
   * @param {Object} event - 碰撞事件对象
   * @private
   */
  _dispatchCollisionEvent(typeA, typeB, event) {
    // 尝试按两种组合查找处理器
    const handlerKey1 = `${typeA}-${typeB}`;
    const handlerKey2 = `${typeB}-${typeA}`;
    
    // 获取对应的碰撞处理器
    const handlers1 = this.collisionHandlers.get(handlerKey1) || [];
    const handlers2 = this.collisionHandlers.get(handlerKey2) || [];
    
    // ---> 新增日志 <-----
    const totalHandlers = handlers1.length + handlers2.length;
    if (totalHandlers > 0) {
      console.log(`[CollisionManager] Dispatching collision event for ${handlerKey1} / ${handlerKey2}. Found ${totalHandlers} specific handler(s). Phase: ${event.phase}`);
    }
    // ---> 结束新增日志 <-----
    
    // 调用所有注册的处理器
    [...handlers1, ...handlers2].forEach(handler => {
      handler(event);
    });
    
    // 全局碰撞处理器
    const globalHandlers = this.collisionHandlers.get('global') || [];
    globalHandlers.forEach(handler => {
      handler(event);
    });
  }

  /**
   * 注册碰撞事件处理器
   * @param {String} typeA - 第一个碰撞体类型
   * @param {String} typeB - 第二个碰撞体类型
   * @param {Function} handler - 碰撞处理回调函数
   * @returns {Function} 用于移除处理器的函数
   */
  registerCollisionHandler(typeA, typeB, handler) {
    const handlerKey = `${typeA}-${typeB}`;
    
    if (!this.collisionHandlers.has(handlerKey)) {
      this.collisionHandlers.set(handlerKey, []);
    }
    
    const handlers = this.collisionHandlers.get(handlerKey);
    handlers.push(handler);
    
    // 返回移除此处理器的函数
    return () => {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * 注册全局碰撞处理器
   * @param {Function} handler - 碰撞处理回调函数
   * @returns {Function} 用于移除处理器的函数
   */
  registerGlobalHandler(handler) {
    const handlerKey = 'global';
    
    if (!this.collisionHandlers.has(handlerKey)) {
      this.collisionHandlers.set(handlerKey, []);
    }
    
    const handlers = this.collisionHandlers.get(handlerKey);
    handlers.push(handler);
    
    // 返回移除此处理器的函数
    return () => {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * 为特定物体添加碰撞事件监听
   * @param {CANNON.Body} body - 要监听的物理体
   * @param {Function} callback - 当物体发生碰撞时调用的回调
   */
  addBodyCollisionListener(body, callback) {
    const listener = (e) => {
      const otherBody = e.body_i === body ? e.body_j : e.body_i;
      callback(otherBody, e.contact);
    };
    
    body.addEventListener('collide', listener);
    this.registeredListeners.add({ body, listener });
    
    // 返回移除函数
    return () => {
      body.removeEventListener('collide', listener);
      this.registeredListeners.delete({ body, listener });
    };
  }

  /**
   * 清理所有注册的碰撞监听器
   */
  clearAllListeners() {
    this.registeredListeners.forEach(({ body, listener }) => {
      body.removeEventListener('collide', listener);
    });
    
    this.registeredListeners.clear();
    this.collisionHandlers.clear();
    this.collisionHistory.clear();
  }

  /**
   * 设置碰撞体的类型
   * @param {CANNON.Body} body - 物理体
   * @param {String} type - 碰撞类型
   */
  setBodyType(body, type) {
    if (!body.userData) {
      body.userData = {};
    }
    
    body.userData.type = type;
  }

  /**
   * 设置护栏碰撞类型
   * @param {CANNON.Body} body - 护栏物理体
   */
  setAsRail(body) {
    this.setBodyType(body, this.collisionTypes.RAIL);
  }
}

// 创建单例
const collisionManagerInstance = {
  instance: null,
  
  /**
   * 初始化碰撞管理器
   * @param {CANNON.World} world - Cannon物理世界
   * @returns {CollisionManager} 碰撞管理器实例
   */
  init(world) {
    if (!this.instance) {
      this.instance = new CollisionManager(world);
    }
    return this.instance;
  },
  
  /**
   * 获取碰撞管理器实例
   * @returns {CollisionManager} 碰撞管理器实例
   */
  getInstance() {
    if (!this.instance) {
      console.warn('CollisionManager not initialized. Call init() first.');
      return null;
    }
    return this.instance;
  }
};

export default collisionManagerInstance; 