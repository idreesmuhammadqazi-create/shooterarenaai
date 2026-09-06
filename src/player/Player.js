// Player.js - Movement, Stamina, Health Regen, Slide, and Input Coordinator
import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';

export class Player {
  constructor(camera, scene, physics, particleSystem) {
    this.camera = camera;
    this.scene = scene;
    this.physics = physics;
    this.particles = particleSystem;

    this.pos = new THREE.Vector3(0, 1.6, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    this.radius = 0.35;
    this.standHeight = 1.6;
    this.crouchHeight = 0.9;
    this.currentHeight = 1.6;

    // Movement attributes
    this.walkSpeed = 5.2;
    this.sprintSpeed = 8.6;
    this.crouchSpeed = 2.8;
    this.slideSpeed = 10.5;
    this.jumpForce = 8.5;
    this.friction = 14.0;
    this.acceleration = 70.0;

    this.onGround = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.slideTimer = 0;

    // Sprint Stamina (5.0s max sprint)
    this.stamina = 5.0;
    this.maxStamina = 5.0;

    // Health & Regeneration
    this.maxHealth = 100;
    this.health = 100;
    this.isDead = false;
    this.timeSinceLastDamage = 10.0;
    this.regenDelay = 4.2;
    this.regenRate = 40.0; // HP per sec
    this.damageVignette = 0; // 0 to 1

    // Footstep timer
    this.footstepTimer = 0;

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      crouch: false,
      fire: false,
      ads: false,
      reload: false,
      switch: false,
      grenade: false,
      melee: false
    };

    this.setupKeyboardListeners();
  }

  setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = true;
          break;
        case 'Space':
          this.keys.jump = true;
          break;
        case 'KeyC':
        case 'ControlLeft':
          this.toggleCrouch();
          break;
        case 'KeyR':
          this.keys.reload = true;
          break;
        case 'KeyQ':
        case 'Digit1':
        case 'Digit2':
          this.keys.switch = true;
          break;
        case 'KeyG':
          this.keys.grenade = true;
          break;
        case 'KeyV':
        case 'KeyF':
          this.keys.melee = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.keys.fire = true;
      if (e.button === 2) this.keys.ads = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.keys.fire = false;
      if (e.button === 2) this.keys.ads = false;
    });

    // Prevent default right-click context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toggleCrouch() {
    if (this.isSprinting && this.onGround && !this.isSliding) {
      // Initiate Slide
      this.isSliding = true;
      this.slideTimer = 0.65;
      this.isCrouching = true;
    } else {
      this.isCrouching = !this.isCrouching;
      this.isSliding = false;
    }
  }

  spawn(spawnPos) {
    this.pos.copy(spawnPos);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.isDead = false;
    this.timeSinceLastDamage = 10.0;
    this.damageVignette = 0;
    this.stamina = this.maxStamina;
    soundFX.setLowHealthState(false);
  }

  takeDamage(amount, sourcePos = null) {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);
    this.timeSinceLastDamage = 0;
    this.damageVignette = 1.0;

    soundFX.playPlayerHurt();

    if (this.health <= 35) {
      soundFX.setLowHealthState(true);
    }

    if (this.health <= 0) {
      this.isDead = true;
      soundFX.setLowHealthState(false);
      this.particles.spawnBlood(this.pos, new THREE.Vector3(0, 1, 0));
    }
  }

  heal(amount) {
    if (this.isDead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.health > 35) {
      soundFX.setLowHealthState(false);
    }
  }

  update(dt, cameraRig) {
    if (this.isDead) return;

    // 1. Health Regeneration
    this.timeSinceLastDamage += dt;
    if (this.timeSinceLastDamage > this.regenDelay && this.health < this.maxHealth) {
      this.heal(this.regenRate * dt);
    }

    // Decay damage vignette overlay
    this.damageVignette = Math.max(0, this.damageVignette - dt * 1.5);

    // 2. Crouch Height Lerp
    const targetHeight = this.isCrouching ? this.crouchHeight : this.standHeight;
    this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, dt * 12);

    // 3. Movement Direction from Camera Yaw
    const yaw = cameraRig.yaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();

    let moveX = 0;
    let moveZ = 0;
    if (this.keys.forward) moveZ += 1;
    if (this.keys.backward) moveZ -= 1;
    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;

    const inputDir = new THREE.Vector3();
    inputDir.addScaledVector(forward, moveZ);
    inputDir.addScaledVector(right, moveX);

    const isMoving = inputDir.lengthSq() > 0.01;
    if (isMoving) inputDir.normalize();

    // 4. Sprint & Slide Mechanics
    if (this.keys.sprint && isMoving && moveZ > 0 && !this.isCrouching && !this.keys.ads && this.stamina > 0.5) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - dt);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 1.2);
    }

    // Slide state
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // Target movement speed
    let targetSpeed = this.walkSpeed;
    if (this.isSliding) targetSpeed = this.slideSpeed;
    else if (this.isSprinting) targetSpeed = this.sprintSpeed;
    else if (this.isCrouching) targetSpeed = this.crouchSpeed;
    else if (this.keys.ads) targetSpeed = this.walkSpeed * 0.6;

    // 5. Horizontal Acceleration & Friction
    if (isMoving && !this.isSliding) {
      const targetVelX = inputDir.x * targetSpeed;
      const targetVelZ = inputDir.z * targetSpeed;

      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, dt * this.acceleration * 0.1);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, dt * this.acceleration * 0.1);
    } else if (this.isSliding) {
      // Slide deceleration
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * 2.0);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, dt * 2.0);
    } else {
      // Ground friction
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dt * this.friction);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, dt * this.friction);
    }

    // 6. Jumping
    if (this.keys.jump && this.onGround && !this.isSliding) {
      this.velocity.y = this.jumpForce;
      this.onGround = false;
      soundFX.playJump();
    }

    // 7. Physics Movement & Collision
    const wasOnGround = this.onGround;
    const colResult = this.physics.moveEntity(this.pos, this.velocity, this.radius, this.currentHeight, dt, true);
    this.onGround = colResult.onGround;

    if (!wasOnGround && this.onGround && Math.abs(this.velocity.y) < 1.0) {
      soundFX.playLand();
    }

    // 8. Footstep Audio Rhythm
    if (this.onGround && isMoving) {
      const stepInterval = this.isSprinting ? 0.28 : (this.isCrouching ? 0.65 : 0.42);
      this.footstepTimer += dt;
      if (this.footstepTimer >= stepInterval) {
        this.footstepTimer = 0;
        soundFX.playFootstep(this.isSprinting, this.isCrouching);
      }
    } else {
      this.footstepTimer = 0.1;
    }
  }
}
