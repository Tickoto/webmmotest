// world.js
// -----------------------------------------------------------------------------
// Procedural infinite-ish world generator.
// - The world is divided into square chunks on an (x,z) grid.
// - Each chunk is assigned a type (city core, suburb, park, highway, wasteland)
//   deterministically using seeded randomness.
// - Within city chunks, simple boxy buildings and roads are created.
// - Buildings have colliders and "door" meshes used for interaction.
//
// Exterior collisions are handled as 2D AABB vs player circle.
// -----------------------------------------------------------------------------

import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { seededRandom } from './utils.js';

export const CHUNK_SIZE = 80; // world units per chunk

export class WorldManager {
  constructor(scene, nameGen) {
    this.scene = scene;
    this.nameGen = nameGen;
    this.globalSeed = 4242;
    this.chunks = new Map(); // key: "x,z" -> chunk data
    this.activeRadius = 1; // number of chunks around player to keep
    this.colliders = []; // global list of building AABBs
    this.doors = []; // door objects for interaction
  }

  _chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  update(playerPos) {
    const cx = Math.floor(playerPos.x / CHUNK_SIZE);
    const cz = Math.floor(playerPos.z / CHUNK_SIZE);

    // Ensure neighboring chunks are generated
    for (let x = cx - this.activeRadius; x <= cx + this.activeRadius; x++) {
      for (let z = cz - this.activeRadius; z <= cz + this.activeRadius; z++) {
        const key = this._chunkKey(x, z);
        if (!this.chunks.has(key)) {
          this._generateChunk(x, z);
        }
      }
    }

    // Optionally, remove far-away chunks (very simple culling)
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - cx;
      const dz = chunk.cz - cz;
      if (Math.abs(dx) > this.activeRadius + 1 || Math.abs(dz) > this.activeRadius + 1) {
        // Remove meshes from scene
        this.scene.remove(chunk.group);
        // Remove colliders and doors belonging to this chunk
        this.colliders = this.colliders.filter((c) => c.chunkKey !== key);
        this.doors = this.doors.filter((d) => d.chunkKey !== key);
        this.chunks.delete(key);
      }
    }
  }

  _getChunkType(cx, cz) {
    const r = seededRandom(cx, cz, this.globalSeed);
    if (r < 0.45) return 'city';
    if (r < 0.60) return 'suburb';
    if (r < 0.72) return 'park';
    if (r < 0.84) return 'highway';
    return 'wasteland';
  }

  _generateChunk(cx, cz) {
    const key = this._chunkKey(cx, cz);
    const type = this._getChunkType(cx, cz);
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);

    const areaName = this.nameGen.getAreaName(type, cx, cz);

    // Simple ground plane per chunk
    const groundGeom = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 1, 1);
    let groundColor = 0x222222;
    if (type === 'park') groundColor = 0x224422;
    if (type === 'wasteland') groundColor = 0x333322;
    if (type === 'highway') groundColor = 0x2a2a2a;
    const groundMat = new THREE.MeshLambertMaterial({ color: groundColor });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    group.add(ground);

    if (type === 'city' || type === 'suburb') {
      this._populateBuildings(cx, cz, group, areaName, type);
      this._addRoads(cx, cz, group, type);
    } else if (type === 'park') {
      this._populatePark(cx, cz, group);
    } else if (type === 'highway') {
      this._populateHighway(cx, cz, group);
    } else if (type === 'wasteland') {
      this._populateWasteland(cx, cz, group);
    }

    this.scene.add(group);
    this.chunks.set(key, {
      cx,
      cz,
      type,
      group,
      areaName,
    });
  }

  _addRoads(cx, cz, group, type) {
    // Very simple cross-shaped road through city/suburb chunks
    const thickness = 6;
    const roadColor = type === 'city' ? 0x111111 : 0x181818;
    const roadMat = new THREE.MeshLambertMaterial({ color: roadColor });

    const roadXGeom = new THREE.BoxGeometry(CHUNK_SIZE, 0.2, thickness);
    const roadX = new THREE.Mesh(roadXGeom, roadMat);
    roadX.position.set(0, 0.01, 0);
    group.add(roadX);

    const roadZGeom = new THREE.BoxGeometry(thickness, 0.2, CHUNK_SIZE);
    const roadZ = new THREE.Mesh(roadZGeom, roadMat);
    roadZ.position.set(0, 0.02, 0);
    group.add(roadZ);
  }

  _populateBuildings(cx, cz, group, areaName, type) {
    const seedBase = cx * 92821 + cz * 68917 + this.globalSeed * 3;
    const buildingColorBase = type === 'city' ? 0x666666 : 0x777777;
    const rows = type === 'city' ? 4 : 3;
    const cols = type === 'city' ? 4 : 3;
    const spacingX = CHUNK_SIZE / (cols + 1);
    const spacingZ = CHUNK_SIZE / (rows + 1);

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const r = seededRandom(seedBase + i * 17, seedBase + j * 37, 99);
        if (r < 0.2) continue; // empty lot

        const width = 8 + r * 10;
        const depth = 8 + ((r * 11) % 6);
        const height = 8 + ((r * 13) % 20);

        const geom = new THREE.BoxGeometry(width, height, depth);
        const colorVar = ((seededRandom(seedBase + i, seedBase + j, 5) * 0x20) | 0) & 0xff;
        const color = (buildingColorBase & 0xffffff) + colorVar;
        const mat = new THREE.MeshLambertMaterial({ color: color & 0xffffff });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const x = (i + 1) * spacingX - CHUNK_SIZE / 2;
        const z = (j + 1) * spacingZ - CHUNK_SIZE / 2;
        mesh.position.set(x, height / 2, z);
        group.add(mesh);

        // Collider (AABB in world space)
        const minX = cx * CHUNK_SIZE + x - width / 2;
        const maxX = cx * CHUNK_SIZE + x + width / 2;
        const minZ = cz * CHUNK_SIZE + z - depth / 2;
        const maxZ = cz * CHUNK_SIZE + z + depth / 2;
        this.colliders.push({
          minX,
          maxX,
          minZ,
          maxZ,
          chunkKey: this._chunkKey(cx, cz),
        });

        // Door: small cube at base on one side
        const doorGeom = new THREE.BoxGeometry(1.2, 2.0, 0.3);
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x884422 });
        const door = new THREE.Mesh(doorGeom, doorMat);
        const doorLocalX = x + (width / 2 + 0.2); // front face
        door.position.set(doorLocalX, 1.0, z);
        group.add(door);

        const worldDoorX = cx * CHUNK_SIZE + door.position.x;
        const worldDoorZ = cz * CHUNK_SIZE + door.position.z;

        const poiKind = r < 0.5 ? 'shop' : 'office';
        const poiName =
          poiKind === 'shop'
            ? this.nameGen.getPoiName('shop', cx, cz, i * 10 + j)
            : `${areaName} Tower-${i}${j}`;

        this.doors.push({
          mesh: door,
          x: worldDoorX,
          z: worldDoorZ,
          areaName: poiName,
          chunkKey: this._chunkKey(cx, cz),
          interiorType: poiKind === 'shop' ? 'shop' : 'office',
          id: `${cx},${cz},${i},${j}`,
        });
      }
    }
  }

  _populatePark(cx, cz, group) {
    // Scatter some trees (cylinders + cones)
    const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    const treeLeafMat = new THREE.MeshLambertMaterial({ color: 0x224422 });

    for (let i = 0; i < 10; i++) {
      const r = seededRandom(cx * 17 + i, cz * 31 + i * 3, 123);
      const x = (r * CHUNK_SIZE) - CHUNK_SIZE / 2;
      const z = (((r * 13.37) % 1) * CHUNK_SIZE) - CHUNK_SIZE / 2;
      const trunkH = 2 + ((r * 7) % 2);
      const trunkGeom = new THREE.CylinderGeometry(0.3, 0.5, trunkH, 6);
      const trunk = new THREE.Mesh(trunkGeom, treeTrunkMat);
      trunk.position.set(x, trunkH / 2, z);
      group.add(trunk);

      const crownGeom = new THREE.ConeGeometry(1.6, 3, 6);
      const crown = new THREE.Mesh(crownGeom, treeLeafMat);
      crown.position.set(x, trunkH + 1.2, z);
      group.add(crown);
    }
  }

  _populateHighway(cx, cz, group) {
    // Elevated slab running through chunk
    const geom = new THREE.BoxGeometry(CHUNK_SIZE, 1, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x202020 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, 5, 0);
    group.add(mesh);
  }

  _populateWasteland(cx, cz, group) {
    // Low boxes as debris
    const mat = new THREE.MeshLambertMaterial({ color: 0x444433 });
    for (let i = 0; i < 8; i++) {
      const r = seededRandom(cx * 31 + i * 7, cz * 41 + i * 11, 777);
      const w = 4 + (r * 6) % 4;
      const d = 4 + (r * 9) % 4;
      const h = 1 + (r * 5) % 3;
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      const x = (r * CHUNK_SIZE) - CHUNK_SIZE / 2;
      const z = (((r * 10.7) % 1) * CHUNK_SIZE) - CHUNK_SIZE / 2;
      mesh.position.set(x, h / 2, z);
      group.add(mesh);
    }
  }

  // Collision: push player out of building boxes
  handleCollisions(pos, radius) {
    const r = radius || 0.7;
    for (const c of this.colliders) {
      if (
        pos.x > c.minX - r &&
        pos.x < c.maxX + r &&
        pos.z > c.minZ - r &&
        pos.z < c.maxZ + r
      ) {
        const dxMin = Math.abs(pos.x - (c.minX - r));
        const dxMax = Math.abs(pos.x - (c.maxX + r));
        const dzMin = Math.abs(pos.z - (c.minZ - r));
        const dzMax = Math.abs(pos.z - (c.maxZ + r));
        const minOverlap = Math.min(dxMin, dxMax, dzMin, dzMax);

        if (minOverlap === dxMin) pos.x = c.minX - r;
        else if (minOverlap === dxMax) pos.x = c.maxX + r;
        else if (minOverlap === dzMin) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      }
    }
    // Flat ground at y=1.6 (rough "eye height")
    if (pos.y < 1.6) pos.y = 1.6;
  }

  getAreaNameForPosition(pos) {
    const cx = Math.floor(pos.x / CHUNK_SIZE);
    const cz = Math.floor(pos.z / CHUNK_SIZE);
    const key = this._chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (chunk) return chunk.areaName;
    const type = this._getChunkType(cx, cz);
    return this.nameGen.getAreaName(type, cx, cz);
  }

  getNearbyDoor(pos, maxDist) {
    let best = null;
    let bestDistSq = maxDist * maxDist;
    for (const d of this.doors) {
      const dx = pos.x - d.x;
      const dz = pos.z - d.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = d;
      }
    }
    return best;
  }
}
