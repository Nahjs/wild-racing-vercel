<template>
  <div class="track-editor-view">
    <div class="scene-container">
      <canvas ref="sceneCanvas"></canvas>
    </div>
    
    <TrackEditor
      v-if="scene && physicsWorld && renderer && camera"
      :scene="scene"
      :physicsWorld="physicsWorld"
      :renderer="renderer"
      :camera="camera"
      @track-loaded="onTrackLoaded"
      @track-generated="onTrackGenerated"
      @race-started="onRaceStarted"
      @race-stopped="onRaceStopped"
      @object-placed="onObjectPlaced"
    />
    
    <div class="navbar">
      <h1>赛道编辑器</h1>
      <div class="nav-links">
        <router-link to="/">返回主页</router-link>
        <router-link to="/garage">车库</router-link>
        <router-link to="/race">开始比赛</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import TrackEditor from '@/game/track/TrackEditor.vue';

export default {
  name: 'TrackEditorView',
  components: {
    TrackEditor
  },
  setup() {
    // 场景引用
    const sceneCanvas = ref(null);
    const scene = ref(null);
    const camera = ref(null);
    const renderer = ref(null);
    const controls = ref(null);
    const physicsWorld = ref(null);
    
    // 渲染循环
    let animationFrameId = null;
    
    // 初始化三维场景
    const initScene = () => {
      // 创建场景
      scene.value = new THREE.Scene();
      scene.value.background = new THREE.Color(0xc4e0f9); // 天蓝色背景
      
      // 添加环境光和平行光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.value.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(50, 200, 100);
      directionalLight.castShadow = true;
      
      // 设置阴影参数
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 500;
      directionalLight.shadow.camera.left = -100;
      directionalLight.shadow.camera.right = 100;
      directionalLight.shadow.camera.top = 100;
      directionalLight.shadow.camera.bottom = -100;
      
      scene.value.add(directionalLight);
      
      // 创建地面
      const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a5d1a,
        roughness: 0.8,
        metalness: 0.2
      });
      
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2; // 水平放置
      ground.receiveShadow = true;
      scene.value.add(ground);
      
      // 添加天空盒
      const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
      const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        side: THREE.BackSide
      });
      
      const sky = new THREE.Mesh(skyGeometry, skyMaterial);
      scene.value.add(sky);
      
      // 添加网格辅助线
      const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x888888);
      scene.value.add(gridHelper);
      
      // 创建相机
      camera.value = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.value.position.set(0, 50, 100);
      
      // 创建渲染器
      renderer.value = new THREE.WebGLRenderer({
        canvas: sceneCanvas.value,
        antialias: true
      });
      renderer.value.setSize(window.innerWidth, window.innerHeight);
      renderer.value.setPixelRatio(window.devicePixelRatio);
      renderer.value.shadowMap.enabled = true;
      renderer.value.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // 创建相机控制器
      controls.value = new OrbitControls(camera.value, renderer.value.domElement);
      controls.value.enableDamping = true;
      controls.value.dampingFactor = 0.05;
      
      // 初始化物理引擎
      physicsWorld.value = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
      });
      
      // 创建地面刚体
      const groundBody = new CANNON.Body({
        mass: 0, // 质量为0表示静态物体
        shape: new CANNON.Plane(),
        material: new CANNON.Material({ friction: 0.3 })
      });
      
      groundBody.quaternion.setFromAxisAngle(
        new CANNON.Vec3(1, 0, 0),
        -Math.PI / 2
      );
      
      physicsWorld.value.addBody(groundBody);
      
      // 设置默认接触材质
      physicsWorld.value.defaultContactMaterial.friction = 0.3;
      physicsWorld.value.defaultContactMaterial.restitution = 0.3;
      
      // 处理窗口大小变化
      window.addEventListener('resize', onWindowResize);
    };
    
    // 更新窗口大小
    const onWindowResize = () => {
      if (camera.value && renderer.value) {
        camera.value.aspect = window.innerWidth / window.innerHeight;
        camera.value.updateProjectionMatrix();
        renderer.value.setSize(window.innerWidth, window.innerHeight);
      }
    };
    
    // 渲染循环
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      if (physicsWorld.value) {
        physicsWorld.value.step(1 / 60);
      }
      
      if (controls.value) {
        controls.value.update();
      }
      
      if (renderer.value && scene.value && camera.value) {
        renderer.value.render(scene.value, camera.value);
      }
    };
    
    // 事件处理函数
    const onTrackLoaded = (data) => {
      console.log('赛道已加载:', data);
    };
    
    const onTrackGenerated = (data) => {
      console.log('赛道已生成:', data);
    };
    
    const onRaceStarted = () => {
      console.log('比赛已开始');
    };
    
    const onRaceStopped = () => {
      console.log('比赛已停止');
    };
    
    const onObjectPlaced = (data) => {
      console.log('放置物体:', data);
    };
    
    // 组件挂载
    onMounted(() => {
      initScene();
      animate();
    });
    
    // 组件卸载
    onUnmounted(() => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      window.removeEventListener('resize', onWindowResize);
      
      // 清理资源
      if (renderer.value) {
        renderer.value.dispose();
      }
      
      if (scene.value) {
        scene.value.traverse(object => {
          if (object.isMesh) {
            if (object.geometry) {
              object.geometry.dispose();
            }
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          }
        });
      }
    });
    
    return {
      sceneCanvas,
      scene,
      camera,
      renderer,
      physicsWorld,
      onTrackLoaded,
      onTrackGenerated,
      onRaceStarted,
      onRaceStopped,
      onObjectPlaced
    };
  }
};
</script>

<style scoped>
.track-editor-view {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.scene-container {
  width: 100%;
  height: 100%;
}

.navbar {
  position: fixed;
  top: 0;
  right: 0;
  padding: 15px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-bottom-left-radius: 8px;
  z-index: 1000;
  display: flex;
  align-items: center;
}

.navbar h1 {
  margin: 0;
  font-size: 18px;
  margin-right: 20px;
}

.nav-links {
  display: flex;
}

.nav-links a {
  color: white;
  text-decoration: none;
  margin-left: 15px;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.nav-links a:hover {
  background: rgba(255, 255, 255, 0.2);
}

.nav-links a.router-link-active {
  background: rgba(255, 255, 255, 0.3);
}
</style> 