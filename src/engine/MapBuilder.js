// MapBuilder.js - Procedural arena layouts for Blockment, Crash Site, and Rust Spire
import { BLOCK } from './VoxelWorld.js';
import * as THREE from 'three';

export class MapBuilder {
  constructor(voxelWorld) {
    this.world = voxelWorld;
    this.spawnPoints = [];
    this.enemySpawnPoints = [];
    this.coverNodes = [];
    this.sniperNodes = [];
  }

  // Helper methods to place shapes of voxels
  fillBox(x1, y1, z1, x2, y2, z2, blockId, isDestructible = false) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.world.setBlock(x, y, z, blockId);
        }
      }
    }
  }

  // Hollow box (for buildings, containers)
  hollowBox(x1, y1, z1, x2, y2, z2, wallBlockId, floorBlockId = null, roofBlockId = null) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const isEdgeX = (x === minX || x === maxX);
          const isEdgeY = (y === minY || y === maxY);
          const isEdgeZ = (z === minZ || z === maxZ);

          if (y === minY) {
            this.world.setBlock(x, y, z, floorBlockId || wallBlockId);
          } else if (y === maxY) {
            this.world.setBlock(x, y, z, roofBlockId || wallBlockId);
          } else if (isEdgeX || isEdgeZ) {
            this.world.setBlock(x, y, z, wallBlockId);
          } else {
            this.world.setBlock(x, y, z, BLOCK.AIR);
          }
        }
      }
    }
  }

  // Place shipping container (hollow or solid, with open doors)
  placeContainer(x, y, z, length, width, height, blockId, openEnds = false, rotationY = 0) {
    // length along Z or X
    if (rotationY === 0) {
      this.hollowBox(x, y, z, x + width - 1, y + height - 1, z + length - 1, blockId, blockId, blockId);
      if (openEnds) {
        // Open front and back
        for (let dx = 1; dx < width - 1; dx++) {
          for (let dy = 1; dy < height - 1; dy++) {
            this.world.setBlock(x + dx, y + dy, z, BLOCK.AIR);
            this.world.setBlock(x + dx, y + dy, z + length - 1, BLOCK.AIR);
          }
        }
      }
    } else {
      this.hollowBox(x, y, z, x + length - 1, y + height - 1, z + width - 1, blockId, blockId, blockId);
      if (openEnds) {
        for (let dz = 1; dz < width - 1; dz++) {
          for (let dy = 1; dy < height - 1; dy++) {
            this.world.setBlock(x, y + dy, z + dz, BLOCK.AIR);
            this.world.setBlock(x + length - 1, y + dy, z + dz, BLOCK.AIR);
          }
        }
      }
    }
  }

  // Place stairs / ramp
  placeStairs(x, y, z, length, height, width, dir = 'z', blockId = BLOCK.CONCRETE) {
    const stepH = height / length;
    for (let i = 0; i < length; i++) {
      const currentY = y + Math.floor(i * stepH);
      for (let h = y; h <= currentY; h++) {
        for (let w = 0; w < width; w++) {
          if (dir === 'z') {
            this.world.setBlock(x + w, h, z + i, blockId);
          } else if (dir === '-z') {
            this.world.setBlock(x + w, h, z + (length - 1 - i), blockId);
          } else if (dir === 'x') {
            this.world.setBlock(x + i, h, z + w, blockId);
          } else if (dir === '-x') {
            this.world.setBlock(x + (length - 1 - i), h, z + w, blockId);
          }
        }
      }
    }
  }

  // Build Map 1: BLOCKMENT (Fast CQB Container Yard)
  buildBlockment() {
    this.world.clear();
    this.spawnPoints = [];
    this.enemySpawnPoints = [];
    this.coverNodes = [];
    this.sniperNodes = [];

    const size = 36;
    const half = size / 2;

    // Ground: Asphalt floor with road markings
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        const isBorder = (x === -half || x === half || z === -half || z === half);
        const isHazard = (Math.abs(x) === half - 1 || Math.abs(z) === half - 1);
        const block = isHazard ? BLOCK.HAZARD : BLOCK.ASPHALT;
        this.world.setBlock(x, 0, z, block);
      }
    }

    // Outer Perimeter Blast Walls (3 blocks high)
    for (let x = -half; x <= half; x++) {
      for (let y = 1; y <= 4; y++) {
        this.world.setBlock(x, y, -half, BLOCK.CONCRETE);
        this.world.setBlock(x, y, half, BLOCK.CONCRETE);
      }
    }
    for (let z = -half; z <= half; z++) {
      for (let y = 1; y <= 4; y++) {
        this.world.setBlock(-half, y, z, BLOCK.CONCRETE);
        this.world.setBlock(half, y, z, BLOCK.CONCRETE);
      }
    }

    // Corner Watch Towers / Sniper Perches
    const towers = [
      { x: -half + 2, z: -half + 2 },
      { x: half - 6, z: -half + 2 },
      { x: -half + 2, z: half - 6 },
      { x: half - 6, z: half - 6 }
    ];

    towers.forEach(t => {
      // 4x4 tower base
      this.fillBox(t.x, 1, t.z, t.x + 3, 3, t.z + 3, BLOCK.DARK_METAL);
      // Low railing
      this.world.setBlock(t.x, 4, t.z, BLOCK.METAL_BARRICADE);
      this.world.setBlock(t.x + 3, 4, t.z, BLOCK.METAL_BARRICADE);
      this.world.setBlock(t.x, 4, t.z + 3, BLOCK.METAL_BARRICADE);
      this.world.setBlock(t.x + 3, 4, t.z + 3, BLOCK.METAL_BARRICADE);
      this.sniperNodes.push(new THREE.Vector3(t.x + 1.5, 4, t.z + 1.5));
    });

    // --- CONTAINERS LAYOUT ---
    // North Containers (Blue & Red stacked)
    this.placeContainer(-12, 1, -12, 10, 4, 3, BLOCK.CONTAINER_BLUE, true, 0);
    this.placeContainer(-12, 4, -12, 10, 4, 3, BLOCK.CONTAINER_RED, false, 0);

    this.placeContainer(8, 1, -12, 10, 4, 3, BLOCK.CONTAINER_GREEN, true, 0);
    this.placeContainer(8, 4, -12, 10, 4, 3, BLOCK.CONTAINER_BLUE, false, 0);

    // South Containers
    this.placeContainer(-12, 1, 2, 10, 4, 3, BLOCK.CONTAINER_GREEN, true, 0);
    this.placeContainer(-12, 4, 2, 10, 4, 3, BLOCK.CONTAINER_BLUE, false, 0);

    this.placeContainer(8, 1, 2, 10, 4, 3, BLOCK.CONTAINER_RED, true, 0);
    this.placeContainer(8, 4, 2, 10, 4, 3, BLOCK.CONTAINER_GREEN, false, 0);

    // Angled / Cross Containers in middle
    this.placeContainer(-2, 1, -14, 4, 10, 3, BLOCK.CONTAINER_BLUE, true, 1);
    this.placeContainer(-2, 1, 4, 4, 10, 3, BLOCK.CONTAINER_RED, true, 1);

    // Center Hub Cover: Sandbags & Military Crates
    this.fillBox(-2, 1, -2, 2, 1, -2, BLOCK.SANDBAG);
    this.fillBox(-2, 1, 2, 2, 1, 2, BLOCK.SANDBAG);
    this.fillBox(-3, 1, -1, -3, 1, 1, BLOCK.SANDBAG);
    this.fillBox(3, 1, -1, 3, 1, 1, BLOCK.SANDBAG);

    // Center Crates
    this.fillBox(-1, 1, -1, 1, 2, 1, BLOCK.MILITARY_CRATE);
    this.world.setBlock(0, 3, 0, BLOCK.MILITARY_CRATE);

    // Explosive Barrels placed in strategic hot spots
    const barrels = [
      { x: -5, y: 1, z: -5 },
      { x: 5, y: 1, z: -5 },
      { x: -5, y: 1, z: 5 },
      { x: 5, y: 1, z: 5 },
      { x: -14, y: 1, z: 0 },
      { x: 14, y: 1, z: 0 }
    ];
    barrels.forEach(b => {
      this.world.setBlock(b.x, b.y, b.z, BLOCK.EXPLOSIVE_BARREL);
    });

    // Ramps to container tops
    this.placeStairs(-8, 1, -12, 4, 3, 2, 'z', BLOCK.WOOD);
    this.placeStairs(6, 1, 2, 4, 3, 2, 'z', BLOCK.WOOD);

    // Setup Spawns & Cover nodes
    this.spawnPoints.push(
      new THREE.Vector3(0, 1.6, -15),
      new THREE.Vector3(0, 1.6, 15),
      new THREE.Vector3(-15, 1.6, 0),
      new THREE.Vector3(15, 1.6, 0)
    );

    this.enemySpawnPoints.push(
      new THREE.Vector3(-14, 1.2, -14),
      new THREE.Vector3(14, 1.2, -14),
      new THREE.Vector3(-14, 1.2, 14),
      new THREE.Vector3(14, 1.2, 14),
      new THREE.Vector3(0, 1.2, -14),
      new THREE.Vector3(0, 1.2, 14),
      new THREE.Vector3(-14, 1.2, 0),
      new THREE.Vector3(14, 1.2, 0)
    );

    // Cover Nodes for AI tactical movement
    for (let x = -12; x <= 12; x += 6) {
      for (let z = -12; z <= 12; z += 6) {
        if (!this.world.hasBlock(x, 1, z)) {
          this.coverNodes.push(new THREE.Vector3(x, 1.2, z));
        }
      }
    }

    this.world.buildMesh();
  }

  // Build Map 2: CRASH SITE (Urban Warzone with 3-story hotel & crashed helicopter)
  buildCrashSite() {
    this.world.clear();
    this.spawnPoints = [];
    this.enemySpawnPoints = [];
    this.coverNodes = [];
    this.sniperNodes = [];

    const size = 50;
    const half = size / 2;

    // Ground: Asphalt roads & concrete sidewalks
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        // Sidewalk vs road
        const isRoad = (Math.abs(x) < 8 || Math.abs(z) < 8);
        this.world.setBlock(x, 0, z, isRoad ? BLOCK.ASPHALT : BLOCK.CONCRETE);
      }
    }

    // Outer City Buildings & Perimeter Walls
    for (let x = -half; x <= half; x++) {
      for (let y = 1; y <= 6; y++) {
        this.world.setBlock(x, y, -half, BLOCK.BRICK);
        this.world.setBlock(x, y, half, BLOCK.BRICK);
      }
    }
    for (let z = -half; z <= half; z++) {
      for (let y = 1; y <= 6; y++) {
        this.world.setBlock(-half, y, z, BLOCK.BRICK);
        this.world.setBlock(half, y, z, BLOCK.BRICK);
      }
    }

    // --- 3-STORY HOTEL BUILDING (North-West) ---
    const hx = -22, hz = -22, hw = 14, hl = 12, hh = 9;
    this.hollowBox(hx, 1, hz, hx + hw, hh, hz + hl, BLOCK.WHITE_CONCRETE, BLOCK.CONCRETE, BLOCK.ROOF_TILE);
    
    // Floor 2 & 3 slabs
    this.fillBox(hx + 1, 4, hz + 1, hx + hw - 1, 4, hz + hl - 1, BLOCK.WOOD);
    this.fillBox(hx + 1, 7, hz + 1, hx + hw - 1, 7, hz + hl - 1, BLOCK.WOOD);

    // Hotel Entrance Doorways
    for (let dy = 1; dy <= 3; dy++) {
      this.world.setBlock(hx + 6, dy, hz + hl, BLOCK.AIR);
      this.world.setBlock(hx + 7, dy, hz + hl, BLOCK.AIR);
    }
    // Floor 2 Sniper Balcony Windows facing plaza
    for (let dy = 5; dy <= 6; dy++) {
      this.world.setBlock(hx + 4, dy, hz + hl, BLOCK.AIR);
      this.world.setBlock(hx + 5, dy, hz + hl, BLOCK.AIR);
      this.world.setBlock(hx + 9, dy, hz + hl, BLOCK.AIR);
      this.world.setBlock(hx + 10, dy, hz + hl, BLOCK.AIR);
    }
    // Floor 3 Roof Sniper Perch
    this.sniperNodes.push(new THREE.Vector3(hx + 6, 10, hz + 6));
    this.sniperNodes.push(new THREE.Vector3(hx + 10, 5, hz + hl - 1));

    // Stairs inside Hotel
    this.placeStairs(hx + 2, 1, hz + 2, 4, 3, 2, 'z', BLOCK.WOOD);
    this.placeStairs(hx + 2, 4, hz + 7, 4, 3, 2, '-z', BLOCK.WOOD);
    this.placeStairs(hx + 8, 7, hz + 2, 4, 3, 2, 'z', BLOCK.WOOD);

    // --- 2-STORY CAFE BUILDING (South-East) ---
    const cx = 8, cz = 8, cw = 14, cl = 12, ch = 6;
    this.hollowBox(cx, 1, cz, cx + cw, ch, cz + cl, BLOCK.BRICK, BLOCK.CONCRETE, BLOCK.ROOF_TILE);
    this.fillBox(cx + 1, 3, cz + 1, cx + cw - 1, 3, cz + cl - 1, BLOCK.WOOD);

    // Cafe Doors & Windows
    for (let dy = 1; dy <= 2; dy++) {
      this.world.setBlock(cx, dy, cz + 5, BLOCK.AIR);
      this.world.setBlock(cx, dy, cz + 6, BLOCK.AIR);
      this.world.setBlock(cx + 4, dy, cz, BLOCK.GLASS);
      this.world.setBlock(cx + 5, dy, cz, BLOCK.GLASS);
    }
    this.placeStairs(cx + 2, 1, cz + 2, 4, 3, 2, 'z', BLOCK.WOOD);
    this.sniperNodes.push(new THREE.Vector3(cx + 6, 7, cz + 6));

    // --- CRASHED TRANSPORT HELICOPTER IN CENTER PLAZA ---
    // Fuselage (Dark Metal & Camo)
    this.fillBox(-4, 1, -2, 4, 2, 2, BLOCK.DARK_METAL);
    this.fillBox(-5, 1, -1, -4, 2, 1, BLOCK.CAMO); // Cockpit
    this.fillBox(4, 1, -1, 7, 2, 1, BLOCK.DARK_METAL); // Tail boom
    this.fillBox(7, 2, -1, 8, 4, 0, BLOCK.DARK_METAL); // Tail fin
    // Broken Rotor blades
    this.fillBox(-1, 3, -1, 1, 3, 1, BLOCK.STEEL_BEAM);
    this.fillBox(-5, 3, 0, 3, 3, 0, BLOCK.STEEL_BEAM);
    this.fillBox(0, 3, -4, 0, 3, 4, BLOCK.STEEL_BEAM);

    // Crater debris & Sandbag defense ring around chopper
    this.fillBox(-6, 1, -5, -2, 1, -5, BLOCK.SANDBAG);
    this.fillBox(2, 1, -5, 6, 1, -5, BLOCK.SANDBAG);
    this.fillBox(-6, 1, 5, -2, 1, 5, BLOCK.SANDBAG);
    this.fillBox(2, 1, 5, 6, 1, 5, BLOCK.SANDBAG);

    // Explosive Red Barrels around crash
    this.world.setBlock(-3, 1, -4, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(3, 1, 4, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(10, 1, -10, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(-10, 1, 10, BLOCK.EXPLOSIVE_BARREL);

    // Crates & Barricades for cover along streets
    this.fillBox(-10, 1, -2, -8, 2, 0, BLOCK.MILITARY_CRATE);
    this.fillBox(8, 1, 2, 10, 2, 4, BLOCK.MILITARY_CRATE);
    this.fillBox(0, 1, 12, 3, 1, 12, BLOCK.METAL_BARRICADE);
    this.fillBox(-3, 1, -12, 0, 1, -12, BLOCK.METAL_BARRICADE);

    // Spawns
    this.spawnPoints.push(
      new THREE.Vector3(0, 1.6, -20),
      new THREE.Vector3(0, 1.6, 20),
      new THREE.Vector3(-20, 1.6, 0),
      new THREE.Vector3(20, 1.6, 0)
    );

    this.enemySpawnPoints.push(
      new THREE.Vector3(-20, 1.2, -20),
      new THREE.Vector3(20, 1.2, -20),
      new THREE.Vector3(-20, 1.2, 20),
      new THREE.Vector3(20, 1.2, 20),
      new THREE.Vector3(0, 1.2, -20),
      new THREE.Vector3(0, 1.2, 20),
      new THREE.Vector3(-18, 1.2, 5),
      new THREE.Vector3(18, 1.2, -5)
    );

    // Cover nodes
    for (let x = -18; x <= 18; x += 6) {
      for (let z = -18; z <= 18; z += 6) {
        if (!this.world.hasBlock(x, 1, z)) {
          this.coverNodes.push(new THREE.Vector3(x, 1.2, z));
        }
      }
    }

    this.world.buildMesh();
  }

  // Build Map 3: RUST SPIRE (Multi-Tier Central Tower, Oil Pipelines, Bunkers)
  buildRustSpire() {
    this.world.clear();
    this.spawnPoints = [];
    this.enemySpawnPoints = [];
    this.coverNodes = [];
    this.sniperNodes = [];

    const size = 44;
    const half = size / 2;

    // Desert Sand / Dirt ground
    for (let x = -half; x <= half; x++) {
      for (let z = -half; z <= half; z++) {
        this.world.setBlock(x, 0, z, BLOCK.DIRT);
      }
    }

    // Outer Perimeter Rock / Concrete Walls
    for (let x = -half; x <= half; x++) {
      for (let y = 1; y <= 5; y++) {
        this.world.setBlock(x, y, -half, BLOCK.CONCRETE);
        this.world.setBlock(x, y, half, BLOCK.CONCRETE);
      }
    }
    for (let z = -half; z <= half; z++) {
      for (let y = 1; y <= 5; y++) {
        this.world.setBlock(-half, y, z, BLOCK.CONCRETE);
        this.world.setBlock(half, y, z, BLOCK.CONCRETE);
      }
    }

    // --- CENTRAL MULTI-TIER TOWER ---
    // Tier 1 Base (8x8, height 4)
    this.fillBox(-4, 1, -4, 4, 4, 4, BLOCK.DARK_METAL);
    // Hollow interior access with archways
    for (let dy = 1; dy <= 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.world.setBlock(dx, dy, -4, BLOCK.AIR);
        this.world.setBlock(dx, dy, 4, BLOCK.AIR);
        this.world.setBlock(-4, dy, dx, BLOCK.AIR);
        this.world.setBlock(4, dy, dx, BLOCK.AIR);
      }
    }

    // Tier 1 Deck Railing
    for (let x = -4; x <= 4; x++) {
      this.world.setBlock(x, 5, -4, BLOCK.METAL_BARRICADE);
      this.world.setBlock(x, 5, 4, BLOCK.METAL_BARRICADE);
    }
    for (let z = -4; z <= 4; z++) {
      this.world.setBlock(-4, 5, z, BLOCK.METAL_BARRICADE);
      this.world.setBlock(4, 5, z, BLOCK.METAL_BARRICADE);
    }

    // Tier 2 Middle Tower (4x4, height 8)
    this.fillBox(-2, 5, -2, 2, 8, 2, BLOCK.DARK_METAL);
    // Tier 2 Platform
    this.fillBox(-3, 8, -3, 3, 8, 3, BLOCK.STEEL_BEAM);
    this.world.setBlock(-3, 9, -3, BLOCK.METAL_BARRICADE);
    this.world.setBlock(3, 9, -3, BLOCK.METAL_BARRICADE);
    this.world.setBlock(-3, 9, 3, BLOCK.METAL_BARRICADE);
    this.world.setBlock(3, 9, 3, BLOCK.METAL_BARRICADE);

    // Tier 3 Crow's Nest / Top Spire (height 12)
    this.fillBox(-1, 9, -1, 1, 12, 1, BLOCK.STEEL_BEAM);
    this.fillBox(-2, 12, -2, 2, 12, 2, BLOCK.DARK_METAL);
    this.sniperNodes.push(new THREE.Vector3(0, 13, 0));
    this.sniperNodes.push(new THREE.Vector3(0, 9, 0));

    // Ramps & Stairs up to the Tower
    this.placeStairs(-4, 1, -8, 4, 4, 2, 'z', BLOCK.DARK_METAL);
    this.placeStairs(4, 1, 4, 4, 4, 2, '-z', BLOCK.DARK_METAL);
    this.placeStairs(-2, 5, 2, 3, 3, 2, '-z', BLOCK.DARK_METAL);
    this.placeStairs(0, 8, -2, 4, 4, 1, 'z', BLOCK.DARK_METAL);

    // --- PIPELINE TUNNELS (Crouch / Run Under Cover) ---
    // North-South Pipeline
    this.hollowBox(-14, 1, -16, -11, 3, 16, BLOCK.STEEL_BEAM, BLOCK.DIRT, BLOCK.STEEL_BEAM);
    // Open pipeline ends
    for (let dy = 1; dy <= 2; dy++) {
      for (let dx = -13; dx <= -12; dx++) {
        this.world.setBlock(dx, dy, -16, BLOCK.AIR);
        this.world.setBlock(dx, dy, 16, BLOCK.AIR);
        this.world.setBlock(dx, dy, 0, BLOCK.AIR); // middle cutout
      }
    }

    // East Fuel Tanks (Cylindrical-ish voxel tanks)
    this.fillBox(10, 1, -12, 16, 4, -6, BLOCK.CONTAINER_BLUE);
    this.fillBox(10, 1, 6, 16, 4, 12, BLOCK.CONTAINER_GREEN);

    // Bunkers & Sandbag Rings
    this.fillBox(-12, 1, -6, -8, 2, -6, BLOCK.SANDBAG);
    this.fillBox(-12, 1, 6, -8, 2, 6, BLOCK.SANDBAG);
    this.fillBox(8, 1, -2, 8, 2, 2, BLOCK.SANDBAG);

    // Explosive Barrels
    this.world.setBlock(10, 1, -4, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(10, 1, 4, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(-10, 1, 0, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(-5, 1, -12, BLOCK.EXPLOSIVE_BARREL);
    this.world.setBlock(5, 1, 12, BLOCK.EXPLOSIVE_BARREL);

    // Crates
    this.fillBox(5, 1, -14, 7, 2, -12, BLOCK.MILITARY_CRATE);
    this.fillBox(-8, 1, 12, -6, 2, 14, BLOCK.MILITARY_CRATE);

    // Spawns
    this.spawnPoints.push(
      new THREE.Vector3(0, 1.6, -18),
      new THREE.Vector3(0, 1.6, 18),
      new THREE.Vector3(-18, 1.6, 0),
      new THREE.Vector3(18, 1.6, 0)
    );

    this.enemySpawnPoints.push(
      new THREE.Vector3(-16, 1.2, -16),
      new THREE.Vector3(16, 1.2, -16),
      new THREE.Vector3(-16, 1.2, 16),
      new THREE.Vector3(16, 1.2, 16),
      new THREE.Vector3(0, 1.2, -16),
      new THREE.Vector3(0, 1.2, 16),
      new THREE.Vector3(-16, 1.2, 0),
      new THREE.Vector3(16, 1.2, 0)
    );

    for (let x = -16; x <= 16; x += 6) {
      for (let z = -16; z <= 16; z += 6) {
        if (!this.world.hasBlock(x, 1, z)) {
          this.coverNodes.push(new THREE.Vector3(x, 1.2, z));
        }
      }
    }

    this.world.buildMesh();
  }

  loadMap(mapId = 'blockment') {
    switch (mapId.toLowerCase()) {
      case 'blockment':
      case 'shipment':
        this.buildBlockment();
        break;
      case 'crash':
      case 'crashsite':
        this.buildCrashSite();
        break;
      case 'rust':
      case 'rustspire':
        this.buildRustSpire();
        break;
      default:
        this.buildBlockment();
    }
  }
}
