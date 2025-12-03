// ui.js
// -----------------------------------------------------------------------------
// HTML-based UI:
// - Inventory / equipment panel
// - Character customization controls
// - War status text
// - Notifications
// - Chat log (with simulated "ghost" chatters)
// - Simple NPC dialogue box
//
// The UI module doesn't own gameplay state; it just renders what it's given
// and calls callbacks when user interacts.
// -----------------------------------------------------------------------------

export const UI = {
  init(config) {
    this.inventory = config.inventory;
    this.characterCustomizer = config.characterCustomizer;
    this.warManager = config.warManager;
    this.onEquipItem = config.onEquipItem;
    this.onUnequipSlot = config.onUnequipSlot;
    this.onChatSubmit = config.onChatSubmit;

    this.areaLabel = document.getElementById('areaLabel');
    this.warStatusLabel = document.getElementById('warStatus');
    this.inventoryPanel = document.getElementById('inventoryPanel');
    this.inventoryItemsRoot = document.getElementById('inventoryItems');
    this.equipmentSlotsRoot = document.getElementById('equipmentSlots');
    this.customizationPanel = document.getElementById('customizationPanel');
    this.chatLog = document.getElementById('chatLog');
    this.chatInput = document.getElementById('chatInput');
    this.chatSend = document.getElementById('chatSend');
    this.dialogBox = document.getElementById('dialogBox');
    this.dialogText = document.getElementById('dialogText');
    this.notificationLog = document.getElementById('notificationLog');

    // Inventory toggle buttons
    document
      .getElementById('inventoryToggle')
      .addEventListener('click', () => this.toggleInventoryPanel());
    document
      .getElementById('customizationToggle')
      .addEventListener('click', () => this.toggleCustomizationPanel());

    // Customization controls
    const genderSelect = document.getElementById('genderSelect');
    const bodyPresetSelect = document.getElementById('bodyPresetSelect');
    const headPresetSelect = document.getElementById('headPresetSelect');
    const skinToneSelect = document.getElementById('skinToneSelect');
    const hairStyleSelect = document.getElementById('hairStyleSelect');
    const hairColorSelect = document.getElementById('hairColorSelect');

    const applyCustomization = () => {
      const opts = {
        gender: genderSelect.value,
        bodyPreset: bodyPresetSelect.value,
        headPreset: headPresetSelect.value,
        skinTone: skinToneSelect.value,
        hairStyle: hairStyleSelect.value,
        hairColor: hairColorSelect.value,
      };
      if (this.characterCustomizer) {
        this.characterCustomizer.applyOptions(opts);
      }
      if (this.onCustomizationChanged) {
        this.onCustomizationChanged(opts);
      }
    };

    this.onCustomizationChanged = config.onCustomizationChanged;
    [
      genderSelect,
      bodyPresetSelect,
      headPresetSelect,
      skinToneSelect,
      hairStyleSelect,
      hairColorSelect,
    ].forEach((el) => el.addEventListener('change', applyCustomization));

    // Chat input
    this.chatSend.addEventListener('click', () => this._handleChatSubmit());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleChatSubmit();
    });

    // Ghost chat simulation
    this._startGhostChat();

    // Initial war status
    this.updateWarStatus(this.warManager);
  },

  // INVENTORY -----------------------------------------------------------------
  toggleInventoryPanel() {
    this.inventoryPanel.classList.toggle('hidden');
    if (!this.inventoryPanel.classList.contains('hidden')) {
      this.refreshInventoryView(this.inventory);
    }
  },

  refreshInventoryView(inventory) {
    if (!inventory) return;
    const items = inventory.getItems();
    const equipment = inventory.getEquipment();

    // Items list
    this.inventoryItemsRoot.innerHTML = '';
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'inventory-item';
      div.textContent = `${item.name} [${item.slot}]`;
      div.dataset.itemId = item.id;
      div.addEventListener('click', () => {
        if (this.onEquipItem) this.onEquipItem(item.id);
      });
      this.inventoryItemsRoot.appendChild(div);
    }

    // Equipment slots
    const slots = ['head', 'torso', 'legs', 'feet', 'accessory'];
    this.equipmentSlotsRoot.innerHTML = '<strong>Equipped</strong><br/>';
    for (const slot of slots) {
      const item = equipment[slot];
      const div = document.createElement('div');
      div.className = 'equipment-slot';
      const label = slot.charAt(0).toUpperCase() + slot.slice(1);
      if (item) {
        div.textContent = `${label}: ${item.name} (click to unequip)`;
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
          if (this.onUnequipSlot) this.onUnequipSlot(slot);
        });
      } else {
        div.textContent = `${label}: (empty)`;
      }
      this.equipmentSlotsRoot.appendChild(div);
    }
  },

  // CUSTOMIZATION -------------------------------------------------------------
  toggleCustomizationPanel() {
    this.customizationPanel.classList.toggle('hidden');
  },

  // AREA / WAR STATUS ---------------------------------------------------------
  setAreaName(name) {
    if (this.areaLabel) this.areaLabel.textContent = name;
  },

  updateWarStatus(warManager) {
    if (!this.warStatusLabel || !warManager) return;
    this.warStatusLabel.textContent = `War status: ${warManager.getStatusSummary()}`;
  },

  // DIALOG --------------------------------------------------------------------
  showDialog(text) {
    this.dialogText.textContent = text;
    this.dialogBox.classList.remove('hidden');
  },

  hideDialog() {
    this.dialogBox.classList.add('hidden');
  },

  // CHAT ----------------------------------------------------------------------
  _handleChatSubmit() {
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';
    if (this.onChatSubmit) this.onChatSubmit(text);
  },

  appendChatMessage(author, text) {
    const div = document.createElement('div');
    div.className = 'chat-line';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-author';
    nameSpan.textContent = `[${author}] `;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = text;
    div.appendChild(nameSpan);
    div.appendChild(msgSpan);
    this.chatLog.appendChild(div);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  },

  _startGhostChat() {
    const ghostNames = ['Echo01', 'NovaKid', 'ArcadiaSys', 'Guest42', 'Wanderer'];
    const ghostLines = [
      'Anyone else see the tanks roll past Block A1?',
      'Lagging again... maybe the highway nodes are overloaded.',
      'Faction B just pinged the mall near Delta-3.',
      'This place still feels like an early MMO lobby.',
      'If you reach Wasteland Block 122, watch the skies.',
    ];

    const tick = () => {
      if (Math.random() > 0.6) {
        const name = ghostNames[Math.floor(Math.random() * ghostNames.length)];
        const line = ghostLines[Math.floor(Math.random() * ghostLines.length)];
        this.appendChatMessage(name, line);
      }
      setTimeout(tick, 5000 + Math.random() * 5000);
    };
    setTimeout(tick, 6000);
  },

  // NOTIFICATIONS -------------------------------------------------------------
  showNotification(text) {
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = text;
    this.notificationLog.appendChild(div);
    setTimeout(() => {
      if (div.parentElement) div.parentElement.removeChild(div);
    }, 7000);
  },
};
