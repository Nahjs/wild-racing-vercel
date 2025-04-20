import { ref, computed, watch } from 'vue';

/**
 * 比赛逻辑组合式函数
 * 管理比赛状态、计时、圈数和检查点等逻辑
 * 
 * @param {Object} options 配置选项
 * @param {Number} options.totalLaps 总圈数
 * @param {Function} options.onRaceStart 比赛开始回调
 * @param {Function} options.onRaceFinish 比赛结束回调
 * @returns {Object} 比赛逻辑相关的状态和方法
 */
export function useRaceLogic(options = {}) {
  // 默认选项
  const {
    totalLaps = 3,
    onRaceStart = () => {},
    onRaceFinish = () => {},
  } = options;
  
  // 比赛状态
  const raceStatus = ref('waiting'); // waiting, countdown, racing, finished
  const countdown = ref(3);
  
  // 计时器
  const raceStartTime = ref(0);
  const currentLapStartTime = ref(0);
  const currentLapTime = ref(0);
  const bestLapTime = ref(0);
  const totalRaceTime = ref(0);
  const currentLap = ref(0);
  const lapTimes = ref([]);
  
  // 检查点
  const checkpoints = ref([]);
  const nextCheckpointIndex = ref(0);
  
  // 计算属性：是否处于倒计时状态
  const isCountingDown = computed(() => raceStatus.value === 'countdown');
  
  // 计算属性：是否正在比赛中
  const isRacing = computed(() => raceStatus.value === 'racing');
  
  // 计算属性：是否已完成比赛
  const isFinished = computed(() => raceStatus.value === 'finished');
  
  /**
   * 设置检查点
   * @param {Array} points 检查点数组
   */
  const setCheckpoints = (points) => {
    checkpoints.value = points;
    nextCheckpointIndex.value = 0;
  };
  
  /**
   * 开始倒计时
   */
  const startCountdown = () => {
    raceStatus.value = 'countdown';
    countdown.value = 3;
    
    const countdownInterval = setInterval(() => {
      countdown.value--;
      
      if (countdown.value <= 0) {
        clearInterval(countdownInterval);
        startRace();
      }
    }, 1000);
  };
  
  /**
   * 开始比赛
   */
  const startRace = () => {
    raceStatus.value = 'racing';
    currentLap.value = 1;
    raceStartTime.value = Date.now();
    currentLapStartTime.value = Date.now();
    lapTimes.value = [];
    onRaceStart();
  };
  
  /**
   * 更新比赛时间
   */
  const updateRaceTime = () => {
    if (raceStatus.value === 'racing') {
      currentLapTime.value = Date.now() - currentLapStartTime.value;
      totalRaceTime.value = Date.now() - raceStartTime.value;
    }
  };
  
  /**
   * 检查车辆是否通过了检查点
   * @param {Object} vehiclePosition 车辆位置
   * @param {Number} checkpointRadius 检查点半径（默认为5单位）
   */
  const checkCheckpoint = (vehiclePosition, checkpointRadius = 5) => {
    if (!isRacing.value || checkpoints.value.length === 0) return;
    
    const currentCheckpoint = checkpoints.value[nextCheckpointIndex.value];
    if (!currentCheckpoint) return;
    
    const distance = Math.sqrt(
      Math.pow(vehiclePosition.x - currentCheckpoint.position.x, 2) +
      Math.pow(vehiclePosition.y - currentCheckpoint.position.y, 2) +
      Math.pow(vehiclePosition.z - currentCheckpoint.position.z, 2)
    );
    
    if (distance <= checkpointRadius) {
      nextCheckpointIndex.value++;
      
      // 如果已经通过了所有检查点，完成一圈
      if (nextCheckpointIndex.value >= checkpoints.value.length) {
        completeLap();
      }
    }
  };
  
  /**
   * 完成一圈
   */
  const completeLap = () => {
    const lapTime = Date.now() - currentLapStartTime.value;
    lapTimes.value.push(lapTime);
    
    // 更新最佳圈速
    if (bestLapTime.value === 0 || lapTime < bestLapTime.value) {
      bestLapTime.value = lapTime;
    }
    
    // 检查是否完成全部圈数
    currentLap.value++;
    
    if (currentLap.value > totalLaps) {
      finishRace();
    } else {
      // 开始新的一圈
      nextCheckpointIndex.value = 0;
      currentLapStartTime.value = Date.now();
    }
  };
  
  /**
   * 完成比赛
   */
  const finishRace = () => {
    raceStatus.value = 'finished';
    onRaceFinish({
      totalTime: totalRaceTime.value,
      bestLapTime: bestLapTime.value,
      lapTimes: lapTimes.value
    });
  };
  
  /**
   * 重新开始比赛
   */
  const restartRace = () => {
    raceStatus.value = 'waiting';
    currentLap.value = 0;
    nextCheckpointIndex.value = 0;
    totalRaceTime.value = 0;
    currentLapTime.value = 0;
    bestLapTime.value = 0;
    lapTimes.value = [];
    
    // 开始新的倒计时
    startCountdown();
  };
  
  /**
   * 格式化时间显示 (毫秒转换为 分:秒.毫秒)
   * @param {Number} timeMs 毫秒时间
   * @returns {String} 格式化的时间字符串
   */
  const formatTime = (timeMs) => {
    if (timeMs === 0) return '00:00.000';
    
    const minutes = Math.floor(timeMs / 60000);
    const seconds = Math.floor((timeMs % 60000) / 1000);
    const ms = timeMs % 1000;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };
  
  return {
    // 状态
    raceStatus,
    countdown,
    currentLap,
    totalLaps,
    currentLapTime,
    bestLapTime,
    totalRaceTime,
    checkpoints,
    nextCheckpointIndex,
    lapTimes,
    
    // 计算属性
    isCountingDown,
    isRacing,
    isFinished,
    
    // 方法
    setCheckpoints,
    startCountdown,
    updateRaceTime,
    checkCheckpoint,
    restartRace,
    formatTime
  };
} 