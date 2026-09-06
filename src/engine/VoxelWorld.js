// VoxelWorld.js - Voxel chunk manager, texture generator, optimized mesh builder
import * as THREE from 'three';

export const BLOCK = {
  AIR: 0,
  CONCRETE: 1,
  BRICK: 2,
  MILITARY_CRATE: 3,
  CONTAINER_BLUE: 4,
  CONTAINER_GREEN: 5,
  EXPLOSIVE_BARREL: 6,
  SANDBAG: 7,
  ASPHALT: 8,
  METAL_BARRICADE: 9,
  WOOD: 10,
  GLASS: 11,
  STEEL_BEAM: 12,
  HAZARD: 13,
  CAMO: 14,
  DIRT: 15,
  ROOF_TILE: 16,
  CONTAINER_RED: 17,
  WHITE_CONCRETE: 18,
  DARK_METAL: 19
};

export class VoxelWorld {
  constructor(scene) {
    this.scene = scene;
    this.voxels = new Map(); // key: "x,y,z" -> blockId
    this.destructible = new Map(); // key -> { hp, maxHp, isExplosive }
    this.materials = {};
    this.textureAtlas = null;
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this.blockSize = 1.0;
    this.initTextures();
  }

  posKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }

  initTextures() {
    // Generate procedural block canvas textures for realistic COD voxel aesthetic
    const createTexture = (drawFn) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      drawFn(ctx);
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestMipmapLinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    // Concrete
    const texConcrete = createTexture((ctx) => {
      ctx.fillStyle = '#6e7275';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const c = Math.random() > 0.5 ? '#55585b' : '#888c90';
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.strokeStyle = '#4e5154';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
    });

    // White Concrete / Plaster
    const texWhiteConcrete = createTexture((ctx) => {
      ctx.fillStyle = '#c8cbcc';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#b0b3b5' : '#dcdfe0';
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
      }
      ctx.strokeStyle = '#9ca0a3';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, 62, 62);
    });

    // Brick
    const texBrick = createTexture((ctx) => {
      ctx.fillStyle = '#4a2318';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#8f3c27';
      const rows = 8;
      const rowHeight = 64 / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowHeight;
        const offset = (r % 2) * 16;
        for (let x = -16 + offset; x < 64; x += 32) {
          ctx.fillStyle = (r + x) % 3 === 0 ? '#7a3120' : '#8f3c27';
          ctx.fillRect(x + 1, y + 1, 30, rowHeight - 2);
        }
      }
    });

    // Military Crate
    const texMilitaryCrate = createTexture((ctx) => {
      ctx.fillStyle = '#3a442e';
      ctx.fillRect(0, 0, 64, 64);
      // Border & metal brackets
      ctx.fillStyle = '#22291b';
      ctx.fillRect(0, 0, 64, 6);
      ctx.fillRect(0, 58, 64, 6);
      ctx.fillRect(0, 0, 6, 64);
      ctx.fillRect(58, 0, 6, 64);
      // Cross brace
      ctx.strokeStyle = '#22291b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(58, 58);
      ctx.moveTo(58, 6);
      ctx.lineTo(6, 58);
      ctx.stroke();
      // Stencil text
      ctx.fillStyle = '#c5a059';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('US-99', 18, 36);
    });

    // Shipping Container Blue
    const texContainerBlue = createTexture((ctx) => {
      ctx.fillStyle = '#1c4468';
      ctx.fillRect(0, 0, 64, 64);
      // Corrugation ridges
      for (let x = 4; x < 64; x += 8) {
        ctx.fillStyle = '#122e47';
        ctx.fillRect(x, 0, 3, 64);
        ctx.fillStyle = '#2c5d88';
        ctx.fillRect(x + 3, 0, 2, 64);
      }
      ctx.strokeStyle = '#0e2438';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
    });

    // Shipping Container Green
    const texContainerGreen = createTexture((ctx) => {
      ctx.fillStyle = '#2d4d34';
      ctx.fillRect(0, 0, 64, 64);
      for (let x = 4; x < 64; x += 8) {
        ctx.fillStyle = '#1c3121';
        ctx.fillRect(x, 0, 3, 64);
        ctx.fillStyle = '#416a4a';
        ctx.fillRect(x + 3, 0, 2, 64);
      }
      ctx.strokeStyle = '#142418';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
    });

    // Shipping Container Red
    const texContainerRed = createTexture((ctx) => {
      ctx.fillStyle = '#6d2621';
      ctx.fillRect(0, 0, 64, 64);
      for (let x = 4; x < 64; x += 8) {
        ctx.fillStyle = '#441714';
        ctx.fillRect(x, 0, 3, 64);
        ctx.fillStyle = '#8f332d';
        ctx.fillRect(x + 3, 0, 2, 64);
      }
      ctx.strokeStyle = '#32100e';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
    });

    // Explosive Barrel
    const texExplosive = createTexture((ctx) => {
      ctx.fillStyle = '#b81d13';
      ctx.fillRect(0, 0, 64, 64);
      // Steel bands
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(0, 10, 64, 6);
      ctx.fillRect(0, 48, 64, 6);
      // Yellow hazard diamond
      ctx.fillStyle = '#f1b82d';
      ctx.beginPath();
      ctx.moveTo(32, 22);
      ctx.lineTo(44, 32);
      ctx.lineTo(32, 42);
      ctx.lineTo(20, 32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('TNT', 24, 35);
    });

    // Sandbag
    const texSandbag = createTexture((ctx) => {
      ctx.fillStyle = '#9e8965';
      ctx.fillRect(0, 0, 64, 64);
      // Burlap weave pattern
      ctx.fillStyle = '#84714f';
      for (let y = 0; y < 64; y += 4) {
        for (let x = 0; x < 64; x += 8) {
          ctx.fillRect(x + ((y / 4) % 2) * 4, y, 3, 2);
        }
      }
      ctx.strokeStyle = '#6a5a3e';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
    });

    // Asphalt
    const texAsphalt = createTexture((ctx) => {
      ctx.fillStyle = '#2a2d30';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#1f2123' : '#383b3e';
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
      }
    });

    // Metal Barricade / Steel Plate
    const texMetalBarricade = createTexture((ctx) => {
      ctx.fillStyle = '#4a5056';
      ctx.fillRect(0, 0, 64, 64);
      // Rivets
      ctx.fillStyle = '#2b2e32';
      ctx.beginPath();
      ctx.arc(8, 8, 3, 0, Math.PI * 2);
      ctx.arc(56, 8, 3, 0, Math.PI * 2);
      ctx.arc(8, 56, 3, 0, Math.PI * 2);
      ctx.arc(56, 56, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b2e32';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 60, 60);
    });

    // Wood Planks
    const texWood = createTexture((ctx) => {
      ctx.fillStyle = '#6b4724';
      ctx.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 16) {
        ctx.fillStyle = y % 32 === 0 ? '#5a3b1e' : '#7c532b';
        ctx.fillRect(0, y + 1, 64, 14);
        // Wood grain
        ctx.fillStyle = '#482f18';
        ctx.fillRect(8, y + 5, 20, 1);
        ctx.fillRect(36, y + 9, 18, 1);
      }
    });

    // Hazard Stripes
    const texHazard = createTexture((ctx) => {
      ctx.fillStyle = '#f1b82d';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#1c1c1c';
      for (let i = -64; i < 128; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 12, 0);
        ctx.lineTo(i + 12 + 64, 64);
        ctx.lineTo(i + 64, 64);
        ctx.closePath();
        ctx.fill();
      }
    });

    // Camo / Foliage
    const texCamo = createTexture((ctx) => {
      ctx.fillStyle = '#3f4f34';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#283321';
      ctx.beginPath();
      ctx.arc(18, 20, 14, 0, Math.PI * 2);
      ctx.arc(48, 44, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#556846';
      ctx.beginPath();
      ctx.arc(44, 16, 12, 0, Math.PI * 2);
      ctx.arc(16, 48, 14, 0, Math.PI * 2);
      ctx.fill();
    });

    // Dark Metal / Steel Beam
    const texDarkMetal = createTexture((ctx) => {
      ctx.fillStyle = '#222528';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#32363b';
      ctx.fillRect(6, 6, 52, 52);
      ctx.fillStyle = '#16181a';
      ctx.fillRect(16, 16, 32, 32);
    });

    // Dirt / Ground
    const texDirt = createTexture((ctx) => {
      ctx.fillStyle = '#5c462e';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 150; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#483723' : '#705639';
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
      }
    });

    // Roof Tile
    const texRoofTile = createTexture((ctx) => {
      ctx.fillStyle = '#383b40';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#282a2e';
      for (let y = 0; y < 64; y += 12) {
        ctx.fillRect(0, y, 64, 2);
      }
    });

    // Create materials for each block ID
    const createMat = (tex, roughness = 0.85, metalness = 0.1) => {
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: roughness,
        metalness: metalness
      });
    };

    this.materials[BLOCK.CONCRETE] = createMat(texConcrete, 0.9, 0.05);
    this.materials[BLOCK.WHITE_CONCRETE] = createMat(texWhiteConcrete, 0.9, 0.05);
    this.materials[BLOCK.BRICK] = createMat(texBrick, 0.85, 0.05);
    this.materials[BLOCK.MILITARY_CRATE] = createMat(texMilitaryCrate, 0.7, 0.2);
    this.materials[BLOCK.CONTAINER_BLUE] = createMat(texContainerBlue, 0.4, 0.6);
    this.materials[BLOCK.CONTAINER_GREEN] = createMat(texContainerGreen, 0.4, 0.6);
    this.materials[BLOCK.CONTAINER_RED] = createMat(texContainerRed, 0.4, 0.6);
    this.materials[BLOCK.EXPLOSIVE_BARREL] = createMat(texExplosive, 0.5, 0.4);
    this.materials[BLOCK.SANDBAG] = createMat(texSandbag, 0.95, 0.0);
    this.materials[BLOCK.ASPHALT] = createMat(texAsphalt, 0.95, 0.05);
    this.materials[BLOCK.METAL_BARRICADE] = createMat(texMetalBarricade, 0.4, 0.7);
    this.materials[BLOCK.WOOD] = createMat(texWood, 0.85, 0.0);
    this.materials[BLOCK.STEEL_BEAM] = createMat(texDarkMetal, 0.35, 0.75);
    this.materials[BLOCK.DARK_METAL] = createMat(texDarkMetal, 0.35, 0.75);
    this.materials[BLOCK.HAZARD] = createMat(texHazard, 0.6, 0.3);
    this.materials[BLOCK.CAMO] = createMat(texCamo, 0.9, 0.05);
    this.materials[BLOCK.DIRT] = createMat(texDirt, 0.95, 0.0);
    this.materials[BLOCK.ROOF_TILE] = createMat(texRoofTile, 0.85, 0.1);

    // Glass (semi-transparent)
    this.materials[BLOCK.GLASS] = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.45
    });
  }

  setBlock(x, y, z, blockId, destructibleConfig = null) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const key = `${ix},${iy},${iz}`;

    if (blockId === BLOCK.AIR) {
      this.voxels.delete(key);
      this.destructible.delete(key);
    } else {
      this.voxels.set(key, blockId);
      if (destructibleConfig) {
        this.destructible.set(key, { ...destructibleConfig });
      } else if (blockId === BLOCK.EXPLOSIVE_BARREL) {
        this.destructible.set(key, { hp: 20, maxHp: 20, isExplosive: true });
      } else if (blockId === BLOCK.WOOD || blockId === BLOCK.MILITARY_CRATE) {
        this.destructible.set(key, { hp: 60, maxHp: 60, isExplosive: false });
      }
    }
  }

  getBlock(x, y, z) {
    const key = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    return this.voxels.get(key) || BLOCK.AIR;
  }

  hasBlock(x, y, z) {
    return this.getBlock(x, y, z) !== BLOCK.AIR;
  }

  clear() {
    this.voxels.clear();
    this.destructible.clear();
    while (this.meshGroup.children.length > 0) {
      const child = this.meshGroup.children[0];
      this.meshGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }
  }

  // Build high-performance merged geometry with face culling
  buildMesh() {
    // Clear old meshes
    while (this.meshGroup.children.length > 0) {
      const child = this.meshGroup.children[0];
      this.meshGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    // Group blocks by material type to batch into single geometries
    const blockBatches = new Map(); // blockId -> Array of { x, y, z, faces }

    // 6 Faces: +X, -X, +Y, -Y, +Z, -Z
    const NEIGHBORS = [
      { dir: [1, 0, 0], face: 'px' },
      { dir: [-1, 0, 0], face: 'nx' },
      { dir: [0, 1, 0], face: 'py' },
      { dir: [0, -1, 0], face: 'ny' },
      { dir: [0, 0, 1], face: 'pz' },
      { dir: [0, 0, -1], face: 'nz' }
    ];

    for (const [key, blockId] of this.voxels.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      const activeFaces = [];

      for (const { dir, face } of NEIGHBORS) {
        const nx = x + dir[0];
        const ny = y + dir[1];
        const nz = z + dir[2];
        const neighborBlock = this.getBlock(nx, ny, nz);
        
        // Render face if neighbor is air or transparent
        if (neighborBlock === BLOCK.AIR || (neighborBlock === BLOCK.GLASS && blockId !== BLOCK.GLASS)) {
          activeFaces.push(face);
        }
      }

      if (activeFaces.length > 0) {
        if (!blockBatches.has(blockId)) {
          blockBatches.set(blockId, []);
        }
        blockBatches.get(blockId).push({ x, y, z, faces: activeFaces });
      }
    }

    // Face vertex definitions (unit cube from 0 to 1)
    const FACE_DATA = {
      px: {
        verts: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
        norm: [1, 0, 0],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      nx: {
        verts: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
        norm: [-1, 0, 0],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      py: {
        verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
        norm: [0, 1, 0],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      },
      ny: {
        verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
        norm: [0, -1, 0],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      },
      pz: {
        verts: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]],
        norm: [0, 0, 1],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      nz: {
        verts: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
        norm: [0, 0, -1],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      }
    };

    // Construct merged BufferGeometry per block type
    for (const [blockId, blocks] of blockBatches.entries()) {
      const mat = this.materials[blockId] || this.materials[BLOCK.CONCRETE];

      const positions = [];
      const normals = [];
      const uvs = [];
      const indices = [];
      let vertOffset = 0;

      for (const { x, y, z, faces } of blocks) {
        for (const face of faces) {
          const data = FACE_DATA[face];
          for (let i = 0; i < 4; i++) {
            const v = data.verts[i];
            positions.push(x + v[0], y + v[1], z + v[2]);
            normals.push(...data.norm);
            uvs.push(...data.uvs[i]);
          }
          // Quad indices (two triangles: 0-1-2, 0-2-3)
          indices.push(
            vertOffset, vertOffset + 1, vertOffset + 2,
            vertOffset, vertOffset + 2, vertOffset + 3
          );
          vertOffset += 4;
        }
      }

      if (positions.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeBoundingSphere();

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.meshGroup.add(mesh);
      }
    }
  }

  // Raycast against voxel blocks
  raycast(origin, direction, maxDistance = 100) {
    const dir = direction.clone().normalize();
    let t = 0;
    const step = 0.2; // Fine step for accurate collision

    const currentPos = origin.clone();
    let lastAirPos = origin.clone();

    while (t < maxDistance) {
      currentPos.addScaledVector(dir, step);
      t += step;

      const bx = Math.floor(currentPos.x);
      const by = Math.floor(currentPos.y);
      const bz = Math.floor(currentPos.z);

      const block = this.getBlock(bx, by, bz);
      if (block !== BLOCK.AIR) {
        // Calculate hit normal based on entry direction
        const normal = new THREE.Vector3();
        const prevBx = Math.floor(lastAirPos.x);
        const prevBy = Math.floor(lastAirPos.y);
        const prevBz = Math.floor(lastAirPos.z);

        if (prevBx !== bx) normal.x = prevBx > bx ? 1 : -1;
        else if (prevBy !== by) normal.y = prevBy > by ? 1 : -1;
        else if (prevBz !== bz) normal.z = prevBz > bz ? 1 : -1;
        else normal.y = 1;

        return {
          hit: true,
          point: currentPos.clone(),
          normal: normal,
          distance: t,
          blockX: bx,
          blockY: by,
          blockZ: bz,
          blockId: block
        };
      }
      lastAirPos.copy(currentPos);
    }

    return { hit: false };
  }

  // Damage a voxel block (destructible crates, barrels)
  damageBlock(bx, by, bz, damage, onExplode = null) {
    const key = `${bx},${by},${bz}`;
    const dest = this.destructible.get(key);
    if (!dest) return false;

    dest.hp -= damage;
    if (dest.hp <= 0) {
      const isExplosive = dest.isExplosive;
      this.setBlock(bx, by, bz, BLOCK.AIR);
      this.buildMesh(); // Rebuild mesh on destruction

      if (isExplosive && onExplode) {
        onExplode(new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5));
      }
      return true;
    }
    return false;
  }
}
