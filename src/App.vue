<template>
  <div class="app">
    <header v-if="showHeader">
      <div class="logo">Drift Pulse Zero</div>
      <nav>
        <router-link to="/">首页</router-link>
        <router-link to="/garage">车库</router-link>
        <router-link to="/race">比赛</router-link>
        <router-link to="/profile">个人中心</router-link>
      </nav>
      <div class="user-controls">
        <button @click="toggleFullscreen">
          <i class="icon-fullscreen"></i>
        </button>
        <button @click="toggleSettings">
          <i class="icon-settings"></i>
        </button>
        </div>
    </header>

    <main>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" @toggle-header="toggleHeader" />
        </transition>
      </router-view>
    </main>

    <footer v-if="showHeader">
      <div class="copyright">© 2025-2026 Drift Pulse Zero</div>
      <div class="version">Version: 0.2.7 Beta</div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

// 控制头部和底部的显示
const showHeader = ref(true);
const route = useRoute();

// 监听路由变化
watch(
  () => route.path,
  (newPath) => {
    // 如果是车库或比赛页面，隐藏头部和底部；否则显示
    showHeader.value = !newPath.includes('/garage') && !newPath.includes('/race');
  }
);

// 切换全屏
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

// 切换设置
const toggleSettings = () => {
  // 实现设置弹窗的显示/隐藏
  console.log('打开设置');
};

// 切换头部显示
const toggleHeader = (value) => {
  showHeader.value = value !== undefined ? value : !showHeader.value;
};

onMounted(() => {
  // 初始加载时检查路由
  showHeader.value = !route.path.includes('/garage') && !route.path.includes('/race');
});
</script>

<style>
:root {
  --primary-color: #2c3e50;
  --accent-color: #42b983;
  --text-color: #ffffff;
  --bg-color: #121212;
  --header-height: 60px;
  --footer-height: 40px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Arial', sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  height: var(--header-height);
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.logo {
  font-weight: bold;
  font-size: 1.5rem;
  color: var(--accent-color);
}

nav {
  display: flex;
  gap: 20px;
}

nav a {
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
  padding: 5px 10px;
  border-radius: 4px;
}

nav a:hover, nav a.router-link-active {
  color: var(--accent-color);
  background-color: rgba(255, 255, 255, 0.1);
}

.user-controls {
  display: flex;
  gap: 10px;
}

.user-controls button {
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background-color 0.3s;
}

.user-controls button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

main {
  flex: 1;
  margin-top: var(--header-height);
  position: relative;
}

footer {
  height: var(--footer-height);
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

/* 显示隐藏动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 适应全屏模式不显示头部和底部的情况 */
main:only-child {
  margin-top: 0;
}
</style>
