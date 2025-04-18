import { ref, watch, onUnmounted, computed, shallowRef, nextTick, watchEffect } from 'vue';
import { CameraController, CameraMode } from '@/game/user/camera/CameraController'; // 确认路径正确
import { OrbitControls } from '@/utils/controls/OrbitControls'; // 确认路径正确
import { settingsService } from '@/services/settingsService';
import { Clock, Object3D, PerspectiveCamera, WebGLRenderer } from 'three';

/**
 * @typedef {import('three').PerspectiveCamera} PerspectiveCamera
 * @typedef {import('three').Object3D} Object3D
 * @typedef {import('@/utils/controls/OrbitControls').OrbitControls} OrbitControlsInstance
 * @typedef {import('@/game/user/camera/CameraController').CameraController} CameraControllerInstance
 */

/**
 * @typedef {object} UseCameraOptions
 * @property {number} [initialMode=CameraMode.FREE_LOOK] - 初始相机模式.
 * @property {boolean} [listenForKeys=true] - 是否监听 'V' 键切换模式.
 * @property {boolean} [handleUpdates=true] - 是否在内部处理相机更新 (调用 cameraController.update).
 */

/**
 * 可复用的 Vue Composition API 用于管理 Three.js 相机控制.
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
 *   cameraController: import('vue').ShallowRef<CameraControllerInstance | null>,
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
    const cameraController = shallowRef(null);
    const controls = shallowRef(null);
    const currentCameraMode = ref(initialMode);
    const cameraParams = ref({}); // 当前模式的参数
    const autoRotate = ref(false); // 适用于自由视角
    const isInitialized = ref(false);
    const isSaving = ref(false);
    const clock = new Clock(); // 用于更新增量时间

    const initialize = async () => {
        // 确保所有必要的 Refs 都已准备好，并且尚未初始化
        if (!cameraRef.value || !targetRef.value || !rendererElementRef.value || isInitialized.value) {
            return;
        }
        console.log("useCamera: Initializing...");

        try {
            // 创建 OrbitControls (自由视角需要)
            // 确保只在需要时传递 DOM 元素
            if (rendererElementRef.value) {
                const orbitControlsInstance = new OrbitControls(cameraRef.value, rendererElementRef.value);
                orbitControlsInstance.enableDamping = true;
                orbitControlsInstance.dampingFactor = 0.05;
                orbitControlsInstance.zoomSpeed = 0.5; // 可选：调整缩放速度
                controls.value = orbitControlsInstance; // 使用 shallowRef 赋值
            } else {
                 console.warn("useCamera: rendererElementRef is missing, OrbitControls not created.");
            }


            // 创建 CameraController
            // 确保 CameraController 构造函数可以处理 controls 为 null 的情况（如果自由视角不是必须的）
            const controllerInstance = new CameraController(cameraRef.value, targetRef.value, controls.value);
            cameraController.value = controllerInstance; // 使用 shallowRef 赋值

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
                console.log("useCamera: Initialized successfully.");
            }).catch(error => {
                console.error("useCamera: Error loading settings during init:", error);
                // 加载失败时回退到初始模式
                setMode(initialMode);
                if (listenForKeys) {
                    setupKeyListener();
                }
                isInitialized.value = true; // 即使出错也标记为已初始化
                console.log("useCamera: Initialized with default settings due to load error.");
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
        if (!cameraController.value) return;
        console.log("useCamera: Loading camera settings...");
        try {
            const settings = await settingsService.getSettings();
            // 确保 settings.camera 存在
            if (settings && settings.camera) {
                // 加载每个模式的参数
                Object.values(CameraMode).forEach(modeIndex => {
                    if (settings.camera.modes && settings.camera.modes[modeIndex]) {
                        // 验证参数是否有效（例如，lookAtOffset 是否为数组）
                        const params = settings.camera.modes[modeIndex];
                         if (params.lookAtOffset && !Array.isArray(params.lookAtOffset)) {
                           console.warn(`useCamera: Invalid lookAtOffset format for mode ${modeIndex}, using default.`);
                           delete params.lookAtOffset; // 或者设置为默认值
                         }
                        cameraController.value.setParameters(params, modeIndex);
                    }
                });

                // 设置当前模式，如果保存的值无效，则使用 initialMode
                const savedMode = settings.camera.currentMode;
                const isValidMode = Object.values(CameraMode).includes(savedMode);
                setMode(isValidMode ? savedMode : initialMode);

                // 加载自动旋转状态
                autoRotate.value = settings.camera.autoRotate ?? false;

                console.log('useCamera: Loaded camera settings:', settings.camera);
            } else {
                console.log('useCamera: No saved camera settings found, using defaults.');
                setMode(initialMode); // 使用默认值
                autoRotate.value = false; // 默认自动旋转
            }
             // 更新 cameraParams 以反映当前模式的设置
             if (cameraController.value) {
                cameraParams.value = cameraController.value.getParameters() || {};
             }

        } catch (error) {
            console.error('useCamera: Failed to load camera settings:', error);
            setMode(initialMode); // 出错时回退到默认值
            autoRotate.value = false;
            // 更新 cameraParams
             if (cameraController.value) {
                cameraParams.value = cameraController.value.getParameters() || {};
             }
            // 不再抛出错误，以允许应用程序继续
            // throw error;
        }
    };

    const saveSettings = async () => {
        if (!cameraController.value) return;
        isSaving.value = true;
        console.log("useCamera: Saving camera settings...");
        try {
            const settingsToSave = {
                currentMode: currentCameraMode.value,
                autoRotate: autoRotate.value,
                modes: {}
            };
            Object.values(CameraMode).forEach(modeIndex => {
                // 从控制器获取可序列化的参数
                settingsToSave.modes[modeIndex] = cameraController.value.getParameters(modeIndex);
            });
            await settingsService.updateSettings({ camera: settingsToSave });
            console.log('useCamera: Saved camera settings:', settingsToSave);
        } catch (error) {
            console.error('useCamera: Failed to save camera settings:', error);
            // 可以选择通知用户保存失败
        } finally {
            isSaving.value = false;
        }
    };

    const setMode = (modeIndex) => {
        if (cameraController.value?.setMode(modeIndex)) {
            currentCameraMode.value = cameraController.value.currentMode;
            cameraParams.value = cameraController.value.getParameters() || {};
            // 更新 OrbitControls 状态
            if (controls.value) {
                controls.value.enabled = currentCameraMode.value === CameraMode.FREE_LOOK;
                 // 当切换到自由视角时，可能需要更新 target
                 if (controls.value.enabled && targetRef.value) {
                     // CameraController 内部会处理 target 更新
                     // controls.value.target.copy(targetRef.value.position);
                 }
            }
            console.log(`useCamera: Mode set to ${Object.keys(CameraMode)[currentCameraMode.value]}`);
            return true;
        } else {
            console.warn(`useCamera: Failed to set mode ${modeIndex}`);
            return false;
        }
    };

    const nextMode = () => {
        if (cameraController.value) {
            // 使用 CameraController 内部的 nextMode 逻辑
            if (cameraController.value.nextMode()) {
                currentCameraMode.value = cameraController.value.currentMode;
                cameraParams.value = cameraController.value.getParameters() || {};
                // 更新 OrbitControls 状态
                if (controls.value) {
                   controls.value.enabled = currentCameraMode.value === CameraMode.FREE_LOOK;
                }
                console.log(`useCamera: Mode switched to ${Object.keys(CameraMode)[currentCameraMode.value]}`);
            } else {
                 console.warn(`useCamera: nextMode() failed.`);
            }
        } else {
             console.warn(`useCamera: Cannot call nextMode(), controller not initialized.`);
        }
    };

    const updateParameters = (newParams, mode = currentCameraMode.value) => {
        if (cameraController.value?.setParameters(newParams, mode)) {
            // 如果更新的是当前模式，刷新响应式参数
            if (mode === currentCameraMode.value) {
                cameraParams.value = cameraController.value.getParameters() || {};
            }
            return true;
        }
        return false;
    };

    const update = () => {
        if (!isInitialized.value || !cameraController.value) return;
        const deltaTime = clock.getDelta();
        // OrbitControls 会在启用阻尼时自我更新
        // if (controls.value?.enabled && controls.value.enableDamping) {
        //     controls.value.update(); // OrbitControls 处理自己的更新
        // }
        // CameraController 处理所有模式的更新（包括在 FREE_LOOK 时不执行操作）
        cameraController.value.update(deltaTime);
    };

    // 键盘监听器
    const handleKeyDown = (event) => {
        // 避免在输入框内触发
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
            return;
        }
        if (event.key === 'v' || event.key === 'V') {
            nextMode();
        }
    };

    const setupKeyListener = () => {
        console.log("useCamera: Setting up key listener.");
        window.addEventListener('keydown', handleKeyDown);
    };

    const removeKeyListener = () => {
        console.log("useCamera: Removing key listener.");
        window.removeEventListener('keydown', handleKeyDown);
    };

    // 自动旋转处理
    watch(autoRotate, (newState) => {
        if (controls.value) {
            controls.value.autoRotate = newState;
        }
    });

    // 清理函数
    const cleanup = () => {
        console.log("useCamera: Cleaning up...");
        if (listenForKeys) {
            removeKeyListener();
        }
        if (controls.value) {
            controls.value.dispose();
            controls.value = null;
        }
        // CameraController 没有标准的 dispose 方法
        cameraController.value = null;
        isInitialized.value = false;
    };

    onUnmounted(cleanup);

    // 公开 API
    return {
        isInitialized,
        currentCameraMode,
        cameraParams,
        autoRotate,
        isSaving,
        controls,
        cameraController,

        setMode,
        nextMode,
        updateParameters,
        saveSettings,
        loadSettings,
        update,
        cleanup
    };
}
