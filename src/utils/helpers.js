/**
 * 防抖函数 - 限制函数在一段时间内只执行一次
 * @param {Function} func 需要防抖的函数
 * @param {number} wait 等待时间（毫秒）
 * @returns {Function} 防抖处理后的函数
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 节流函数 - 限制函数在一段时间内按固定频率执行
 * @param {Function} func 需要节流的函数
 * @param {number} limit 时间限制（毫秒）
 * @returns {Function} 节流处理后的函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 检查网络连接状态
 * @returns {boolean} 是否在线
 */
export function isOnline() {
  return navigator.onLine;
} 