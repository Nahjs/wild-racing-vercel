import { db, STORES } from '../../utils/db';

// 默认赛道设置
const DEFAULT_TRACK = {
  id: 'default-track',
  name: '默认赛道',
  type: 'generated', // 'generated' 或 'predefined'
  generationOptions: {
    trackType: 'loop',
    segmentCount: 12,
    radius: 50,
    complexity: 0.5,
    height: 0,
    trackWidth: 10,
    withBarriers: true,
    withCheckpoints: true
  },
  objects: [], // 赛道上的物体
  checkpoints: [], // 检查点
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

class TrackService {
  // 初始化赛道数据
  async initializeTracks() {
    try {
      // 检查是否已有赛道数据
      const tracks = await this.getAllTracks();
      
      if (tracks.length === 0) {
        // 如果没有数据，添加默认赛道
        await this.addTrack({
          ...DEFAULT_TRACK,
          updatedAt: new Date().toISOString()
        });
        
        // 添加一个基础环形赛道
        await this.addTrack({
          id: 'basic-loop',
          name: '基础环形赛道',
          type: 'generated',
          generationOptions: {
            trackType: 'loop',
            segmentCount: 12,
            radius: 50,
            complexity: 0.2,
            height: 0,
            trackWidth: 12,
            withBarriers: true,
            withCheckpoints: true
          },
          objects: [],
          checkpoints: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('初始化赛道数据失败:', error);
      throw error;
    }
  }
  
  // 获取所有赛道
  async getAllTracks() {
    try {
      const tracks = await db.getAll(STORES.TRACKS);
      return tracks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error('获取所有赛道失败:', error);
      return [];
    }
  }
  
  // 获取单个赛道
  async getTrack(id) {
    try {
      const track = await db.get(STORES.TRACKS, id);
      return track;
    } catch (error) {
      console.error(`获取赛道 ${id} 失败:`, error);
      return null;
    }
  }
  
  // 添加赛道
  async addTrack(track) {
    try {
      // 确保必要的字段
      const newTrack = {
        ...track,
        id: track.id || `track-${Date.now()}`,
        createdAt: track.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.add(STORES.TRACKS, newTrack);
      return newTrack;
    } catch (error) {
      console.error('添加赛道失败:', error);
      throw error;
    }
  }
  
  // 更新赛道
  async updateTrack(track) {
    try {
      // 确保必要的字段
      const updatedTrack = {
        ...track,
        updatedAt: new Date().toISOString()
      };
      
      await db.update(STORES.TRACKS, updatedTrack);
      return updatedTrack;
    } catch (error) {
      console.error(`更新赛道 ${track.id} 失败:`, error);
      throw error;
    }
  }
  
  // 删除赛道
  async deleteTrack(id) {
    try {
      await db.delete(STORES.TRACKS, id);
      return true;
    } catch (error) {
      console.error(`删除赛道 ${id} 失败:`, error);
      throw error;
    }
  }
  
  // 导出赛道数据
  exportTrack(track) {
    return JSON.stringify(track, null, 2);
  }
  
  // 导入赛道数据
  async importTrack(trackData) {
    try {
      let track;
      
      if (typeof trackData === 'string') {
        track = JSON.parse(trackData);
      } else {
        track = trackData;
      }
      
      // 验证数据结构
      if (!track.id || !track.name) {
        throw new Error('无效的赛道数据');
      }
      
      // 检查赛道ID是否已存在
      const existingTrack = await this.getTrack(track.id);
      if (existingTrack) {
        // 生成新ID
        track.id = `track-${Date.now()}`;
      }
      
      // 更新时间戳
      track.createdAt = new Date().toISOString();
      track.updatedAt = new Date().toISOString();
      
      // 添加到数据库
      return await this.addTrack(track);
    } catch (error) {
      console.error('导入赛道失败:', error);
      throw error;
    }
  }
}

export const trackService = new TrackService(); 