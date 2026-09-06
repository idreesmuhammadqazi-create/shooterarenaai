// EnemyAI.js - 3D Voxel AI Soldier with procedural animations, tactical state machine, hitboxes, and weapon bursts
import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';

export class EnemyAI {
  constructor(id, type = 'rifleman', difficulty = 'regular', scene, physics, particleSystem) {
    this.id = id;
    this.type = type; // 'rifleman' | 'rusher' | 'sniper' | 'heavy'
    this.difficulty = difficulty;
    this.scene = scene;
    this.physics = physics;
    this.particles = particleSystem;

    this.pos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;

    this.radius = 0.35;
    this.height = 1.6;
    this.onGround = false;

    // Health & Stats based on type & difficulty
    this.setupStats();

    // AI States: 'patrol' | 'investigate' | 'combat' | 'flank'
    this.state = 'patrol';
    this.targetPos = new THREE.Vector3();
    this.targetNode = null;
    this.stateTimer = 0;

    // Combat tracking
    this.hasSightOfPlayer = false;
    this.sightTimer = 0;
    this.burstTimer = 0;
    this.burstShotsRemaining = 0;
    this.flinchTimer = 0;

    // Procedural 3D Mesh
    this.group = new THREE.Group();
    this.createMesh();
    this.scene.add(this.group);

    this.isDead = false;
    this.animTimer = Math.random() * 10;
  }

  setupStats() {
    const diffMultipliers = {
      recruit: { health: 70, reaction: 0.7, spread: 0.08, burstDelay: 1.6 },
      regular: { health: 100, reaction: 0.45, spread: 0.05, burstDelay: 1.2 },
      hardened: { health: 130, reaction: 0.3, spread: 0.035, burstDelay: 0.9 },
      veteran: { health: 160, reaction: 0.18, spread: 0.02, burstDelay: 0.65 }
    }[this.difficulty] || { health: 100, reaction: 0.45, spread: 0.05, burstDelay: 1.2 };

    if (this.type === 'rusher') {
      this.maxHealth = Math.floor(diffMultipliers.health * 0.85);
      this.moveSpeed = 6.8;
      this.damage = 14;
      this.burstCount = 6;
      this.reactionDelay = diffMultipliers.reaction * 0.8;
      this.spread = diffMultipliers.spread * 1.3;
      this.burstDelay = 0.8;
      this.weaponType = 'vector';
    } else if (this.type === 'sniper') {
      this.maxHealth = Math.floor(diffMultipliers.health * 0.75);
      this.moveSpeed = 3.5;
      this.damage = 65;
      this.burstCount = 1;
      this.reactionDelay = diffMultipliers.reaction * 1.5;
      this.spread = diffMultipliers.spread * 0.2;
      this.burstDelay = 2.2;
      this.weaponType = 'vox50';
    } else if (this.type === 'heavy') {
      this.maxHealth = Math.floor(diffMultipliers.health * 2.8); // Juggernaut
      this.moveSpeed = 3.2;
      this.damage = 18;
      this.burstCount = 12;
      this.reactionDelay = diffMultipliers.reaction;
      this.spread = diffMultipliers.spread * 1.2;
      this.burstDelay = 1.0;
      this.weaponType = 'm4';
    } else {
      // Standard Rifleman
      this.maxHealth = diffMultipliers.health;
      this.moveSpeed = 4.8;
      this.damage = 20;
      this.burstCount = 3;
      this.reactionDelay = diffMultipliers.reaction;
      this.spread = diffMultipliers.spread;
      this.burstDelay = diffMultipliers.burstDelay;
      this.weaponType = 'm4';
    }

    this.health = this.maxHealth;
  }

  // Create 3D Voxel Soldier Character Hierarchy
  createMesh() {
    const isHeavy = (this.type === 'heavy');
    const isSniper = (this.type === 'sniper');

    const uniformColor = isHeavy ? 0x22252a : (isSniper ? 0x484236 : 0x3d4734);
    const vestColor = isHeavy ? 0x151618 : 0x262824;
    const skinColor = 0xcfa57e;
    const helmetColor = isHeavy ? 0x111214 : 0x2e3526;

    const addBox = (parent, x, y, z, w, h, d, color, roughness = 0.8) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color, roughness });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Body Root
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.75, 0);
    this.group.add(this.torsoGroup);

    // Torso box
    const torsoW = isHeavy ? 0.44 : 0.36;
    const torsoD = isHeavy ? 0.28 : 0.22;
    addBox(this.torsoGroup, -torsoW / 2, 0, -torsoD / 2, torsoW, 0.48, torsoD, uniformColor);
    // Vest & Pouches
    addBox(this.torsoGroup, -torsoW / 2 - 0.02, 0.05, -torsoD / 2 - 0.03, torsoW + 0.04, 0.38, torsoD + 0.06, vestColor);
    addBox(this.torsoGroup, -0.12, 0.08, torsoD / 2 + 0.02, 0.24, 0.14, 0.08, 0x1d211a); // Ammo mag pouches

    // Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.5, 0);
    this.torsoGroup.add(this.headGroup);

    // Head & Helmet
    addBox(this.headGroup, -0.12, 0, -0.12, 0.24, 0.24, 0.24, skinColor);
    addBox(this.headGroup, -0.13, 0.1, -0.13, 0.26, 0.16, 0.26, helmetColor);
    // Goggles / Visor
    addBox(this.headGroup, -0.11, 0.08, 0.1, 0.22, 0.06, 0.05, 0x181a1c);

    // Right Arm + Weapon
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(torsoW / 2 + 0.06, 0.4, 0);
    this.torsoGroup.add(this.rightArmGroup);
    addBox(this.rightArmGroup, -0.06, -0.38, -0.06, 0.12, 0.4, 0.12, uniformColor);
    // Voxel Gun
    const gun = new THREE.Group();
    gun.position.set(0, -0.35, 0.15);
    addBox(gun, -0.03, -0.03, -0.1, 0.06, 0.08, 0.35, 0x1f2124);
    addBox(gun, -0.015, -0.01, 0.25, 0.03, 0.03, 0.25, 0x161819); // barrel
    this.rightArmGroup.add(gun);
    this.gunMuzzle = new THREE.Vector3(0, -0.35, 0.65);

    // Left Arm
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-torsoW / 2 - 0.06, 0.4, 0);
    this.torsoGroup.add(this.leftArmGroup);
    addBox(this.leftArmGroup, -0.06, -0.38, -0.06, 0.12, 0.4, 0.12, uniformColor);

    // Left & Right Legs
    this.leftLegGroup = new THREE.Group();
    this.leftLegGroup.position.set(-0.11, 0.75, 0);
    this.group.add(this.leftLegGroup);
    addBox(this.leftLegGroup, -0.07, -0.72, -0.07, 0.14, 0.72, 0.14, uniformColor);
    addBox(this.leftLegGroup, -0.075, -0.74, -0.08, 0.15, 0.18, 0.18, 0x181a1c); // Boot

    this.rightLegGroup = new THREE.Group();
    this.rightLegGroup.position.set(0.11, 0.75, 0);
    this.group.add(this.rightLegGroup);
    addBox(this.rightLegGroup, -0.07, -0.72, -0.07, 0.14, 0.72, 0.14, uniformColor);
    addBox(this.rightLegGroup, -0.075, -0.74, -0.08, 0.15, 0.18, 0.18, 0x181a1c); // Boot
  }

  spawn(pos) {
    this.pos.copy(pos);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.isDead = false;
    this.state = 'patrol';
    this.stateTimer = 0;
    this.group.visible = true;
    this.group.position.copy(this.pos);
  }

  // Hitbox detection (Head vs Torso/Legs)
  checkBulletHit(origin, direction, maxDist = 100) {
    if (this.isDead) return null;

    // Head sphere/box center
    const headPos = new THREE.Vector3(this.pos.x, this.pos.y + 1.4, this.pos.z);
    const bodyPos = new THREE.Vector3(this.pos.x, this.pos.y + 0.8, this.pos.z);

    // Ray to sphere distance check for head (radius 0.28)
    const toHead = new THREE.Vector3().subVectors(headPos, origin);
    const headProj = toHead.dot(direction);
    if (headProj > 0 && headProj < maxDist) {
      const closestPoint = new THREE.Vector3().copy(origin).addScaledVector(direction, headProj);
      const headDist = closestPoint.distanceTo(headPos);
      if (headDist <= 0.28) {
        return { hit: true, isHeadshot: true, point: closestPoint, distance: headProj };
      }
    }

    // Ray to cylinder/box check for body
    const toBody = new THREE.Vector3().subVectors(bodyPos, origin);
    const bodyProj = toBody.dot(direction);
    if (bodyProj > 0 && bodyProj < maxDist) {
      const closestPoint = new THREE.Vector3().copy(origin).addScaledVector(direction, bodyProj);
      const bodyDist = closestPoint.distanceTo(bodyPos);
      if (bodyDist <= 0.45 && Math.abs(closestPoint.y - bodyPos.y) < 0.6) {
        return { hit: true, isHeadshot: false, point: closestPoint, distance: bodyProj };
      }
    }

    return null;
  }

  takeDamage(amount, isHeadshot, hitDir, onDeathCallback) {
    if (this.isDead) return;

    this.health -= amount;
    this.flinchTimer = 0.15;

    // Particle blood
    this.particles.spawnBlood(
      new THREE.Vector3(this.pos.x, this.pos.y + (isHeadshot ? 1.4 : 0.9), this.pos.z),
      hitDir || new THREE.Vector3(0, 0, 1)
    );

    // Alert to combat if shot
    if (this.state !== 'combat') {
      this.state = 'combat';
      this.sightTimer = this.reactionDelay;
    }

    if (this.health <= 0) {
      this.die(onDeathCallback);
    }
  }

  die(callback) {
    this.isDead = true;
    this.group.visible = false;
    this.particles.spawnDeathShatter(this.pos);

    if (callback) {
      callback(this);
    }
  }

  update(dt, player, coverNodes, sniperNodes, onFireBullet) {
    if (this.isDead) return;

    this.animTimer += dt;

    // 1. Line of sight check to player
    const eyePos = new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z);
    const playerEye = new THREE.Vector3(player.pos.x, player.pos.y + player.currentHeight * 0.8, player.pos.z);
    const distToPlayer = eyePos.distanceTo(playerEye);

    const hasLOS = (distToPlayer < 60) && this.physics.hasLineOfSight(eyePos, playerEye);

    // 2. State Machine
    if (hasLOS) {
      this.state = 'combat';
      this.sightTimer += dt;

      // Face player
      const dirToPlayer = new THREE.Vector3().subVectors(player.pos, this.pos).normalize();
      this.yaw = Math.atan2(dirToPlayer.x, dirToPlayer.z);

      // Combat Behavior
      if (this.type === 'rusher') {
        // Rusher moves aggressively towards player
        if (distToPlayer > 4.0) {
          this.velocity.x = dirToPlayer.x * this.moveSpeed;
          this.velocity.z = dirToPlayer.z * this.moveSpeed;
        } else {
          // Circle strafe around player
          const strafe = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).multiplyScalar(Math.sin(this.animTimer * 2) * this.moveSpeed);
          this.velocity.x = strafe.x;
          this.velocity.z = strafe.z;
        }
      } else if (this.type === 'sniper') {
        // Sniper holds position and snipes
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        // Rifleman / Heavy: Strafe left/right while shooting
        const strafeDir = (Math.floor(this.animTimer * 0.8) % 2 === 0) ? 1 : -1;
        const strafe = new THREE.Vector3(-dirToPlayer.z, 0, dirToPlayer.x).multiplyScalar(strafeDir * this.moveSpeed * 0.7);

        if (distToPlayer > 12) {
          strafe.addScaledVector(dirToPlayer, this.moveSpeed * 0.5);
        } else if (distToPlayer < 5) {
          strafe.addScaledVector(dirToPlayer, -this.moveSpeed * 0.5);
        }

        this.velocity.x = strafe.x;
        this.velocity.z = strafe.z;
      }

      // Firing Logic (Burst Fire)
      if (this.sightTimer >= this.reactionDelay && !player.isDead) {
        this.burstTimer += dt;
        if (this.burstShotsRemaining > 0) {
          if (this.burstTimer >= 0.1) {
            this.burstTimer = 0;
            this.burstShotsRemaining--;
            this.fireAtPlayer(playerEye, onFireBullet);
          }
        } else if (this.burstTimer >= this.burstDelay) {
          this.burstTimer = 0;
          this.burstShotsRemaining = this.burstCount;
        }
      }
    } else {
      // Out of sight: Patrol / Hunt towards cover nodes or player's last known area
      this.sightTimer = 0;
      this.stateTimer -= dt;

      if (this.stateTimer <= 0) {
        this.stateTimer = 3.0 + Math.random() * 4.0;
        if (coverNodes && coverNodes.length > 0) {
          this.targetNode = coverNodes[Math.floor(Math.random() * coverNodes.length)];
          this.targetPos.copy(this.targetNode);
        }
      }

      if (this.targetPos.lengthSq() > 0.1) {
        const toTarget = new THREE.Vector3().subVectors(this.targetPos, this.pos);
        toTarget.y = 0;
        const dist = toTarget.length();

        if (dist > 1.0) {
          toTarget.normalize();
          this.velocity.x = toTarget.x * (this.moveSpeed * 0.6);
          this.velocity.z = toTarget.z * (this.moveSpeed * 0.6);
          this.yaw = Math.atan2(toTarget.x, toTarget.z);
        } else {
          this.velocity.x = 0;
          this.velocity.z = 0;
        }
      }
    }

    // 3. Physics Movement
    const colResult = this.physics.moveEntity(this.pos, this.velocity, this.radius, this.height, dt, true);
    this.onGround = colResult.onGround;

    // 4. Procedural Animations
    const isMoving = (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1);
    const legSpeed = 8.0;

    if (isMoving && this.onGround) {
      const legSwing = Math.sin(this.animTimer * legSpeed) * 0.6;
      this.leftLegGroup.rotation.x = legSwing;
      this.rightLegGroup.rotation.x = -legSwing;
      this.leftArmGroup.rotation.x = -legSwing * 0.5;
    } else {
      this.leftLegGroup.rotation.x = THREE.MathUtils.lerp(this.leftLegGroup.rotation.x, 0, dt * 10);
      this.rightLegGroup.rotation.x = THREE.MathUtils.lerp(this.rightLegGroup.rotation.x, 0, dt * 10);
      this.leftArmGroup.rotation.x = THREE.MathUtils.lerp(this.leftArmGroup.rotation.x, 0, dt * 10);
    }

    // Aiming arm towards player
    if (hasLOS) {
      this.rightArmGroup.rotation.x = 0.4;
      this.leftArmGroup.rotation.x = 0.4;
      this.leftArmGroup.rotation.y = -0.3;
    }

    // Flinch
    if (this.flinchTimer > 0) {
      this.flinchTimer -= dt;
      this.torsoGroup.rotation.x = -0.3;
    } else {
      this.torsoGroup.rotation.x = THREE.MathUtils.lerp(this.torsoGroup.rotation.x, 0, dt * 12);
    }

    // Update Mesh Transform
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }

  fireAtPlayer(targetEye, onFireCallback) {
    const muzzlePos = new THREE.Vector3();
    this.rightArmGroup.localToWorld(muzzlePos.copy(this.gunMuzzle));

    // Calculate spread-injected direction towards player
    const dir = new THREE.Vector3().subVectors(targetEye, muzzlePos).normalize();
    dir.x += (Math.random() - 0.5) * this.spread;
    dir.y += (Math.random() - 0.5) * this.spread;
    dir.z += (Math.random() - 0.5) * this.spread;
    dir.normalize();

    // Gunshot Audio (distance scaled)
    const distToPlayer = muzzlePos.distanceTo(targetEye);
    soundFX.playGunshot(this.weaponType, false, distToPlayer);

    // Muzzle Flash
    this.particles.flashMuzzle(muzzlePos, 2.0, 8);

    if (onFireCallback) {
      onFireCallback({
        origin: muzzlePos,
        direction: dir,
        damage: this.damage,
        shooter: this
      });
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
