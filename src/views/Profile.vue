<template>
  <div class="profile-container">
    <div class="profile-card">
      <div class="profile-header">
        <div class="avatar-container">
          <img :src="playerInfo.avatarUrl" alt="用户头像" class="avatar" />
          <div class="level-badge">Lv {{ playerStats.level }}</div>
        </div>
        <div class="player-details">
          <h1>{{ playerInfo.username }}</h1>
          <p class="join-date">加入时间: {{ formatDate(playerInfo.joinDate) }}</p>
          <div class="progress-bar-container">
            <div class="progress-bar">
              <div class="progress" :style="{ width: `${playerStats.levelProgress}%` }"></div>
            </div>
            <span class="progress-text">下一级: {{ playerStats.xpToNextLevel }} XP</span>
          </div>
        </div>
      </div>

      <div class="profile-stats">
        <div class="stat-item">
          <div class="stat-value">{{ playerStats.races }}</div>
          <div class="stat-label">参赛场次</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ playerStats.wins }}</div>
          <div class="stat-label">冠军次数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ (playerStats.winRate * 100).toFixed(1) }}%</div>
          <div class="stat-label">胜率</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatTime(playerStats.bestTime) }}</div>
          <div class="stat-label">最佳圈速</div>
        </div>
      </div>

      <div class="section achievements">
        <h2><i class="icon-trophy"></i> 成就殿堂</h2>
        <div class="achievement-list">
          <div v-for="achievement in achievements" :key="achievement.id"
               class="achievement-item" :class="{ 'achieved': achievement.achieved }">
            <div class="achievement-icon">
              <i :class="achievement.icon"></i>
            </div>
            <div class="achievement-info">
              <div class="achievement-name">{{ achievement.name }}</div>
              <div class="achievement-desc">{{ achievement.description }}</div>
            </div>
            <div v-if="achievement.achieved" class="achieved-mark">
              <i class="icon-check"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="section racing-history">
        <h2><i class="icon-history"></i> 最近比赛记录</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>赛道</th>
                <th>用时</th>
                <th>排名</th>
                <th>获得XP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="race in raceHistory" :key="race.id">
                <td>{{ formatDate(race.date) }}</td>
                <td>{{ race.track }}</td>
                <td>{{ formatTime(race.time) }}</td>
                <td><span :class="getRankClass(race.position)">{{ race.position }}</span></td>
                <td>+{{ race.xpGained }} XP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section settings">
        <h2><i class="icon-settings"></i> 偏好设置</h2>
         <div class="info-item">
          <label>玩家名称</label>
          <input v-model="playerName" type="text" @change="saveProfile" />
        </div>
        <div class="settings-item">
          <label>游戏音量</label>
          <input type="range" min="0" max="100" v-model="settings.volume">
          <span>{{ settings.volume }}%</span>
        </div>
         <div class="settings-item">
          <label>显示辅助线</label>
          <input type="checkbox" v-model="settings.showDrivingLine">
        </div>
        <button class="save-settings-btn">保存设置</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';

export default {
  name: 'Profile',
  setup() {
    const playerName = ref('疾风车手'); // 示例玩家名

    // 玩家基本信息
    const playerInfo = reactive({
      username: playerName.value,
      avatarUrl: 'https://source.unsplash.com/random/150x150/?avatar', // 随机头像
      joinDate: new Date(2024, 0, 15) // 示例加入日期
    });

    // 玩家统计信息
    const playerStats = reactive({
      races: 88,
      wins: 25,
      winRate: 25 / 88,
      bestTime: 88530, // 毫秒, 1:28.530
      level: 12,
      levelProgress: 45, // 当前等级进度百分比
      xpToNextLevel: 1250 // 升到下一级所需的经验值
    });

    // 成就列表 (添加id和更多示例)
    const achievements = reactive([
      {
        id: 1,
        name: '新手上路',
        description: '完成你的第一场比赛。',
        icon: 'icon-flag-checkered',
        achieved: true
      },
      {
        id: 2,
        name: '速度与激情',
        description: '首次达到 250km/h。',
        icon: 'icon-speedometer',
        achieved: true
      },
      {
        id: 3,
        name: '弯道舞者',
        description: '在一场比赛中成功漂移超过 15 次。',
        icon: 'icon-tire-tracks',
        achieved: true
      },
      {
        id: 4,
        name: '常胜将军',
        description: '赢得 10 场比赛的冠军。',
        icon: 'icon-trophy-gold',
        achieved: false
      },
       {
        id: 5,
        name: '赛道征服者',
        description: '在所有官方赛道上都获得过冠军。',
        icon: 'icon-map-marked-alt',
        achieved: false
      },
       {
        id: 6,
        name: '完美主义',
        description: '在无碰撞的情况下赢得一场比赛。',
        icon: 'icon-shield-check',
        achieved: false
      }
    ]);

    // 比赛历史 (添加id和更多示例)
    const raceHistory = reactive([
      {
        id: 1,
        date: new Date(2024, 5, 18, 15, 30),
        track: '都市霓虹',
        time: 91280,
        position: 1,
        xpGained: 150
      },
      {
        id: 2,
        date: new Date(2024, 5, 17, 20, 0),
        track: '海岸公路',
        time: 102550,
        position: 3,
        xpGained: 80
      },
      {
        id: 3,
        date: new Date(2024, 5, 17, 11, 45),
        track: '山涧回环',
        time: 88530, // 最佳时间
        position: 1,
        xpGained: 165
      },
      {
        id: 4,
        date: new Date(2024, 5, 16, 22, 10),
        track: '沙漠遗迹',
        time: 115900,
        position: 5,
        xpGained: 50
      },
       {
        id: 5,
        date: new Date(2024, 5, 16, 14, 0),
        track: '都市霓虹',
        time: 93100,
        position: 2,
        xpGained: 110
      }
    ]);

    // 偏好设置
    const settings = reactive({
      volume: 75,
      showDrivingLine: true
    });

    // 保存个人资料 (更新用户名)
    const saveProfile = () => {
      playerInfo.username = playerName.value;
      console.log('保存个人资料:', playerName.value);
      // 添加保存逻辑
    };

    // 格式化时间显示 (毫秒转换为 分:秒.毫秒)
    const formatTime = (timeMs) => {
      if (!timeMs || timeMs <= 0) return '--:--.---';

      const minutes = Math.floor(timeMs / 60000);
      const seconds = Math.floor((timeMs % 60000) / 1000);
      const ms = timeMs % 1000;

      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    // 格式化日期
    const formatDate = (date) => {
      if (!date) return '未知';
      try {
          return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      } catch (e) {
          console.error("Error formatting date:", date, e);
          return '日期错误';
      }
    };

    // 获取排名对应的CSS类
    const getRankClass = (position) => {
      if (position === 1) return 'rank-gold';
      if (position === 2) return 'rank-silver';
      if (position === 3) return 'rank-bronze';
      return 'rank-normal';
    };

    onMounted(() => {
      // 加载用户数据逻辑
    });

    return {
      playerName,
      playerInfo,
      playerStats,
      achievements,
      raceHistory,
      settings,
      saveProfile,
      formatTime,
      formatDate,
      getRankClass
    };
  }
};
</script>

<style scoped>
/* 引入一些图标字体 (假设项目中有引入 Font Awesome 或类似库) */
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css");
/* 或者你本地的图标库 */
/* @import '../assets/icons.css'; */

.profile-container {
  width: 100%;
  min-height: 100vh;
  padding: 40px 20px;
  background: linear-gradient(to bottom, #2c3e50, #1a2833);
}

.profile-card {
  max-width: 900px;
  margin: 0 auto;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  padding: 30px;
  overflow: hidden;
  color: #eee;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.profile-header {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  gap: 30px; /* 增加头像和信息间的间距 */
}

.avatar-container {
    position: relative;
    text-align: center; /* 让等级徽章居中 */
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #42b983; /* 使用主题强调色 */
  box-shadow: 0 0 15px rgba(66, 185, 131, 0.5);
}

.level-badge {
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #42b983;
    color: white;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    border: 2px solid rgba(255, 255, 255, 0.3);
}

.player-details h1 {
  font-size: 2rem; /* 增大用户名 */
  margin-bottom: 5px;
  color: #fff;
}

.join-date {
    font-size: 0.9rem;
    color: #aaa;
    margin-bottom: 15px;
}

.progress-bar-container {
    width: 100%;
    max-width: 300px; /* 限制进度条最大宽度 */
}

.progress-bar {
  height: 10px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: linear-gradient(to right, #42b983, #3498db);
  transition: width 0.5s ease;
  border-radius: 5px;
}

.progress-text {
    display: block;
    font-size: 0.8rem;
    color: #bbb;
    margin-top: 5px;
    text-align: right;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); /* 响应式网格布局 */
  gap: 20px;
  margin-bottom: 40px;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}

.stat-item {
  text-align: center;
  padding: 15px 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.05); /* 分隔线 */
}
.stat-item:last-child {
    border-right: none;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #42b983;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 0.9rem;
  color: #aaa;
}

.section {
    margin-bottom: 40px;
}

.section h2 {
  font-size: 1.5rem;
  color: #eee;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 10px;
}

.section h2 i {
    color: #42b983;
}

.achievement-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.achievement-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.03);
  opacity: 0.7;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.achievement-item:hover {
    transform: translateY(-3px);
    background-color: rgba(255, 255, 255, 0.06);
    opacity: 0.9;
}

.achievement-item.achieved {
  opacity: 1;
  background-color: rgba(66, 185, 131, 0.1);
  border-left: 4px solid #42b983;
}

.achievement-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 1.2rem;
  color: #aaa;
}

.achievement-item.achieved .achievement-icon {
  background-color: #42b983;
  color: white;
}

.achievement-info {
    flex-grow: 1;
}

.achievement-name {
  font-weight: bold;
  font-size: 1rem;
  margin-bottom: 3px;
  color: #fff;
}

.achievement-desc {
  font-size: 0.85rem;
  color: #bbb;
}

.achieved-mark {
    position: absolute;
    top: 10px;
    right: 10px;
    color: #42b983;
    font-size: 1.2rem;
}

.table-container {
    overflow-x: auto; /* 允许表格水平滚动 */
}

table {
  width: 100%;
  border-collapse: collapse;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

th, td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.9rem;
}

th {
  background-color: rgba(255, 255, 255, 0.05);
  font-weight: bold;
  color: #ccc;
}

tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.05);
}

.rank-gold {
    color: #ffd700; /* 金色 */
    font-weight: bold;
}
.rank-silver {
    color: #c0c0c0; /* 银色 */
    font-weight: bold;
}
.rank-bronze {
    color: #cd7f32; /* 铜色 */
    font-weight: bold;
}
.rank-normal {
    color: #eee;
}

.settings-item {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  gap: 15px;
}

.settings-item label {
  width: 120px; /* 固定标签宽度 */
  flex-shrink: 0;
  color: #bbb;
}

.settings-item input[type="range"] {
    flex-grow: 1;
    cursor: pointer;
}

.info-item {
    margin-bottom: 20px;
}

.info-item label {
  display: block;
  font-size: 0.9rem;
  color: #bbb;
  margin-bottom: 5px;
}

.info-item input[type="text"] {
  width: 100%;
  max-width: 400px;
  padding: 10px 12px;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 1rem;
}

.save-settings-btn {
    background-color: #42b983;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s;
    margin-top: 10px;
}

.save-settings-btn:hover {
    background-color: #3aa876;
}
</style> 