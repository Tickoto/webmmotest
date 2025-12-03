// utils.js
// -----------------------------------------------------------------------------
// Utility helpers: seeded randomness and naming.
// These keep procedural chunks and names consistent based on grid coordinates.
// -----------------------------------------------------------------------------

// Simple hash-based "seeded random" from coordinates
export function seededRandom(x, y, seed = 0) {
  // Cheap deterministic hash -> [0,1)
  const s = Math.sin(x * 374761 + y * 668265 + seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// Very small PRNG class for systems that walk forward in time (war sim)
export class Random {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }
  next() {
    // xorshift32
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed & 0xffffffff) / 0x100000000;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

// Name generator for cities, blocks, POIs, shops, etc.
export class NameGenerator {
  constructor(seed = 0) {
    this.seed = seed;
    this.cityRoots = [
      'Geneva',
      'Nova',
      'Arcadia',
      'Kappa',
      'Echo',
      'Delta',
      'Zenith',
      'Orion',
      'Vega',
      'Helix',
    ];
    this.poiRoots = ['Shop', 'Mall', 'Town', 'Park', 'Yard', 'Depot', 'Block', 'Tower'];
    this.suffixes = ['-1', '-2', '-3', '-4', '-5', '-7', '-9', ' Prime'];
  }

  // Deterministic pseudo-random integer based on grid coordinates
  _hashInt(x, y, extra = 0, mod = 9999) {
    const r = seededRandom(x + extra * 13, y + extra * 29, this.seed + extra * 101);
    return Math.floor(r * mod);
  }

  getCityRootForCoords(x, y) {
    const idx = this._hashInt(x, y, 3, this.cityRoots.length);
    return this.cityRoots[idx];
  }

  getBlockCode(x, y) {
    // Turn coords into something like A1, C3, etc.
    const colLetter = String.fromCharCode(65 + (Math.abs(x) % 26));
    const rowNum = (Math.abs(y) % 99) + 1;
    return `${colLetter}${rowNum}`;
  }

  getCityName(x, y) {
    const root = this.getCityRootForCoords(x, y);
    const block = this.getBlockCode(x, y);
    return `${root} City, Block ${block}`;
  }

  getAreaName(type, x, y) {
    // Different prefixes per type
    if (type === 'city') {
      return this.getCityName(x, y);
    }
    const block = this.getBlockCode(x, y);
    if (type === 'park') {
      return `Park Area Block ${block}`;
    }
    if (type === 'wasteland') {
      return `Wasteland Block ${Math.abs(x * 31 + y * 7) % 400}`;
    }
    if (type === 'suburb') {
      return `Town ${this.getCityRootForCoords(x, y)}-${block}`;
    }
    if (type === 'highway') {
      return `Elevated Highway ${block}`;
    }
    return `Unmapped Block ${block}`;
  }

  getPoiName(kind, x, y, index = 0) {
    const root = this.poiRoots[this._hashInt(x, y, 7 + index, this.poiRoots.length)];
    const city = this.getCityRootForCoords(x, y);
    const suf = this.suffixes[this._hashInt(x, y, 11 + index, this.suffixes.length)];
    if (kind === 'shop') {
      return `Shop ${city}${suf}`;
    }
    if (kind === 'mall') {
      return `Mall ${city}${suf}`;
    }
    if (kind === 'town') {
      return `Town ${city}${suf}`;
    }
    if (kind === 'park') {
      return `Park ${city}${suf}`;
    }
    return `${root} ${city}${suf}`;
  }
}
