// 控制状态对象
export class ControlState {
  constructor() {
    this.accelerate = false;
    this.brake = false;
    this.turnLeft = false;
    this.turnRight = false;
    this.power = 500;      // 加速力度
    this.brakeForce = 300; // 刹车力度
    this.turnStrength = 6; // 转向强度
  }
  
  reset() {
    this.accelerate = false;
    this.brake = false;
    this.turnLeft = false;
    this.turnRight = false;
    console.log("ControlState reset due to blur or touch end."); // Add log for clarity
  }
}

// 键盘控制器
export class KeyboardController {
  constructor(controlState) {
    this.controls = controlState || new ControlState();
    this.keyDownHandler = this.handleKeyDown.bind(this); // Bind 'this'
    this.keyUpHandler = this.handleKeyUp.bind(this);     // Bind 'this'
    this.blurHandler = this.handleBlur.bind(this);       // Bind 'this'
    this.setupListeners();
  }
  
  handleKeyDown(e) {
    let changed = false;
    switch(e.code) {
      case 'KeyW': case 'ArrowUp':
        if (!this.controls.accelerate) { this.controls.accelerate = true; changed = true; } break;
      case 'KeyS': case 'ArrowDown':
        if (!this.controls.brake) { this.controls.brake = true; changed = true; } break;
      case 'KeyA': case 'ArrowLeft':
        if (!this.controls.turnLeft) { this.controls.turnLeft = true; changed = true; } break;
      case 'KeyD': case 'ArrowRight':
        if (!this.controls.turnRight) { this.controls.turnRight = true; changed = true; } break;
    }
    // if (changed) console.log(`Keydown: ${e.code}`, { ...this.controls }); // Can uncomment if needed
  }
  
  handleKeyUp(e) {
    let changed = false;
    switch(e.code) {
      case 'KeyW': case 'ArrowUp':
        if (this.controls.accelerate) { this.controls.accelerate = false; changed = true; } break;
      case 'KeyS': case 'ArrowDown':
        if (this.controls.brake) { this.controls.brake = false; changed = true; } break;
      case 'KeyA': case 'ArrowLeft':
        if (this.controls.turnLeft) { this.controls.turnLeft = false; changed = true; } break;
      case 'KeyD': case 'ArrowRight':
        if (this.controls.turnRight) { this.controls.turnRight = false; changed = true; } break;
    }
    // if (changed) console.log(`Keyup: ${e.code}`, { ...this.controls }); // Can uncomment if needed
  }
  
  handleBlur() {
    this.controls.reset();
  }
  
  setupListeners() {
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    // --- 添加 blur 事件监听器 ---
    window.addEventListener('blur', this.blurHandler); 
  }
  
  // --- 添加清理方法 ---
  removeListeners() {
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('blur', this.blurHandler);
    console.log("KeyboardController listeners removed.");
  }
  
  // 获取当前控制状态
  getControlState() {
    return this.controls;
  }
}

// 触摸屏控制器
export class TouchController {
  constructor(controlState, touchElement) {
    this.controls = controlState || new ControlState();
    this.touchElement = touchElement || document.body;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartHandler = this.handleTouchStart.bind(this);
    this.touchMoveHandler = this.handleTouchMove.bind(this);
    this.touchEndHandler = this.handleTouchEnd.bind(this);
    this.blurHandler = this.handleBlur.bind(this); // Also reset on blur
    this.isEnabled = true; // 添加一个标志来控制是否启用自动触摸控制
    this.setupListeners();
  }
  
  // 添加一个方法来禁用/启用触摸控制
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) {
      // 如果禁用，重置控制状态
      this.controls.reset();
    }
  }
  
  handleTouchStart(e) {
    // 如果禁用了，不处理触摸事件
    if (!this.isEnabled) return;
    
    // 如果触摸来自我们的虚拟按钮，不处理
    if (e.target.closest('.control-btn')) return;
    
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    // Don't reset here, reset only on move/end
  }
  
  handleTouchMove(e) {
    // 如果禁用了，不处理触摸事件
    if (!this.isEnabled) return;
    
    // 如果触摸来自我们的虚拟按钮，不处理
    if (e.target.closest('.control-btn')) return;
    
    // Prevent default scroll/zoom behavior if needed
    // e.preventDefault(); 
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    
    // Reset controls before applying new ones based on move
    this.controls.reset(); 
    
    if (deltaX > 30) this.controls.turnRight = true; // Reduced threshold
    else if (deltaX < -30) this.controls.turnLeft = true;
    
    if (deltaY < -30) this.controls.accelerate = true;
    else if (deltaY > 30) this.controls.brake = true;
  }

  handleTouchEnd(e) {
    // 如果禁用了，不处理触摸事件
    if (!this.isEnabled) return;
    
    // 如果触摸来自我们的虚拟按钮，不处理
    if (e.target && e.target.closest('.control-btn')) return;
    
    this.controls.reset();
  }
  
  handleBlur() {
    this.controls.reset();
  }

  setupListeners() {
    this.touchElement.addEventListener('touchstart', this.touchStartHandler, { passive: false }); // passive: false if preventDefault is needed
    this.touchElement.addEventListener('touchmove', this.touchMoveHandler, { passive: false }); 
    this.touchElement.addEventListener('touchend', this.touchEndHandler);
    this.touchElement.addEventListener('touchcancel', this.touchEndHandler); // Also reset on cancel
    window.addEventListener('blur', this.blurHandler); // Add blur listener
  }
  
  removeListeners() {
    this.touchElement.removeEventListener('touchstart', this.touchStartHandler);
    this.touchElement.removeEventListener('touchmove', this.touchMoveHandler);
    this.touchElement.removeEventListener('touchend', this.touchEndHandler);
    this.touchElement.removeEventListener('touchcancel', this.touchEndHandler);
    window.removeEventListener('blur', this.blurHandler);
    console.log("TouchController listeners removed.");
  }

  // 获取当前控制状态
  getControlState() {
    return this.controls;
  }
}

// 配置控制参数的工具函数
export const configureControls = (controlState, options = {}) => {
  if (options.power !== undefined) {
    controlState.power = options.power;
  }
  
  if (options.brakeForce !== undefined) {
    controlState.brakeForce = options.brakeForce;
  }
  
  if (options.turnStrength !== undefined) {
    controlState.turnStrength = options.turnStrength;
  }
  
  return controlState;
}; 