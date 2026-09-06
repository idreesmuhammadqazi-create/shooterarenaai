// EnemyManager.js - Wave director, spawn management, and enemy lifecycle
import * as THREE from 'three';
import { EnemyAI } from './EnemyAI.js';

export class EnemyManager {
  constructor(scene, physics, particleSystem) {
    this.scene = scene;
    this.physics = physics;
    this.particles = particleSystem;

    this.enemies = [];
    this.enemyIdCounter = 1;
    this.difficulty = 'regular';

    this.spawnPoints = [];
    this.coverNodes = [];
    this.sniperNodes = [];

    // Wave spawning state
    this.waveNumber = 1;
    this.totalEnemiesInWave = 0;
    this.enemiesSpawnedThisWave = 0;
    this.enemiesAliveCount = 0;
    this.spawnCooldown = 0;
    this.waveInProgress = false;
  }

  setMapNodes(spawnPoints, coverNodes, sniperNodes) {
    this.spawnPoints = spawnPoints;
    this.coverNodes = coverNodes;
    this.sniperNodes = sniperNodes;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  startWave(waveNum) {
    this.waveNumber = waveNum;
    this.enemiesSpawnedThisWave = 0;
    
    // Wave size scaling: Wave 1: 5 enemies, Wave 5: 14 enemies, Wave 10: 25 enemies
    this.totalEnemiesInWave = Math.min(30, 4 + waveNum * 2);
    this.enemiesAliveCount = 0;
    this.spawnCooldown = 0.5;
    this.waveInProgress = true;
  }

  // Choose tactical spawn point away from player's view
  getBestSpawnPoint(playerPos) {
    if (!this.spawnPoints || this.spawnPoints.length === 0) {
      return new THREE.Vector3(0, 1.2, 0);
    }

    // Filter spawns that are at least 10m away from player
    const validSpawns = this.spawnPoints.filter(p => p.distanceTo(playerPos) > 10);
    const pool = (validSpawns.length > 0) ? validSpawns : this.spawnPoints;

    return pool[Math.floor(Math.random() * pool.length)].clone();
  }

  spawnEnemy(playerPos) {
    const spawnPos = this.getBestSpawnPoint(playerPos);

    // Archetype selection based on wave number
    let type = 'rifleman';
    const rand = Math.random();

    if (this.waveNumber >= 4 && rand < 0.25) {
      type = 'heavy'; // Juggernaut
    } else if (this.waveNumber >= 3 && rand < 0.5 && this.sniperNodes.length > 0) {
      type = 'sniper';
      // Place sniper in high perch node if available
      const perch = this.sniperNodes[Math.floor(Math.random() * this.sniperNodes.length)];
      spawnPos.copy(perch);
    } else if (this.waveNumber >= 2 && rand < 0.6) {
      type = 'rusher';
    }

    const enemy = new EnemyAI(
      this.enemyIdCounter++,
      type,
      this.difficulty,
      this.scene,
      this.physics,
      this.particles
    );

    enemy.spawn(spawnPos);
    this.enemies.push(enemy);
    this.enemiesSpawnedThisWave++;
    this.enemiesAliveCount++;
  }

  update(dt, player, onFireEnemyBullet, onEnemyDeath) {
    // 1. Spawning director
    if (this.waveInProgress && this.enemiesSpawnedThisWave < this.totalEnemiesInWave) {
      // Max 8 active simultaneous enemies on screen
      const maxConcurrent = Math.min(10, 4 + Math.floor(this.waveNumber * 0.8));
      if (this.enemiesAliveCount < maxConcurrent) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0) {
          this.spawnEnemy(player.pos);
          this.spawnCooldown = 1.2 + Math.random() * 1.5;
        }
      }
    }

    // 2. Update all active enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isDead) continue;

      e.update(dt, player, this.coverNodes, this.sniperNodes, onFireEnemyBullet);
    }
  }

  // Check raycast against all enemy hitboxes
  raycastEnemies(origin, direction, maxDist = 100) {
    let closestHit = null;
    let closestDist = Infinity;

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;

      const hit = enemy.checkBulletHit(origin, direction, maxDist);
      if (hit && hit.distance < closestDist) {
        closestDist = hit.distance;
        closestHit = {
          enemy,
          isHeadshot: hit.isHeadshot,
          point: hit.point,
          distance: hit.distance
        };
      }
    }

    return closestHit;
  }

  // Damage enemies in explosion radius
  damageEnemiesInRadius(center, radius, maxDamage, onEnemyDeath) {
    const affected = [];

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;

      const eye = new THREE.Vector3(enemy.pos.x, enemy.pos.y + 0.8, enemy.pos.z);
      const dist = eye.distanceTo(center);

      if (dist <= radius) {
        // Line of sight check
        if (this.physics.hasLineOfSight(center, eye)) {
          const falloff = 1 - (dist / radius);
          const dmg = Math.floor(maxDamage * Math.max(0.2, falloff));
          const hitDir = new THREE.Vector3().subVectors(enemy.pos, center).normalize();

          enemy.takeDamage(dmg, false, hitDir, (deadEnemy) => {
            this.handleEnemyDeath(deadEnemy, onEnemyDeath, false);
          });

          affected.push({ enemy, damage: dmg });
        }
      }
    }

    return affected;
  }

  handleEnemyDeath(enemy, onEnemyDeath, isHeadshot = false) {
    this.enemiesAliveCount--;

    if (onEnemyDeath) {
      onEnemyDeath(enemy, isHeadshot);
    }
  }

  isWaveComplete() {
    return this.waveInProgress && (this.enemiesSpawnedThisWave >= this.totalEnemiesInWave) && (this.enemiesAliveCount <= 0);
  }

  clear() {
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.enemiesAliveCount = 0;
    this.enemiesSpawnedThisWave = 0;
    this.waveInProgress = false;
  }
}
