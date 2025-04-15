import { vehiclesList } from '@/config/vehicles';
import { db } from '@/utils/db';
import { isOnline } from '@/utils/helpers';

// 离线存储 - 缓存未能保存的更新
const pendingUpdates = new Map();

class VehicleService {
    // 初始化车辆数据
    async initializeVehicles() {
        try {
            // 检查是否已有车辆数据
            const existingVehicles = await this.getAllVehicles();
            if (existingVehicles.length === 0) {
                // 如果没有数据，添加默认车辆
                await Promise.all(vehiclesList.map(vehicle => {
                    const vehicleWithDefaults = {
                        ...vehicle,
                        customSettings: {
                            scale: vehicle.scale || 1.0,
                            position: Array.isArray(vehicle.position) ? [...vehicle.position] : [0, 0, 0],
                            rotation: vehicle.rotation || -Math.PI/2,
                            colors: {
                                body: vehicle.colors?.body || "#2f426f",
                                wheel: vehicle.colors?.wheel || "#1a1a1a"
                            }
                        },
                        updatedAt: new Date().toISOString()
                    };
                    return this.addVehicle(vehicleWithDefaults);
                }));
            }
            
            // 尝试重新提交离线时缓存的更新
            this.retryPendingUpdates();
        } catch (error) {
            console.error('初始化车辆数据失败:', error);
            throw error;
        }
    }

    // 获取所有车辆
    async getAllVehicles() {
        try {
            const vehicles = await db.getAll('vehicles');
            return vehicles.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } catch (error) {
            console.error('获取所有车辆失败:', error);
            throw error;
        }
    }

    // 获取单个车辆
    async getVehicle(id) {
        try {
            const vehicle = await db.get('vehicles', id);
            if (vehicle && !vehicle.customSettings) {
                // 如果没有自定义设置，添加默认值
                vehicle.customSettings = {
                    scale: vehicle.scale || 1.0,
                    position: Array.isArray(vehicle.position) ? [...vehicle.position] : [0, 0, 0],
                    rotation: vehicle.rotation || -Math.PI/2,
                    colors: {
                        body: vehicle.colors?.body || "#2f426f",
                        wheel: vehicle.colors?.wheel || "#1a1a1a"
                    }
                };
                vehicle.updatedAt = new Date().toISOString();
                await this.updateVehicle(vehicle);
            }
            return vehicle;
        } catch (error) {
            console.error('获取车辆失败:', error);
            throw error;
        }
    }

    // 添加车辆
    async addVehicle(vehicle) {
        try {
            if (!vehicle.customSettings) {
                vehicle.customSettings = {
                    scale: vehicle.scale || 1.0,
                    position: Array.isArray(vehicle.position) ? [...vehicle.position] : [0, 0, 0],
                    rotation: vehicle.rotation || -Math.PI/2,
                    colors: {
                        body: vehicle.colors?.body || "#2f426f",
                        wheel: vehicle.colors?.wheel || "#1a1a1a"
                    }
                };
            }
            vehicle.updatedAt = new Date().toISOString();
            await db.add('vehicles', vehicle);
        } catch (error) {
            console.error('添加车辆失败:', error);
            throw error;
        }
    }

    // 更新车辆
    async updateVehicle(vehicle) {
        try {
            if (!vehicle.customSettings) {
                vehicle.customSettings = {
                    scale: vehicle.scale || 1.0,
                    position: Array.isArray(vehicle.position) ? [...vehicle.position] : [0, 0, 0],
                    rotation: vehicle.rotation || -Math.PI/2,
                    colors: {
                        body: vehicle.colors?.body || "#2f426f",
                        wheel: vehicle.colors?.wheel || "#1a1a1a"
                    }
                };
            }
            vehicle.updatedAt = new Date().toISOString();
            
            // 检查网络连接
            if (!isOnline()) {
                // 离线状态：保存到待处理更新
                pendingUpdates.set(vehicle.id, vehicle);
                console.warn('离线状态：更新已缓存，将在网络恢复后提交');
                
                // 监听网络恢复事件
                window.addEventListener('online', this.retryPendingUpdates.bind(this), { once: true });
                return vehicle;
            }
            
            // 在线状态：直接更新
            await db.update('vehicles', vehicle);
            return vehicle;
        } catch (error) {
            // 发生错误时缓存更新
            pendingUpdates.set(vehicle.id, vehicle);
            console.error('更新车辆失败，将在下次连接时重试:', error);
            
            // 监听网络恢复事件
            window.addEventListener('online', this.retryPendingUpdates.bind(this), { once: true });
            
            throw error;
        }
    }

    // 删除车辆
    async deleteVehicle(id) {
        try {
            await db.delete('vehicles', id);
        } catch (error) {
            console.error('删除车辆失败:', error);
            throw error;
        }
    }
    
    // 批量更新车辆设置
    async batchUpdateVehicle(id, updates) {
        try {
            // 获取当前车辆数据
            const currentVehicle = await db.get('vehicles', id);
            if (!currentVehicle) {
                throw new Error(`车辆 ${id} 不存在`);
            }
            
            // 合并更新
            const updatedVehicle = {
                ...currentVehicle,
                ...updates,
                // 总是包含customSettings
                customSettings: {
                    ...(currentVehicle.customSettings || {}),
                    ...(updates.customSettings || {})
                },
                updatedAt: new Date().toISOString()
            };
            
            // 更新数据库
            await this.updateVehicle(updatedVehicle);
            
            // 触发自定义事件通知系统其他部分
            this.notifyVehicleUpdated(updatedVehicle);
            
            return updatedVehicle;
        } catch (error) {
            console.error('批量更新车辆失败:', error);
            throw error;
        }
    }
    
    // 带有重试机制的更新
    async updateVehicleWithRetry(vehicle, maxRetries = 3) {
        let retries = 0;
        
        const tryUpdate = async () => {
            try {
                return await this.updateVehicle(vehicle);
            } catch (error) {
                if (retries < maxRetries && isOnline()) {
                    retries++;
                    console.log(`更新失败，第 ${retries} 次重试...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                    return tryUpdate();
                } else {
                    throw error;
                }
            }
        };
        
        return tryUpdate();
    }
    
    // 重试所有待处理的更新
    async retryPendingUpdates() {
        console.log(`尝试提交 ${pendingUpdates.size} 个待处理更新`);
        
        if (pendingUpdates.size === 0) return;
        
        for (const [id, vehicle] of pendingUpdates.entries()) {
            try {
                if (isOnline()) {
                    await db.update('vehicles', vehicle);
                    pendingUpdates.delete(id);
                    console.log(`成功提交更新: ${id}`);
                    
                    // 触发更新事件
                    this.notifyVehicleUpdated(vehicle);
                }
            } catch (error) {
                console.error(`重试更新失败: ${id}`, error);
            }
        }
        
        // 如果还有未完成的更新，继续监听在线事件
        if (pendingUpdates.size > 0) {
            window.addEventListener('online', this.retryPendingUpdates.bind(this), { once: true });
        }
    }
    
    // 事件通知系统
    notifyVehicleUpdated(vehicle) {
        const event = new CustomEvent('vehicleUpdated', { 
            detail: { vehicle } 
        });
        window.dispatchEvent(event);
    }
}

export const vehicleService = new VehicleService(); 