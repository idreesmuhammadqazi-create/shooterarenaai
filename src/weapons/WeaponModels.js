// WeaponModels.js - Procedural 3D Voxel First-Person Weapon & Hand Models
import * as THREE from 'three';

export class WeaponModels {
  static getCamoColors(camo = 'standard') {
    switch (camo.toLowerCase()) {
      case 'desert':
        return { primary: 0xc4a36e, secondary: 0x8a7046, accent: 0x3d3527 };
      case 'arctic':
        return { primary: 0xd8dee0, secondary: 0x8e979d, accent: 0x2e353b };
      case 'gold':
        return { primary: 0xffd700, secondary: 0xdaa520, accent: 0x1a1a1a, metalness: 0.9, roughness: 0.2 };
      case 'digital':
        return { primary: 0x4e6b52, secondary: 0x2e3d30, accent: 0x1f2720 };
      case 'standard':
      default:
        return { primary: 0x2c2e30, secondary: 0x1a1b1d, accent: 0x45484c };
    }
  }

  // Helper to add voxel box to group
  static addBox(group, x, y, z, w, h, d, color, metalness = 0.4, roughness = 0.6) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Create tactical arms/hands gripping weapon
  static createHands() {
    const group = new THREE.Group();
    const gloveColor = 0x24282c;
    const sleeveColor = 0x384033; // Military camo green

    // Right Arm (Forearm + Hand)
    const rightArm = new THREE.Group();
    // Sleeve
    WeaponModels.addBox(rightArm, 0.12, -0.4, 0.1, 0.12, 0.45, 0.14, sleeveColor, 0.1, 0.9);
    // Glove Hand
    WeaponModels.addBox(rightArm, 0.1, -0.05, 0.05, 0.14, 0.12, 0.16, gloveColor, 0.2, 0.8);
    // Fingers
    WeaponModels.addBox(rightArm, 0.08, -0.02, 0.08, 0.04, 0.08, 0.1, 0x181a1c);
    group.add(rightArm);

    // Left Arm (Forearm + Hand supporting front)
    const leftArm = new THREE.Group();
    WeaponModels.addBox(leftArm, -0.28, -0.38, 0.25, 0.12, 0.42, 0.14, sleeveColor, 0.1, 0.9);
    WeaponModels.addBox(leftArm, -0.22, -0.04, 0.35, 0.14, 0.1, 0.14, gloveColor, 0.2, 0.8);
    group.add(leftArm);

    return { group, rightArm, leftArm };
  }

  // 1. M4-VOX (Assault Rifle)
  static createM4(camo = 'standard') {
    const group = new THREE.Group();
    const colors = WeaponModels.getCamoColors(camo);
    const m = colors.metalness || 0.4;
    const r = colors.roughness || 0.6;

    // Lower & Upper Receiver
    WeaponModels.addBox(group, -0.04, -0.06, -0.15, 0.08, 0.12, 0.35, colors.primary, m, r);
    // Stock (Carbine)
    WeaponModels.addBox(group, -0.035, -0.04, -0.42, 0.07, 0.1, 0.28, colors.secondary, 0.2, 0.8);
    WeaponModels.addBox(group, -0.038, -0.08, -0.44, 0.076, 0.14, 0.06, colors.accent, 0.3, 0.7);
    // Grip
    WeaponModels.addBox(group, -0.035, -0.24, -0.12, 0.07, 0.18, 0.08, colors.secondary, 0.2, 0.8);
    // Magazine (Curved 30-round mag)
    WeaponModels.addBox(group, -0.032, -0.28, 0.06, 0.064, 0.24, 0.1, 0x1f2124, 0.6, 0.4);
    // Handguard / Quad Rail
    WeaponModels.addBox(group, -0.045, -0.05, 0.2, 0.09, 0.1, 0.32, colors.primary, m, r);
    // Barrel
    WeaponModels.addBox(group, -0.02, -0.01, 0.52, 0.04, 0.04, 0.25, 0x181a1b, 0.8, 0.3);
    // Muzzle Brake / Flash Hider
    WeaponModels.addBox(group, -0.025, -0.015, 0.77, 0.05, 0.05, 0.06, 0x2a2d30, 0.9, 0.2);

    // Tactical Holographic Sight
    const sight = new THREE.Group();
    // Sight base
    WeaponModels.addBox(sight, -0.035, 0.06, -0.02, 0.07, 0.03, 0.14, 0x151618, 0.5, 0.5);
    // Sight hood/frame
    WeaponModels.addBox(sight, -0.04, 0.09, -0.02, 0.08, 0.08, 0.14, 0x222426, 0.4, 0.6);
    // Hollow sight window
    WeaponModels.addBox(sight, -0.03, 0.1, -0.01, 0.06, 0.06, 0.12, 0x0a0a0a, 0.1, 0.1);
    // Glowing Holographic Reticle Voxel Dot
    const reticleGeo = new THREE.BoxGeometry(0.008, 0.008, 0.002);
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.position.set(0, 0.13, 0.05);
    sight.add(reticle);

    group.add(sight);

    // Muzzle tip position for tracers & flashes
    group.muzzlePoint = new THREE.Vector3(0, 0.01, 0.83);
    group.ejectionPoint = new THREE.Vector3(0.05, 0.02, 0.02);

    return group;
  }

  // 2. MP-VECTOR (SMG)
  static createVector(camo = 'standard') {
    const group = new THREE.Group();
    const colors = WeaponModels.getCamoColors(camo);
    const m = colors.metalness || 0.4;
    const r = colors.roughness || 0.6;

    // Compact Angular Receiver
    WeaponModels.addBox(group, -0.04, -0.12, -0.1, 0.08, 0.18, 0.32, colors.primary, m, r);
    // Grip
    WeaponModels.addBox(group, -0.035, -0.28, -0.08, 0.07, 0.16, 0.07, colors.secondary, 0.2, 0.8);
    // Front Grip / Magwell
    WeaponModels.addBox(group, -0.035, -0.22, 0.12, 0.07, 0.14, 0.07, colors.secondary, 0.2, 0.8);
    // Long 9mm Extended Stick Magazine
    WeaponModels.addBox(group, -0.028, -0.34, 0.05, 0.056, 0.26, 0.06, 0x1f2124, 0.5, 0.5);
    // Short Shrouded Barrel & Suppressor
    WeaponModels.addBox(group, -0.03, -0.06, 0.22, 0.06, 0.06, 0.2, 0x181a1b, 0.8, 0.3);
    // Skeleton Stock
    WeaponModels.addBox(group, -0.02, -0.05, -0.32, 0.04, 0.08, 0.22, colors.accent, 0.7, 0.3);

    // Reflex Red Dot Sight
    const sight = new THREE.Group();
    WeaponModels.addBox(sight, -0.03, 0.06, 0.0, 0.06, 0.02, 0.1, 0x151618);
    WeaponModels.addBox(sight, -0.035, 0.08, 0.02, 0.07, 0.06, 0.06, 0x222426);
    // Red Dot
    const dotGeo = new THREE.BoxGeometry(0.006, 0.006, 0.002);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(0, 0.11, 0.05);
    sight.add(dot);
    group.add(sight);

    group.muzzlePoint = new THREE.Vector3(0, -0.03, 0.42);
    group.ejectionPoint = new THREE.Vector3(0.04, 0.0, 0.0);

    return group;
  }

  // 3. STRIKER-12 (Pump Shotgun)
  static createShotgun(camo = 'standard') {
    const group = new THREE.Group();
    const colors = WeaponModels.getCamoColors(camo);

    // Receiver
    WeaponModels.addBox(group, -0.045, -0.06, -0.15, 0.09, 0.12, 0.3, colors.primary, 0.5, 0.5);
    // Grip & Stock
    WeaponModels.addBox(group, -0.035, -0.22, -0.12, 0.07, 0.16, 0.08, colors.secondary, 0.1, 0.9);
    WeaponModels.addBox(group, -0.038, -0.06, -0.42, 0.076, 0.12, 0.28, colors.secondary, 0.1, 0.9);
    // Double Barrel + Mag Tube
    WeaponModels.addBox(group, -0.03, 0.0, 0.15, 0.06, 0.05, 0.48, 0x181a1b, 0.8, 0.2);
    WeaponModels.addBox(group, -0.028, -0.045, 0.15, 0.056, 0.045, 0.42, 0x26292c, 0.7, 0.3);
    // Ribbed Pump Slide
    WeaponModels.addBox(group, -0.04, -0.06, 0.24, 0.08, 0.08, 0.18, 0x3d352b, 0.2, 0.8);
    // Ghost ring iron sight
    WeaponModels.addBox(group, -0.015, 0.06, -0.1, 0.03, 0.03, 0.02, 0x44ff44);
    WeaponModels.addBox(group, -0.01, 0.055, 0.6, 0.02, 0.03, 0.02, 0xff4444);

    group.muzzlePoint = new THREE.Vector3(0, 0.025, 0.63);
    group.ejectionPoint = new THREE.Vector3(0.05, 0.0, 0.02);

    return group;
  }

  // 4. VOX-50 (Heavy Sniper Rifle)
  static createSniper(camo = 'standard') {
    const group = new THREE.Group();
    const colors = WeaponModels.getCamoColors(camo);

    // Heavy Long Receiver
    WeaponModels.addBox(group, -0.05, -0.06, -0.2, 0.1, 0.13, 0.4, colors.primary, 0.6, 0.4);
    // Ergonomic Precision Stock
    WeaponModels.addBox(group, -0.04, -0.08, -0.52, 0.08, 0.15, 0.32, colors.secondary, 0.2, 0.8);
    // Pistol Grip
    WeaponModels.addBox(group, -0.035, -0.24, -0.15, 0.07, 0.18, 0.08, colors.secondary);
    // Heavy Box Mag
    WeaponModels.addBox(group, -0.035, -0.22, 0.02, 0.07, 0.16, 0.12, 0x1a1c1e, 0.7, 0.3);
    // Bolt Action Handle
    WeaponModels.addBox(group, 0.05, 0.02, -0.08, 0.08, 0.03, 0.03, 0x44484d, 0.9, 0.1);
    // Long Fluted 50-cal Barrel
    WeaponModels.addBox(group, -0.025, -0.01, 0.2, 0.05, 0.05, 0.7, 0x161819, 0.85, 0.2);
    // Giant Muzzle Brake
    WeaponModels.addBox(group, -0.04, -0.025, 0.9, 0.08, 0.08, 0.1, 0x282c30, 0.9, 0.1);

    // High Power Tactical Sniper Scope
    const scope = new THREE.Group();
    // Scope Rings Mount
    WeaponModels.addBox(scope, -0.03, 0.07, -0.12, 0.06, 0.04, 0.04, 0x111314);
    WeaponModels.addBox(scope, -0.03, 0.07, 0.08, 0.06, 0.04, 0.04, 0x111314);
    // Scope Tube Body
    WeaponModels.addBox(scope, -0.035, 0.11, -0.22, 0.07, 0.07, 0.4, 0x1f2326, 0.6, 0.4);
    // Front & Rear Bell Housing
    WeaponModels.addBox(scope, -0.045, 0.1, -0.26, 0.09, 0.09, 0.06, 0x16181a);
    WeaponModels.addBox(scope, -0.045, 0.1, 0.16, 0.09, 0.09, 0.08, 0x16181a);
    // Illuminated Green Scope Lens
    const lensGeo = new THREE.BoxGeometry(0.07, 0.07, 0.01);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, 0.145, -0.255);
    scope.add(lens);

    group.add(scope);

    group.muzzlePoint = new THREE.Vector3(0, 0.015, 1.0);
    group.ejectionPoint = new THREE.Vector3(0.06, 0.02, -0.05);

    return group;
  }

  // 5. MAGNUM-44 (Secondary Revolver / Pistol)
  static createMagnum(camo = 'standard') {
    const group = new THREE.Group();
    const colors = WeaponModels.getCamoColors(camo);

    // Frame
    WeaponModels.addBox(group, -0.03, -0.05, -0.08, 0.06, 0.09, 0.22, colors.primary, 0.8, 0.2);
    // Grip (Wood or Tactical rubber)
    WeaponModels.addBox(group, -0.028, -0.22, -0.08, 0.056, 0.17, 0.07, 0x4a2a16, 0.1, 0.9);
    // Revolver Cylinder (6-shot)
    WeaponModels.addBox(group, -0.036, -0.04, -0.02, 0.072, 0.072, 0.1, 0x1e2022, 0.9, 0.2);
    // 6-inch Heavy Barrel with top vent rib
    WeaponModels.addBox(group, -0.025, -0.03, 0.14, 0.05, 0.06, 0.24, colors.primary, 0.85, 0.15);
    // Hammer
    WeaponModels.addBox(group, -0.01, 0.02, -0.09, 0.02, 0.04, 0.03, 0x44484c);
    // Front Red Ramp Sight
    WeaponModels.addBox(group, -0.008, 0.035, 0.36, 0.016, 0.025, 0.02, 0xff2222);

    group.muzzlePoint = new THREE.Vector3(0, 0.0, 0.38);
    group.ejectionPoint = new THREE.Vector3(0.04, 0.02, 0.0);

    return group;
  }

  // 6. Combat Knife
  static createKnife() {
    const group = new THREE.Group();
    // Grip
    WeaponModels.addBox(group, -0.02, -0.15, -0.03, 0.04, 0.14, 0.06, 0x222624, 0.1, 0.9);
    // Crossguard
    WeaponModels.addBox(group, -0.03, -0.01, -0.04, 0.06, 0.02, 0.08, 0x3d4144, 0.8, 0.2);
    // Serrated Steel Blade
    WeaponModels.addBox(group, -0.008, 0.01, -0.03, 0.016, 0.26, 0.06, 0x9fa4a8, 0.95, 0.1);

    group.muzzlePoint = new THREE.Vector3(0, 0.25, 0);
    return group;
  }

  // 7. Frag Grenade
  static createGrenade() {
    const group = new THREE.Group();
    // Voxel Pineapple Body
    WeaponModels.addBox(group, -0.06, -0.08, -0.06, 0.12, 0.14, 0.12, 0x3f4f34, 0.3, 0.7);
    // Ridges
    WeaponModels.addBox(group, -0.065, -0.05, -0.065, 0.13, 0.08, 0.13, 0x2e3b26, 0.4, 0.6);
    // Fuse & Lever
    WeaponModels.addBox(group, -0.03, 0.06, -0.03, 0.06, 0.05, 0.06, 0x4b5258, 0.8, 0.2);
    WeaponModels.addBox(group, 0.03, 0.02, -0.02, 0.02, 0.08, 0.04, 0x7a8288, 0.8, 0.2);
    // Pull Ring
    WeaponModels.addBox(group, -0.05, 0.07, 0.0, 0.02, 0.04, 0.04, 0xd4af37, 0.9, 0.1);
    // LED Flasher
    const ledGeo = new THREE.BoxGeometry(0.015, 0.015, 0.015);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0.09, 0.03);
    group.add(led);
    group.led = led;

    return group;
  }
}
