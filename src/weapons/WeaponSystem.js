// WeaponSystem.js - Weapon definitions, state management, firing, reloading, recoil, and spread
import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';

export const WEAPON_DATA = {
  m4: {
    id: 'm4',
    name: 'M4-VOX',
    type: 'ar',
    fireRate: 650, // RPM (~0.092s per shot)
    fireMode: 'auto',
    damage: 34, // 3-4 shot kill
    headshotMult: 2.0,
    rangeStart: 18,
    rangeEnd: 45,
    minDamageMult: 0.65,
    magSize: 30,
    maxReserve: 150,
    defaultReserve: 90,
    reloadTime: 2.2,
    spreadHip: 0.035,
    spreadADS: 0.003,
    recoilPitch: 0.022,
    recoilYaw: 0.008,
    viewmodelKick: { z: 0.045, rotX: 0.08 },
    adsFOV: 52,
    adsPos: new THREE.Vector3(0, -0.13, -0.32),
    weightSpeedMult: 1.0
  },
  vector: {
    id: 'vector',
    name: 'MP-VECTOR',
    type: 'smg',
    fireRate: 950, // RPM (~0.063s per shot)
    fireMode: 'auto',
    damage: 23, // 5 shot kill
    headshotMult: 1.8,
    rangeStart: 10,
    rangeEnd: 28,
    minDamageMult: 0.5,
    magSize: 36,
    maxReserve: 180,
    defaultReserve: 108,
    reloadTime: 1.8,
    spreadHip: 0.045,
    spreadADS: 0.006,
    recoilPitch: 0.016,
    recoilYaw: 0.012,
    viewmodelKick: { z: 0.035, rotX: 0.05 },
    adsFOV: 58,
    adsPos: new THREE.Vector3(0, -0.11, -0.28),
    weightSpeedMult: 1.06
  },
  striker: {
    id: 'striker',
    name: 'STRIKER-12',
    type: 'shotgun',
    fireRate: 80, // RPM (~0.75s per shot)
    fireMode: 'pump',
    pelletCount: 8,
    damage: 18, // 18 * 8 = 144 max damage (one-shot close)
    headshotMult: 1.5,
    rangeStart: 6,
    rangeEnd: 20,
    minDamageMult: 0.25,
    magSize: 8,
    maxReserve: 40,
    defaultReserve: 24,
    reloadTime: 2.8,
    spreadHip: 0.085,
    spreadADS: 0.045,
    recoilPitch: 0.065,
    recoilYaw: 0.018,
    viewmodelKick: { z: 0.09, rotX: 0.16 },
    adsFOV: 62,
    adsPos: new THREE.Vector3(0, -0.06, -0.34),
    weightSpeedMult: 0.98
  },
  vox50: {
    id: 'vox50',
    name: 'VOX-50',
    type: 'sniper',
    fireRate: 42, // RPM (~1.4s bolt cycle)
    fireMode: 'bolt',
    damage: 120, // One shot torso/head
    headshotMult: 2.5,
    rangeStart: 40,
    rangeEnd: 120,
    minDamageMult: 0.9,
    magSize: 5,
    maxReserve: 25,
    defaultReserve: 15,
    reloadTime: 3.2,
    spreadHip: 0.14,
    spreadADS: 0.0005, // Pinpoint in scope
    recoilPitch: 0.09,
    recoilYaw: 0.015,
    viewmodelKick: { z: 0.12, rotX: 0.22 },
    adsFOV: 20,
    adsPos: new THREE.Vector3(0, -0.145, -0.28),
    weightSpeedMult: 0.92,
    hasScopeOverlay: true
  },
  magnum: {
    id: 'magnum',
    name: 'MAGNUM-44',
    type: 'pistol',
    fireRate: 220, // RPM (~0.27s per shot)
    fireMode: 'semi',
    damage: 55, // 2-shot kill
    headshotMult: 2.0,
    rangeStart: 12,
    rangeEnd: 35,
    minDamageMult: 0.55,
    magSize: 6,
    maxReserve: 36,
    defaultReserve: 24,
    reloadTime: 2.0,
    spreadHip: 0.038,
    spreadADS: 0.005,
    recoilPitch: 0.045,
    recoilYaw: 0.01,
    viewmodelKick: { z: 0.05, rotX: 0.12 },
    adsFOV: 60,
    adsPos: new THREE.Vector3(0, -0.035, -0.3),
    weightSpeedMult: 1.08
  }
};

export class WeaponSystem {
  constructor(perks = {}) {
    this.perks = perks; // e.g. { sleightOfHand: true, stoppingPower: false, scavenger: true }
    this.primaryWeaponId = 'm4';
    this.secondaryWeaponId = 'magnum';
    this.currentSlot = 'primary'; // 'primary' | 'secondary'

    this.weapons = {};
    this.initWeapons();

    this.fireTimer = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.isSwitching = false;
    this.switchTimer = 0;

    this.grenadeCount = 3;
    this.maxGrenades = 4;
    this.isCookingGrenade = false;
    this.grenadeCookTime = 0;

    this.isMeleeing = false;
    this.meleeTimer = 0;

    // Current dynamic spread
    this.currentSpread = 0.03;
  }

  initWeapons() {
    for (const key of Object.keys(WEAPON_DATA)) {
      const data = WEAPON_DATA[key];
      this.weapons[key] = {
        data: data,
        currentAmmo: data.magSize,
        reserveAmmo: data.defaultReserve
      };
    }
  }

  setupLoadout(primaryId, secondaryId, camo = 'standard', perks = {}) {
    this.primaryWeaponId = primaryId || 'm4';
    this.secondaryWeaponId = secondaryId || 'magnum';
    this.camo = camo;
    this.perks = perks;
    this.currentSlot = 'primary';
    this.isReloading = false;
    this.isSwitching = false;
    this.initWeapons();
  }

  getCurrentWeapon() {
    const id = this.currentSlot === 'primary' ? this.primaryWeaponId : this.secondaryWeaponId;
    return this.weapons[id];
  }

  getCurrentWeaponData() {
    return this.getCurrentWeapon().data;
  }

  canFire() {
    if (this.isReloading || this.isSwitching || this.isMeleeing) return false;
    if (this.fireTimer > 0) return false;
    const w = this.getCurrentWeapon();
    return w.currentAmmo > 0;
  }

  // Attempt to fire weapon
  fire(isADS = false, isMoving = false, isSprinting = false, isCrouching = false) {
    if (this.isReloading || this.isSwitching || this.isMeleeing) return null;

    const w = this.getCurrentWeapon();
    const data = w.data;

    // Empty mag check
    if (w.currentAmmo <= 0) {
      if (this.fireTimer <= 0) {
        soundFX.playReloadPart('empty');
        this.fireTimer = 0.25;
      }
      return null;
    }

    // Fire timing
    const fireInterval = 60 / data.fireRate;
    this.fireTimer = fireInterval;
    w.currentAmmo--;

    // Play synthesized gunfire sound
    soundFX.playGunshot(data.type, true);

    // Calculate dynamic spread
    let baseSpread = isADS ? data.spreadADS : data.spreadHip;
    if (isCrouching) baseSpread *= 0.7;
    if (isMoving) baseSpread *= 1.6;
    if (isSprinting) baseSpread *= 2.2;
    this.currentSpread = baseSpread;

    // Stopping Power perk (+25% damage)
    const dmgMult = this.perks.stoppingPower ? 1.25 : 1.0;
    const baseDamage = data.damage * dmgMult;

    return {
      weaponData: data,
      pellets: data.pelletCount || 1,
      damage: baseDamage,
      headshotMult: data.headshotMult,
      rangeStart: data.rangeStart,
      rangeEnd: data.rangeEnd,
      minDamageMult: data.minDamageMult,
      spread: baseSpread,
      recoilPitch: data.recoilPitch,
      recoilYaw: data.recoilYaw,
      kickZ: data.viewmodelKick.z,
      kickRotX: data.viewmodelKick.rotX,
      isADS
    };
  }

  // Start Reload
  reload() {
    if (this.isReloading || this.isSwitching || this.isMeleeing) return false;
    const w = this.getCurrentWeapon();
    const data = w.data;

    if (w.currentAmmo >= data.magSize) return false; // Full
    if (w.reserveAmmo <= 0) return false; // Out of ammo

    this.isReloading = true;
    // Sleight of hand perk (50% faster)
    const reloadSpeedMult = this.perks.sleightOfHand ? 0.65 : 1.0;
    this.reloadDuration = data.reloadTime * reloadSpeedMult;
    this.reloadTimer = this.reloadDuration;

    // Play staged reload audio
    soundFX.playReloadPart('out');
    setTimeout(() => {
      if (this.isReloading) soundFX.playReloadPart('in');
    }, this.reloadDuration * 500);

    setTimeout(() => {
      if (this.isReloading) {
        if (data.fireMode === 'pump') soundFX.playReloadPart('pump');
        else soundFX.playReloadPart('bolt');
      }
    }, this.reloadDuration * 800);

    return true;
  }

  // Switch Weapon Slot
  switchWeapon() {
    if (this.isSwitching || this.isMeleeing) return false;
    this.isReloading = false;
    this.isSwitching = true;
    this.switchTimer = 0.45; // 0.45s switch time

    soundFX.playReloadPart('switch');
    this.currentSlot = (this.currentSlot === 'primary') ? 'secondary' : 'primary';
    return true;
  }

  // Quick Melee Swipe
  melee() {
    if (this.isMeleeing || this.isSwitching) return false;
    this.isMeleeing = true;
    this.meleeTimer = 0.55;
    soundFX.playMelee();
    return true;
  }

  // Replenish ammo (from Scavenger drops or ammo crates)
  addAmmo(amount = 60) {
    for (const key of Object.keys(this.weapons)) {
      const w = this.weapons[key];
      w.reserveAmmo = Math.min(w.data.maxReserve, w.reserveAmmo + Math.floor(w.data.magSize * 1.5));
    }
  }

  update(dt) {
    if (this.fireTimer > 0) this.fireTimer -= dt;

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const w = this.getCurrentWeapon();
        const data = w.data;
        const needed = data.magSize - w.currentAmmo;
        const taken = Math.min(needed, w.reserveAmmo);
        w.currentAmmo += taken;
        w.reserveAmmo -= taken;
      }
    }

    if (this.isSwitching) {
      this.switchTimer -= dt;
      if (this.switchTimer <= 0) {
        this.isSwitching = false;
      }
    }

    if (this.isMeleeing) {
      this.meleeTimer -= dt;
      if (this.meleeTimer <= 0) {
        this.isMeleeing = false;
      }
    }
  }
}
