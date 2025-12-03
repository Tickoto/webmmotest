// npc.js
// -----------------------------------------------------------------------------
// Friendly city NPCs:
// - Simple roaming boxes that wander around the city streets.
// - Player can press E near an NPC to see a short dialogue line.
// - NPCs occasionally reference war events or nearby areas.
// -----------------------------------------------------------------------------

import { loadThree } from './three-loader.js';
import { Random } from './utils.js';
import { CHUNK_SIZE } from './world.js';

const THREE = await loadThree();

export class NpcManager {
  constructor(scene, nameGen, warManager) {
    this.scene = scene;
    this.nameGen = nameGen;
    this.warManager = warManager;
    this.random = new Random(555);

    this.npcs = [];
    this._spawnInitialNpcs();
  }

  _spawnInitialNpcs() {
    // Spawn a handful of NPCs around origin city blocks
    for (let i = 0; i < 14; i++) {
      const npc = this._createNpc(
        this.random.range(-CHUNK_SIZE / 2, CHUNK_SIZE / 2),
        this.random.range(-CHUNK_SIZE / 2, CHUNK_SIZE / 2)
      );
      this.npcs.push(npc);
    }
  }

  _createNpc(x, z) {
    const ghostHandles = ['xXDarkAngelXx', 'CyberRogue', 'DreamcastKid', 'HL2Fan', 'PixelHeart', 'NeonSkater'];
    const bodyGeom = new THREE.BoxGeometry(0.4, 1.4, 0.4);
    const bodyMat = new THREE.MeshLambertMaterial({
      color: 0x888888 + (this.random.int(0, 0x222222)),
    });
    const mesh = new THREE.Mesh(bodyGeom, bodyMat);
    mesh.position.set(x, 1.0, z);
    this.scene.add(mesh);

    return {
      mesh,
      state: 'idle',
      vx: 0,
      vz: 0,
      wanderTimer: this.random.range(2, 6),
      name: ghostHandles[this.random.int(0, ghostHandles.length - 1)],
    };
  }

  update(dt, playerPos) {
    for (const npc of this.npcs) {
      npc.wanderTimer -= dt;
      if (npc.wanderTimer <= 0) {
        npc.wanderTimer = this.random.range(2, 6);
        // Choose a new wander direction
        const angle = this.random.range(0, Math.PI * 2);
        npc.vx = Math.cos(angle) * 1.0;
        npc.vz = Math.sin(angle) * 1.0;
      }

      npc.mesh.position.x += npc.vx * dt;
      npc.mesh.position.z += npc.vz * dt;

      // Simple confinement around origin
      const r = CHUNK_SIZE / 1.5;
      npc.mesh.position.x = Math.max(
        -r,
        Math.min(r, npc.mesh.position.x)
      );
      npc.mesh.position.z = Math.max(
        -r,
        Math.min(r, npc.mesh.position.z)
      );

      // Idle bobbing
      const t = performance.now() / 400;
      npc.mesh.position.y = 1.0 + Math.sin(t + npc.mesh.position.x) * 0.03;
    }
  }

  getNearbyNpc(playerPos, maxDist) {
    let best = null;
    let bestDistSq = maxDist * maxDist;
    for (const npc of this.npcs) {
      const dx = playerPos.x - npc.mesh.position.x;
      const dz = playerPos.z - npc.mesh.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = npc;
      }
    }
    return best;
  }

  getNpcDialogue(npc, areaName, warManager) {
    const genericLines = [
      `Welcome to ${areaName}. Watch your step — the highways can be rough.`,
      `I grew up here in ${areaName}. It looked very different back then.`,
      `You look new. Try the shops around the main road, they still have power.`,
    ];
    const event = warManager.getRandomRecentEvent();
    if (event && Math.random() > 0.4) {
      return `${npc.name}: "${event}"`;
    }
    const line =
      genericLines[this.random.int(0, genericLines.length - 1)];
    return `${npc.name}: "${line}"`;
  }
}
