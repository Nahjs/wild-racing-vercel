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
  }
}

// 键盘控制器
export class KeyboardController {
  constructor(controlState) {
    this.controls = controlState || new ControlState();
    this.setupListeners();
  }
  
  setupListeners() {
    // 键盘按下事件
    document.addEventListener('keydown', (e) => {
      switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.controls.accelerate = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.controls.brake = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.controls.turnLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.controls.turnRight = true;
          break;
      }
    });
    
    // 键盘释放事件
    document.addEventListener('keyup', (e) => {
      switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.controls.accelerate = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.controls.brake = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.controls.turnLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.controls.turnRight = false;
          break;
      }
    });
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
    this.setupListeners();
  }
  
  setupListeners() {
    // 触摸开始事件
    this.touchElement.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    });
    
    // 触摸移动事件
    this.touchElement.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      
      // 重置控制状态
      this.controls.reset();
      
      // 水平移动控制转向
      if (deltaX > 50) {
        this.controls.turnRight = true;
      } else if (deltaX < -50) {
        this.controls.turnLeft = true;
      }
      
      // 垂直移动控制加速和刹车
      if (deltaY < -50) {
        this.controls.accelerate = true;
      } else if (deltaY > 50) {
        this.controls.brake = true;
      }
    });
    
    // 触摸结束事件
    this.touchElement.addEventListener('touchend', () => {
      this.controls.reset();
    });
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