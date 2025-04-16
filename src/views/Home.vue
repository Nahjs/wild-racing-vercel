<template>
  <div class="home">
    <div class="hero">
      <h1>Drift Pulse Zero</h1>
      <p>高性能3D赛车游戏体验</p>
      
      <div class="actions">
        <router-link to="/garage" class="btn primary" @click="hideHeader">
          进入车库
        </router-link>
        <router-link to="/race" class="btn">
          开始比赛
        </router-link>
      </div>
    </div>
    
    <div class="features">
      <div class="feature">
        <div class="icon">🚗</div>
        <h3>真实物理引擎</h3>
        <p>基于Cannon.js的高精度物理模拟，让每一次漂移都令人心跳加速</p>
      </div>
      
      <div class="feature">
        <div class="icon">🔧</div>
        <h3>车辆自定义</h3>
        <p>个性化定制您的赛车外观与性能，打造独一无二的竞速利器</p>
      </div>
      
      <div class="feature">
        <div class="icon">🏆</div>
        <h3>多人竞速</h3>
        <p>支持8人在线竞速，与全球玩家一较高下</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';

const emit = defineEmits(['toggle-header']);

// 在进入车库时隐藏头部
const hideHeader = () => {
  emit('toggle-header', false);
};

onMounted(() => {
  // 确保在首页显示头部
  emit('toggle-header', true);
});
</script>

<style scoped>
.home {
  min-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero {
  height: 70vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), 
              url('/assets/hero-bg.jpg') no-repeat center center;
  background-size: cover;
  text-align: center;
  padding: 0 20px;
}

.hero h1 {
  font-size: 4rem;
  margin-bottom: 20px;
  color: #fff;
  text-shadow: 0 0 10px rgba(66, 185, 131, 0.7);
}

.hero p {
  font-size: 1.5rem;
  margin-bottom: 40px;
  color: #eee;
}

.actions {
  display: flex;
  gap: 20px;
}

.btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 30px;
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.btn.primary {
  background: #42b983;
  border-color: #42b983;
}

.btn.primary:hover {
  background: #3aa876;
  border-color: #3aa876;
}

.features {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 40px;
  padding: 60px 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.feature {
  width: 300px;
  text-align: center;
  padding: 30px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  transition: transform 0.3s;
}

.feature:hover {
  transform: translateY(-10px);
  background: rgba(255, 255, 255, 0.1);
}

.icon {
  font-size: 3rem;
  margin-bottom: 20px;
}

.feature h3 {
  font-size: 1.5rem;
  margin-bottom: 15px;
  color: #42b983;
}

@media (max-width: 768px) {
  .hero h1 {
    font-size: 2.5rem;
  }
  
  .hero p {
    font-size: 1.2rem;
  }
  
  .actions {
    flex-direction: column;
    gap: 15px;
  }
}
</style> 