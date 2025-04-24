// 控制状态对象
export class ControlState {
  constructor() {
    this.accelerate = false;
    this.brake = false;
    this.turnLeft = false;
    this.turnRight = false;
    this.handbrake = false; // 新增：手刹状态
    this.gearUp = false;    // 新增：升档
    this.gearDown = false;  // 新增：降档
  }
  
  reset() {
    // 确保使用显式的布尔值false，而不是0或其他值
    this.accelerate = false;
    this.brake = false;
    this.turnLeft = false;
    this.turnRight = false;
    this.handbrake = false;
    this.gearUp = false;
    this.gearDown = false;
  }
}

// 键盘控制器
export class KeyboardController {
  constructor() {
    // **修改：不再直接持有 ControlState 实例，而是接收外部传入的响应式引用**
    // this.controlState = new ControlState(); 
    this.controlState = null; // 将在 useInputControls 中设置
    this.keyState = {}; // 跟踪按键状态
    this.hasBindEvents = false; // 标记是否已经绑定了事件
    
    // 绑定事件处理器到this
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    
    // 重置按键状态
    this.resetKeyState();
    
    // 添加事件监听器（确保只添加一次）
    this.addListeners();
  }
  
  // 添加重置按键状态的方法
  resetKeyState() {
    this.keyState = {};
  }
  
  addListeners() {
    // 避免重复绑定事件
    if (!this.hasBindEvents) {
      
      // 尝试使用window和document级别的监听，并使用不同的事件选项
      window.addEventListener('keydown', this.handleKeyDown, { capture: true, passive: false });
      window.addEventListener('keyup', this.handleKeyUp, { capture: true, passive: false });
      
      // 添加document级别的监听作为备份
      document.addEventListener('keydown', this.handleKeyDown, { capture: true, passive: false });
      document.addEventListener('keyup', this.handleKeyUp, { capture: true, passive: false });
      
      // 尝试监听document.body
      document.body.addEventListener('keydown', this.handleKeyDown, { capture: true, passive: false });
      document.body.addEventListener('keyup', this.handleKeyUp, { capture: true, passive: false });
      
      this.hasBindEvents = true;
      
    }
  }
  
  removeListeners() {
    // 只有在已绑定的情况下才移除
    if (this.hasBindEvents) {
      window.removeEventListener('keydown', this.handleKeyDown, { capture: true });
      window.removeEventListener('keyup', this.handleKeyUp, { capture: true });
      
      document.removeEventListener('keydown', this.handleKeyDown, { capture: true });
      document.removeEventListener('keyup', this.handleKeyUp, { capture: true });
      
      document.body.removeEventListener('keydown', this.handleKeyDown, { capture: true });
      document.body.removeEventListener('keyup', this.handleKeyUp, { capture: true });
      
      this.hasBindEvents = false;
      // 移除监听器时也重置按键状态
      this.resetKeyState();
      // **确保重置外部传入的 controlState (如果存在)**
      if (this.controlState && typeof this.controlState.reset === 'function') {
      this.controlState.reset();
      } else {
        console.warn("KeyboardController: 无法重置 controlState，可能未正确设置或 reset 方法不存在。");
      }
    }
  }

  handleKeyDown(event) {
    // **添加检查：确保 controlState 已被设置**
    if (!this.controlState) {
      console.warn("KeyboardController: controlState 未设置，无法处理 keydown 事件。");
      return;
    }
    
      // 只关注我们需要的键
    const key = event.key.toLowerCase();
    
    // 更新按键状态
    this.keyState[key] = true;
    
    // 更新控制状态
    switch (key) {
      case 'w':
      case 'arrowup':
        this.controlState.accelerate = true;
        break;
      case 's':
      case 'arrowdown':
        this.controlState.brake = true;
        break;
      case 'a':
      case 'arrowleft':
        this.controlState.turnLeft = true;
        break;
      case 'd':
      case 'arrowright':
        this.controlState.turnRight = true;
        break;
      case ' ': // 空格键
        this.controlState.handbrake = true;
        break;
      case 'e':
        this.controlState.gearUp = true;
        break;
      case 'q':
        this.controlState.gearDown = true;
        break;
    }
    
    // 在处理完毕后阻止事件传播和默认行为
    event.preventDefault();
    event.stopPropagation();
  }
  
  handleKeyUp(event) {
    // **添加检查：确保 controlState 已被设置**
    if (!this.controlState) {
      console.warn("KeyboardController: controlState 未设置，无法处理 keyup 事件。");
      return;
    }
    
    
    const key = event.key.toLowerCase();
    
    // 更新按键状态
    this.keyState[key] = false;
    
    // 更新控制状态
    switch (key) {
      case 'w':
      case 'arrowup':
        this.controlState.accelerate = false;
        break;
      case 's':
      case 'arrowdown':
        this.controlState.brake = false;
        break;
      case 'a':
      case 'arrowleft':
        this.controlState.turnLeft = false;
        break;
      case 'd':
      case 'arrowright':
        this.controlState.turnRight = false;
        break;
      case ' ': // 空格键
        this.controlState.handbrake = false;
        break;
      case 'e':
        this.controlState.gearUp = false;
        break;
      case 'q':
        this.controlState.gearDown = false;
        break;
    }
    
    // 在处理完毕后阻止事件传播和默认行为
    event.preventDefault();
    event.stopPropagation();

  }
  
  getControlState() {
    return this.controlState;
  }
  
  dispose() {
    // 移除事件监听器
    this.removeListeners();
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