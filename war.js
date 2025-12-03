// war.js
// -----------------------------------------------------------------------------
// Background 3-faction war simulation (abstract RTS layer).
// - Factions have bases with resources and units (infantry / tank / air).
// - Bases gather resources over time; resources -> spawning units and builder
//   convoys that found new bases.
// - Combat is resolved in a coarse 2D grid.
// - Notifications are pushed out via a callback provided from main/UI.
//
// This is intentionally "lightweight" and does not simulate every bullet; it's
// aimed at feeling like an autonomous war engine that occasionally reports
// events to the player.
// -----------------------------------------------------------------------------

import { Random } from './utils.js';

class Faction {
  constructor(name, color, id) {
    this.name = name;
    this.color = color;
    this.id = id;
  }
}

export class WarManager {
  constructor(nameGen, onEvent) {
    this.nameGen = nameGen;
    this.onEvent = onEvent || (() => {});
    this.random = new Random(999);

    this.factions = [
      new Faction('Faction A', '#ff5555', 0),
      new Faction('Faction B', '#55ff55', 1),
      new Faction('Faction C', '#5599ff', 2),
    ];

    this.bases = []; // {id, factionId, x, y, hp, resources}
    this.units = []; // {id, factionId, x, y, tx, ty, type, hp}
    this.lastBaseId = 0;
    this.lastUnitId = 0;

    this.timeAccumulator = 0;
    this.recentEvents = [];

    this._initStartingBases();
  }

  _initStartingBases() {
    // Seed three starting city hubs roughly around origin
    const starts = [
      { x: 0, y: 0 },
      { x: 6, y: -4 },
      { x: -5, y: 5 },
    ];
    for (let i = 0; i < this.factions.length; i++) {
      const f = this.factions[i];
      const s = starts[i];
      this._createBase(f.id, s.x, s.y, true);
    }
  }

  _createBase(factionId, x, y, silent = false) {
    const base = {
      id: ++this.lastBaseId,
      factionId,
      x,
      y,
      hp: 100,
      resources: 50,
    };
    this.bases.push(base);

    if (!silent) {
      const faction = this.factions[factionId];
      const areaName = this.nameGen.getAreaName('city', x, y);
      this._pushEvent(`${faction.name} established a new base near ${areaName}.`);
    }
    return base;
  }

  _createUnit(factionId, x, y, type, tx, ty) {
    const unit = {
      id: ++this.lastUnitId,
      factionId,
      x,
      y,
      tx,
      ty,
      type, // 'infantry' | 'tank' | 'air' | 'builder'
      hp: type === 'tank' ? 40 : type === 'air' ? 30 : 20,
    };
    this.units.push(unit);
    return unit;
  }

  _pushEvent(msg) {
    this.recentEvents.unshift({ t: performance.now(), msg });
    if (this.recentEvents.length > 10) this.recentEvents.pop();
    this.onEvent(msg);
  }

  update(dt) {
    this.timeAccumulator += dt;
    if (this.timeAccumulator < 1 / 2) {
      // Run logic ~2 times per second
      return;
    }
    this.timeAccumulator = 0;

    // Bases gather resources and occasionally spawn units/builder convoys
    for (const base of this.bases) {
      const gather = 5 + this.random.int(0, 5);
      base.resources += gather;

      // If resources are plentiful, spawn more units
      if (base.resources > 80) {
        const choice = this.random.next();
        let type = 'infantry';
        let cost = 25;
        if (choice > 0.75) {
          type = 'tank';
          cost = 40;
        } else if (choice > 0.5) {
          type = 'air';
          cost = 35;
        }
        if (base.resources >= cost) {
          base.resources -= cost;
          const target = this._pickEnemyLocation(base.factionId);
          this._createUnit(base.factionId, base.x, base.y, type, target.x, target.y);
        }
      }

      // Occasionally launch a base-building convoy
      if (base.resources > 120 && this.random.next() > 0.7) {
        base.resources -= 80;
        const dir = this.random.int(0, 3);
        const offset = [
          { x: 3, y: 0 },
          { x: -3, y: 0 },
          { x: 0, y: 3 },
          { x: 0, y: -3 },
        ][dir];
        const tx = base.x + offset.x;
        const ty = base.y + offset.y;
        this._createUnit(base.factionId, base.x, base.y, 'builder', tx, ty);
      }
    }

    // Move units and handle combat / base founding
    this._updateUnits();
  }

  _pickEnemyLocation(factionId) {
    const enemies = this.bases.filter((b) => b.factionId !== factionId);
    if (enemies.length === 0) {
      return { x: 0, y: 0 };
    }
    const b = enemies[this.random.int(0, enemies.length - 1)];
    return { x: b.x, y: b.y };
  }

  _updateUnits() {
    const moveSpeed = {
      infantry: 0.5,
      tank: 0.4,
      air: 0.8,
      builder: 0.4,
    };

    for (const u of this.units) {
      const speed = moveSpeed[u.type] || 0.5;
      const dx = u.tx - u.x;
      const dy = u.ty - u.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        const step = Math.min(speed, dist);
        u.x += (dx / dist) * step;
        u.y += (dy / dist) * step;
      } else {
        // Reached target
        if (u.type === 'builder') {
          // Try to found a base if location is empty
          const existing = this.bases.find(
            (b) => Math.hypot(b.x - u.x, b.y - u.y) < 1.0
          );
          if (!existing) {
            this._createBase(u.factionId, Math.round(u.x), Math.round(u.y));
          }
        } else {
          // Combat: damage any enemy base at location
          const enemyBases = this.bases.filter(
            (b) =>
              b.factionId !== u.factionId &&
              Math.hypot(b.x - u.x, b.y - u.y) < 1.0
          );
          for (const eb of enemyBases) {
            eb.hp -= u.type === 'tank' ? 30 : u.type === 'air' ? 20 : 10;
            if (eb.hp <= 0) {
              this._destroyBase(eb);
            }
          }
        }

        // Retask: pick new enemy location
        const target = this._pickEnemyLocation(u.factionId);
        u.tx = target.x;
        u.ty = target.y;
      }
    }

    // Unit vs unit skirmishes (very rough)
    for (let i = 0; i < this.units.length; i++) {
      const u1 = this.units[i];
      for (let j = i + 1; j < this.units.length; j++) {
        const u2 = this.units[j];
        if (u1.factionId === u2.factionId) continue;
        const dist = Math.hypot(u1.x - u2.x, u1.y - u2.y);
        if (dist < 0.7) {
          u1.hp -= 5;
          u2.hp -= 5;
        }
      }
    }

    // Cleanup dead units
    this.units = this.units.filter((u) => u.hp > 0);
  }

  _destroyBase(base) {
    const idx = this.bases.indexOf(base);
    if (idx >= 0) {
      this.bases.splice(idx, 1);
      const faction = this.factions[base.factionId];
      const areaName = this.nameGen.getAreaName('city', base.x, base.y);
      this._pushEvent(
        `${faction.name} lost a base near ${areaName} in heavy fighting.`
      );
    }
  }

  // Returns a short war status string
  getStatusSummary() {
    const counts = this.factions.map((f) => ({
      f,
      bases: this.bases.filter((b) => b.factionId === f.id).length,
    }));
    return counts
      .map((c) => `${c.f.name}: ${c.bases} bases`)
      .join(' | ');
  }

  // Used by NPCs to mention something "recent"
  getRandomRecentEvent() {
    if (this.recentEvents.length === 0) return null;
    const idx = this.random.int(0, this.recentEvents.length - 1);
    return this.recentEvents[idx].msg;
  }
}
