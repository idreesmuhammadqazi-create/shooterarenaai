// GameManager.js - Master Game Loop, State Transitions, and Game Modes
import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';

export class GameManager {
  constructor(player, enemyManager, weaponSystem, killstreakSystem, scoreManager, mapBuilder, cameraRig, viewmodelRig, particleSystem, grenadeManager) {
    this.player = player;
    this.enemyManager = enemyManager;
    this.weaponSystem = weaponSystem;
    this.killstreaks = killstreakSystem;
    this.scoreManager = scoreManager;
    this.mapBuilder = mapBuilder;
    this.cameraRig = cameraRig;
    this.viewmodelRig = viewmodelRig;
    this.particles = particleSystem;
    this.grenades = grenadeManager;

    this.gameState = 'menu'; // 'menu' | 'playing' | 'paused' | 'respawning' | 'wave_cleared' | 'game_over'
    this.gameMode = 'wave'; // 'wave' | 'tdm' | 'gungame'
    this.currentMap = 'blockment';
    this.difficulty = 'regular';

    this.matchTime = 0;
    this.currentWave = 1;
    this.respawnTimer = 0;
    this.waveIntermissionTimer = 0;
    this.nukeFlashIntensity = 0;

    // Gun Game Weapon Ladder
    this.gunGameLadder = ['m4', 'vector', 'striker', 'vox50', 'magnum'];
    this.gunGameIndex = 0;

    // TDM Score Limits
    this.tdmTargetKills = 30;
    this.tdmEnemyScore = 0;
  }

  startMatch(mode = 'wave', mapId = 'blockment', difficulty = 'regular', primaryWeapon = 'm4', camo = 'standard', perks = {}) {
    this.gameMode = mode;
    this.currentMap = mapId;
    this.difficulty = difficulty;

    // Build selected Map
    this.mapBuilder.loadMap(mapId);
    this.enemyManager.setMapNodes(this.mapBuilder.spawnPoints, this.mapBuilder.coverNodes, this.mapBuilder.sniperNodes);
    this.enemyManager.setDifficulty(difficulty);

    // Setup Loadout & Perks
    this.weaponSystem.setupLoadout(primaryWeapon, 'magnum', camo, perks);
    this.viewmodelRig.setCamo(camo);
    this.viewmodelRig.setWeapon(primaryWeapon);

    // Reset systems
    this.scoreManager.resetMatch();
    this.killstreaks.reset();
    this.particles.clearAll();
    this.grenades.clear();

    // Spawn Player
    const playerSpawn = (this.mapBuilder.spawnPoints && this.mapBuilder.spawnPoints.length > 0) 
      ? this.mapBuilder.spawnPoints[0].clone() 
      : new THREE.Vector3(0, 1.6, 0);
    this.player.spawn(playerSpawn);

    this.matchTime = 0;
    this.currentWave = 1;
    this.gunGameIndex = 0;
    this.tdmEnemyScore = 0;
    this.nukeFlashIntensity = 0;

    if (this.gameMode === 'gungame') {
      const gWeapon = this.gunGameLadder[0];
      this.weaponSystem.setupLoadout(gWeapon, 'magnum', camo, perks);
      this.viewmodelRig.setWeapon(gWeapon);
    }

    // Start Mode
    this.enemyManager.clear();
    this.enemyManager.startWave(1);

    this.gameState = 'playing';
    soundFX.playVoiceCue('roundStart');
  }

  restartCurrentMatch() {
    this.startMatch(
      this.gameMode,
      this.currentMap,
      this.difficulty,
      this.weaponSystem.primaryWeaponId,
      this.weaponSystem.camo,
      this.weaponSystem.perks
    );
  }

  // Handle Player Shooting
  handlePlayerShoot() {
    if (this.gameState !== 'playing' || this.player.isDead) return;

    const isADS = this.player.keys.ads;
    const isMoving = this.player.velocity.lengthSq() > 0.1;
    const isSprinting = this.player.isSprinting;
    const isCrouching = this.player.isCrouching;

    const shotData = this.weaponSystem.fire(isADS, isMoving, isSprinting, isCrouching);
    if (!shotData) return;

    // Viewmodel & Camera recoil punch
    this.viewmodelRig.applyFireKick(shotData.kickZ, shotData.kickRotX);
    this.cameraRig.applyRecoil(shotData.recoilPitch, shotData.recoilYaw);

    const muzzleWorld = this.viewmodelRig.getMuzzleWorldPosition();
    const camForward = this.cameraRig.getForwardDirection();

    // Muzzle flash point light
    this.particles.flashMuzzle(muzzleWorld, 3.0, 10);

    // Eject brass casing
    this.particles.spawnShellCasing(muzzleWorld, this.cameraRig.getRightDirection());

    // Fire Raycasts (Support multi-pellet for Shotgun)
    const pellets = shotData.pellets;
    let anyHit = false;

    for (let p = 0; p < pellets; p++) {
      // Apply spread
      const shootDir = camForward.clone();
      if (shotData.spread > 0) {
        shootDir.x += (Math.random() - 0.5) * shotData.spread;
        shootDir.y += (Math.random() - 0.5) * shotData.spread;
        shootDir.z += (Math.random() - 0.5) * shotData.spread;
        shootDir.normalize();
      }

      // 1. Raycast against Enemy Hitboxes
      const enemyHit = this.enemyManager.raycastEnemies(this.cameraRig.camera.position, shootDir, 100);

      // 2. Raycast against Voxel World Geometry
      const voxelHit = this.mapBuilder.world.raycast(this.cameraRig.camera.position, shootDir, 100);

      let endPos = this.cameraRig.camera.position.clone().addScaledVector(shootDir, 80);

      if (enemyHit && (!voxelHit.hit || enemyHit.distance < voxelHit.distance)) {
        // HIT ENEMY!
        anyHit = true;
        endPos.copy(enemyHit.point);

        // Calculate falloff damage
        let finalDamage = shotData.damage;
        if (enemyHit.distance > shotData.rangeStart) {
          const falloffProgress = Math.min(1.0, (enemyHit.distance - shotData.rangeStart) / (shotData.rangeEnd - shotData.rangeStart));
          const mult = THREE.MathUtils.lerp(1.0, shotData.minDamageMult, falloffProgress);
          finalDamage *= mult;
        }

        if (enemyHit.isHeadshot) {
          finalDamage *= shotData.headshotMult;
        }
        finalDamage = Math.floor(finalDamage);

        // Apply damage to enemy
        enemyHit.enemy.takeDamage(finalDamage, enemyHit.isHeadshot, shootDir, (deadEnemy) => {
          this.handleEnemyKill(deadEnemy, enemyHit.isHeadshot, enemyHit.distance);
        });

        // Hitmarker feedback
        soundFX.playHitmarker(enemyHit.isHeadshot, enemyHit.enemy.isDead);
        this.hud?.showHitmarker(enemyHit.isHeadshot, enemyHit.enemy.isDead);
      } else if (voxelHit.hit) {
        // HIT VOXEL BLOCK
        endPos.copy(voxelHit.point);

        // Particle impact & sound
        const isMetal = (voxelHit.blockId === 4 || voxelHit.blockId === 5 || voxelHit.blockId === 9 || voxelHit.blockId === 12);
        this.particles.spawnImpact(voxelHit.point, voxelHit.normal, isMetal);
        soundFX.playBulletImpact(isMetal ? 'metal' : 'concrete');

        // Check destructible blocks (e.g. explosive barrels)
        this.mapBuilder.world.damageBlock(voxelHit.blockX, voxelHit.blockY, voxelHit.blockZ, shotData.damage, (barrelPos) => {
          this.handleExplosiveBarrelDetonate(barrelPos);
        });
      }

      // Spawn luminous bullet tracer
      this.particles.spawnTracer(muzzleWorld, endPos, 140, 0xffe285);
    }
  }

  // Handle Enemy Kill
  handleEnemyKill(enemy, isHeadshot, distance) {
    const currentWeapon = this.weaponSystem.getCurrentWeaponData();

    // Streak Check
    const streakReward = this.killstreaks.addKill();
    if (streakReward) {
      this.scoreManager.addScore(250, streakReward.name, true);
    }

    // Score & Killfeed Record
    this.scoreManager.recordKill(currentWeapon.name, isHeadshot, distance, this.killstreaks.currentStreak);

    // Scavenger Perk: replenish ammo on kill
    if (this.weaponSystem.perks.scavenger) {
      this.weaponSystem.addAmmo(30);
    }

    // Gun Game Mode Progression
    if (this.gameMode === 'gungame') {
      this.gunGameIndex++;
      if (this.gunGameIndex < this.gunGameLadder.length) {
        const nextW = this.gunGameLadder[this.gunGameIndex];
        this.weaponSystem.setupLoadout(nextW, 'magnum', this.weaponSystem.camo, this.weaponSystem.perks);
        this.viewmodelRig.setWeapon(nextW);
        this.scoreManager.addScore(200, 'WEAPON TIER UPGRADED!', true);
        soundFX.playVoiceCue('streakReady');
      } else {
        // Victory!
        this.gameState = 'game_over';
        soundFX.playVoiceCue('victory');
      }
    }

    // TDM check
    if (this.gameMode === 'tdm' && this.scoreManager.matchKills >= this.tdmTargetKills) {
      this.gameState = 'game_over';
      soundFX.playVoiceCue('victory');
    }
  }

  // Handle Enemy Bullet Fired at Player
  handleEnemyBullet(bulletData) {
    const { origin, direction, damage, shooter } = bulletData;

    // Check hit against player
    const playerEye = new THREE.Vector3(this.player.pos.x, this.player.pos.y + this.player.currentHeight * 0.6, this.player.pos.z);
    const toPlayer = new THREE.Vector3().subVectors(playerEye, origin);
    const dist = toPlayer.dot(direction);

    // Raycast world
    const voxelHit = this.mapBuilder.world.raycast(origin, direction, 80);

    let endPos = origin.clone().addScaledVector(direction, 60);

    if (dist > 0 && (!voxelHit.hit || dist < voxelHit.distance)) {
      const closestPoint = origin.clone().addScaledVector(direction, dist);
      const playerDistToRay = closestPoint.distanceTo(playerEye);

      if (playerDistToRay < 0.6) {
        // HIT PLAYER!
        endPos.copy(closestPoint);
        this.player.takeDamage(damage, origin);
        this.cameraRig.addShake(0.35);

        if (this.player.isDead) {
          this.handlePlayerDeath(shooter ? shooter.type : 'ENEMY');
        }
      }
    } else if (voxelHit.hit) {
      endPos.copy(voxelHit.point);
      this.particles.spawnImpact(voxelHit.point, voxelHit.normal, false);
    }

    // Tracer
    this.particles.spawnTracer(origin, endPos, 110, 0xff5533);
  }

  // Handle Player Death & Respawn Sequence
  handlePlayerDeath(killerType = 'ENEMY RIFLEMAN') {
    this.gameState = 'respawning';
    this.respawnTimer = 3.5;
    this.killstreaks.currentStreak = 0;
    this.scoreManager.recordDeath(killerType.toUpperCase());

    if (this.gameMode === 'tdm') {
      this.tdmEnemyScore++;
      if (this.tdmEnemyScore >= this.tdmTargetKills) {
        this.gameState = 'game_over';
        soundFX.playVoiceCue('defeat');
      }
    }
  }

  // Respawn Player
  respawnPlayer() {
    const spawnPos = (this.mapBuilder.spawnPoints && this.mapBuilder.spawnPoints.length > 0)
      ? this.mapBuilder.spawnPoints[Math.floor(Math.random() * this.mapBuilder.spawnPoints.length)].clone()
      : new THREE.Vector3(0, 1.6, 0);

    this.player.spawn(spawnPos);
    this.weaponSystem.initWeapons();
    this.gameState = 'playing';
    soundFX.playVoiceCue('roundStart');
  }

  // Handle Grenade Throw
  handlePlayerThrowGrenade() {
    if (this.weaponSystem.grenadeCount <= 0 || this.gameState !== 'playing' || this.player.isDead) return;

    this.weaponSystem.grenadeCount--;
    const origin = this.cameraRig.camera.position.clone().addScaledVector(this.cameraRig.getForwardDirection(), 0.4);
    const forward = this.cameraRig.getForwardDirection();

    this.grenades.throwGrenade(origin, forward, 20, 3.2, 'player');
  }

  // Handle Grenade Explosion Blast
  handleGrenadeBlast(blast) {
    const { pos, radius, maxDamage, owner } = blast;

    soundFX.playExplosion(pos.distanceTo(this.player.pos), pos.distanceTo(this.player.pos) < 5);
    this.cameraRig.addShake(Math.max(0, 1 - (pos.distanceTo(this.player.pos) / 12)));

    // Damage enemies
    this.enemyManager.damageEnemiesInRadius(pos, radius, maxDamage, (deadEnemy) => {
      this.handleEnemyKill(deadEnemy, false, pos.distanceTo(this.player.pos));
    });

    // Damage player if in radius
    const distToPlayer = pos.distanceTo(this.player.pos);
    if (distToPlayer <= radius && this.mapBuilder.world.raycast(pos, new THREE.Vector3().subVectors(this.player.pos, pos).normalize(), distToPlayer).hit === false) {
      const dmg = Math.floor(maxDamage * (1 - distToPlayer / radius));
      this.player.takeDamage(dmg, pos);
      if (this.player.isDead) this.handlePlayerDeath('GRENADE BLAST');
    }
  }

  // Explosive Barrel Detonation
  handleExplosiveBarrelDetonate(pos) {
    soundFX.playExplosion(pos.distanceTo(this.player.pos), pos.distanceTo(this.player.pos) < 6);
    this.particles.spawnExplosion(pos, 6.5);
    this.cameraRig.addShake(0.8);

    this.enemyManager.damageEnemiesInRadius(pos, 7.5, 200, (deadEnemy) => {
      this.handleEnemyKill(deadEnemy, false, pos.distanceTo(this.player.pos));
    });

    const distToPlayer = pos.distanceTo(this.player.pos);
    if (distToPlayer <= 7.5) {
      const dmg = Math.floor(160 * (1 - distToPlayer / 7.5));
      this.player.takeDamage(dmg, pos);
      if (this.player.isDead) this.handlePlayerDeath('EXPLODING BARREL');
    }
  }

  // Tactical Nuke Wipe
  detonateNuke() {
    this.nukeFlashIntensity = 1.0;
    soundFX.playExplosion(0, true);
    this.cameraRig.addShake(1.5);

    // Wipe all active enemies
    const active = [...this.enemyManager.enemies];
    for (const e of active) {
      if (!e.isDead) {
        e.die((deadEnemy) => {
          this.handleEnemyKill(deadEnemy, true, 20);
        });
      }
    }

    this.scoreManager.addScore(5000, 'TACTICAL NUKE VICTORY!', true);
    soundFX.playVoiceCue('victory');
  }

  update(dt) {
    if (this.gameState === 'paused' || this.gameState === 'menu') return;

    this.matchTime += dt;

    // Nuke flash decay
    if (this.nukeFlashIntensity > 0) {
      this.nukeFlashIntensity = Math.max(0, this.nukeFlashIntensity - dt * 0.5);
    }

    // 1. Update Player & Weapon
    this.player.update(dt, this.cameraRig);
    this.weaponSystem.update(dt);

    // 2. Continuous fire input check
    if (this.player.keys.fire && this.weaponSystem.canFire()) {
      this.handlePlayerShoot();
    }

    // 3. Grenade input check
    if (this.player.keys.grenade) {
      this.player.keys.grenade = false;
      this.handlePlayerThrowGrenade();
    }

    // 4. Reload input check
    if (this.player.keys.reload) {
      this.player.keys.reload = false;
      this.weaponSystem.reload();
    }

    // 5. Weapon Switch check
    if (this.player.keys.switch) {
      this.player.keys.switch = false;
      if (this.weaponSystem.switchWeapon()) {
        const cur = this.weaponSystem.getCurrentWeaponData();
        this.viewmodelRig.setWeapon(cur.id);
      }
    }

    // 6. Melee check
    if (this.player.keys.melee) {
      this.player.keys.melee = false;
      this.weaponSystem.melee();
      // Melee raycast check (2.2m)
      const hit = this.enemyManager.raycastEnemies(this.cameraRig.camera.position, this.cameraRig.getForwardDirection(), 2.2);
      if (hit) {
        hit.enemy.takeDamage(100, false, this.cameraRig.getForwardDirection(), (deadEnemy) => {
          this.handleEnemyKill(deadEnemy, false, hit.distance);
        });
        soundFX.playHitmarker(false, hit.enemy.isDead);
        this.hud?.showHitmarker(false, hit.enemy.isDead);
      }
    }

    // 7. Update Viewmodel Rig
    const isReloading = this.weaponSystem.isReloading;
    const reloadProg = 1 - (this.weaponSystem.reloadTimer / this.weaponSystem.reloadDuration);
    const isSwitching = this.weaponSystem.isSwitching;
    const switchProg = 1 - (this.weaponSystem.switchTimer / 0.45);
    const isMeleeing = this.weaponSystem.isMeleeing;
    const meleeProg = 1 - (this.weaponSystem.meleeTimer / 0.55);

    this.viewmodelRig.update(
      dt,
      this.player.keys.ads,
      this.player.isSprinting,
      this.player.velocity.lengthSq() > 0.1,
      isReloading,
      reloadProg,
      isSwitching,
      switchProg,
      isMeleeing,
      meleeProg,
      this.weaponSystem.getCurrentWeaponData()
    );

    // 8. Update Camera & FOV
    const isADS = this.player.keys.ads;
    const isMoving = this.player.velocity.lengthSq() > 0.1;
    const isSprinting = this.player.isSprinting && isMoving;
    const curWeaponData = this.weaponSystem.getCurrentWeaponData();

    if (isADS && curWeaponData) {
      this.cameraRig.setTargetFOV(curWeaponData.adsFOV);
    } else if (isSprinting) {
      this.cameraRig.setTargetFOV(this.cameraRig.baseFOV + 10);
    } else {
      this.cameraRig.setTargetFOV(this.cameraRig.baseFOV);
    }

    this.cameraRig.update(
      dt,
      new THREE.Vector3(this.player.pos.x, this.player.pos.y + this.player.currentHeight, this.player.pos.z),
      isMoving,
      this.player.isSprinting,
      this.player.isCrouching,
      this.player.keys.ads
    );

    // 9. Update Enemies
    this.enemyManager.update(
      dt,
      this.player,
      (bulletData) => this.handleEnemyBullet(bulletData),
      (deadEnemy, isHeadshot) => this.handleEnemyKill(deadEnemy, isHeadshot, 10)
    );

    // 10. Update Grenades
    this.grenades.update(dt, (blast) => this.handleGrenadeBlast(blast));

    // 11. Update Killstreaks
    this.killstreaks.update(dt, (deadEnemy) => this.handleEnemyKill(deadEnemy, false, 20));

    // 12. Update Particles & Score
    this.particles.update(dt);
    this.scoreManager.update(dt);

    // 13. Wave Completion Check
    if (this.gameMode === 'wave') {
      if (this.enemyManager.isWaveComplete() && this.gameState === 'playing') {
        this.gameState = 'wave_cleared';
        this.waveIntermissionTimer = 4.0;
        this.scoreManager.recordWaveClear(this.currentWave);
        soundFX.playVoiceCue('waveClear');
      }

      if (this.gameState === 'wave_cleared') {
        this.waveIntermissionTimer -= dt;
        if (this.waveIntermissionTimer <= 0) {
          this.currentWave++;
          this.enemyManager.startWave(this.currentWave);
          this.gameState = 'playing';
          soundFX.playVoiceCue('roundStart');
        }
      }
    }

    // 14. Respawn Timer
    if (this.gameState === 'respawning') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnPlayer();
      }
    }
  }
}
