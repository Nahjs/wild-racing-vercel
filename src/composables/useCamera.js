import { ref, watch, onUnmounted, computed, shallowRef, nextTick, watchEffect } from 'vue';
// import { CameraController, CameraMode } from '@/game/user/camera/CameraController'; // 暂时移除
import { OrbitControls } from '@/utils/controls/OrbitControls'; // 确认路径正确
import { settingsService } from '@/services/settingsService';
import { Clock, Object3D, PerspectiveCamera, WebGLRenderer, Vector3 } from 'three';
import * as THREE from 'three'; // 添加完整的THREE导入

// 丰富相机模式
const CameraMode = {
  FREE_LOOK: 0,       // 自由视角
  FOLLOW: 1,          // 跟随视角
  COCKPIT: 2,         // 驾驶舱视角
  CHASE: 3,           // 追逐视角
  TOP_DOWN: 4,        // 俯视视角
  CINEMATIC: 5,       // 电影视角
};

/**
 * @typedef {import('three').PerspectiveCamera} PerspectiveCamera
 * @typedef {import('three').Object3D} Object3D
 * @typedef {import('@/utils/controls/OrbitControls').OrbitControls} OrbitControlsInstance
//  * @typedef {import('@/game/user/camera/CameraController').CameraController} CameraControllerInstance
 */

/**
 * @typedef {object} UseCameraOptions
 * @property {number} [initialMode=CameraMode.FREE_LOOK] - 初始相机模式.
 * @property {boolean} [listenForKeys=true] - 是否监听 'V' 键切换模式.
 * @property {boolean} [handleUpdates=true] - 是否在内部处理相机更新 (调用 cameraController.update).
 */

/**
 * 可复用的 Vue Composition API 用于管理 Three.js 相机控制. (简化版)
 * @param {import('vue').Ref<PerspectiveCamera | null>} cameraRef - 相机对象的 Ref.
 * @param {import('vue').Ref<Object3D | null>} targetRef - 相机目标对象 (例如车辆模型) 的 Ref.
 * @param {import('vue').Ref<HTMLElement | null>} rendererElementRef - 用于 OrbitControls 的渲染器 DOM 元素 Ref.
 * @param {UseCameraOptions} [options={}] - 配置选项.
 * @returns {{
 *   isInitialized: import('vue').Ref<boolean>,
 *   currentCameraMode: import('vue').Ref<number>,
 *   cameraParams: import('vue').Ref<object>,
 *   autoRotate: import('vue').Ref<boolean>,
 *   isSaving: import('vue').Ref<boolean>,
 *   controls: import('vue').ShallowRef<OrbitControlsInstance | null>,
//  *   cameraController: import('vue').ShallowRef<CameraControllerInstance | null>,
 *   setMode: (modeIndex: number) => boolean,
 *   nextMode: () => void,
 *   updateParameters: (newParams: object, mode?: number) => boolean,
 *   saveSettings: () => Promise<void>,
 *   loadSettings: () => Promise<void>,
 *   update: () => void,
 *   cleanup: () => void
 * }}
 */
export function useCamera(cameraRef, targetRef, rendererElementRef, options = {}) {
    const { initialMode = CameraMode.FREE_LOOK, listenForKeys = true, handleUpdates = true, enableAutoSave = false } = options;

    // 使用 shallowRef 来存储 Three.js 实例以获得更好的性能
    // const cameraController = shallowRef(null); // 暂时移除
    const controls = shallowRef(null);
    const currentCameraMode = ref(initialMode);
    const cameraParams = ref({}); // 当前模式的参数
    const autoRotate = ref(false); // 适用于自由视角
    const isInitialized = ref(false);
    const isSaving = ref(false);
    const clock = new Clock(); // 用于更新增量时间

    // 默认相机模式参数
    const defaultCameraParams = {
        [CameraMode.FREE_LOOK]: {
            distance: 15,           // 初始距离，之后由用户完全控制
            height: 5,              // 初始高度，之后由用户完全控制
            damping: 0.05,
            rotationSpeed: 0.8,
            maxPolarAngle: Math.PI, // 允许完全的上下视角
            minDistance: 2,         // 最小距离减小，给用户更多控制空间
            maxDistance: 100,       // 最大距离增加，可以看得更远
        },
        [CameraMode.FOLLOW]: {
            distance: 15,           // 增加距离
            height: 15,              // 增加高度
            offset: new THREE.Vector3(0, 3, -10), // 调整跟随偏移
            lookAtOffset: new THREE.Vector3(0, 1, 10), // 看向车辆前方
            damping: 0.1,           // 阻尼值，平滑相机移动
        },
        [CameraMode.COCKPIT]: {
            offset: new THREE.Vector3(0, 5, 0.2), // 调整驾驶舱位置
            lookAtOffset: new THREE.Vector3(0, 1.0, 15), // 看向前方更远处
            fov: 75,                // 视场角
        },
        [CameraMode.CHASE]: {
            distance: 8,            // 增加距离
            height: 2.5,            // 增加高度
            offset: new THREE.Vector3(0, 1.5, -6), // 调整追逐偏移
            lookAtOffset: new THREE.Vector3(0, 0.5, 10), // 看向车辆前方更远处
            damping: 0.15,          // 较高阻尼值，更平滑的跟随
        },
        [CameraMode.TOP_DOWN]: {
            distance: 30,           // 增加高空距离
            height: 25,             // 增加高度
            angle: 0,               // 俯视角度
        },
        [CameraMode.CINEMATIC]: {
            autoRotate: true,       // 自动围绕车辆旋转
            autoRotateSpeed: 0.3,   // 旋转速度降低，更平滑
            distance: 18,           // 增加距离
            height: 4,              // 增加高度
            damping: 0.08,          // 阻尼值
        }
    };

    const initialize = async () => {
        // 确保所有必要的 Refs 都已准备好，并且尚未初始化
        if (!cameraRef.value || !targetRef.value || !rendererElementRef.value || isInitialized.value) {
            return;
        }

        try {
            // 创建 OrbitControls (自由视角需要)
            if (rendererElementRef.value) {
                const orbitControlsInstance = new OrbitControls(cameraRef.value, rendererElementRef.value);
                orbitControlsInstance.enableDamping = true;
                orbitControlsInstance.dampingFactor = 0.05;
                orbitControlsInstance.zoomSpeed = 0.7; // 增加缩放速度
                
                // 初始化视距设置 - 更大的范围
                orbitControlsInstance.minDistance = 2; // 减小最小距离，给予更多控制
                orbitControlsInstance.maxDistance = 100; // 增加最大距离，可以看得更远
                
                // 允许更完全的上下旋转
                orbitControlsInstance.maxPolarAngle = Math.PI; 
                orbitControlsInstance.minPolarAngle = 0;
                
                // 确保轨道控制的目标始终是车辆
                if (targetRef.value) {
                    orbitControlsInstance.target = targetRef.value.position.clone();
                }
                
                // 位置调整
                if (cameraRef.value) {
                    cameraRef.value.position.set(15, 8, 15); // 设置一个更远的初始位置
                    if (targetRef.value) {
                        cameraRef.value.lookAt(targetRef.value.position);
                    }
                }
                
                controls.value = orbitControlsInstance; // 使用 shallowRef 赋值
            } else {
                 console.warn("useCamera: rendererElementRef is missing, OrbitControls not created.");
            }


            // 创建 CameraController (暂时移除)
            // const controllerInstance = new CameraController(cameraRef.value, targetRef.value, controls.value);
            // cameraController.value = controllerInstance; // 使用 shallowRef 赋值

            // 加载设置并设置初始模式
            await loadSettings().then(() => {
                // 确保 OrbitControls 状态与加载的模式匹配
                if (controls.value) {
                    controls.value.enabled = currentCameraMode.value === CameraMode.FREE_LOOK;
                    controls.value.autoRotate = autoRotate.value;
                }
                if (listenForKeys) {
                    setupKeyListener();
                }
                isInitialized.value = true;
            }).catch(error => {
                console.error("useCamera: Error loading settings during init:", error);
                // 加载失败时回退到初始模式
                setMode(initialMode);
                if (listenForKeys) {
                    setupKeyListener();
                }
                isInitialized.value = true; // 即使出错也标记为已初始化
            });

        } catch (error) {
            console.error("useCamera: Initialization failed:", error);
            cleanup(); // 初始化失败时清理资源
            isInitialized.value = false;
        }
    };

    // 监听 Refs 是否可用
    watch([cameraRef, targetRef, rendererElementRef], ([cam, target, elem]) => {
        if (cam && target && elem && !isInitialized.value) {
            initialize();
        }
        // 如果相机或目标消失（例如，模型被替换），则清理
        if ((!cam || !target) && isInitialized.value) {
            console.warn("useCamera: Camera or Target became null. Cleaning up.");
            cleanup();
        }
    }, { immediate: true }); // 尝试立即执行，但要小心 Refs 可能尚未就绪

    const loadSettings = async () => {
        try {
            const settings = await settingsService.getSettings();
            // 确保 settings.camera 存在
            if (settings && settings.camera) {
                 // 加载模式参数
                if (settings.camera.modes) {
                    Object.values(CameraMode).forEach(modeIndex => {
                        if (settings.camera.modes[modeIndex]) {
                            cameraParams.value = {...defaultCameraParams[modeIndex], ...settings.camera.modes[modeIndex]};
                        } else {
                            // 如果没有保存的参数，使用默认值
                            cameraParams.value = {...defaultCameraParams[modeIndex]};
                        }
                    });
                } else {
                    // 如果没有保存的模式设置，使用默认参数
                    cameraParams.value = {...defaultCameraParams[currentCameraMode.value]};
                }

                // 设置当前模式，如果保存的值无效，则使用 initialMode
                const savedMode = settings.camera.currentMode;
                const isValidMode = Object.values(CameraMode).includes(savedMode);
                setMode(isValidMode ? savedMode : initialMode);

                // 加载自动旋转状态
                autoRotate.value = settings.camera.autoRotate ?? false;

            } else {
                setMode(initialMode); // 使用默认值
                autoRotate.value = false; // 默认自动旋转
                // 使用默认参数
                cameraParams.value = {...defaultCameraParams[initialMode]};
            }
            //  // 更新 cameraParams 以反映当前模式的设置 (简化)
            //  if (cameraController.value) {
            //     cameraParams.value = cameraController.value.getParameters() || {};
            //  }

        } catch (error) {
            console.error('useCamera: Failed to load camera settings:', error);
            setMode(initialMode); // 出错时回退到默认值
            autoRotate.value = false;
            // 使用默认参数
            cameraParams.value = {...defaultCameraParams[initialMode]};
        }
    };

    const saveSettings = async () => {
        // if (!cameraController.value) return; // 暂时移除
        isSaving.value = true;
        try {
            const settingsToSave = {
                currentMode: currentCameraMode.value,
                autoRotate: autoRotate.value,
                modes: {
                    // 只保存当前已有的参数 (通常是自由视角)
                    [CameraMode.FREE_LOOK]: cameraParams.value
                }
            };
            // Object.values(CameraMode).forEach(modeIndex => {
            //     // 从控制器获取可序列化的参数 (简化)
            //     // settingsToSave.modes[modeIndex] = cameraController.value.getParameters(modeIndex);
            // });
            await settingsService.updateSettings({ camera: settingsToSave });
        } catch (error) {
            console.error('useCamera: Failed to save camera settings:', error);
        } finally {
            isSaving.value = false;
        }
    };

    const setMode = (modeIndex) => {
         // 验证模式是否有效
         if (!Object.values(CameraMode).includes(modeIndex)) {
            console.warn(`useCamera: Invalid mode index ${modeIndex}`);
            return false;
        }
        
        currentCameraMode.value = modeIndex;
        
        // 更新 OrbitControls 状态
        if (controls.value) {
            // 自由视角模式启用轨道控制
            controls.value.enabled = currentCameraMode.value === CameraMode.FREE_LOOK;
            
            // 特殊处理自由视角模式
            if (currentCameraMode.value === CameraMode.FREE_LOOK) {
                // 关闭自动旋转，完全由用户控制
                controls.value.autoRotate = false;
                
                // 允许阻尼效果，使相机移动更平滑
                controls.value.enableDamping = true;
                controls.value.dampingFactor = 0.1;
                
                // 从默认或保存的参数更新OrbitControls
                const params = {...defaultCameraParams[CameraMode.FREE_LOOK], ...cameraParams.value};
                controls.value.minDistance = params.minDistance;
                controls.value.maxDistance = params.maxDistance;
                controls.value.maxPolarAngle = params.maxPolarAngle;
                
                // --- 新增：重置相机位置和目标 --- 
                if (targetRef.value && cameraRef.value) {
                    // 计算一个在目标后上方的位置
                    const offset = new THREE.Vector3(0, 5, 15); // 可以调整这个偏移量
                    const newCameraPos = targetRef.value.position.clone().add(offset);
                    cameraRef.value.position.copy(newCameraPos); // 直接设置，而不是lerp
                    
                    // 确保 controls 的目标也已更新
                    controls.value.target.copy(targetRef.value.position);
                    
                    // 更新 controls 状态以反映新位置/目标
                    controls.value.update();
                } else {
                     console.warn('useCamera: Cannot reset FREE_LOOK position, target or camera ref missing.');
                }
                // --- 重置结束 ---
            }
            // --- 新增：为 CHASE 模式设置初始状态 ---
            else if (currentCameraMode.value === CameraMode.CHASE) {
                // 确保 OrbitControls 禁用
                controls.value.enabled = false;
                controls.value.autoRotate = false; // Chase 模式通常不自动旋转
                
                if (targetRef.value && cameraRef.value) {
                    const params = {...defaultCameraParams[CameraMode.CHASE], ...cameraParams.value};
                    const targetPosition = targetRef.value.position.clone();
                    const targetQuaternion = targetRef.value.quaternion.clone();
                    
                    // 计算初始相机位置
                    const offset = new THREE.Vector3(params.offset.x, params.offset.y, params.offset.z);
                    offset.applyQuaternion(targetQuaternion);
                    const initialCameraPos = targetPosition.clone().add(offset);
                    cameraRef.value.position.copy(initialCameraPos);
                    
                    // 计算初始看向点
                    const lookAtOffset = new THREE.Vector3(params.lookAtOffset.x, params.lookAtOffset.y, params.lookAtOffset.z);
                    lookAtOffset.applyQuaternion(targetQuaternion);
                    const initialLookAtPoint = targetPosition.clone().add(lookAtOffset);
                    cameraRef.value.lookAt(initialLookAtPoint);
                    
                } else {
                     console.warn('useCamera: Cannot set initial CHASE state, target or camera ref missing.');
                }
            }
            // --- CHASE 模式初始状态设置结束 ---
            // 特殊处理电影视角模式
            else if (currentCameraMode.value === CameraMode.CINEMATIC) {
                controls.value.autoRotate = true;
                controls.value.autoRotateSpeed = defaultCameraParams[CameraMode.CINEMATIC].autoRotateSpeed;
            } else {
                controls.value.autoRotate = autoRotate.value;
            }
        }
        
        // 更新相机参数
        if (!cameraParams.value[modeIndex]) {
            cameraParams.value = {...defaultCameraParams[modeIndex]};
        }
        return true;
    };

    const nextMode = () => {
        // 获取所有模式的键名
        const modeValues = Object.values(CameraMode);
        // 当前模式的索引
        const currentIndex = modeValues.indexOf(currentCameraMode.value);
        // 计算下一个模式的索引 (循环)
        const nextIndex = (currentIndex + 1) % modeValues.length;
        // 获取下一个模式的值
        const nextModeValue = modeValues[nextIndex];
        
        console.log(`正在切换视角: 从 ${currentCameraMode.value} 到 ${nextModeValue}`);
        
        // 设置新模式
        setMode(nextModeValue);
    };

    const updateParameters = (newParams, mode = currentCameraMode.value) => {
         // 简化：只允许更新当前模式的参数
         if (mode === currentCameraMode.value) {
            cameraParams.value = { ...cameraParams.value, ...newParams };
            return true;
         } else {
            console.warn(`useCamera: Cannot update parameters for inactive mode ${mode}`);
            return false;
         }
         
         // 原有逻辑 (暂时移除)
         // if (cameraController.value?.setParameters(newParams, mode)) {
         //     // 如果更新的是当前模式，刷新响应式参数
         //     if (mode === currentCameraMode.value) {
         //         cameraParams.value = cameraController.value.getParameters() || {};
         //     }
         //     return true;
         // }
         // return false;
    };

    const update = () => {
        if (!isInitialized.value || !cameraRef.value || !targetRef.value) return;
        const delta = clock.getDelta();

        // 更新 OrbitControls (FREE_LOOK 模式)
        if (controls.value && currentCameraMode.value === CameraMode.FREE_LOOK) {
            // 只更新目标位置，但不重置相机位置
            controls.value.target.copy(targetRef.value.position);
            
            // 禁用自动旋转，确保用户控制
            controls.value.autoRotate = false;
            
            // 更新控制器
            controls.value.update();
            return;
        }
        
        // 处理其他相机模式
        switch (currentCameraMode.value) {
            case CameraMode.FOLLOW:
                updateFollowCamera();
                break;
            case CameraMode.COCKPIT:
                updateCockpitCamera();
                break;
            case CameraMode.CHASE:
                updateChaseCamera();
                break;
            case CameraMode.TOP_DOWN:
                updateTopDownCamera();
                break;
            case CameraMode.CINEMATIC:
                updateCinematicCamera();
                break;
        }
    };
    
    // 各种相机模式的更新函数
    const updateFollowCamera = () => {
        if (!targetRef.value || !cameraRef.value) return;
        
        const params = {...defaultCameraParams[CameraMode.FOLLOW], ...cameraParams.value};
        const targetPosition = targetRef.value.position.clone();
        const targetQuaternion = targetRef.value.quaternion.clone();
        
        // 计算相机位置
        const offset = new THREE.Vector3(
            params.offset.x, 
            params.offset.y, 
            params.offset.z
        );
        offset.applyQuaternion(targetQuaternion);
        const cameraPosition = targetPosition.clone().add(offset);
        
        // 平滑过渡到新位置
        cameraRef.value.position.lerp(cameraPosition, params.damping);
        
        // 计算相机看向的点
        const lookAtOffset = new THREE.Vector3(
            params.lookAtOffset.x, 
            params.lookAtOffset.y, 
            params.lookAtOffset.z
        );
        lookAtOffset.applyQuaternion(targetQuaternion);
        const lookAtPoint = targetPosition.clone().add(lookAtOffset);
        
        cameraRef.value.lookAt(lookAtPoint);
    };
    
    const updateCockpitCamera = () => {
        if (!targetRef.value || !cameraRef.value) return;
        
        const params = {...defaultCameraParams[CameraMode.COCKPIT], ...cameraParams.value};
        const targetPosition = targetRef.value.position.clone();
        const targetQuaternion = targetRef.value.quaternion.clone();
        
        // 计算驾驶舱位置
        const offset = new THREE.Vector3(
            params.offset.x, 
            params.offset.y, 
            params.offset.z
        );
        offset.applyQuaternion(targetQuaternion);
        cameraRef.value.position.copy(targetPosition.clone().add(offset));
        
        // --- 调整看向的点计算方式 ---
        // 1. 获取车辆的局部前方向量 (假设模型 Z 轴朝前)
        const localForward = new THREE.Vector3(0, 0, 1);
        // 2. 将局部前方向量转换为世界方向
        const worldForward = localForward.applyQuaternion(targetQuaternion);
        // 3. 计算相机前方的一个点作为看向的目标
        const lookAtPoint = cameraRef.value.position.clone().add(worldForward.multiplyScalar(100)); // 看向前方100个单位
        
        // 移除旧的计算方式
        // const lookAtOffset = new THREE.Vector3(
        //     params.lookAtOffset.x,
        //     params.lookAtOffset.y,
        //     params.lookAtOffset.z
        // );
        // lookAtOffset.applyQuaternion(targetQuaternion);
        // const lookAtPoint = targetPosition.clone().add(lookAtOffset);
        // ---------------------------
        
        cameraRef.value.lookAt(lookAtPoint);
        
        // 更新 FOV
        if (params.fov) {
            cameraRef.value.fov = params.fov;
            cameraRef.value.updateProjectionMatrix();
        }
    };
    
    const updateChaseCamera = () => {
        if (!targetRef.value || !cameraRef.value) return;
        
        const params = {...defaultCameraParams[CameraMode.CHASE], ...cameraParams.value};
        const targetPosition = targetRef.value.position.clone();
        const targetQuaternion = targetRef.value.quaternion.clone();
        
        // 计算相机位置 (紧跟在车后方)
        const offset = new THREE.Vector3(
            params.offset.x, 
            params.offset.y, 
            params.offset.z
        );
        offset.applyQuaternion(targetQuaternion);
        const cameraPosition = targetPosition.clone().add(offset);
        
        // 平滑过渡到新位置
        cameraRef.value.position.lerp(cameraPosition, params.damping);
        
        // 计算相机看向的点
        const lookAtOffset = new THREE.Vector3(
            params.lookAtOffset.x, 
            params.lookAtOffset.y, 
            params.lookAtOffset.z
        );
        lookAtOffset.applyQuaternion(targetQuaternion);
        const lookAtPoint = targetPosition.clone().add(lookAtOffset);
        
        cameraRef.value.lookAt(lookAtPoint);
    };
    
    const updateTopDownCamera = () => {
        if (!targetRef.value || !cameraRef.value) return;
        
        const params = {...defaultCameraParams[CameraMode.TOP_DOWN], ...cameraParams.value};
        const targetPosition = targetRef.value.position.clone();
        
        // 计算相机位置 (在车辆正上方)
        const cameraPosition = new THREE.Vector3(
            targetPosition.x,
            targetPosition.y + params.height,
            targetPosition.z
        );
        
        // 平滑过渡到新位置
        cameraRef.value.position.lerp(cameraPosition, 0.1);
        
        // 看向车辆
        cameraRef.value.lookAt(targetPosition);
    };
    
    const updateCinematicCamera = () => {
        if (!targetRef.value || !cameraRef.value) return;
        
        const params = {...defaultCameraParams[CameraMode.CINEMATIC], ...cameraParams.value};
        const targetPosition = targetRef.value.position.clone();
        
        // 电影视角 - 圆周运动
        const time = Date.now() * 0.001;
        const angle = time * params.autoRotateSpeed;
        
        const x = targetPosition.x + params.distance * Math.cos(angle);
        const z = targetPosition.z + params.distance * Math.sin(angle);
        const y = targetPosition.y + params.height;
        
        // 平滑过渡到新位置
        const newPosition = new THREE.Vector3(x, y, z);
        cameraRef.value.position.lerp(newPosition, params.damping);
        
        // 始终看向车辆
        cameraRef.value.lookAt(targetPosition);
    };

    // --- Keyboard listener ---
    const handleKeyDown = (event) => {
        if (event.key === 'v' || event.key === 'V') {
            nextMode();
        }
    };

    const setupKeyListener = () => {
        window.addEventListener('keydown', handleKeyDown);
    };

    const removeKeyListener = () => {
        window.removeEventListener('keydown', handleKeyDown);
    };

    // --- Cleanup --- 
    const cleanup = () => {
        removeKeyListener();
        if (controls.value) {
            controls.value.dispose();
            controls.value = null;
        }
        // if (cameraController.value) {
        //     // cameraController.value.dispose(); // Assuming CameraController has a dispose method
        //     cameraController.value = null;
        // }
        isInitialized.value = false;
        currentCameraMode.value = initialMode;
        cameraParams.value = {};
        autoRotate.value = false;
        // 不需要取消监听 Refs，它们会在组件卸载时自动处理
    };

    onUnmounted(cleanup);

    // 自动保存设置
    watchEffect(() => {
        if (isInitialized.value && enableAutoSave && (currentCameraMode.value || autoRotate.value || cameraParams.value)) {
            // 可以添加防抖来避免过于频繁的保存
             saveSettings(); 
        }
    });

    return {
        isInitialized,
        currentCameraMode,
        cameraParams,
        autoRotate,
        isSaving,
        controls,
        // cameraController, // 暂时移除
        setMode,
        nextMode,
        updateParameters,
        saveSettings,
        loadSettings,
        update, // 暴露 update 方法，如果父组件需要手动调用
        cleanup // 暴露 cleanup 方法，如果父组件需要手动调用
    };
}
