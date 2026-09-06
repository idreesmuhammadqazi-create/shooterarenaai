// Grenade.js - Frag Grenade 3D physics, cooking, bounce, and explosive detonation
import * as THREE from 'three';
import { WeaponModels } from './WeaponModels.js';
import { soundFX } from '../audio/SoundFX.js';

export class GrenadeManager {
  constructor(scene, voxelWorld, physics, particleSystem) {
    this.scene = scene;
    this.world = voxelWorld;
    this.physics = physics;
    this.particles = particleSystem;
    this.activeGrenades = [];
  }

  // Throw a grenade with velocity and remaining fuse time
  throwGrenade(origin, direction, throwForce = 22, fuseTime = 3.2, owner = 'player') {
    const mesh = WeaponModels.createGrenade();
    mesh.position.copy(origin);
    this.scene.add(mesh);

    const vel = direction.clone().multiplyScalar(throwForce);
    vel.y += 4.5; // Slight upward loft

    soundFX.playGrenadePin();

    const grenade = {
      mesh,
      pos: origin.clone(),
      vel,
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      ),
      fuse: fuseTime,
      maxFuse: fuseTime,
      bounces: 0,
      radius: 0.15,
      owner,
      beepTimer: 0.5
    };

    this.activeGrenades.push(grenade);
    return grenade;
  }

  update(dt, onExplodeCallback) {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.fuse -= dt;
      g.beepTimer -= dt;

      // LED Flash & Audio Beep logic
      if (g.fuse < 1.5 && g.beepTimer <= 0) {
        soundFX.playGrenadeBeep(1400);
        g.beepTimer = Math.max(0.1, g.fuse * 0.25);
        if (g.mesh.led) {
          g.mesh.led.material.color.setHex(0xffff00);
          setTimeout(() => {
            if (g.mesh && g.mesh.led) g.mesh.led.material.color.setHex(0xff0000);
          }, 60);
        }
      }

      // Detonation
      if (g.fuse <= 0) {
        this.explode(g, onExplodeCallback);
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
        continue;
      }

      // Gravity & Physics movement
      g.vel.y -= 22.0 * dt; // Gravity
      const dx = g.vel.x * dt;
      const dy = g.vel.y * dt;
      const dz = g.vel.z * dt;

      // 1. Move Y
      const nextY = g.pos.y + dy;
      if (this.physics.checkAABB(g.pos.x - g.radius, nextY, g.pos.z - g.radius, g.pos.x + g.radius, nextY + g.radius * 2, g.pos.z + g.radius)) {
        // Bounce floor/ceiling
        g.vel.y *= -0.55;
        g.vel.x *= 0.8;
        g.vel.z *= 0.8;
        g.bounces++;
        if (Math.abs(g.vel.y) > 2) soundFX.playGrenadeBounce();
      } else {
        g.pos.y = nextY;
      }

      // 2. Move X
      const nextX = g.pos.x + dx;
      if (this.physics.checkAABB(nextX - g.radius, g.pos.y, g.pos.z - g.radius, nextX + g.radius, g.pos.y + g.radius * 2, g.pos.z + g.radius)) {
        g.vel.x *= -0.6;
        g.bounces++;
        if (Math.abs(g.vel.x) > 2) soundFX.playGrenadeBounce();
      } else {
        g.pos.x = nextX;
      }

      // 3. Move Z
      const nextZ = g.pos.z + dz;
      if (this.physics.checkAABB(g.pos.x - g.radius, g.pos.y, nextZ - g.radius, g.pos.x + g.radius, g.pos.y + g.radius * 2, nextZ + g.radius)) {
        g.vel.z *= -0.6;
        g.bounces++;
        if (Math.abs(g.vel.z) > 2) soundFX.playGrenadeBounce();
      } else {
        g.pos.z = nextZ;
      }

      // Update mesh transform
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.rotVel.x * dt;
      g.mesh.rotation.y += g.rotVel.y * dt;
      g.mesh.rotation.z += g.rotVel.z * dt;
    }
  }

  explode(grenade, callback) {
    const pos = grenade.pos.clone().add(new THREE.Vector3(0, 0.2, 0));
    
    // Particle Explosion
    this.particles.spawnExplosion(pos, 6.0);

    // Blast damage & voxel destruction
    const maxRadius = 7.5;
    const maxDamage = 180;

    if (callback) {
      callback({
        pos,
        radius: maxRadius,
        maxDamage,
        owner: grenade.owner
      });
    }
  }

  clear() {
    this.activeGrenades.forEach(g => this.scene.remove(g.mesh));
    this.activeGrenades = [];
  }
}
