import { db, STORES } from '../utils/db';

const DEFAULT_SETTINGS = {
    id: 'user-settings',
    theme: 'light',
    language: 'zh',
    showTutorial: true,
  
    camera: {
        currentMode: 0, // NEAR_FOLLOW
        autoRotate: false,
        modes: {
            // NEAR_FOLLOW 模式
            0: { 
                distance: 8, 
                height: 3, 
                lookAtOffset: [0, 1.5, 0], 
                fov: 75, 
                damping: 0.05 
            },
            // FAR_FOLLOW 模式
            1: { 
                distance: 15, 
                height: 6, 
                lookAtOffset: [0, 2.0, 0], 
                fov: 65, 
                damping: 0.05 
            },
            // FREE_LOOK 模式
            2: { 
                fov: 60 
            }
        }
    },
    gridSettings: {
        showGrid: true,
        showAxes: true,
        gridSize: 20,
        gridDivisions: 20,
        axesSize: 10
    },
    updatedAt: new Date().toISOString()
};

class SettingsService {
    // 确保数组数据格式正确
    ensureArrayFormat(data) {
        if (data && data.cameraSettings && Array.isArray(data.cameraSettings.position)) {
            data.cameraSettings.position = [...data.cameraSettings.position];
        }
        return data;
    }

    // 初始化用户设置
    async initializeSettings() {
        try {
            const settings = await this.getSettings();
            if (!settings) {
                const initialSettings = {
                    ...DEFAULT_SETTINGS,
                    updatedAt: new Date().toISOString()
                };
                await db.add(STORES.USER_SETTINGS, this.ensureArrayFormat(initialSettings));
            }
        } catch (error) {
            console.error('初始化设置失败:', error);
            // 如果添加失败，尝试更新
            try {
                const updateSettings = {
                    ...DEFAULT_SETTINGS,
                    updatedAt: new Date().toISOString()
                };
                await db.update(STORES.USER_SETTINGS, this.ensureArrayFormat(updateSettings));
            } catch (updateError) {
                console.error('更新默认设置失败:', updateError);
            }
        }
    }

    // 获取用户设置
    async getSettings() {
        try {
            const settings = await db.get(STORES.USER_SETTINGS, 'user-settings');
            return this.ensureArrayFormat(settings || DEFAULT_SETTINGS);
        } catch (error) {
            console.error('获取设置失败:', error);
            return this.ensureArrayFormat(DEFAULT_SETTINGS);
        }
    }

    // 更新用户设置
    async updateSettings(settings) {
        try {
            const currentSettings = await this.getSettings();
            const newSettings = this.ensureArrayFormat({
                ...currentSettings,
                ...settings,
                id: 'user-settings',
                updatedAt: new Date().toISOString()
            });
            const result = await db.update(STORES.USER_SETTINGS, newSettings);
            if (!result) {
                throw new Error('更新设置失败');
            }
            return true;
        } catch (error) {
            console.error('更新设置失败:', error);
            return false;
        }
    }

    // 重置用户设置
    async resetSettings() {
        try {
            const resetSettings = {
                ...DEFAULT_SETTINGS,
                updatedAt: new Date().toISOString()
            };
            const result = await db.update(STORES.USER_SETTINGS, resetSettings);
            if (!result) {
                throw new Error('重置设置失败');
            }
            return true;
        } catch (error) {
            console.error('重置设置失败:', error);
            return false;
        }
    }

    // 更新相机设置
    async updateCameraSettings(cameraSettings) {
        try {
            const settings = await this.getSettings();
            const newSettings = this.ensureArrayFormat({
                ...settings,
                cameraSettings: {
                    ...settings.cameraSettings,
                    ...cameraSettings,
                    position: Array.isArray(cameraSettings.position) ? 
                        [...cameraSettings.position] : 
                        settings.cameraSettings.position
                }
            });
            return await this.updateSettings(newSettings);
        } catch (error) {
            console.error('更新相机设置失败:', error);
            return false;
        }
    }

    // 更新控制器设置
    async updateControlSettings(controlSettings) {
        try {
            const settings = await this.getSettings();
            const newSettings = {
                ...settings,
                controlSettings: {
                    ...settings.controlSettings,
                    ...controlSettings
                }
            };
            return await this.updateSettings(newSettings);
        } catch (error) {
            console.error('更新控制器设置失败:', error);
            return false;
        }
    }
}

export const settingsService = new SettingsService(); 