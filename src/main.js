// main.js - Application Entry Point, 3D Renderer, Game Coordinator
import * as THREE from 'three';
import { VoxelWorld } from './engine/VoxelWorld.js';
import { MapBuilder } from './engine/MapBuilder.js';
import { Physics } from './engine/Physics.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { Player } from './player/Player.js';
import { CameraRig } from './player/CameraRig.js';
import { ViewmodelRig } from './player/ViewmodelRig.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';
import { GrenadeManager } from './weapons/Grenade.js';
import { EnemyManager } from './ai/EnemyManager.js';
import { KillstreakSystem } from './gameplay/KillstreakSystem.js';
import { ScoreManager } from './gameplay/ScoreManager.js';
import { GameManager } from './gameplay/GameManager.js';
import { HUD } from './ui/HUD.js';
import { MenuManager } from './ui/MenuManager.js';
import { TouchControls } from './ui/TouchControls.js';
import { soundFX } from './audio/SoundFX.js';

class App {
  constructor() {
    this.container = document.getElementById('game-container');
    this.initThree();
    this.initGame();
    this.bindWindowEvents();
    this.startLoop();
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7da4be);
    this.scene.fog = new THREE.FogExp2(0x7da4be, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.05, 150);
    this.scene.add(this.camera);

    // 3. Renderer with soft shadows & sRGB color space
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    // Ambient Light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    // Hemisphere Light (Sky vs Ground tint)
    this.hemiLight = new THREE.HemisphereLight(0xbad2e3, 0x544738, 0.4);
    this.scene.add(this.hemiLight);

    // Directional Sun Light with Shadows
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    this.sunLight.position.set(30, 45, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
  }

  initGame() {
    // 1. Engine Systems
    this.voxelWorld = new VoxelWorld(this.scene);
    this.mapBuilder = new MapBuilder(this.voxelWorld);
    this.physics = new Physics(this.voxelWorld);
    this.particles = new ParticleSystem(this.scene);

    // 2. Player & Rig
    this.cameraRig = new CameraRig(this.camera, this.renderer.domElement);
    this.viewmodelRig = new ViewmodelRig(this.camera, this.scene);
    this.player = new Player(this.camera, this.scene, this.physics, this.particles);

    // 3. Weapons & Equipment
    this.weaponSystem = new WeaponSystem();
    this.grenadeManager = new GrenadeManager(this.scene, this.voxelWorld, this.physics, this.particles);

    // 4. AI & Director
    this.enemyManager = new EnemyManager(this.scene, this.physics, this.particles);

    // 5. Progression & Streaks
    this.scoreManager = new ScoreManager();
    this.killstreaks = new KillstreakSystem(this.scene, this.enemyManager, this.particles, this.cameraRig);

    // 6. Master Game Manager
    this.gameManager = new GameManager(
      this.player,
      this.enemyManager,
      this.weaponSystem,
      this.killstreaks,
      this.scoreManager,
      this.mapBuilder,
      this.cameraRig,
      this.viewmodelRig,
      this.particles,
      this.grenadeManager
    );

    // 7. HUD & Menus
    this.hud = new HUD(this.gameManager);
    this.gameManager.hud = this.hud;
    this.menuManager = new MenuManager(this.gameManager);
    this.touchControls = new TouchControls(this.player, this.cameraRig, this.weaponSystem, this.gameManager);

    // Initial default map load for menu background
    this.mapBuilder.loadMap('blockment');

    // Start background synth music on first user interaction
    const startAudioOnInteraction = () => {
      soundFX.init();
      soundFX.startMenuMusic();
      window.removeEventListener('click', startAudioOnInteraction);
      window.removeEventListener('keydown', startAudioOnInteraction);
      window.removeEventListener('touchstart', startAudioOnInteraction);
    };
    window.addEventListener('click', startAudioOnInteraction);
    window.addEventListener('keydown', startAudioOnInteraction);
    window.addEventListener('touchstart', startAudioOnInteraction);

    this.clock = new THREE.Clock();
    this.menuCamAngle = 0;
  }

  bindWindowEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);

      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.1); // Clamp delta time

      // 1. Main Menu Cinematic Camera Pan
      if (this.gameManager.gameState === 'menu') {
        this.menuCamAngle += dt * 0.15;
        const radius = 26;
        this.camera.position.set(
          Math.cos(this.menuCamAngle) * radius,
          12 + Math.sin(this.menuCamAngle * 1.5) * 2,
          Math.sin(this.menuCamAngle) * radius
        );
        this.camera.lookAt(0, 2, 0);
        this.particles.update(dt);
      } else {
        // 2. Active Game Loop Update
        this.gameManager.update(dt);
        this.hud.update(dt);
        this.menuManager.update(dt);
      }

      // 3. Render 3D Scene
      this.renderer.render(this.scene, this.camera);
    };

    loop();
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
