// ViewmodelRig.js - 3D First-Person Weapon & Hands Animation Rig
import * as THREE from 'three';
import { WeaponModels } from '../weapons/WeaponModels.js';

export class ViewmodelRig {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    // Viewmodel container attached to camera
    this.root = new THREE.Group();
    this.camera.add(this.root);

    // Default hipfire offsets
    this.defaultPos = new THREE.Vector3(0.18, -0.16, -0.36);
    this.defaultRot = new THREE.Euler(0, 0, 0);

    // Current offsets
    this.currentPos = this.defaultPos.clone();
    this.currentRot = new THREE.Euler(0, 0, 0);

    // Procedural springs
    this.kickOffset = new THREE.Vector3();
    this.kickRot = new THREE.Vector3();

    this.swayOffset = new THREE.Vector3();
    this.swayRot = new THREE.Vector3();

    this.reloadOffset = new THREE.Vector3();
    this.reloadRot = new THREE.Vector3();

    this.switchOffset = new THREE.Vector3();

    this.idleTimer = 0;
    this.bobTimer = 0;

    // Active weapon model instances
    this.weaponMeshes = {};
    this.currentWeaponId = 'm4';
    this.hands = null;
    this.camo = 'standard';

    this.initViewmodels();
  }

  initViewmodels() {
    // Build procedural weapon meshes
    this.weaponMeshes['m4'] = WeaponModels.createM4(this.camo);
    this.weaponMeshes['vector'] = WeaponModels.createVector(this.camo);
    this.weaponMeshes['striker'] = WeaponModels.createShotgun(this.camo);
    this.weaponMeshes['vox50'] = WeaponModels.createSniper(this.camo);
    this.weaponMeshes['magnum'] = WeaponModels.createMagnum(this.camo);

    // Hands
    this.hands = WeaponModels.createHands();
    this.root.add(this.hands.group);

    // Add all weapon models to root, hide inactive
    for (const [id, mesh] of Object.entries(this.weaponMeshes)) {
      mesh.visible = (id === this.currentWeaponId);
      this.root.add(mesh);
    }
  }

  setCamo(camo) {
    this.camo = camo;
    // Rebuild active models with new camo
    for (const [id, mesh] of Object.entries(this.weaponMeshes)) {
      this.root.remove(mesh);
    }
    this.initViewmodels();
  }

  setWeapon(weaponId) {
    this.currentWeaponId = weaponId;
    for (const [id, mesh] of Object.entries(this.weaponMeshes)) {
      mesh.visible = (id === weaponId);
    }
  }

  getActiveWeaponMesh() {
    return this.weaponMeshes[this.currentWeaponId];
  }

  getMuzzleWorldPosition() {
    const mesh = this.getActiveWeaponMesh();
    if (!mesh || !mesh.muzzlePoint) {
      return this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.5));
    }
    const worldPos = new THREE.Vector3();
    mesh.localToWorld(worldPos.copy(mesh.muzzlePoint));
    return worldPos;
  }

  // Trigger firing recoil punch on viewmodel
  applyFireKick(kickZ = 0.05, kickRotX = 0.1) {
    this.kickOffset.z += kickZ;
    this.kickOffset.y += kickZ * 0.4;
    this.kickRot.x += kickRotX;
    this.kickRot.y += (Math.random() - 0.5) * kickRotX * 0.4;
    this.kickRot.z += (Math.random() - 0.5) * kickRotX * 0.6;
  }

  update(dt, isADS, isSprinting, isMoving, isReloading, reloadProgress, isSwitching, switchProgress, isMeleeing, meleeProgress, weaponData) {
    this.idleTimer += dt * 2.0;

    // 1. Target Position / Rotation based on stance
    let targetPos = this.defaultPos.clone();
    let targetRot = new THREE.Vector3(0, 0, 0);

    if (isADS && weaponData && weaponData.adsPos) {
      // ADS alignment (centers weapon optics)
      targetPos.copy(weaponData.adsPos);
      targetRot.set(0, 0, 0);
    } else if (isSprinting && isMoving) {
      // Sprint: Lower weapon, tilt diagonally
      targetPos.set(0.12, -0.22, -0.28);
      targetRot.set(-0.35, 0.45, -0.25);
    } else if (isMoving) {
      // Walk bob
      this.bobTimer += dt * 9.0;
      targetPos.x += Math.cos(this.bobTimer * 0.5) * 0.015;
      targetPos.y += Math.abs(Math.sin(this.bobTimer)) * 0.012;
    } else {
      // Idle breathing sway
      targetPos.x += Math.sin(this.idleTimer) * 0.003;
      targetPos.y += Math.cos(this.idleTimer * 1.5) * 0.003;
    }

    // 2. Reload Animation
    if (isReloading) {
      const p = reloadProgress; // 0 to 1
      if (p < 0.3) {
        // Drop gun down & tilt left
        const drop = Math.sin(p / 0.3 * (Math.PI / 2));
        this.reloadOffset.set(-0.04 * drop, -0.14 * drop, -0.05 * drop);
        this.reloadRot.set(0.2 * drop, 0.35 * drop, 0.25 * drop);
      } else if (p < 0.7) {
        // Slam magazine back up
        const slam = Math.sin((p - 0.3) / 0.4 * Math.PI);
        this.reloadOffset.set(-0.04, -0.14 + slam * 0.06, -0.05);
        this.reloadRot.set(0.2 - slam * 0.1, 0.35, 0.25);
      } else {
        // Return to rest & cock bolt
        const returnProgress = (p - 0.7) / 0.3;
        this.reloadOffset.lerp(new THREE.Vector3(), returnProgress);
        this.reloadRot.lerp(new THREE.Vector3(), returnProgress);
      }
    } else {
      this.reloadOffset.lerp(new THREE.Vector3(), dt * 10);
      this.reloadRot.lerp(new THREE.Vector3(), dt * 10);
    }

    // 3. Switch Weapon Animation
    if (isSwitching) {
      const dropAmount = Math.sin(switchProgress * Math.PI) * 0.3;
      this.switchOffset.set(0, -dropAmount, 0);
    } else {
      this.switchOffset.lerp(new THREE.Vector3(), dt * 12);
    }

    // 4. Melee Swipe Animation
    let meleeOffset = new THREE.Vector3();
    let meleeRot = new THREE.Vector3();
    if (isMeleeing) {
      const m = meleeProgress; // 0 to 1
      const swipe = Math.sin(m * Math.PI);
      meleeOffset.set(-swipe * 0.2, swipe * 0.1, -swipe * 0.15);
      meleeRot.set(swipe * 0.4, -swipe * 0.8, swipe * 0.6);
    }

    // 5. Spring Decay for Fire Kick
    this.kickOffset.lerp(new THREE.Vector3(), dt * 16);
    this.kickRot.lerp(new THREE.Vector3(), dt * 16);

    // 6. Smooth Interpolation to final position & rotation
    const lerpSpeed = isADS ? 18 : 12;
    this.currentPos.lerp(targetPos, dt * lerpSpeed);

    this.root.position.copy(this.currentPos)
      .add(this.kickOffset)
      .add(this.reloadOffset)
      .add(this.switchOffset)
      .add(meleeOffset);

    this.root.rotation.set(
      targetRot.x + this.kickRot.x + this.reloadRot.x + meleeRot.x,
      targetRot.y + this.kickRot.y + this.reloadRot.y + meleeRot.y,
      targetRot.z + this.kickRot.z + this.reloadRot.z + meleeRot.z
    );
  }
}
