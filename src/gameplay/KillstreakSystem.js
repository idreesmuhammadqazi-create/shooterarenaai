// KillstreakSystem.js - UAV, Precision Airstrike, Attack Chopper, Tactical Nuke
import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';

export class KillstreakSystem {
  constructor(scene, enemyManager, particleSystem, cameraRig) {
    this.scene = scene;
    this.enemyManager = enemyManager;
    this.particles = particleSystem;
    this.cameraRig = cameraRig;

    this.currentStreak = 0;
    this.availableStreaks = {
      uav: false,
      airstrike: false,
      chopper: false,
      nuke: false
    };

    // Active streak states
    this.uavActive = false;
    this.uavTimer = 0;

    this.airstrikeActive = false;
    this.airstrikeTimer = 0;
    this.airstrikeShellsRemaining = 0;
    this.airstrikeTarget = new THREE.Vector3();

    this.chopperActive = false;
    this.chopperTimer = 0;
    this.chopperMesh = null;
    this.chopperFireTimer = 0;

    this.nukeActive = false;
    this.nukeTimer = 0;
    this.nukeCountdown = 10;
  }

  reset() {
    this.currentStreak = 0;
    this.availableStreaks = { uav: false, airstrike: false, chopper: false, nuke: false };
    this.uavActive = false;
    this.airstrikeActive = false;
    this.stopChopper();
    this.nukeActive = false;
  }

  // Register a kill towards streak
  addKill() {
    this.currentStreak++;

    if (this.currentStreak === 3 && !this.availableStreaks.uav) {
      this.availableStreaks.uav = true;
      soundFX.playVoiceCue('streakReady');
      return { streak: 'uav', name: 'UAV RECON (3 KILLS)' };
    }
    if (this.currentStreak === 5 && !this.availableStreaks.airstrike) {
      this.availableStreaks.airstrike = true;
      soundFX.playVoiceCue('streakReady');
      return { streak: 'airstrike', name: 'MORTAR BARRAGE (5 KILLS)' };
    }
    if (this.currentStreak === 7 && !this.availableStreaks.chopper) {
      this.availableStreaks.chopper = true;
      soundFX.playVoiceCue('streakReady');
      return { streak: 'chopper', name: 'ATTACK CHOPPER (7 KILLS)' };
    }
    if (this.currentStreak === 10 && !this.availableStreaks.nuke) {
      this.availableStreaks.nuke = true;
      soundFX.playVoiceCue('streakReady');
      return { streak: 'nuke', name: 'TACTICAL NUKE (10 KILLS)' };
    }

    return null;
  }

  // 1. Activate UAV
  activateUAV() {
    if (!this.availableStreaks.uav) return false;
    this.availableStreaks.uav = false;
    this.uavActive = true;
    this.uavTimer = 30.0; // 30s duration
    soundFX.playVoiceCue('uav');
    soundFX.playUavSweep();
    return true;
  }

  // 2. Activate Mortar Airstrike
  activateAirstrike(playerPos, forwardDir) {
    if (!this.availableStreaks.airstrike) return false;
    this.availableStreaks.airstrike = false;

    // Target ~20m in front of player
    this.airstrikeTarget.copy(playerPos).addScaledVector(forwardDir, 18);
    this.airstrikeTarget.y = 0.5;

    this.airstrikeActive = true;
    this.airstrikeTimer = 1.0;
    this.airstrikeShellsRemaining = 5;

    soundFX.playVoiceCue('airstrike');
    soundFX.playAirstrikeIncoming();
    return true;
  }

  // 3. Activate Attack Chopper
  activateChopper() {
    if (!this.availableStreaks.chopper) return false;
    this.availableStreaks.chopper = false;
    this.chopperActive = true;
    this.chopperTimer = 35.0; // 35s active

    this.createChopperMesh();
    soundFX.playVoiceCue('chopper');
    soundFX.startChopperSound();
    return true;
  }

  // 4. Activate Tactical Nuke
  activateNuke(onNukeDetonate) {
    if (!this.availableStreaks.nuke) return false;
    this.availableStreaks.nuke = false;
    this.nukeActive = true;
    this.nukeTimer = 10.0; // 10s countdown
    this.onNukeDetonate = onNukeDetonate;

    soundFX.playVoiceCue('nuke');
    soundFX.playNukeAlarm();
    return true;
  }

  createChopperMesh() {
    if (this.chopperMesh) this.scene.remove(this.chopperMesh);

    this.chopperMesh = new THREE.Group();
    // Fuselage
    const addBox = (x, y, z, w, h, d, col) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.3 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x + w / 2, y + h / 2, z + d / 2);
      this.chopperMesh.add(m);
    };

    addBox(-1, -0.8, -2, 2, 1.6, 4, 0x1f2420); // Main Body
    addBox(-0.6, -0.4, 2, 1.2, 0.8, 3, 0x1f2420); // Tail
    addBox(-1.5, 0.2, 4.8, 3, 0.2, 0.8, 0x151816); // Tail rotor
    // Rotor blades
    this.chopperRotor = new THREE.Group();
    const rGeo = new THREE.BoxGeometry(7, 0.1, 0.4);
    const rMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const r1 = new THREE.Mesh(rGeo, rMat);
    const r2 = new THREE.Mesh(rGeo, rMat);
    r2.rotation.y = Math.PI / 2;
    this.chopperRotor.add(r1, r2);
    this.chopperRotor.position.set(0, 1.1, 0);
    this.chopperMesh.add(this.chopperRotor);

    this.chopperAngle = 0;
    this.chopperMesh.position.set(0, 22, 0);
    this.scene.add(this.chopperMesh);
  }

  stopChopper() {
    if (this.chopperMesh) {
      this.scene.remove(this.chopperMesh);
      this.chopperMesh = null;
    }
    soundFX.stopChopperSound();
    this.chopperActive = false;
  }

  update(dt, onStreakKill) {
    // 1. Update UAV
    if (this.uavActive) {
      this.uavTimer -= dt;
      if (this.uavTimer <= 0) {
        this.uavActive = false;
      }
    }

    // 2. Update Mortar Airstrike
    if (this.airstrikeActive) {
      this.airstrikeTimer -= dt;
      if (this.airstrikeTimer <= 0 && this.airstrikeShellsRemaining > 0) {
        this.airstrikeTimer = 0.45;
        this.airstrikeShellsRemaining--;

        // Shell detonation with spread around target
        const blastPos = this.airstrikeTarget.clone();
        blastPos.x += (Math.random() - 0.5) * 8;
        blastPos.z += (Math.random() - 0.5) * 8;

        soundFX.playExplosion(0, false);
        this.particles.spawnExplosion(blastPos, 7.0);
        this.cameraRig.addShake(0.6);

        // Damage in blast radius
        const kills = this.enemyManager.damageEnemiesInRadius(blastPos, 8.5, 250, onStreakKill);
      }

      if (this.airstrikeShellsRemaining <= 0 && this.airstrikeTimer <= 0) {
        this.airstrikeActive = false;
      }
    }

    // 3. Update Attack Chopper
    if (this.chopperActive && this.chopperMesh) {
      this.chopperTimer -= dt;
      this.chopperAngle += dt * 0.4;
      if (this.chopperRotor) this.chopperRotor.rotation.y += dt * 35;

      const orbitRadius = 24;
      this.chopperMesh.position.x = Math.cos(this.chopperAngle) * orbitRadius;
      this.chopperMesh.position.z = Math.sin(this.chopperAngle) * orbitRadius;
      this.chopperMesh.position.y = 20 + Math.sin(this.chopperAngle * 2) * 2;
      this.chopperMesh.rotation.y = -this.chopperAngle + Math.PI / 2;

      // Chopper auto-targets closest ground enemy
      this.chopperFireTimer -= dt;
      if (this.chopperFireTimer <= 0) {
        this.chopperFireTimer = 0.2;

        const liveEnemies = this.enemyManager.enemies.filter(e => !e.isDead);
        if (liveEnemies.length > 0) {
          const target = liveEnemies[Math.floor(Math.random() * liveEnemies.length)];
          const targetPos = target.pos.clone().add(new THREE.Vector3(0, 0.8, 0));
          const chopperPos = this.chopperMesh.position.clone();

          // Fire heavy tracer
          this.particles.spawnTracer(chopperPos, targetPos, 140, 0xffaa00);
          soundFX.playGunshot('m4', false, 20);

          // Direct damage
          target.takeDamage(35, false, new THREE.Vector3(0, -1, 0), onStreakKill);
        }
      }

      if (this.chopperTimer <= 0) {
        this.stopChopper();
      }
    }

    // 4. Update Tactical Nuke
    if (this.nukeActive) {
      this.nukeTimer -= dt;
      if (this.nukeTimer <= 0) {
        this.nukeActive = false;
        if (this.onNukeDetonate) {
          this.onNukeDetonate();
        }
      }
    }
  }
}
