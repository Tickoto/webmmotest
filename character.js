// character.js
// -----------------------------------------------------------------------------
// Player character model and movement.
// Rebuilt with a PS1/Dreamcast-inspired low-poly avatar similar to the
// "CyberZone 2004" mockup: layered boxy meshes, pixelated canvas textures, and
// simple limb animation. Clothing colors still respond to equipment slots and
// customization options, but the silhouette and materials now have much more
// personality.
// -----------------------------------------------------------------------------

import { loadThree } from './three-loader.js';
const THREE = await loadThree();

// -----------------------------------------------------------------------------
// Texture helpers (tiny canvas textures to keep a retro look)
// -----------------------------------------------------------------------------
const textureCache = new Map();

function createTexture(key, drawFn) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  drawFn(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  textureCache.set(key, tex);
  return tex;
}

function buildFaceTexture(skinHex) {
  return createTexture(`face_${skinHex}`, (ctx) => {
    ctx.fillStyle = skinHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#111';
    ctx.fillRect(25, 55, 25, 12);
    ctx.fillRect(78, 55, 25, 12);
    ctx.fillStyle = '#fff';
    ctx.fillRect(27, 57, 21, 8);
    ctx.fillRect(80, 57, 21, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(35, 59, 8, 8);
    ctx.fillRect(88, 59, 8, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(25, 48, 25, 3);
    ctx.fillRect(78, 48, 25, 3);
    ctx.fillStyle = '#aa6666';
    ctx.fillRect(59, 95, 10, 3);
  });
}

function buildSkinTexture(colorHex) {
  return createTexture(`skin_${colorHex}`, (ctx) => {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
  });
}

function buildJacketBackTexture(colorHex) {
  return createTexture(`jacket_back_${colorHex}`, (ctx) => {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 500; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(64, 64, 35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.moveTo(64, 40);
    ctx.lineTo(45, 75);
    ctx.lineTo(83, 75);
    ctx.fill();
  });
}

function buildDenimTexture(colorHex) {
  return createTexture(`denim_${colorHex}`, (ctx) => {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 2000; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, 5, 128);
    ctx.fillRect(123, 0, 5, 128);
  });
}

// -----------------------------------------------------------------------------
// PlayerCharacter
// -----------------------------------------------------------------------------
export class PlayerCharacter {
  constructor(scene, isFemale, startPos) {
    this.scene = scene;
    this.isFemale = isFemale;
    this.params = {
      gender: isFemale ? 'female' : 'male',
      heightScale: 1.0,
      bodyPreset: 'average',
      headPreset: 'round',
      skinTone: '#d8b59a',
      hairStyle: 'long',
      hairColor: '#aa0000',
      jacketColor: '#111111',
      shirtColor: '#990000',
      pantsColor: '#223355',
    };

    this.equipmentState = { head: null, torso: null, legs: null, feet: null, accessory: null };
    this.genderLabel = this.params.gender === 'female' ? 'Female' : 'Male';

    this.group = new THREE.Group();
    this.position = startPos.clone();
    this.group.position.copy(this.position);

    this.velocityY = 0;
    this.onGround = true;
    this.yaw = 0;

    this.limbs = {};
    this._buildBody();
    this.scene.add(this.group);
  }

  // ---------------------------------------------------------------------------
  // Model construction
  // ---------------------------------------------------------------------------
  _buildBody() {
    if (this.meshGroup) {
      this.group.remove(this.meshGroup);
    }

    const p = this.params;
    const meshGroup = new THREE.Group();
    this.meshGroup = meshGroup;
    this.group.add(meshGroup);

    const skinTex = buildSkinTexture(p.skinTone);
    const faceTex = buildFaceTexture(p.skinTone);
    const denimTex = buildDenimTexture(p.pantsColor);
    const jacketBackTex = buildJacketBackTexture(p.jacketColor);

    const matSkin = new THREE.MeshLambertMaterial({ map: skinTex });
    const matFace = new THREE.MeshLambertMaterial({ map: faceTex });
    const matJeans = new THREE.MeshLambertMaterial({ map: denimTex });
    const matJacket = new THREE.MeshLambertMaterial({ color: p.jacketColor });
    const matJacketBack = new THREE.MeshLambertMaterial({ map: jacketBackTex });
    const matShirt = new THREE.MeshLambertMaterial({ color: p.shirtColor });
    const matHair = new THREE.MeshLambertMaterial({ color: p.hairColor });
    const matBoots = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const matHolster = new THREE.MeshLambertMaterial({ color: 0x050505 });

    const s = p.heightScale;

    // Hips
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.26), matJeans);
    hips.position.y = 0.9 * s;
    meshGroup.add(hips);
    this.limbs.hips = hips;

    // Midriff
    const midriff = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), matSkin);
    midriff.position.y = 0.17;
    hips.add(midriff);

    // Chest
    const chestGroup = new THREE.Group();
    chestGroup.position.y = 0.12;
    midriff.add(chestGroup);

    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.22), matShirt);
    shirt.position.y = 0.1;
    chestGroup.add(shirt);

    const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.05), matJacketBack);
    jacketBack.position.set(0, 0.1, 0.12);
    chestGroup.add(jacketBack);

    const jacketL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.28), matJacket);
    jacketL.position.set(0.19, 0.1, 0);
    chestGroup.add(jacketL);
    const jacketR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.28), matJacket);
    jacketR.position.set(-0.19, 0.1, 0);
    chestGroup.add(jacketR);

    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.26), matJacket);
    collar.position.set(0, 0.3, 0.05);
    chestGroup.add(collar);

    // Head (face on front)
    const headMats = [matSkin, matSkin, matSkin, matSkin, matSkin, matFace];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), headMats);
    head.position.y = 0.45;
    chestGroup.add(head);
    this.headRef = head;

    // Hair
    this._addHairMeshes(head, matHair, p.hairStyle);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.15, 0.85 * s, 0.17);
    const lLeg = new THREE.Mesh(legGeo, matJeans);
    lLeg.position.set(0.11, -0.45 * s, 0);
    hips.add(lLeg);
    this.limbs.leftLeg = lLeg;

    const holsterL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.17), matHolster);
    holsterL.position.set(0.06, 0.1, 0);
    lLeg.add(holsterL);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.17), matHolster);
    strapL.position.y = 0.1;
    lLeg.add(strapL);

    const rLeg = new THREE.Mesh(legGeo, matJeans);
    rLeg.position.set(-0.11, -0.45 * s, 0);
    hips.add(rLeg);
    this.limbs.rightLeg = rLeg;

    const holsterR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.17), matHolster);
    holsterR.position.set(-0.06, 0.1, 0);
    rLeg.add(holsterR);
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.17), matHolster);
    strapR.position.y = 0.1;
    rLeg.add(strapR);

    const bootGeo = new THREE.BoxGeometry(0.17, 0.25, 0.25);
    const lBoot = new THREE.Mesh(bootGeo, matBoots);
    lBoot.position.y = -0.35 * s;
    lBoot.position.z = -0.04;
    lLeg.add(lBoot);
    const rBoot = new THREE.Mesh(bootGeo, matBoots);
    rBoot.position.y = -0.35 * s;
    rBoot.position.z = -0.04;
    rLeg.add(rBoot);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.11, 0.7 * s, 0.11);
    const lArm = new THREE.Mesh(armGeo, matJacket);
    lArm.position.set(0.25, 0.1, 0);
    chestGroup.add(lArm);
    this.limbs.leftArm = lArm;
    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), matHolster);
    lGlove.position.y = -0.3 * s;
    lArm.add(lGlove);

    const rArm = new THREE.Mesh(armGeo, matJacket);
    rArm.position.set(-0.25, 0.1, 0);
    chestGroup.add(rArm);
    this.limbs.rightArm = rArm;
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), matHolster);
    rGlove.position.y = -0.3 * s;
    rArm.add(rGlove);

    // Shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.9 * s + 0.02;
    hips.add(shadow);

    this.applyBodyPreset(this.params.bodyPreset);
    this.applyHeadPreset(this.params.headPreset);
    this.applyEquipment(this.equipmentState);
  }

  _addHairMeshes(head, matHair, hairStyle) {
    const hairGroup = new THREE.Group();
    if (hairStyle === 'short') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), matHair);
      cap.position.y = 0.15;
      hairGroup.add(cap);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), matHair);
      spike.position.y = 0.2;
      hairGroup.add(spike);
    } else if (hairStyle === 'ponytail') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), matHair);
      cap.position.y = 0.15;
      hairGroup.add(cap);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12), matHair);
      tail.position.set(0, -0.05, 0.18);
      hairGroup.add(tail);
    } else {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.08), matHair);
      back.position.set(0, -0.1, 0.13);
      hairGroup.add(back);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.2), matHair);
      sideL.position.set(0.14, -0.1, 0.02);
      hairGroup.add(sideL);
      const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.2), matHair);
      sideR.position.set(-0.14, -0.1, 0.02);
      hairGroup.add(sideR);
      const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.05), matHair);
      bangs.position.set(0, 0.08, -0.13);
      hairGroup.add(bangs);
    }
    hairGroup.position.y = 0.45;
    head.add(hairGroup);
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------
  attachCamera(camera) {
    this.camera = camera;
  }

  updateCamera(camera, orbit) {
    if (!camera) return;
    const target = new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z);
    const offset = new THREE.Vector3();
    const { yaw, pitch, distance } = orbit;
    const cosPitch = Math.cos(pitch);
    offset.set(Math.sin(yaw) * cosPitch * distance, Math.sin(pitch) * distance, Math.cos(yaw) * cosPitch * distance);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  }

  syncTransform() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  // ---------------------------------------------------------------------------
  // Movement & animation
  // ---------------------------------------------------------------------------
  update(dt, input, collisionFn) {
    const speed = 6.0;
    let strafe = 0;
    let forward = 0;

    if (input.forward) forward += 1;
    if (input.backward) forward -= 1;
    if (input.left) strafe -= 1;
    if (input.right) strafe += 1;

    const len = Math.hypot(strafe, forward);
    if (len > 0) {
      strafe /= len;
      forward /= len;
    }

    const camYaw = input.camYaw ?? 0;
    const forwardDir = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const rightDir = new THREE.Vector3(Math.sin(camYaw + Math.PI / 2), 0, Math.cos(camYaw + Math.PI / 2));
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forwardDir, forward);
    moveDir.addScaledVector(rightDir, strafe);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.position.addScaledVector(moveDir, speed * dt);
      this.yaw = Math.atan2(moveDir.x, moveDir.z);
    }

    const gravity = -18.0;
    const jumpSpeed = 9.0;

    if (input.jump && this.onGround) {
      this.velocityY = jumpSpeed;
      this.onGround = false;
    }

    this.velocityY += gravity * dt;
    this.position.y += this.velocityY * dt;

    const baseHeight = 1.6 * this.params.heightScale;
    if (this.position.y <= baseHeight) {
      this.position.y = baseHeight;
      this.velocityY = 0;
      this.onGround = true;
    }

    collisionFn(this.position, 0.6);
    this.syncTransform();

    const moving = len > 0.01;
    const t = performance.now() / 200;
    const swing = moving ? Math.sin(t) * 0.3 : 0;
    if (this.limbs.leftLeg && this.limbs.rightLeg) {
      this.limbs.leftLeg.rotation.x = swing;
      this.limbs.rightLeg.rotation.x = -swing;
    }
    if (this.limbs.leftArm && this.limbs.rightArm) {
      this.limbs.leftArm.rotation.x = -swing;
      this.limbs.rightArm.rotation.x = swing;
    }
  }

  // ---------------------------------------------------------------------------
  // Customization hooks
  // ---------------------------------------------------------------------------
  setGender(isFemale) {
    this.isFemale = isFemale;
    this.params.gender = isFemale ? 'female' : 'male';
    this.genderLabel = isFemale ? 'Female' : 'Male';
    this._buildBody();
  }

  applyBodyPreset(preset) {
    this.params.bodyPreset = preset;
    if (!this.limbs.hips) return;
    if (preset === 'slim') {
      this.limbs.hips.scale.set(0.9, 1.0, 1.0);
    } else if (preset === 'stocky') {
      this.limbs.hips.scale.set(1.15, 1.0, 1.05);
    } else {
      this.limbs.hips.scale.set(1.0, 1.0, 1.0);
    }
  }

  applyHeadPreset(preset) {
    this.params.headPreset = preset;
    if (!this.meshGroup) return;
    const head = this.headRef;
    if (!head) return;
    if (preset === 'sharp') {
      head.scale.set(0.7, 0.7, 0.5);
    } else if (preset === 'angular') {
      head.scale.set(0.5, 0.7, 0.7);
    } else {
      head.scale.set(1.0, 1.0, 1.0);
    }
  }

  applySkinTone(tone) {
    this.params.skinTone = this._skinHexFromTone(tone);
    this._buildBody();
  }

  applyHairStyle(style) {
    this.params.hairStyle = style;
    this._buildBody();
  }

  applyHairColor(colorName) {
    this.params.hairColor = `#${this._colorFromHairName(colorName).toString(16).padStart(6, '0')}`;
    this._buildBody();
  }

  applyEquipment(equipmentState) {
    this.equipmentState = equipmentState || this.equipmentState;
    const slotColors = {
      head: 0xaa3333,
      torso: 0x224466,
      legs: 0x223355,
      feet: 0x111111,
      accessory: 0x336633,
    };
    const getColor = (slot) => {
      const item = this.equipmentState[slot];
      if (!item) return null;
      return typeof item.color === 'number' ? item.color : slotColors[slot];
    };

    const torsoColor = getColor('torso');
    const legColor = getColor('legs');
    const feetColor = getColor('feet');
    if (torsoColor) this.params.jacketColor = `#${torsoColor.toString(16).padStart(6, '0')}`;
    if (legColor) this.params.pantsColor = `#${legColor.toString(16).padStart(6, '0')}`;
    if (feetColor && this.meshGroup) {
      this.meshGroup.traverse((child) => {
        if (child.isMesh && child.material && child.material.color && child.geometry.type === 'BoxGeometry') {
          if (child.parent === this.limbs.leftLeg || child.parent === this.limbs.rightLeg) {
            child.material.color.setHex(feetColor);
          }
        }
      });
    }
    if (torsoColor || legColor) {
      this._buildBody();
    }
  }

  applyHeightPreset(preset) {
    this.params.heightScale = preset === 'short' ? 0.9 : preset === 'tall' ? 1.1 : 1.0;
    this.group.scale.set(1.0, this.params.heightScale, 1.0);
    this._buildBody();
  }

  getPreviewState() {
    const equipment = this.equipmentState || {};
    const toStyle = (item, fallback) => {
      const color = item && item.color ? item.color : fallback;
      if (typeof color === 'string') return color;
      const hex = typeof color === 'number' ? color : fallback;
      return `#${hex.toString(16).padStart(6, '0')}`;
    };

    return {
      genderLabel: this.genderLabel || (this.isFemale ? 'Female' : 'Male'),
      bodyLabel:
        this.params.bodyPreset === 'stocky'
          ? 'Stocky'
          : this.params.bodyPreset === 'slim'
          ? 'Slim'
          : 'Average',
      hairStyle: this.params.hairStyle,
      heightScale: this.params.heightScale,
      torsoColor: toStyle(equipment.torso, 0x224466),
      legsColor: toStyle(equipment.legs, 0x113355),
      feetColor: toStyle(equipment.feet, 0x111111),
      headItem: !!equipment.head,
      headColor: toStyle(equipment.head, 0xaa3333),
      hairColor: this.params.hairColor,
      skinColor: this.params.skinTone,
    };
  }

  setDisplayName(name) {
    if (!this.nameSprite) {
      const sprite = this._createNameSprite(name || 'Player');
      sprite.position.set(0, 3.2, 0);
      this.group.add(sprite);
      this.nameSprite = sprite;
    } else {
      this._updateNameSprite(this.nameSprite, name);
    }
  }

  _createNameSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this._drawNameToTexture(canvas, text), transparent: true })
    );
    return sprite;
  }

  _updateNameSprite(sprite, text) {
    const canvas = sprite.material.map.image;
    sprite.material.map.dispose();
    sprite.material.map = this._drawNameToTexture(canvas, text);
    sprite.material.needsUpdate = true;
  }

  _drawNameToTexture(canvas, text) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = '#b8e8ff';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 10);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  _colorFromHairName(colorName) {
    if (colorName === 'brown') return 0x402018;
    if (colorName === 'blonde') return 0xc0b060;
    if (colorName === 'red') return 0x802020;
    if (colorName === 'neon') return 0x30ffcc;
    if (colorName === 'black') return 0x201010;
    return 0x201010;
  }

  _skinHexFromTone(tone) {
    if (tone === 'pale') return '#f0d0c0';
    if (tone === 'tan') return '#c09060';
    if (tone === 'dark') return '#804830';
    return '#d0b090';
  }
}

// Thin wrapper to collect customization options from UI and apply to player
export class CharacterCustomizer {
  constructor(player) {
    this.player = player;
  }

  applyOptions(opts) {
    if (!opts) return;
    this.player.setGender(opts.gender === 'female');
    this.player.applyHeightPreset(opts.height || 'medium');
    this.player.applyBodyPreset(opts.bodyPreset);
    this.player.applyHeadPreset(opts.headPreset);
    this.player.applySkinTone(opts.skinTone);
    this.player.applyHairStyle(opts.hairStyle);
    this.player.applyHairColor(opts.hairColor);
  }
}
