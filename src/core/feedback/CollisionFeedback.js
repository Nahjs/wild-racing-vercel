import * as THREE from 'three';

/**
 * 碰撞反馈系统 - 处理碰撞的视觉、音效和物理反馈
 */
class CollisionFeedback {
  constructor() {
    // 音效资源
    this.sounds = {
      smallImpact: null,
      mediumImpact: null,
      heavyImpact: null,
      railScrape: null
    };
    
    // 粒子系统
    this.particleSystems = new Map();
    
    // 是否已初始化
    this.initialized = false;
    
    // 缓存碰撞材质
    this.materials = new Map();
    
    // 碰撞强度阈值
    this.impactThresholds = {
      light: 2,    // 轻微碰撞
      medium: 5,   // 中等碰撞
      heavy: 10    // 严重碰撞
    };
    
    // 音频上下文 (延迟初始化)
    this.audioContext = null;
  }

  /**
   * 初始化碰撞反馈系统
   * @param {THREE.Scene} scene - Three.js场景
   */
  init(scene) {
    if (this.initialized) return;
    
    this.scene = scene;
    
    // 延迟初始化音频上下文（需要用户交互）
    this._initAudio();
    
    // 初始化粒子系统
    this._initParticleSystems();
    
    this.initialized = true;
  }
  
  /**
   * 初始化音频系统
   * @private
   */
  _initAudio() {
    // 创建音频上下文（在用户交互后再初始化）
    const initAudioContext = () => {
      if (this.audioContext) return;
      
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 预加载碰撞音效 (更新路径)
        this._loadSound('/sounds/crash.mp3', 'smallImpact');
        this._loadSound('/sounds/crash.mp3', 'mediumImpact');
        this._loadSound('/sounds/crash.mp3', 'heavyImpact');
        this._loadSound('/sounds/drift.mp3', 'railScrape');
        
        // 移除事件监听器
        document.removeEventListener('click', initAudioContext);
        document.removeEventListener('keydown', initAudioContext);
      } catch (e) {
        console.warn('Web Audio API不受支持:', e);
      }
    };
    
    // 在用户交互后初始化音频上下文
    document.addEventListener('click', initAudioContext);
    document.addEventListener('keydown', initAudioContext);
  }
  
  /**
   * 加载音效
   * @param {String} url - 音效文件URL
   * @param {String} id - 音效ID
   * @private
   */
  _loadSound(url, id) {
    if (!this.audioContext) return;
    
    fetch(url)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        this.sounds[id] = audioBuffer;
      })
      .catch(error => {
        console.warn(`加载音效失败: ${url}`, error);
      });
  }
  
  /**
   * 播放音效
   * @param {String} soundId - 音效ID
   * @param {Object} options - 播放选项
   * @private
   */
  _playSound(soundId, options = {}) {
    if (!this.audioContext || !this.sounds[soundId]) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds[soundId];
    
    // 创建音量控制
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = options.volume || 1;
    
    // 根据碰撞强度调整音调
    if (options.impactStrength) {
      const playbackRate = 0.8 + (options.impactStrength / 20); // 根据碰撞强度调整播放速率
      source.playbackRate.value = Math.min(Math.max(playbackRate, 0.6), 1.5);
    }
    
    // 连接节点
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // 播放音效
    source.start(0);
    
    // 循环播放
    if (options.loop) {
      source.loop = true;
      return {
        stop: () => {
          // 平滑停止
          gainNode.gain.exponentialRampToValueAtTime(
            0.001, this.audioContext.currentTime + 0.5
          );
          setTimeout(() => source.stop(), 500);
        }
      };
    }
  }
  
  /**
   * 初始化粒子系统
   * @private
   */
  _initParticleSystems() {
    // 火花粒子材质
    const sparkMaterial = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.05,
      blending: THREE.AdditiveBlending,
      transparent: true,
      sizeAttenuation: true
    });
    
    // 缓存材质
    this.materials.set('spark', sparkMaterial);
    
    // 烟雾粒子材质
    const smokeMaterial = new THREE.PointsMaterial({
      color: 0x666666,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true
    });
    
    // 缓存材质
    this.materials.set('smoke', smokeMaterial);
  }
  
  /**
   * 创建碰撞粒子系统
   * @param {THREE.Vector3} position - 碰撞位置
   * @param {String} type - 粒子类型 ('spark'/'smoke')
   * @param {Object} options - 粒子系统选项
   * @private
   */
  _createParticleSystem(position, type, options = {}) {
    const count = options.count || 20;
    const material = this.materials.get(type);
    
    if (!material) return null;
    
    // 创建粒子几何体
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    
    // 初始化粒子位置
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = position.x;
      positions[i3 + 1] = position.y;
      positions[i3 + 2] = position.z;
      
      // 随机速度
      velocities.push(
        (Math.random() - 0.5) * options.speed || 0.1,
        (Math.random() - 0.5) * options.speed || 0.1,
        (Math.random() - 0.5) * options.speed || 0.1
      );
    }
    
    // 设置粒子位置
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // 创建粒子系统
    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);
    
    // 生命周期和动画
    const lifetime = options.lifetime || 1000;
    const startTime = Date.now();
    
    // 存储粒子系统
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.particleSystems.set(id, {
      particles,
      velocities,
      startTime,
      lifetime,
      update: (delta) => {
        const positions = particles.geometry.attributes.position.array;
        
        // 更新粒子位置
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const v3 = i * 3;
          
          positions[i3] += velocities[v3] * delta;
          positions[i3 + 1] += velocities[v3 + 1] * delta + (type === 'smoke' ? 0.01 : 0);
          positions[i3 + 2] += velocities[v3 + 2] * delta;
          
          // 模拟重力或阻力
          if (type === 'spark') {
            velocities[v3 + 1] -= 0.01; // 重力
          } else if (type === 'smoke') {
            // 阻力
            velocities[v3] *= 0.98;
            velocities[v3 + 1] *= 0.98;
            velocities[v3 + 2] *= 0.98;
          }
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
        
        // 检查生命周期
        if (Date.now() - startTime > lifetime) {
          this.scene.remove(particles);
          particles.geometry.dispose();
          this.particleSystems.delete(id);
        }
      }
    });
  }
  
  /**
   * 更新所有粒子系统
   * @param {Number} delta - 帧时间差
   */
  update(delta) {
    this.particleSystems.forEach(system => {
      system.update(delta);
    });
  }
  
  /**
   * 处理车辆与护栏的碰撞
   * @param {Object} event - 碰撞事件
   */
  handleRailCollision(event) {
    console.log(`[CollisionFeedback] handleRailCollision triggered. Phase: ${event.phase}`);

    if (!this.initialized) return;
    
    // 获取碰撞强度
    const velocity = event.bodyA.velocity.length() + event.bodyB.velocity.length();
    const impactStrength = velocity;
    
    // 获取碰撞点 (添加安全检查)
    let contactPoint = null;
    if (event.contact && event.contact.bi && event.contact.bi.position) {
      // 优先使用精确的碰撞点 (body B 上的接触点)
      contactPoint = new THREE.Vector3().copy(event.contact.bi.position);
    } else if (event.contact && event.contact.ri) { 
      // 备选：使用世界坐标系中的接触点 'ri'
      contactPoint = new THREE.Vector3().copy(event.contact.ri); 
    } else {
      // 最后备选：使用车辆的位置作为近似点
      console.warn("[CollisionFeedback] Cannot find precise contact point, using vehicle position as fallback.");
      contactPoint = new THREE.Vector3().copy(event.bodyA.position);
    }
    
    // 根据碰撞强度播放不同的音效
    if (impactStrength > this.impactThresholds.heavy) {
      this._playSound('heavyImpact', { impactStrength, volume: 0.8 });
      this._createParticleSystem(contactPoint, 'spark', { 
        count: 30, 
        speed: 0.15, 
        lifetime: 800 
      });
      this._createParticleSystem(contactPoint, 'smoke', { 
        count: 15, 
        speed: 0.05, 
        lifetime: 1500 
      });
    } else if (impactStrength > this.impactThresholds.medium) {
      this._playSound('mediumImpact', { impactStrength, volume: 0.6 });
      this._createParticleSystem(contactPoint, 'spark', { 
        count: 20, 
        speed: 0.1, 
        lifetime: 600 
      });
    } else if (impactStrength > this.impactThresholds.light) {
      this._playSound('smallImpact', { impactStrength, volume: 0.4 });
      this._createParticleSystem(contactPoint, 'spark', { 
        count: 10, 
        speed: 0.05, 
        lifetime: 400 
      });
    }
    
    // 持续的摩擦音效（当车辆沿着护栏滑行时）
    if (event.phase === 'begin' && impactStrength > this.impactThresholds.light) {
      const scrape = this._playSound('railScrape', { 
        volume: Math.min(0.3, impactStrength / 20), 
        loop: true 
      });
      
      // 存储到事件中，以便在碰撞结束时停止
      if (scrape) {
        event.scrapeSound = scrape;
      }
    } else if (event.phase === 'end' && event.scrapeSound) {
      event.scrapeSound.stop();
    }
  }
  
  /**
   * 清理所有资源
   */
  dispose() {
    // 清理粒子系统
    this.particleSystems.forEach(system => {
      this.scene.remove(system.particles);
      system.particles.geometry.dispose();
    });
    
    this.particleSystems.clear();
    
    // 清理材质
    this.materials.forEach(material => {
      material.dispose();
    });
    
    this.materials.clear();
    
    // 关闭音频上下文
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.initialized = false;
  }
}

// 导出单例
export default new CollisionFeedback(); 