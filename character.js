// character.js
// -----------------------------------------------------------------------------
// Player character model and movement.
// - Character is built from simple box/cylinder primitives but clearly shows
//   male/female silhouette.
// - Clothing slots (head, torso, legs, feet, accessory) exist as extra meshes
//   whose visibility/color is updated by the inventory.
// - Movement: basic WASD + gravity + jump, plus yaw rotation from mouse.
// - Camera: attached as a child of the character group for a simple
//   third-person-ish view.
// -----------------------------------------------------------------------------

import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class PlayerCharacter {
  constructor(scene, isFemale, startPos) {
    this.scene = scene;
    this.isFemale = isFemale;
    this.heightPreset = 'medium';
    this.bodyPreset = 'average';
    this.headPreset = 'round';
    this.skinTone = 'light';
    this.hairStyle = 'short';
    this.hairColorName = 'brown';
    this.baseHeight = 1.6;
    this.equipmentState = { head: null, torso: null, legs: null, feet: null, accessory: null };
    this.genderLabel = isFemale ? 'Female' : 'Male';

    this.group = new THREE.Group();
    this.position = startPos.clone();
    this.group.position.copy(this.position);

    this.velocityY = 0;
    this.onGround = true;
    this.yaw = 0;

    // Build base body primitives
    this._buildBody();

    this.scene.add(this.group);
  }

  _buildBody() {
    const bodyColor = 0xd0b090;
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });

    // Torso
    const torsoGeom = new THREE.BoxGeometry(0.9, 1.2, 0.4);
    this.torso = new THREE.Mesh(torsoGeom, bodyMat);
    this.torso.position.set(0, 1.6, 0);
    this.group.add(this.torso);

    // Head
    const headGeom = new THREE.BoxGeometry(0.5, 0.6, 0.5);
    this.head = new THREE.Mesh(headGeom, bodyMat);
    this.head.position.set(0, 2.4, 0);
    this.group.add(this.head);

    // Legs
    const legGeom = new THREE.BoxGeometry(0.35, 0.9, 0.35);
    this.leftLeg = new THREE.Mesh(legGeom, bodyMat);
    this.rightLeg = new THREE.Mesh(legGeom, bodyMat);
    this.leftLeg.position.set(-0.2, 0.7, 0);
    this.rightLeg.position.set(0.2, 0.7, 0);
    this.group.add(this.leftLeg);
    this.group.add(this.rightLeg);

    // Simple shoulder/arm "impression" via slightly wider torso on male vs female
    if (this.isFemale) {
      this.torso.scale.set(0.9, 1.0, 0.9);
    } else {
      this.torso.scale.set(1.1, 1.0, 0.9);
    }

    // Hair (multiple styles as meshes, we'll toggle)
    this.hairMeshes = {
      short: this._createHairMesh(0x201010),
      long: this._createHairMesh(0x302010, true),
      ponytail: this._createHairPonytailMesh(0x201020),
    };
    for (const m of Object.values(this.hairMeshes)) {
      m.visible = false;
      this.group.add(m);
    }
    this.currentHairStyle = 'short';
    this.hairMeshes.short.visible = true;

    // Clothing overlay meshes per slot
    this.slotMeshes = {
      head: this._createHeadAccessory(),
      torso: this._createTorsoClothing(),
      legs: this._createLegClothing(),
      feet: this._createFeetClothing(),
      accessory: this._createBackpack(),
    };
    for (const m of Object.values(this.slotMeshes)) {
      m.visible = false;
      this.group.add(m);
    }

    // Default body preset
    this.applyBodyPreset('average');
  }

  _createHairMesh(color, long = false) {
    const geom = long
      ? new THREE.BoxGeometry(0.7, 0.9, 0.6)
      : new THREE.BoxGeometry(0.7, 0.4, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color });
    const hair = new THREE.Mesh(geom, mat);
    hair.position.set(0, long ? 2.2 : 2.4, -0.02);
    return hair;
  }

  _createHairPonytailMesh(color) {
    const group = new THREE.Group();
    const topGeom = new THREE.BoxGeometry(0.7, 0.4, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color });
    const top = new THREE.Mesh(topGeom, mat);
    top.position.set(0, 2.4, 0);
    group.add(top);

    const tailGeom = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    const tail = new THREE.Mesh(tailGeom, mat);
    tail.position.set(0, 2.0, -0.2);
    group.add(tail);

    return group;
  }

  _createHeadAccessory() {
    const geom = new THREE.BoxGeometry(0.8, 0.3, 0.8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x333388 });
    const hat = new THREE.Mesh(geom, mat);
    hat.position.set(0, 2.7, 0);
    return hat;
  }

  _createTorsoClothing() {
    const geom = new THREE.BoxGeometry(1.1, 1.3, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x224466 });
    const jacket = new THREE.Mesh(geom, mat);
    jacket.position.set(0, 1.6, 0);
    return jacket;
  }

  _createLegClothing() {
    const geom = new THREE.BoxGeometry(0.8, 0.95, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const pants = new THREE.Mesh(geom, mat);
    pants.position.set(0, 0.7, 0);
    return pants;
  }

  _createFeetClothing() {
    const geom = new THREE.BoxGeometry(0.9, 0.3, 0.9);
    const mat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const boots = new THREE.Mesh(geom, mat);
    boots.position.set(0, 0.25, 0);
    return boots;
  }

  _createBackpack() {
    const geom = new THREE.BoxGeometry(0.7, 0.9, 0.3);
    const mat = new THREE.MeshLambertMaterial({ color: 0x224422 });
    const pack = new THREE.Mesh(geom, mat);
    pack.position.set(0, 1.6, -0.45);
    return pack;
  }

  attachCamera(camera) {
    // Attach camera as child for a simple chase-cam
    this.group.add(camera);
    camera.position.set(0, 1.9, 4.0);
    camera.lookAt(new THREE.Vector3(0, 1.6, 0));
  }

  syncTransform() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  update(dt, input, collisionFn) {
    // Update yaw
    this.yaw = input.yaw;

    // Movement in local XZ plane
    const speed = 6.0;
    let moveX = 0;
    let moveZ = 0;

    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    // Apply yaw rotation to movement vector
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = (moveX * cos - moveZ * sin) * speed * dt;
    const dz = (moveX * sin + moveZ * cos) * speed * dt;

    this.position.x += dx;
    this.position.z += dz;

    // Gravity & jump
    const gravity = -18.0;
    const jumpSpeed = 9.0;

    if (input.jump && this.onGround) {
      this.velocityY = jumpSpeed;
      this.onGround = false;
    }

    this.velocityY += gravity * dt;
    this.position.y += this.velocityY * dt;

    if (this.position.y <= this.baseHeight) {
      this.position.y = this.baseHeight;
      this.velocityY = 0;
      this.onGround = true;
    }

    // Collision resolution (world or interior)
    collisionFn(this.position, 0.6);

    // Apply transform
    this.syncTransform();

    // Simple walk animation: swing legs if moving
    const moving = len > 0.01;
    const t = performance.now() / 200;
    const swing = moving ? Math.sin(t) * 0.3 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
  }

  // VISUAL CUSTOMIZATION ------------------------------------------------------

  setGender(isFemale) {
    this.isFemale = isFemale;
    this.torso.scale.x = isFemale ? 0.9 : 1.1;
    this.genderLabel = isFemale ? 'Female' : 'Male';
  }

  applyBodyPreset(preset) {
    this.bodyPreset = preset;
    if (preset === 'slim') {
      this.torso.scale.set(0.85, 1.05, 0.9);
      this.leftLeg.scale.set(0.8, 1.0, 1.0);
      this.rightLeg.scale.set(0.8, 1.0, 1.0);
    } else if (preset === 'stocky') {
      this.torso.scale.set(1.25, 1.1, 1.0);
      this.leftLeg.scale.set(1.1, 1.0, 1.0);
      this.rightLeg.scale.set(1.1, 1.0, 1.0);
    } else {
      this.torso.scale.set(1.0, 1.0, 1.0);
      this.leftLeg.scale.set(1.0, 1.0, 1.0);
      this.rightLeg.scale.set(1.0, 1.0, 1.0);
    }
  }

  applyHeadPreset(preset) {
    this.headPreset = preset;
    if (preset === 'sharp') {
      this.head.scale.set(0.7, 0.7, 0.5);
    } else if (preset === 'angular') {
      this.head.scale.set(0.5, 0.7, 0.7);
    } else {
      this.head.scale.set(0.6, 0.6, 0.6);
    }
  }

  applySkinTone(tone) {
    this.skinTone = tone;
    let color = 0xd0b090;
    if (tone === 'pale') color = 0xf0d0c0;
    else if (tone === 'tan') color = 0xc09060;
    else if (tone === 'dark') color = 0x804830;
    this.torso.material.color.setHex(color);
    this.head.material.color.setHex(color);
    this.leftLeg.material.color.setHex(color);
    this.rightLeg.material.color.setHex(color);
  }

  applyHairStyle(style) {
    this.hairStyle = style;
    this.currentHairStyle = style;
    for (const [k, mesh] of Object.entries(this.hairMeshes)) {
      mesh.visible = k === style;
    }
  }

  applyHairColor(colorName) {
    this.hairColorName = colorName;
    const color = this._colorFromHairName(colorName);
    for (const mesh of Object.values(this.hairMeshes)) {
      if (mesh.material) {
        mesh.material.color.setHex(color);
      } else {
        // group hair (ponytail) contains children
        mesh.traverse((child) => {
          if (child.isMesh) child.material.color.setHex(color);
        });
      }
    }
  }

  // Called by inventory when equipment changes
  applyEquipment(equipmentState) {
    this.equipmentState = equipmentState;
    const slotColors = {
      head: 0xaa3333,
      torso: 0x224466,
      legs: 0x113355,
      feet: 0x111111,
      accessory: 0x336633,
    };
    for (const [slot, mesh] of Object.entries(this.slotMeshes)) {
      const item = equipmentState[slot];
      mesh.visible = !!item;
      if (item && mesh.material) {
        const color = item.color || slotColors[slot];
        mesh.material.color.setHex(color);
      }
    }
  }

  applyHeightPreset(preset) {
    this.heightPreset = preset;
    const scale = preset === 'short' ? 0.9 : preset === 'tall' ? 1.1 : 1.0;
    this.baseHeight = 1.6 * scale;
    this.group.scale.set(1.0, scale, 1.0);
  }

  getPreviewState() {
    const skinColor = this.torso.material.color.getStyle();
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
        this.bodyPreset === 'stocky'
          ? 'Stocky'
          : this.bodyPreset === 'slim'
          ? 'Slim'
          : 'Average',
      hairStyle: this.hairStyle,
      heightScale: this.baseHeight / 1.6,
      torsoColor: toStyle(equipment.torso, 0x224466),
      legsColor: toStyle(equipment.legs, 0x113355),
      feetColor: toStyle(equipment.feet, 0x111111),
      headItem: !!equipment.head,
      headColor: toStyle(equipment.head, 0xaa3333),
      hairColor: `#${this._colorFromHairName(this.hairColorName).toString(16).padStart(6, '0')}`,
      skinColor,
    };
  }

  _colorFromHairName(colorName) {
    if (colorName === 'brown') return 0x402018;
    if (colorName === 'blonde') return 0xc0b060;
    if (colorName === 'red') return 0x802020;
    if (colorName === 'neon') return 0x30ffcc;
    if (colorName === 'black') return 0x201010;
    return 0x201010;
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
