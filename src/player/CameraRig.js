// CameraRig.js - Pointer lock, recoil recovery, smooth ADS FOV, headbobbing, and screen shake
import * as THREE from 'three';

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.pitch = 0; // X rotation in radians
    this.yaw = 0;   // Y rotation in radians

    this.mouseSensitivity = 0.0022;
    this.adsSensitivityMult = 0.65;
    this.invertY = false;
    this.isLocked = false;

    // Recoil springs
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.targetRecoilPitch = 0;
    this.targetRecoilYaw = 0;

    // FOV settings
    this.baseFOV = 80;
    this.currentFOV = 80;
    this.targetFOV = 80;

    // Screen Shake
    this.shakeIntensity = 0;
    this.shakeDecay = 4.5;
    this.shakeOffset = new THREE.Vector3();

    // Head bobbing
    this.bobTimer = 0;
    this.bobAmount = 0;
    this.bobOffset = new THREE.Vector3();

    this.setupPointerLock();
  }

  setupPointerLock() {
    this.domElement.addEventListener('click', () => {
      if (!this.isLocked && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = (document.pointerLockElement === this.domElement);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      const sens = this.mouseSensitivity;
      const mult = (this.currentFOV < this.baseFOV - 10) ? this.adsSensitivityMult : 1.0;

      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      this.yaw -= movementX * sens * mult;
      const pitchDelta = movementY * sens * mult * (this.invertY ? -1 : 1);
      this.pitch -= pitchDelta;

      // Clamp pitch -89 deg to 89 deg
      const maxPitch = (Math.PI / 2) - 0.02;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });
  }

  // Apply procedural recoil kick to camera
  applyRecoil(pitchKick, yawKick) {
    this.targetRecoilPitch += pitchKick;
    this.targetRecoilYaw += (Math.random() - 0.5) * yawKick * 2;
  }

  // Apply screen shake (explosions, taking heavy damage)
  addShake(amount) {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + amount);
  }

  setTargetFOV(fov) {
    this.targetFOV = fov;
  }

  update(dt, playerPos, isMoving, isSprinting, isCrouching, isADS) {
    // 1. Smooth FOV Transition (ADS zoom & sprint kick)
    const fovLerpSpeed = isADS ? 16 : 10;
    this.currentFOV = THREE.MathUtils.lerp(this.currentFOV, this.targetFOV, dt * fovLerpSpeed);
    this.camera.fov = this.currentFOV;
    this.camera.updateProjectionMatrix();

    // 2. Recoil Recovery Spring
    // Snap recoil towards target, then target decays back to 0
    this.recoilPitch = THREE.MathUtils.lerp(this.recoilPitch, this.targetRecoilPitch, dt * 25);
    this.recoilYaw = THREE.MathUtils.lerp(this.recoilYaw, this.targetRecoilYaw, dt * 25);
    this.targetRecoilPitch = THREE.MathUtils.lerp(this.targetRecoilPitch, 0, dt * 10);
    this.targetRecoilYaw = THREE.MathUtils.lerp(this.targetRecoilYaw, 0, dt * 10);

    // 3. Screen Shake Decay & Noise
    if (this.shakeIntensity > 0.001) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity * 0.15,
        (Math.random() - 0.5) * this.shakeIntensity * 0.15,
        (Math.random() - 0.5) * this.shakeIntensity * 0.08
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    // 4. Head Bobbing
    if (isMoving && !isADS) {
      const speed = isSprinting ? 14 : 9;
      const amount = isSprinting ? 0.045 : (isCrouching ? 0.015 : 0.025);
      this.bobTimer += dt * speed;
      this.bobOffset.set(
        Math.cos(this.bobTimer * 0.5) * amount * 0.6,
        Math.abs(Math.sin(this.bobTimer)) * amount,
        0
      );
    } else {
      this.bobOffset.lerp(new THREE.Vector3(), dt * 8);
    }

    // 5. Update Camera Transform
    const finalPitch = this.pitch + this.recoilPitch;
    const finalYaw = this.yaw + this.recoilYaw;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = finalYaw;
    this.camera.rotation.x = finalPitch;
    this.camera.rotation.z = this.shakeOffset.z;

    // Apply position + headbob + shake
    this.camera.position.copy(playerPos)
      .add(this.bobOffset)
      .add(new THREE.Vector3(this.shakeOffset.x, this.shakeOffset.y, 0));
  }

  getForwardDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  getRightDirection() {
    const dir = new THREE.Vector3(1, 0, 0);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }
}
