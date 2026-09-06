// ParticleSystem.js - High performance 3D voxel particles, sparks, smoke, explosions, and bullet tracers
import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
    this.shells = [];
    this.decals = [];

    // Reusable geometries and materials
    this.voxelGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.smokeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    this.tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.2, 4);
    this.tracerGeo.rotateX(Math.PI / 2);

    this.shellGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 4);
    this.shellGeo.rotateZ(Math.PI / 2);

    this.matYellowGlow = new THREE.MeshBasicMaterial({ color: 0xffd043 });
    this.matOrangeFire = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    this.matBlood = new THREE.MeshStandardMaterial({ color: 0x8a0b0b, roughness: 0.3 });
    this.matConcrete = new THREE.MeshStandardMaterial({ color: 0x777b7e, roughness: 0.9 });
    this.matSmoke = new THREE.MeshStandardMaterial({ color: 0x444444, transparent: true, opacity: 0.8, roughness: 1.0 });
    this.matBrass = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });

    // Dynamic Muzzle Flash Light
    this.muzzleLight = new THREE.PointLight(0xffaa22, 0, 10);
    this.scene.add(this.muzzleLight);
    this.muzzleLightTimer = 0;
  }

  // Spawn bullet tracer flying through 3D space
  spawnTracer(startPos, endPos, speed = 120, color = 0xffe066) {
    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const totalDist = dir.length();
    dir.normalize();

    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(this.tracerGeo, mat);
    mesh.position.copy(startPos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.scene.add(mesh);

    this.tracers.push({
      mesh,
      pos: startPos.clone(),
      dir,
      speed,
      travelled: 0,
      totalDist
    });
  }

  // Spawn bullet impact effect (sparks + dust)
  spawnImpact(pos, normal, isMetal = false) {
    const count = isMetal ? 12 : 8;
    const baseMat = isMetal ? this.matYellowGlow : this.matConcrete;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.voxelGeo, baseMat);
      mesh.scale.setScalar(0.5 + Math.random() * 0.6);
      mesh.position.copy(pos).addScaledVector(normal, 0.05);
      this.scene.add(mesh);

      // Velocity biased towards normal + spread
      const vel = normal.clone().multiplyScalar(2 + Math.random() * 4);
      vel.x += (Math.random() - 0.5) * 4;
      vel.y += (Math.random() - 0.5) * 4;
      vel.z += (Math.random() - 0.5) * 4;

      this.particles.push({
        mesh,
        vel,
        rotSpeed: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        gravity: 12
      });
    }

    // Small smoke puff
    for (let i = 0; i < 3; i++) {
      const sMesh = new THREE.Mesh(this.smokeGeo, this.matSmoke);
      sMesh.scale.setScalar(0.4);
      sMesh.position.copy(pos);
      this.scene.add(sMesh);

      this.particles.push({
        mesh: sMesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.8 + 0.4, (Math.random() - 0.5) * 0.8),
        rotSpeed: new THREE.Vector3(1, 1, 1),
        life: 0.6,
        maxLife: 0.6,
        gravity: -0.5,
        growth: 1.5
      });
    }
  }

  // Spawn blood impact on enemy hit
  spawnBlood(pos, dir) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.voxelGeo, this.matBlood);
      mesh.scale.setScalar(0.6 + Math.random() * 0.6);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = dir.clone().multiplyScalar(-1.5 - Math.random() * 2);
      vel.x += (Math.random() - 0.5) * 3;
      vel.y += Math.random() * 2;
      vel.z += (Math.random() - 0.5) * 3;

      this.particles.push({
        mesh,
        vel,
        rotSpeed: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        gravity: 16
      });
    }
  }

  // Spawn death voxel burst / ragdoll shatter
  spawnDeathShatter(pos, colors = [0x3a442e, 0x22291b, 0x8a0b0b, 0x556846]) {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
      const mesh = new THREE.Mesh(this.voxelGeo, mat);
      mesh.scale.setScalar(0.8 + Math.random() * 1.2);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + Math.random() * 1.4,
        pos.z + (Math.random() - 0.5) * 0.6
      );
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        3 + Math.random() * 5,
        (Math.random() - 0.5) * 6
      );

      this.particles.push({
        mesh,
        vel,
        rotSpeed: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
        life: 2.0 + Math.random() * 1.0,
        maxLife: 3.0,
        gravity: 18
      });
    }
  }

  // Massive Voxel Explosion
  spawnExplosion(pos, radius = 5) {
    // 1. Core Fireball Voxels
    const count = 40;
    for (let i = 0; i < count; i++) {
      const isYellow = Math.random() > 0.4;
      const mat = isYellow ? this.matYellowGlow : this.matOrangeFire;
      const mesh = new THREE.Mesh(this.smokeGeo, mat);
      mesh.scale.setScalar(0.8 + Math.random() * 1.5);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.2) * Math.PI;
      const speed = 4 + Math.random() * 12;

      const vel = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elev) * speed,
        Math.sin(elev) * speed + 3,
        Math.sin(angle) * Math.cos(elev) * speed
      );

      this.particles.push({
        mesh,
        vel,
        rotSpeed: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        gravity: 10,
        growth: -0.5
      });
    }

    // 2. Rising Dark Smoke Column
    for (let i = 0; i < 24; i++) {
      const sMesh = new THREE.Mesh(this.smokeGeo, this.matSmoke);
      sMesh.scale.setScalar(1.0 + Math.random() * 1.0);
      sMesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.5,
        pos.y + Math.random() * 1.0,
        pos.z + (Math.random() - 0.5) * 1.5
      );
      this.scene.add(sMesh);

      this.particles.push({
        mesh: sMesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          2.5 + Math.random() * 4,
          (Math.random() - 0.5) * 2
        ),
        rotSpeed: new THREE.Vector3(1, 1, 1),
        life: 1.5 + Math.random() * 1.0,
        maxLife: 2.5,
        gravity: -1.0,
        growth: 2.0
      });
    }

    // Dynamic Flash
    this.flashMuzzle(pos, 5.0, 18);
  }

  // Flash point light for muzzle / explosion
  flashMuzzle(pos, intensity = 3.0, distance = 12) {
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = intensity;
    this.muzzleLight.distance = distance;
    this.muzzleLightTimer = 0.06;
  }

  // Eject brass shell casing
  spawnShellCasing(pos, rightDir) {
    const mesh = new THREE.Mesh(this.shellGeo, this.matBrass);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const vel = rightDir.clone().multiplyScalar(2.5 + Math.random() * 1.5);
    vel.y += 1.8 + Math.random() * 1.0;
    vel.x += (Math.random() - 0.5) * 0.8;
    vel.z += (Math.random() - 0.5) * 0.8;

    this.shells.push({
      mesh,
      vel,
      rot: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20),
      life: 1.2
    });
  }

  update(dt) {
    // Muzzle light timer
    if (this.muzzleLightTimer > 0) {
      this.muzzleLightTimer -= dt;
      if (this.muzzleLightTimer <= 0) {
        this.muzzleLight.intensity = 0;
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        if (p.mesh.geometry && p.mesh.geometry !== this.voxelGeo && p.mesh.geometry !== this.smokeGeo) {
          p.mesh.geometry.dispose();
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;
      p.mesh.rotation.z += p.rotSpeed.z * dt;

      if (p.growth) {
        p.mesh.scale.addScalar(p.growth * dt);
      } else {
        // Fade shrink
        const progress = p.life / p.maxLife;
        p.mesh.scale.setScalar(Math.max(0.01, progress));
      }
    }

    // Update Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      const step = t.speed * dt;
      t.pos.addScaledVector(t.dir, step);
      t.travelled += step;
      t.mesh.position.copy(t.pos);

      if (t.travelled >= t.totalDist) {
        this.scene.remove(t.mesh);
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update Shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.shells.splice(i, 1);
        continue;
      }

      s.vel.y -= 16 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.rot.x * dt;
      s.mesh.rotation.y += s.rot.y * dt;

      // Ground bounce
      if (s.mesh.position.y < 0.1) {
        s.mesh.position.y = 0.1;
        s.vel.y *= -0.4;
        s.vel.x *= 0.6;
        s.vel.z *= 0.6;
      }
    }
  }

  clearAll() {
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles = [];
    this.tracers.forEach(t => this.scene.remove(t.mesh));
    this.tracers = [];
    this.shells.forEach(s => this.scene.remove(s.mesh));
    this.shells = [];
  }
}
