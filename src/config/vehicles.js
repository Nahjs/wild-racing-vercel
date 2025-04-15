import { vehicleService } from '../services/vehicleService';
import vehicleConfigs from './vehicle-configs-2025-04-15.json';

// 基础车辆配置列表
export const vehiclesList = vehicleConfigs.vehicles;

// 获取最新的车辆配置（包含数据库中保存的自定义设置）
export const getVehicles = async () => {
    try {
        // 初始化数据库
        await vehicleService.initializeVehicles();
        
        // 获取所有保存的车辆配置
        const savedConfigs = await Promise.all(
            vehiclesList.map(vehicle => vehicleService.getVehicle(vehicle.id))
        );
        
        // 合并基础配置和保存的配置
        return vehiclesList.map((baseConfig, index) => {
            const savedConfig = savedConfigs[index];
            // 优先使用数据库中的自定义设置，如果没有则使用JSON配置文件中的设置
            if (savedConfig && savedConfig.customSettings) {
                return {
                    ...baseConfig,
                    scale: savedConfig.customSettings.scale || baseConfig.scale,
                    position: savedConfig.customSettings.position || baseConfig.position,
                    rotation: savedConfig.customSettings.rotation || baseConfig.rotation,
                    colors: {
                        body: savedConfig.customSettings.colors?.body || baseConfig.colors?.body,
                        wheel: savedConfig.customSettings.colors?.wheel || baseConfig.colors?.wheel
                    }
                };
            }
            // 如果没有数据库配置，直接使用JSON配置文件中的设置
            return baseConfig;
        });
    } catch (error) {
        console.error('获取车辆配置失败:', error);
        // 如果获取失败，直接返回JSON配置文件中的设置
        return vehiclesList;
    }
}; 