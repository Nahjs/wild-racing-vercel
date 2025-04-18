import { ref, onMounted, onUnmounted, markRaw, toRaw } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Default options for scene setup (closer to original)
const defaultOptions = {
  cameraPosition: new THREE.Vector3(0, 0.8, 8),
  cameraFov: 30,
  nearPlane: 0.1,
  farPlane: 1000,
  backgroundColor: 0x111111, // Default background, can be overridden later
  enableShadows: true,
  shadowMapType: THREE.PCFSoftShadowMap,
  shadowMapSize: 2048,
  enableOrbitControls: true,
  orbitControlsOptions: { // Options from the original Garage.vue setup
    enableDamping: true,
    dampingFactor: 0.05,
    rotateSpeed: 0.5,
    enableZoom: true,
    zoomSpeed: 0.5,
    enablePan: true,
    panSpeed: 0.5,
    minDistance: 3,
    maxDistance: 20,
    minPolarAngle: Math.PI / 4,
    maxPolarAngle: Math.PI / 2,
  },
  enableGridHelper: false, // Initially false, controlled by debug panel
  gridSize: 10,
  gridDivisions: 10,
  enableAxesHelper: false, // Initially false, controlled by debug panel
  axesSize: 1,
};

export function useSceneSetup(canvasRef, options = {}) {
  const mergedOptions = { ...defaultOptions, ...options }; // Allow overriding defaults

  const scene = ref(null);
  const camera = ref(null);
  const renderer = ref(null);
  const controls = ref(null);
  let animationFrameId = null;
  let rawScene, rawCamera, rawRenderer, rawControls;
  let gridHelper = null; // Hold reference to grid helper
  let axesHelper = null; // Hold reference to axes helper

  function init() {
    if (!canvasRef.value) {
      console.error('useSceneSetup: Canvas element reference is not available.');
      return;
    }

    // Scene
    rawScene = markRaw(new THREE.Scene());
    rawScene.background = new THREE.Color(mergedOptions.backgroundColor);
    scene.value = rawScene;

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    rawCamera = markRaw(new THREE.PerspectiveCamera(
      mergedOptions.cameraFov,
      aspect,
      mergedOptions.nearPlane,
      mergedOptions.farPlane
    ));
    rawCamera.position.copy(mergedOptions.cameraPosition);
    camera.value = rawCamera;

    // Renderer
    rawRenderer = markRaw(new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true, // Match original renderer options
    }));
    rawRenderer.setSize(window.innerWidth, window.innerHeight);
    rawRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Match original DPR handling

    // Match original render settings
    if (mergedOptions.enableShadows) {
      rawRenderer.shadowMap.enabled = true;
      rawRenderer.shadowMap.type = mergedOptions.shadowMapType;
      rawRenderer.shadowMap.autoUpdate = true; // Keep autoUpdate for simplicity
    }
    rawRenderer.outputEncoding = THREE.sRGBEncoding;
    rawRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    rawRenderer.toneMappingExposure = 1.2;

    renderer.value = rawRenderer;

    // Orbit Controls
    if (mergedOptions.enableOrbitControls) {
      rawControls = markRaw(new OrbitControls(rawCamera, rawRenderer.domElement));
      Object.assign(rawControls, mergedOptions.orbitControlsOptions);
      rawControls.enabled = true; // Enable by default for Garage view
      controls.value = rawControls;
    }

    // Helpers (conditionally added later)
    if (mergedOptions.enableGridHelper) {
      addGridHelper(mergedOptions.gridSize, mergedOptions.gridDivisions);
    }
    if (mergedOptions.enableAxesHelper) {
      addAxesHelper(mergedOptions.axesSize);
    }

    // Handle Resize
    window.addEventListener('resize', handleResize);

    console.log('useSceneSetup: Scene initialized.');
  }

  function handleResize() {
    if (rawCamera && rawRenderer) {
      rawCamera.aspect = window.innerWidth / window.innerHeight;
      rawCamera.updateProjectionMatrix();
      rawRenderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  function startAnimationLoop(updateCallback = null) {
    function animate() {
      animationFrameId = requestAnimationFrame(animate);

      // Update controls if they exist and have damping enabled
      if (rawControls && rawControls.enabled && rawControls.enableDamping) {
        rawControls.update();
      }

      // Call external update logic if provided
      if (updateCallback) {
        updateCallback();
      }

      if (rawRenderer && rawScene && rawCamera) {
        try {
          rawRenderer.render(rawScene, rawCamera);
        } catch (error) {
          console.error("Error in render loop:", error);
          if (error.message && error.message.includes('property') && error.message.includes('read-only')) {
            console.warn("Detected proxy error, attempting to get raw objects again...");
            if (renderer.value) rawRenderer = toRaw(renderer.value);
            if (scene.value) rawScene = toRaw(scene.value);
            if (camera.value) rawCamera = toRaw(camera.value);
          }
        }
      }
    }
    // Prevent multiple loops
    if (animationFrameId === null) {
        animate();
        console.log('useSceneSetup: Animation loop started.');
    } else {
        console.log('useSceneSetup: Animation loop already running.');
    }
  }

  function stopAnimationLoop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      console.log('useSceneSetup: Animation loop stopped.');
    }
  }

  // --- Helper Functions --- 
  function addGridHelper(size = 10, divisions = 10) {
      if (!rawScene) return;
      removeGridHelper(); // Remove existing if any
      gridHelper = markRaw(new THREE.GridHelper(size, divisions));
      rawScene.add(gridHelper);
  }

  function removeGridHelper() {
      if (gridHelper && rawScene) {
          rawScene.remove(gridHelper);
          gridHelper.geometry?.dispose();
          gridHelper.material?.dispose();
          gridHelper = null;
      }
  }

  function addAxesHelper(size = 1) {
      if (!rawScene) return;
      removeAxesHelper(); // Remove existing if any
      axesHelper = markRaw(new THREE.AxesHelper(size));
      rawScene.add(axesHelper);
  }

  function removeAxesHelper() {
      if (axesHelper && rawScene) {
          rawScene.remove(axesHelper);
          axesHelper.geometry?.dispose();
          axesHelper.material?.dispose();
          axesHelper = null;
      }
  }

  function updateGridHelperSize(size, divisions) {
      if (gridHelper) {
          removeGridHelper();
          addGridHelper(size, divisions);
      }
  }

  function updateAxesHelperSize(size) {
      if (axesHelper) {
          removeAxesHelper();
          addAxesHelper(size);
      }
  }
  // --- End Helper Functions ---

  function cleanup() {
    stopAnimationLoop();
    window.removeEventListener('resize', handleResize);

    if (rawControls) {
      rawControls.dispose();
    }
    if (gridHelper) {
      removeGridHelper();
    }
    if (axesHelper) {
      removeAxesHelper();
    }

    if (rawRenderer) {
      rawRenderer.dispose();
      rawRenderer.forceContextLoss(); // Force context loss
      // Remove the canvas element if it's managed internally (optional)
      // canvasRef.value?.remove();
    }
    if (rawScene) {
      rawScene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            // Dispose textures
            Object.values(material).forEach(value => {
              if (value instanceof THREE.Texture) {
                value.dispose();
              }
            });
            material.dispose();
          });
        }
      });
      // Ensure all children are removed
      while (rawScene.children.length > 0) {
          rawScene.remove(rawScene.children[0]);
      }
    }
    scene.value = null;
    camera.value = null;
    renderer.value = null;
    controls.value = null;
    rawScene = null;
    rawCamera = null;
    rawRenderer = null;
    rawControls = null;
    gridHelper = null;
    axesHelper = null;
    console.log('useSceneSetup: Cleaned up resources.');
  }

  onMounted(() => {
    init();
  });

  // Expose scene, camera, renderer, controls, and lifecycle/helper methods
  return {
    scene,
    camera,
    renderer,
    controls,
    init, // Maybe not needed externally if auto-init works
    startAnimationLoop,
    stopAnimationLoop,
    cleanup,
    // Helper controls
    addGridHelper,
    removeGridHelper,
    addAxesHelper,
    removeAxesHelper,
    updateGridHelperSize,
    updateAxesHelperSize,
  };
} 