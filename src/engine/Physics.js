// Physics.js - Fast 3D Voxel Collision, Step-Up logic, Raycasting & Explosion checks
import * as THREE from 'three';
import { BLOCK } from './VoxelWorld.js';

export class Physics {
  constructor(voxelWorld) {
    this.world = voxelWorld;
    this.gravity = -24.0;
  }

  // Check if an AABB intersects any solid voxel in the world
  checkAABB(minX, minY, minZ, maxX, maxY, maxZ) {
    const startX = Math.floor(minX);
    const endX = Math.floor(maxX);
    const startY = Math.floor(minY);
    const endY = Math.floor(maxY);
    const startZ = Math.floor(minZ);
    const endZ = Math.floor(maxZ);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
          const block = this.world.getBlock(x, y, z);
          if (block !== BLOCK.AIR && block !== BLOCK.GLASS) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Move an entity box with sweeping collision and step-up support
  moveEntity(pos, velocity, radius, height, dt, canStepUp = true) {
    let onGround = false;

    // Apply gravity
    velocity.y += this.gravity * dt;

    // Movement delta
    const dx = velocity.x * dt;
    const dy = velocity.y * dt;
    const dz = velocity.z * dt;

    const r = radius;
    const h = height;

    // 1. Vertical Movement (Y-axis)
    const newY = pos.y + dy;
    if (dy < 0) {
      // Moving down - check floor
      if (this.checkAABB(pos.x - r, newY, pos.z - r, pos.x + r, newY + 0.05, pos.z + r)) {
        pos.y = Math.floor(pos.y) + 0.001; // Snap to top of block
        velocity.y = 0;
        onGround = true;
      } else {
        pos.y = newY;
      }
    } else if (dy > 0) {
      // Moving up - check ceiling
      if (this.checkAABB(pos.x - r, newY + h - 0.1, pos.z - r, pos.x + r, newY + h, pos.z + r)) {
        velocity.y = 0;
      } else {
        pos.y = newY;
      }
    }

    // 2. Horizontal Movement X with step-up
    if (Math.abs(dx) > 0.0001) {
      const targetX = pos.x + dx;
      if (!this.checkAABB(targetX - r, pos.y + 0.05, pos.z - r, targetX + r, pos.y + h - 0.05, pos.z + r)) {
        pos.x = targetX;
      } else if (canStepUp && onGround) {
        // Try stepping up 0.5m - 1.0m
        const stepHeight = 1.05;
        if (!this.checkAABB(targetX - r, pos.y + stepHeight, pos.z - r, targetX + r, pos.y + h + stepHeight - 0.1, pos.z + r)) {
          pos.x = targetX;
          pos.y += stepHeight;
        } else {
          velocity.x = 0;
        }
      } else {
        velocity.x = 0;
      }
    }

    // 3. Horizontal Movement Z with step-up
    if (Math.abs(dz) > 0.0001) {
      const targetZ = pos.z + dz;
      if (!this.checkAABB(pos.x - r, pos.y + 0.05, targetZ - r, pos.x + r, pos.y + h - 0.05, targetZ + r)) {
        pos.z = targetZ;
      } else if (canStepUp && onGround) {
        const stepHeight = 1.05;
        if (!this.checkAABB(pos.x - r, pos.y + stepHeight, targetZ - r, pos.x + r, pos.y + h + stepHeight - 0.1, targetZ + r)) {
          pos.z = targetZ;
          pos.y += stepHeight;
        } else {
          velocity.z = 0;
        }
      } else {
        velocity.z = 0;
      }
    }

    // Keep within world bounds
    if (pos.y < -5) {
      pos.y = 2;
      pos.x = 0;
      pos.z = 0;
      velocity.set(0, 0, 0);
    }

    return { onGround };
  }

  // Check line of sight between two 3D points
  hasLineOfSight(p1, p2) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const dist = dir.length();
    if (dist < 0.1) return true;
    dir.normalize();

    const hit = this.world.raycast(p1, dir, dist);
    return !hit.hit;
  }
}
