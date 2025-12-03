// inventory.js
// -----------------------------------------------------------------------------
// Inventory & equipment system.
// - Inventory items are simple objects with slot + color.
// - Equipped items are mapped per slot and drive character's clothing visuals.
// -----------------------------------------------------------------------------

export class InventorySystem {
  constructor(player) {
    this.player = player;

    // Items list & equipment state
    this.items = [];
    this.equipment = {
      head: null,
      torso: null,
      legs: null,
      feet: null,
      accessory: null,
    };
  }

  addStarterItems() {
    this.items.push(
      { id: 'hat_red', name: 'Red Beanie', slot: 'head', color: 0xaa3333 },
      { id: 'hat_blue', name: 'Blue Cap', slot: 'head', color: 0x3333aa },
      { id: 'visor_neon', name: 'Neon Visor', slot: 'head', color: 0x33ffaa },
      { id: 'jacket_green', name: 'Green Jacket', slot: 'torso', color: 0x228822 },
      { id: 'jacket_black', name: 'Black Jacket', slot: 'torso', color: 0x111111 },
      { id: 'jacket_white', name: 'White Hoodie', slot: 'torso', color: 0xdddddd },
      { id: 'pants_jeans', name: 'Worn Jeans', slot: 'legs', color: 0x223366 },
      { id: 'pants_camo', name: 'Camo Pants', slot: 'legs', color: 0x556644 },
      { id: 'boots_combat', name: 'Combat Boots', slot: 'feet', color: 0x222222 },
      { id: 'sneakers', name: 'Urban Sneakers', slot: 'feet', color: 0x778899 },
      { id: 'backpack_city', name: 'City Backpack', slot: 'accessory', color: 0x444488 }
    );
  }

  getItems() {
    return this.items;
  }

  getEquipment() {
    return this.equipment;
  }

  equip(itemId) {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return;
    const slot = item.slot;
    this.equipment[slot] = item;
    this._syncToCharacter();
  }

  unequip(slot) {
    if (!(slot in this.equipment)) return;
    this.equipment[slot] = null;
    this._syncToCharacter();
  }

  _syncToCharacter() {
    if (this.player && this.player.applyEquipment) {
      this.player.applyEquipment(this.equipment);
    }
  }
}
