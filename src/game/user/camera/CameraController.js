import * as THREE from 'three';

export const CameraMode = {
    NEAR_FOLLOW: 0, // 近景跟随
    FAR_FOLLOW: 1,  // 远景跟随
    FREE_LOOK: 2,   // 自由视角 (使用 OrbitControls)
};

export class CameraController {
    constructor(camera, target, orbitControls = null) {
        this.camera = camera;
        this.target = target; // 通常是车辆的 3D 对象 (Object3D)
        this.orbitControls = orbitControls; // 可选的 OrbitControls 实例

        // 确保target存在，如果不存在则创建虚拟目标
        if (!this.target) {
            console.warn("CameraController: Target object is missing, creating virtual target");
            this.target = new THREE.Object3D();
            this.target.position.set(0, 0, 0);
            this.virtualTarget = true; // 标记为虚拟目标
        } else {
            this.virtualTarget = false;
        }

        this.currentMode = CameraMode.NEAR_FOLLOW;
        this.enabled = true; // 控制器是否启用

        // 不同模式的参数 (可以从外部加载/设置)
        this.modes = [
            // NEAR_FOLLOW
            { distance: 8, height: 3, lookAtOffset: new THREE.Vector3(0, 1.5, 0), fov: 75, damping: 0.05 },
            // FAR_FOLLOW
            { distance: 15, height: 6, lookAtOffset: new THREE.Vector3(0, 2.0, 0), fov: 65, damping: 0.05 },
            // FREE_LOOK (参数主要由 OrbitControls 控制)
            { fov: 60, lookAtOffset: new THREE.Vector3(0, 1.0, 0) },
        ];

        // 内部状态
        this._currentLookAt = new THREE.Vector3();
        this._targetPosition = new THREE.Vector3();
        this._targetQuaternion = new THREE.Quaternion();
        this._cameraPosition = new THREE.Vector3();
        this._defaultPosition = new THREE.Vector3().copy(this.camera.position);

        // 初始化时应用第一个模式的FOV
        this.applyFov(this.modes[this.currentMode].fov);
    }

    // 应用FOV并确保更新投影矩阵
    applyFov(fov) {
        if (this.camera && this.camera.isPerspectiveCamera && fov) {
            if (this.camera.fov !== fov) {
                this.camera.fov = fov;
                this.camera.updateProjectionMatrix();
                return true;
            }
        }
        return false;
    }

    // 设置控制器是否启用
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.orbitControls) {
            // 只在FREE_LOOK模式下启用OrbitControls
            this.orbitControls.enabled = enabled && (this.currentMode === CameraMode.FREE_LOOK);
        }
    }

    // 设置相机模式
    setMode(modeIndex) {
        try {
            const newMode = Object.values(CameraMode)[modeIndex];
            if (newMode === undefined) {
                console.warn(`无效的相机模式索引: ${modeIndex}`);
                return false;
            }
            
            this.currentMode = newMode;
            const params = this.modes[this.currentMode];

            // 应用 FOV
            this.applyFov(params.fov);

            // 启用/禁用 OrbitControls
            if (this.orbitControls) {
                this.orbitControls.enabled = this.enabled && (this.currentMode === CameraMode.FREE_LOOK);
                if (this.currentMode === CameraMode.FREE_LOOK) {
                    // 如果切换到自由视角，设置控制器的目标
                    this.target.getWorldPosition(this._targetPosition);
                    this._currentLookAt.copy(this._targetPosition);
                    
                    // 添加lookAtOffset（如果存在）
                    if (params.lookAtOffset) {
                        this._currentLookAt.add(params.lookAtOffset);
                    } else {
                        // 使用近景的偏移量作为备选
                        this._currentLookAt.add(this.modes[CameraMode.NEAR_FOLLOW].lookAtOffset);
                    }
                    
                    this.orbitControls.target.copy(this._currentLookAt);
                    this.orbitControls.update();
                }
            }
            
            console.log(`相机模式设置为: ${Object.keys(CameraMode)[this.currentMode]}`);
            return true;
        } catch (error) {
            console.error("设置相机模式时出错:", error);
            return false;
        }
    }

    // 切换到下一个相机模式
    nextMode() {
        let nextIndex = (Object.values(CameraMode).indexOf(this.currentMode) + 1) % Object.values(CameraMode).length;
        return this.setMode(nextIndex);
    }

    // 获取当前模式的参数
    getParameters(mode = this.currentMode) {
        try {
            if (this.modes[mode]) {
                // 返回可序列化的参数副本
                return JSON.parse(JSON.stringify({
                    ...this.modes[mode],
                    // Vector3 需要特殊处理
                    lookAtOffset: this.modes[mode].lookAtOffset ? this.modes[mode].lookAtOffset.toArray() : null,
                }));
            }
        } catch (error) {
            console.error("获取相机参数时出错:", error);
        }
        return null;
    }

    // 设置相机参数
    setParameters(params, mode = this.currentMode) {
        try {
            if (!this.modes[mode]) {
                console.warn(`无效的模式索引: ${mode}`);
                return false;
            }
            
            const currentParams = this.modes[mode];
            for (const key in params) {
                if (currentParams.hasOwnProperty(key)) {
                    if (key === 'lookAtOffset' && params.lookAtOffset && Array.isArray(params.lookAtOffset)) {
                        if (!currentParams.lookAtOffset) {
                            currentParams.lookAtOffset = new THREE.Vector3();
                        }
                        currentParams.lookAtOffset.fromArray(params.lookAtOffset);
                    } else {
                        currentParams[key] = params[key];
                    }
                }
            }
            
            // 如果设置的是当前模式，立即应用 FOV
            if (mode === this.currentMode) {
                this.applyFov(currentParams.fov);
            }
            
            console.log(`相机参数已更新，模式: ${Object.keys(CameraMode)[mode]}`);
            return true;
        } catch (error) {
            console.error("设置相机参数时出错:", error);
            return false;
        }
    }

    // 重置相机到初始位置
    resetCamera() {
        if (this.camera) {
            this.camera.position.copy(this._defaultPosition);
            if (this.target && !this.virtualTarget) {
                this.target.getWorldPosition(this._targetPosition);
                this.camera.lookAt(this._targetPosition);
            } else {
                this.camera.lookAt(0, 0, 0);
            }
            
            if (this.orbitControls) {
                this.orbitControls.reset();
            }
        }
    }

    // 更新相机位置
    update(deltaTime) {
        if (!this.enabled || !this.camera) return;

        // 确保deltaTime是合理的值
        if (!deltaTime || deltaTime <= 0 || deltaTime > 1) {
            deltaTime = 1/60; // 默认60fps
        }

        try {
            // 如果是自由视角且有 OrbitControls，则由 OrbitControls 处理更新
            if (this.currentMode === CameraMode.FREE_LOOK) {
                if (this.orbitControls?.enabled) {
                    // OrbitControls 会在渲染循环中自动更新（如果 enableDamping=true）
                    // 或者需要手动调用 controls.update() 如果没有渲染循环处理它
                }
                return;
            }

            // 获取目标当前的世界位置和方向
            if (this.target && !this.virtualTarget) {
                this.target.getWorldPosition(this._targetPosition);
                this.target.getWorldQuaternion(this._targetQuaternion);
            } else {
                // 虚拟目标的默认位置
                this._targetPosition.set(0, 0, 0);
                this._targetQuaternion.set(0, 0, 0, 1);
            }

            const params = this.modes[this.currentMode];

            // 计算理想的相机位置
            // 偏移量基于目标的局部坐标系，所以先计算一个向后的向量，然后应用目标的世界旋转
            const idealOffset = new THREE.Vector3(0, params.height, -params.distance); // 相机在目标后上方
            idealOffset.applyQuaternion(this._targetQuaternion); // 将偏移量旋转到世界坐标
            idealOffset.add(this._targetPosition); // 将偏移量加到目标的世界位置上

            // 计算相机看向的目标点（带偏移）
            const idealLookAt = new THREE.Vector3();
            if (params.lookAtOffset) {
                idealLookAt.copy(params.lookAtOffset);
            }
            // LookAt 偏移量通常是相对于目标位置的世界坐标偏移，不需要应用旋转
            idealLookAt.add(this._targetPosition);

            // 使用 Lerp 实现平滑过渡 (阻尼)
            const lerpFactor = 1.0 - Math.exp(-params.damping / deltaTime); // 更稳定的阻尼因子
            // Clamp lerpFactor to avoid instability with large deltaTime
            const clampedLerpFactor = Math.min(1.0, lerpFactor * 60 * deltaTime); // Adjust based on target frame rate (e.g., 60fps)

            if (!this._cameraPosition.equals(this.camera.position)) {
                // 如果相机被外部移动，更新我们的内部位置
                this._cameraPosition.copy(this.camera.position);
            }

            this._cameraPosition.lerp(idealOffset, clampedLerpFactor);
            this._currentLookAt.lerp(idealLookAt, clampedLerpFactor);

            // 更新相机位置和朝向
            this.camera.position.copy(this._cameraPosition);
            this.camera.lookAt(this._currentLookAt);
        } catch (error) {
            console.error("更新相机时出错:", error);
        }
    }
} 