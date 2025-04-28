import * as RAPIER from '@dimforge/rapier3d-compat';

/**
 * Rapier物理引擎加载器
 * 
 * 专门处理Rapier WASM模块的加载和初始化，
 * 确保Rapier在使用前正确初始化。
 */
class RapierLoader {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
  }
  
  /**
   * 初始化Rapier物理引擎
   * 确保WASM模块正确加载
   * 
   * @returns {Promise<void>} 初始化完成的Promise
   */
  async init() {
    // 如果已经有初始化过程，返回现有Promise
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // 创建初始化Promise
    this.initPromise = this._doInit();
    return this.initPromise;
  }
  
  /**
   * 内部初始化过程
   * @private
   */
  async _doInit() {
    
    // 检查RAPIER对象是否存在
    if (!RAPIER) {
      console.error('[RapierLoader] RAPIER对象不存在，检查引入方式');
      throw new Error('RAPIER对象不存在，检查是否正确引入@dimforge/rapier3d-compat');
    }
    
    try {
      // 尝试多种初始化方法
      if (typeof RAPIER.init === 'function') {
        await RAPIER.init();
      } else if (typeof RAPIER.default === 'function') {
        await RAPIER.default();
      } else {
        console.warn('[RapierLoader] 未找到标准初始化方法，假定WASM已自动加载');
        
        // 尝试添加一个延迟，给WASM有机会加载
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 验证WASM是否正确加载
      if (!this._validateWasmLoaded()) {
        throw new Error('WASM模块未正确加载，无法使用Rapier功能');
      }
      
      this.isInitialized = true;
      console.log('[RapierLoader] Rapier物理引擎初始化完成');
      
      return true;
    } catch (error) {
      console.error('[RapierLoader] Rapier初始化失败:', error);
      this.initPromise = null; // 重置Promise，允许重试
      throw error;
    }
  }
  
  /**
   * 验证WASM是否正确加载
   * @private
   * @returns {boolean} WASM是否正确加载
   */
  _validateWasmLoaded() {
    try {
      // 尝试获取Rapier版本，验证WASM功能
      if (typeof RAPIER.version === 'function') {
        const version = RAPIER.version();
        return true;
      }
      
      // 尝试创建一个简单对象
      if (typeof RAPIER.Vector3 === 'function') {
        const vec = new RAPIER.Vector3(0, 0, 0);
        return vec !== undefined;
      }
      
      return false;
    } catch (error) {
      console.error('[RapierLoader] WASM功能验证失败:', error);
      return false;
    }
  }
  
  /**
   * 获取加载的Rapier版本
   * @returns {string|null} Rapier版本字符串，如果无法获取则为null
   */
  getVersion() {
    try {
      if (typeof RAPIER.version === 'function') {
        return RAPIER.version();
      }
      return null;
    } catch (error) {
      console.warn('[RapierLoader] 无法获取Rapier版本:', error);
      return null;
    }
  }
}

// 导出单例
export default new RapierLoader(); 