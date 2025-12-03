// main.js
// -----------------------------------------------------------------------------
// WAR CITIES PROTOTYPE - MAIN ENTRY POINT
// -----------------------------------------------------------------------------
// HOW TO RUN:
//   - Place all files in the same folder.
//   - Open index.html in a browser. For best results, serve via a local static
//     server (e.g. `python -m http.server`) so pointer lock and modules work
//     consistently.
// CONTROLS:
//   - WASD : Move
//   - Mouse: Look (click the canvas to capture the mouse)
//   - Space: Jump
//   - E    : Interact (doors, NPCs, exits)
//   - I    : Toggle inventory
//   - C    : Toggle character customization
//
// This file wires together all systems:
//   - 3D renderer and camera
//   - Procedural outer world (cities, POIs)
//   - Interior "cells" system
//   - Player character & movement
//   - Inventory and equipment visuals
//   - Faction war simulation
//   - NPCs and dialogue
//   - UI, chat, notifications
// -----------------------------------------------------------------------------

import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { NameGenerator, seededRandom } from './utils.js';
import { WorldManager, CHUNK_SIZE } from './world.js';
import { InteriorsManager } from './interiors.js';
import { PlayerCharacter, CharacterCustomizer } from './character.js';
import { InventorySystem } from './inventory.js';
import { WarManager } from './war.js';
import { NpcManager } from './npc.js';
import { UI } from './ui.js';

// Grab DOM elements
const canvas = document.getElementById('gameCanvas');
const pointerHint = document.getElementById('pointerHint');

// Three.js core
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);

// We use two scenes: exterior world and interior cell scenes
const worldScene = new THREE.Scene();
worldScene.background = new THREE.Color(0x05070a);
const interiorScene = new THREE.Scene();
interiorScene.background = new THREE.Color(0x020203);

// Basic lighting (simple PS2 / early Source feel)
const worldAmbient = new THREE.AmbientLight(0x404040);
worldScene.add(worldAmbient);
const worldDir = new THREE.DirectionalLight(0xffffff, 0.8);
worldDir.position.set(1, 3, 2);
worldScene.add(worldDir);

const interiorAmbient = new THREE.AmbientLight(0x555555);
interiorScene.add(interiorAmbient);
const interiorDir = new THREE.DirectionalLight(0xffffff, 0.6);
interiorDir.position.set(-2, 5, -1);
interiorScene.add(interiorDir);

// Camera & pointer-lock style controls (3rd-person chase camera)
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Game-wide random naming helper
const nameGen = new NameGenerator(1337);

// World/exterior manager
const worldManager = new WorldManager(worldScene, nameGen);

// Interiors manager
const interiorsManager = new InteriorsManager(interiorScene, nameGen);

// War simulation
const warManager = new WarManager(nameGen, (msg) => {
  UI.showNotification(msg);
});

// NPC manager (friendly city dwellers)
const npcManager = new NpcManager(worldScene, nameGen, warManager);

// Player character
const startingPos = new THREE.Vector3(0, 1.6, 0);
const player = new PlayerCharacter(worldScene, /*isFemale*/ true, startingPos);
player.attachCamera(camera);
const username = prompt('Enter your username', 'Guest');
player.setDisplayName(username || 'Guest');

// Character customization helper
const characterCustomizer = new CharacterCustomizer(player);

// Inventory system
const inventory = new InventorySystem(player);

// Game state
const state = {
  activeScene: 'world', // 'world' or 'interior'
  inInterior: false,
  lastAreaName: '',
  lastWorldPosition: startingPos.clone(),
  currentInteriorName: '',
};

// INPUT HANDLING --------------------------------------------------------------
const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
};

let wantJump = false; // one-shot jump intent

document.addEventListener('keydown', (e) => {
  if (e.code in keys) keys[e.code] = true;

  if (e.code === 'Space') {
    wantJump = true;
  }

  if (e.code === 'KeyI') {
    UI.toggleInventoryPanel();
  }
  if (e.code === 'KeyC') {
    UI.toggleCustomizationPanel();
  }
  if (e.code === 'KeyE') {
    handleInteraction();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code in keys) keys[e.code] = false;
});

// Pointer lock & mouse look
let yaw = 0;
let mouseLocked = false;

canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === canvas;
  pointerHint.style.display = mouseLocked ? 'none' : 'block';
});

document.addEventListener('mousemove', (e) => {
  if (!mouseLocked) return;
  const sensitivity = 0.0025;
  yaw -= e.movementX * sensitivity;
});

// WINDOW RESIZE ---------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// UI INITIALIZATION -----------------------------------------------------------
UI.init({
  inventory,
  characterCustomizer,
  warManager,
  player,
  onEquipItem: (itemId) => {
    inventory.equip(itemId);
    UI.refreshInventoryView(inventory);
  },
  onUnequipSlot: (slot) => {
    inventory.unequip(slot);
    UI.refreshInventoryView(inventory);
  },
  onCustomizationChanged: (options) => {
    characterCustomizer.applyOptions(options);
  },
  onChatSubmit: (text) => {
    // Player chat
    UI.appendChatMessage('You', text);
  },
});

// Seed some starter items into the inventory and render UI
inventory.addStarterItems();
// Default look inspired by the cyber-street vibe screenshot
characterCustomizer.applyOptions({
  gender: 'female',
  height: 'medium',
  bodyPreset: 'slim',
  headPreset: 'sharp',
  skinTone: 'light',
  hairStyle: 'long',
  hairColor: 'red',
});
inventory.equip('jacket_black');
inventory.equip('pants_jeans');
inventory.equip('boots_combat');
UI.refreshInventoryView(inventory);

// GAME LOOP -------------------------------------------------------------------
let lastTime = performance.now();

function gameLoop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (!Number.isFinite(dt) || dt <= 0) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const clampedDt = Math.min(dt, 0.1); // avoid rare spikes that can destabilize physics

  const input = {
    forward: keys.KeyW,
    backward: keys.KeyS,
    left: keys.KeyA,
    right: keys.KeyD,
    jump: wantJump,
    yaw: yaw,
  };
  wantJump = false; // consumed this frame

  // Move player and handle collisions
  const collisionFn = state.inInterior
    ? (pos, radius) => interiorsManager.handleCollisions(pos, radius)
    : (pos, radius) => worldManager.handleCollisions(pos, radius);

  player.update(clampedDt, input, collisionFn);

  // Update world or interiors
  if (!state.inInterior) {
    worldManager.update(player.position);
    npcManager.update(clampedDt, player.position);

    // Update "current area" label
    const areaName = worldManager.getAreaNameForPosition(player.position);
    if (areaName !== state.lastAreaName) {
      state.lastAreaName = areaName;
      UI.setAreaName(areaName);
    }
  } else {
    const areaName = `Inside: ${state.currentInteriorName}`;
    if (areaName !== state.lastAreaName) {
      state.lastAreaName = areaName;
      UI.setAreaName(areaName);
    }
  }

  // Advance war simulation
  warManager.update(clampedDt);
  UI.updateWarStatus(warManager);

  // Choose scene and render
  const sceneToRender = state.inInterior ? interiorScene : worldScene;
  renderer.render(sceneToRender, camera);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// INTERACTION HANDLING --------------------------------------------------------
function handleInteraction() {
  if (state.inInterior) {
    // Try exiting current interior
    const exitInfo = interiorsManager.getNearbyExit(player.position, 2.0);
    if (exitInfo) {
      // Teleport back to last exterior position
      player.position.copy(state.lastWorldPosition);
      player.syncTransform();
      state.inInterior = false;
      state.activeScene = 'world';
      UI.showNotification('You step back out onto the street.');
    }
    return;
  }

  // WORLD INTERACTIONS: NPCs first, then doors
  const npc = npcManager.getNearbyNpc(player.position, 2.0);
  if (npc) {
    const areaName = state.lastAreaName || worldManager.getAreaNameForPosition(player.position);
    const line = npcManager.getNpcDialogue(npc, areaName, warManager);
    UI.showDialog(line);
    return;
  }

  const door = worldManager.getNearbyDoor(player.position, 2.0);
  if (door) {
    // Enter interior
    state.lastWorldPosition.copy(player.position);
    const info = interiorsManager.enterInteriorFromDoor(door);
    state.currentInteriorName = info.interiorName || door.areaName;
    state.inInterior = true;
    state.activeScene = 'interior';

    // Teleport player into interior
    player.position.copy(info.spawnPosition);
    player.syncTransform();

    UI.showNotification(`Entering ${state.currentInteriorName}`);
    return;
  }

  // If we had a dialog open and nothing else to interact with, close it
  UI.hideDialog();
}
