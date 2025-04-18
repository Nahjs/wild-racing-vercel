import * as THREE from 'three';
import { ref, markRaw, toRaw, onUnmounted } from 'vue';
import {
  createContactShadow,
  generateVirtualLight,
  setMovingSpot,
  floatMesh,
  createCustomMaterial,
} from "@/utils/utils";

// Import necessary THREE components if not already
import {
  AmbientLight,
  SpotLight,
  PlaneGeometry,
  MeshPhongMaterial,
  Mesh,
  WebGLCubeRenderTarget,
  CubeCamera,
  SphereGeometry,
  HalfFloatType,
  PCFSoftShadowMap,
  DoubleSide,
  Color,
  Group
} from 'three';

export function useEnvironmentSetup(options = {}) {
  const config = {
    enableContactShadow: true,
    enableEnvironmentMap: true,
    enableBigSpotLight: true,
    ...options
  };

  // References to be managed by this composable
  const scene = ref(null); // Parent scene reference
  const renderer = ref(null); // Parent renderer reference
  const virtualScene = ref(null); // Scene for environment map rendering
  const shadowGroup = ref(null);
  const ambientLight = ref(null);
  const spotLight = ref(null); // The initial spotlight
  const bigSpotLight = ref(null); // The later stage spotlight
  const floorMesh = ref(null);
  const virtualBackgroundMesh = ref(null);
  const cubeCamera = ref(null);
  const fbo = ref(null); // Framebuffer object for env map
  let virtualRenderFrameId = null;

  function cleanupRef(refItem, parentScene, includeTarget = false) {
      const item = refItem.value;
      if (item) {
          if (parentScene && item.parent === parentScene) {
              parentScene.remove(item);
          }
          if (includeTarget && item.target && item.target.parent === parentScene) {
               parentScene.remove(item.target);
          }
          item.geometry?.dispose();
          if (item.material) {
              const materials = Array.isArray(item.material) ? item.material : [item.material];
              materials.forEach(m => m?.dispose());
          }
      }
      refItem.value = null;
  }

  function _cleanupVirtualScene() {
    if (virtualRenderFrameId) {
        cancelAnimationFrame(virtualRenderFrameId);
        virtualRenderFrameId = null;
    }
    
    // Dispose FBO first, before cleaning scene children
    if (fbo.value && typeof fbo.value.dispose === 'function') {
        fbo.value.dispose();
        console.log("useEnvironmentSetup: FBO disposed.");
    } else {
        console.log("useEnvironmentSetup: FBO was null or had no dispose method, or already disposed.");
    }
    fbo.value = null;
    
    const sceneToClean = virtualScene.value;
    if (sceneToClean) {
        // Iterate backwards for safe removal
        for (let i = sceneToClean.children.length - 1; i >= 0; i--) {
            const object = sceneToClean.children[i];
            if (object) { 
                sceneToClean.remove(object); 
                object.geometry?.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    // Simplify material disposal - material.dispose() should handle textures
                    materials.forEach(m => {
                        m?.dispose(); 
                    });
                }
            }
        } 
    }
    virtualScene.value = null; 
    virtualBackgroundMesh.value = null;
    cubeCamera.value = null;
    // fbo is already nulled out above
    console.log("useEnvironmentSetup: Virtual scene cleaned up.");
  }

  function _setAmbientLight(targetScene) {
    if (!targetScene) return;
    cleanupRef(ambientLight, targetScene);
    const light = markRaw(new AmbientLight(0x404040, 0.6));
    targetScene.add(light);
    ambientLight.value = light;
    console.log("useEnvironmentSetup: Ambient light set.");
  }

  function _setSpotLight(targetScene) {
    if (!targetScene) return;
    cleanupRef(spotLight, targetScene, true);
    const light = markRaw(new SpotLight(0xffffff, 3));
    light.position.set(0, 15, 0);
    light.penumbra = 1;
    light.angle = 0.5;
    light.shadow.bias = -0.0001;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.castShadow = true;
    light.target.position.set(0, 0, 6);
    targetScene.add(light.target);
    targetScene.add(light);
    spotLight.value = light;
    console.log("useEnvironmentSetup: Initial spotlight set.");
  }

  function _setBigSpotLight(targetScene, targetRenderer, modelZ = 0) {
    if (!targetScene || !targetRenderer) return;
    console.log("useEnvironmentSetup: Setting big spotlight...");
    cleanupRef(bigSpotLight, targetScene, true);
    cleanupRef(floorMesh, targetScene);

    const objectsToRemove = [];
    targetScene.traverse((child) => {
      if (child instanceof Mesh && child.geometry instanceof PlaneGeometry && child !== floorMesh.value) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach(child => {
        targetScene.remove(child);
        child.geometry?.dispose();
        if (child.material) {
             const materials = Array.isArray(child.material) ? child.material : [child.material];
             materials.forEach(m => m?.dispose());
        }
    });

    targetScene.background = new Color("#d4cfa3");
    targetRenderer.shadowMap.type = PCFSoftShadowMap;

    const material = markRaw(new MeshPhongMaterial({
      side: DoubleSide,
      color: "#00ff1a",
      emissive: "#ac8f3e",
    }));
    const geometry = markRaw(new PlaneGeometry(200, 200));
    const floor = markRaw(new Mesh(geometry, material));
    floor.rotation.x = Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.set(0, -1.02, 0);
    targetScene.add(floor);
    floorMesh.value = floor;
    console.log("useEnvironmentSetup: Floor mesh added.");

    const lightsToRemove = [];
    targetScene.traverse((child) => {
      if (child instanceof SpotLight && child !== spotLight.value && child !== bigSpotLight.value) {
        lightsToRemove.push(child);
      }
    });
     lightsToRemove.forEach(light => {
        targetScene.remove(light.target);
        targetScene.remove(light);
    });

    const light = markRaw(new SpotLight("#ffffff", 2));
    light.angle = Math.PI / 8;
    light.penumbra = 0.2;
    light.decay = 2;
    light.distance = 30;
    light.position.set(0, 10, 0);
    light.target.position.set(0, 0, modelZ);
    targetScene.add(light.target);
    targetScene.add(light);
    bigSpotLight.value = light;
    console.log("useEnvironmentSetup: Big spotlight added.");

    if (spotLight.value) {
      spotLight.value.visible = false;
      console.log("useEnvironmentSetup: Original spotlight hidden.");
    }
  }

  function _setContactShadow(targetScene, targetRenderer, modelZ = 0) {
    if (!targetScene || !targetRenderer) return;
    console.log("useEnvironmentSetup: Setting contact shadow...");
    cleanupRef(shadowGroup, targetScene);
    shadowGroup.value = markRaw(new Group());
    shadowGroup.value.position.set(0, -1.01, modelZ);
    shadowGroup.value.rotation.set(0, Math.PI / 2, 0);
    targetScene.add(shadowGroup.value);
    try {
        createContactShadow(targetScene, targetRenderer, shadowGroup.value);
        console.log("useEnvironmentSetup: Contact shadow created.");
    } catch (error) {
        console.error("useEnvironmentSetup: Error creating contact shadow:", error);
        cleanupRef(shadowGroup, targetScene);
    }
  }

  function _setEnvironment(targetScene, targetRenderer) {
    if (!targetScene || !targetRenderer) return;
    console.log("useEnvironmentSetup: Setting environment map...");
    _cleanupVirtualScene();

    if (targetScene.environment) {
      targetScene.environment.dispose();
      targetScene.environment = null;
    }
    if (targetScene.background && targetScene.background.isTexture) {
      targetScene.background.dispose();
    }
    targetScene.background = null;

    // Use THREE.Scene to create the virtual scene
    virtualScene.value = markRaw(new THREE.Scene());
    const resolution = 256;
    fbo.value = markRaw(new WebGLCubeRenderTarget(resolution));
    fbo.value.texture.type = HalfFloatType;
    cubeCamera.value = markRaw(new CubeCamera(1, 1000, fbo.value));
    virtualScene.value.add(cubeCamera.value);

    const lights = [
        generateVirtualLight({ intensity: 1.5, scale: [10, 10, 1], position: [0, 5, -9], rotation: [Math.PI / 2, 0, 0] }),
        generateVirtualLight({ intensity: 5, scale: [20, 0.1, 1], position: [-5, 1, -1], rotation: [0, Math.PI / 2, 0] }),
        generateVirtualLight({ intensity: 2, scale: [20, 0.5, 1], position: [-5, -1, -1], rotation: [0, Math.PI / 2, 0] }),
        generateVirtualLight({ intensity: 2, scale: [20, 1, 1], position: [10, 1, 0], rotation: [0, -Math.PI / 2, 0] }),
        generateVirtualLight({ form: "ring", color: "red", intensity: 2, scale: 10, position: [-15, 4, -18], target: [0, 0, 0] })
    ];
    lights.forEach(light => virtualScene.value.add(markRaw(light)));

    const geometry = markRaw(new SphereGeometry(1, 64, 64));
    const material = markRaw(createCustomMaterial("#2f2f2f"));
    virtualBackgroundMesh.value = markRaw(new Mesh(geometry, material));
    virtualBackgroundMesh.value.scale.set(100, 100, 100);
    virtualScene.value.add(virtualBackgroundMesh.value);

    floatMesh({ group: lights[4], speed: 5, rotationIntensity: 2, floatIntensity: 2 });
    setMovingSpot(virtualScene.value);

    targetScene.environment = fbo.value.texture;

    let count = 0;
    const frames = Infinity;
    function virtualRender() {
      if (frames === Infinity || count < frames) {
         if (cubeCamera.value && virtualScene.value && renderer.value) {
             try {
                cubeCamera.value.update(toRaw(renderer.value), toRaw(virtualScene.value));
                count++;
             } catch (e) {
                console.error("Error updating cube camera:", e);
             }
         } else {
              cancelAnimationFrame(virtualRenderFrameId);
              virtualRenderFrameId = null;
         }
      }
      if (virtualRenderFrameId !== null) {
        virtualRenderFrameId = requestAnimationFrame(virtualRender);
      }
    }

    if (virtualRenderFrameId) {
        cancelAnimationFrame(virtualRenderFrameId);
    }
    virtualRenderFrameId = requestAnimationFrame(virtualRender);
    console.log("useEnvironmentSetup: Environment map setup complete and virtual render loop started.");
  }

  // --- Public API --- 

  const initializeEnvironment = (sceneRef = null, rendererRef = null, modelZ = 0) => {
    scene.value = sceneRef;
    renderer.value = rendererRef;
    const targetScene = toRaw(scene.value);
    const targetRenderer = toRaw(renderer.value);

    if (!targetScene || !targetRenderer) {
      console.error("useEnvironmentSetup: Scene or renderer is not set.");
      return;
    }
    console.log("useEnvironmentSetup: Initializing environment...");
    try {
      _setAmbientLight(targetScene);
      _setSpotLight(targetScene);

      if (config.enableEnvironmentMap) {
          setTimeout(() => _setEnvironment(targetScene, targetRenderer), 600);
      }
      setTimeout(() => {
            if (config.enableBigSpotLight) {
                 if (spotLight.value) spotLight.value.visible = false;
                 _setBigSpotLight(targetScene, targetRenderer, modelZ);
            }
            if (config.enableContactShadow) {
                 _setContactShadow(targetScene, targetRenderer, modelZ);
            }
            console.log("useEnvironmentSetup: Delayed environment setup complete.");
      }, 900);

      console.log("useEnvironmentSetup: Initial environment setup complete (delayed steps scheduled).");
    } catch (error) {
      console.error("Environment initialization failed:", error);
    }
  };

  const cleanupEnvironment = () => {
    console.log("useEnvironmentSetup: Cleaning up environment...");
    const targetScene = toRaw(scene.value);
    _cleanupVirtualScene();
    cleanupRef(shadowGroup, targetScene);
    cleanupRef(ambientLight, targetScene);
    cleanupRef(spotLight, targetScene, true);
    cleanupRef(bigSpotLight, targetScene, true);
    cleanupRef(floorMesh, targetScene);
    scene.value = null;
    renderer.value = null;
    console.log("useEnvironmentSetup: Cleanup complete.");
  };

  // Add onUnmounted hook to automatically call cleanup
  onUnmounted(() => {
      cleanupEnvironment();
  });

  // Expose necessary functions and refs
  return {
    initializeEnvironment,
    cleanupEnvironment // Keep exposing in case manual cleanup is needed elsewhere
  };
}