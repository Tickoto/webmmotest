// interiors.js
// -----------------------------------------------------------------------------
// Interior cell system:
// - When entering a door, we switch to a separate interior scene and generate
//   a simple layout (shop / office).
// - The interior manager keeps a cache per door id so revisiting yields the
//   same layout.
// - It also manages collisions and an "exit" interaction.
// -----------------------------------------------------------------------------

import { loadThree } from './three-loader.js';

const THREE = await loadThree();

export class InteriorsManager {
  constructor(scene, nameGen) {
    this.scene = scene;
    this.nameGen = nameGen;
    this.interiorsByDoorId = new Map();
    this.activeInterior = null;
  }

  _createInteriorForDoor(door) {
    const group = new THREE.Group();

    // Simple rectangular room
    const w = 18;
    const d = 12;
    const h = 4;

    const floorGeom = new THREE.PlaneGeometry(w, d);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x202025 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x404040 });
    const wallGeomX = new THREE.BoxGeometry(w, h, 0.4);
    const wallGeomZ = new THREE.BoxGeometry(0.4, h, d);

    const wallFront = new THREE.Mesh(wallGeomX, wallMat);
    wallFront.position.set(0, h / 2, -d / 2);
    group.add(wallFront);

    const wallBack = new THREE.Mesh(wallGeomX, wallMat);
    wallBack.position.set(0, h / 2, d / 2);
    group.add(wallBack);

    const wallLeft = new THREE.Mesh(wallGeomZ, wallMat);
    wallLeft.position.set(-w / 2, h / 2, 0);
    group.add(wallLeft);

    const wallRight = new THREE.Mesh(wallGeomZ, wallMat);
    wallRight.position.set(w / 2, h / 2, 0);
    group.add(wallRight);

    const colliders = [
      // Represent walls as AABBs in local coordinates
      { minX: -w / 2, maxX: w / 2, minZ: -d / 2 - 0.2, maxZ: -d / 2 + 0.2 },
      { minX: -w / 2, maxX: w / 2, minZ: d / 2 - 0.2, maxZ: d / 2 + 0.2 },
      { minX: -w / 2 - 0.2, maxX: -w / 2 + 0.2, minZ: -d / 2, maxZ: d / 2 },
      { minX: w / 2 - 0.2, maxX: w / 2 + 0.2, minZ: -d / 2, maxZ: d / 2 },
    ];

    // Add simple props based on interior type
    if (door.interiorType === 'shop') {
      const shelfGeom = new THREE.BoxGeometry(1.5, 1.2, 4);
      const shelfMat = new THREE.MeshLambertMaterial({ color: 0x303040 });
      for (let i = -1; i <= 1; i++) {
        const shelf = new THREE.Mesh(shelfGeom, shelfMat);
        shelf.position.set(i * 4, 0.6, 0);
        group.add(shelf);
        colliders.push({
          minX: shelf.position.x - 0.75,
          maxX: shelf.position.x + 0.75,
          minZ: shelf.position.z - 2,
          maxZ: shelf.position.z + 2,
        });
      }
    } else {
      // Office desks
      const deskGeom = new THREE.BoxGeometry(2.4, 0.8, 1.2);
      const deskMat = new THREE.MeshLambertMaterial({ color: 0x3b3b35 });
      for (let i = -2; i <= 2; i += 2) {
        const desk = new THREE.Mesh(deskGeom, deskMat);
        desk.position.set(i * 2, 0.4, -1);
        group.add(desk);
        colliders.push({
          minX: desk.position.x - 1.2,
          maxX: desk.position.x + 1.2,
          minZ: desk.position.z - 0.6,
          maxZ: desk.position.z + 0.6,
        });
      }
    }

    // Exit door: near the "front" wall
    const exitGeom = new THREE.BoxGeometry(1.5, 2.5, 0.3);
    const exitMat = new THREE.MeshLambertMaterial({ color: 0x885522 });
    const exitMesh = new THREE.Mesh(exitGeom, exitMat);
    exitMesh.position.set(0, 1.3, -d / 2 + 0.2);
    group.add(exitMesh);

    const exitInfo = {
      mesh: exitMesh,
      x: exitMesh.position.x,
      z: exitMesh.position.z,
    };

    this.scene.add(group);

    const interior = {
      group,
      colliders,
      exitInfo,
      doorId: door.id,
      interiorName: door.areaName,
    };
    this.interiorsByDoorId.set(door.id, interior);
    return interior;
  }

  enterInteriorFromDoor(door) {
    let interior = this.interiorsByDoorId.get(door.id);
    if (!interior) {
      interior = this._createInteriorForDoor(door);
    }
    this.activeInterior = interior;

    // Spawn position: slightly in front of exit door
    const spawn = new THREE.Vector3(
      interior.exitInfo.x,
      1.6,
      interior.exitInfo.z + 2.0
    );

    return { spawnPosition: spawn, interiorName: interior.interiorName };
  }

  getNearbyExit(pos, maxDist) {
    if (!this.activeInterior) return null;
    const e = this.activeInterior.exitInfo;
    const dx = pos.x - e.x;
    const dz = pos.z - e.z;
    const d2 = dx * dx + dz * dz;
    return d2 <= maxDist * maxDist ? e : null;
  }

  // Very similar to world collision but in local interior coordinates
  handleCollisions(pos, radius) {
    if (!this.activeInterior) return;
    const r = radius || 0.7;
    for (const c of this.activeInterior.colliders) {
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
    if (pos.y < 1.6) pos.y = 1.6;
  }
}
