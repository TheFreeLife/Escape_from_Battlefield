import { recipes } from '../items/recipes.js';

export default class Inventory {
    constructor(game) {
        this.game = game;
        this.isOpen = false;

        // Storage (8x4 grid)
        this.slots = 32;
        this.items = new Array(this.slots).fill(null);

        // Hotbar (8 slots)
        this.hotbarSlots = 8;
        this.hotbar = new Array(this.hotbarSlots).fill(null);
        this.selectedSlot = 0;

        // Equipment (6 slots: Head, Top, Bottom, Chest, Acc1, Acc2)
        this.equipment = {
            head: null,
            chest: null,
            top: null,
            bottom: null,
            acc1: null,
            acc2: null
        };
        this.equipmentSlotNames = ['head', 'top', 'bottom', 'chest', 'acc1', 'acc2'];

        this.heldItem = null;
        this.lastMouseDown = false;
        this.hoveredSlotInfo = null; // { item, x, y, size }

        // External Storage Integration (Chests, Vehicles, etc.)
        this.currentExternalStorage = null;
        this.externalStorageType = null; // 'vehicle' or 'chest'
        this.isExternalStorageOpen = false;

        // Crafting System (3x2 grid + 1 result)
        this.craftingSlots = new Array(6).fill(null);
        this.craftingResult = null;
        this.isCraftingOpen = false;
        this.craftingTab = 'CRAFT'; // 'CRAFT' or 'MOD'
        this.modWeaponSlot = null; // Weapon being modified
        this.modAttachmentSlots = { optic: null, barrel: null, underbarrel: null };

        // Reload system
        this.isReloading = false;
        this.reloadTimer = 0;
        this.reloadingItemIdx = -1; // Index in hotbar

        // Aim system
        this.isAiming = false;
        this.aimProgress = 0; // For smooth transition

        // Test Items
        this.addHotbarItem({ id: 'deagle', count: 1 }, 0);
        this.addHotbarItem({ id: 'm4a1', count: 1 }, 1);
        this.addHotbarItem({ id: 'vector', count: 1 }, 2);
        this.addHotbarItem({ id: 'awm', count: 1 }, 3);
        this.addHotbarItem({ id: 'remington870', count: 1 }, 4);
        this.addHotbarItem({ id: 'm249', count: 1 }, 5);
        this.addHotbarItem({ id: 'rpg7', count: 1 }, 6);
        this.addHotbarItem({ id: 'famas', count: 1 }, 7);
        
        this.addItem({ id: 'ak47', count: 1 });
        this.addItem({ id: 'p90', count: 1 });
        this.addItem({ id: 'db_shotgun', count: 1 });
        this.addItem({ id: 'magnum', count: 1 });
        this.addItem({ id: 'medkit', count: 5 });
        this.addItem({ id: 'helmet', count: 1 });
        this.addItem({ id: 'vest', count: 1 });
        this.addItem({ id: 'boots', count: 1 });
        this.addItem({ id: 'watch', count: 1 });
        this.addItem({ id: 'scope_2x', count: 1 });
        this.addItem({ id: 'scope_4x', count: 1 });
        this.addItem({ id: 'laser_sight', count: 1 });

        // Add matching ammos
        this.addItem({ id: 'ammo_556', count: 200 });
        this.addItem({ id: 'ammo_9mm', count: 300 });
        this.addItem({ id: 'ammo_762', count: 150 });
        this.addItem({ id: 'ammo_357', count: 50 });
        this.addItem({ id: 'ammo_338', count: 20 });
        this.addItem({ id: 'ammo_12g', count: 40 });
        this.addItem({ id: 'ammo_50ae', count: 30 });
        this.addItem({ id: 'ammo_40mm', count: 10 });
        this.addItem({ id: 'ammo_rocket', count: 5 });

        this.addItem({ id: 'tank_shell_he', count: 10 });
        this.addItem({ id: 'tank_shell_ap', count: 10 });

        // Add Crafting Materials
        this.addItem({ id: 'iron_ingot', count: 20 });
        this.addItem({ id: 'wood_plank', count: 10 });
        this.addItem({ id: 'spring', count: 15 });
    }

    openExternalStorage(storageObj, type = 'chest') {
        this.currentExternalStorage = storageObj;
        this.externalStorageType = type;
        this.isExternalStorageOpen = true;
        this.isOpen = true;
    }

    closeExternalStorage() {
        if (this.currentExternalStorage && this.externalStorageType === 'vehicle') {
            this.currentExternalStorage.isStorageOpen = false;
        }
        this.currentExternalStorage = null;
        this.externalStorageType = null;
        this.isExternalStorageOpen = false;
    }

    openCrafting() {
        this.isCraftingOpen = true;
        this.isOpen = true;
    }

    checkCraftingRecipe() {
        // Convert flat 6 slots to 2x3 grid (2 rows, 3 columns)
        const grid = [
            [this.craftingSlots[0]?.id || null, this.craftingSlots[1]?.id || null, this.craftingSlots[2]?.id || null],
            [this.craftingSlots[3]?.id || null, this.craftingSlots[4]?.id || null, this.craftingSlots[5]?.id || null]
        ];

        const match = recipes.find(r => {
            return JSON.stringify(r.ingredients) === JSON.stringify(grid);
        });

        if (match) {
            this.craftingResult = { id: match.result, count: 1 };
        } else {
            this.craftingResult = null;
        }
    }

    onCraftingTake() {
        // Consume one from each ingredient slot
        for (let i = 0; i < 6; i++) {
            if (this.craftingSlots[i]) {
                this.craftingSlots[i].count--;
                if (this.craftingSlots[i].count <= 0) this.craftingSlots[i] = null;
            }
        }
        this.checkCraftingRecipe();
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (!this.isOpen) {
            this.closeExternalStorage();
            this.isCraftingOpen = false;
            
            // Return crafting items
            for (let i = 0; i < 6; i++) {
                if (this.craftingSlots[i]) {
                    if (!this.addItem(this.craftingSlots[i])) { }
                    this.craftingSlots[i] = null;
                }
            }
            // Return Mod items
            if (this.modWeaponSlot) {
                this.addItem(this.modWeaponSlot);
                this.modWeaponSlot = null;
                this.modAttachmentSlots = { optic: null, barrel: null, underbarrel: null };
            }

            this.craftingResult = null;
            if (this.heldItem) {
                if (!this.addItem(this.heldItem)) { }
                this.heldItem = null;
            }
            this.hoveredSlotInfo = null;
        }
    }

    addItem(item) {
        const itemDef = this.getItemDef(item.id);
        if (!itemDef) return false;

        const maxStack = 999;
        const isStackable = !!itemDef.stackable;

        // 1. Try to stack if the item is stackable
        if (isStackable) {
            // Check hotbar
            for (let i = 0; i < this.hotbarSlots; i++) {
                if (this.hotbar[i] && this.hotbar[i].id === item.id && this.hotbar[i].count < maxStack) {
                    const addAmount = Math.min(item.count, maxStack - this.hotbar[i].count);
                    this.hotbar[i].count += addAmount;
                    item.count -= addAmount;
                    if (item.count <= 0) return true;
                }
            }
            // Check storage
            for (let i = 0; i < this.slots; i++) {
                if (this.items[i] && this.items[i].id === item.id && this.items[i].count < maxStack) {
                    const addAmount = Math.min(item.count, maxStack - this.items[i].count);
                    this.items[i].count += addAmount;
                    item.count -= addAmount;
                    if (item.count <= 0) return true;
                }
            }
        }

        // 2. Find empty slot
        for (let i = 0; i < this.slots; i++) {
            if (!this.items[i]) {
                if (itemDef.type === 'weapon') {
                    if (item.ammo === undefined) item.ammo = itemDef.magSize || 0;
                    if (!item.attachments) item.attachments = { optic: null, barrel: null, underbarrel: null };
                }
                this.items[i] = { ...item };
                return true;
            }
        }
        return false;
    }

    addHotbarItem(item, slot) {
        if (slot >= 0 && slot < this.hotbarSlots) {
            const itemDef = this.getItemDef(item.id);
            if (itemDef && itemDef.type === 'weapon') {
                item.ammo = itemDef.magSize;
                item.attachments = { optic: null, barrel: null, underbarrel: null };
            }
            this.hotbar[slot] = item;
            return true;
        }
        return false;
    }

    getSelectedItem() {
        return this.hotbar[this.selectedSlot];
    }

    update(dt) {
        const input = this.game.input;

        if (input.isKeyPressed('KeyE')) {
            if (!this.lastEState) {
                this.toggle();
            }
            this.lastEState = true;
        } else {
            this.lastEState = false;
        }

        // Allow closing external storage with 'T' key
        if (input.isKeyPressed('KeyT')) {
            if (!this.lastTState && this.isExternalStorageOpen) {
                this.toggle();
            }
            this.lastTState = true;
        } else {
            this.lastTState = false;
        }

        if (this.isOpen) {
            this.updateHover(input.mouse.x, input.mouse.y);

            if (input.mouse.leftDown) {
                if (!this.lastMouseDown) {
                    this.handleInputClick(input.mouse.x, input.mouse.y);
                }
                this.lastMouseDown = true;
            } else {
                this.lastMouseDown = false;
            }

            if (input.mouse.rightDown) {
                if (!this.lastRightMouseDown) {
                    this.handleInputRightClick(input.mouse.x, input.mouse.y);
                }
                this.lastRightMouseDown = true;
            } else {
                this.lastRightMouseDown = false;
            }

            this.isAiming = false;
            this.aimProgress = 0;
            return;
        }

        // Gameplay Aiming (Right Click to Aim with Scope)
        const item = this.getSelectedItem();
        const itemDef = item ? this.getItemDef(item.id) : null;
        const hasOptic = item && item.attachments?.optic;

        if (input.mouse.rightDown && !this.isOpen && hasOptic) {
            this.isAiming = true;
            this.aimProgress = Math.min(1, this.aimProgress + 0.1);
        } else {
            this.isAiming = false;
            this.aimProgress = Math.max(0, this.aimProgress - 0.1);
        }

        // Zoom logic
        this.updateZoom();

        for (let i = 0; i < this.hotbarSlots; i++) {
            if (input.isKeyPressed(`Digit${i + 1}`)) {
                this.selectedSlot = i;
            }
        }

        // Reload progress
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                this.completeReload();
            }
        }

        // Mouse wheel for hotbar selection
        if (input.wheel !== 0) {
            const oldSlot = this.selectedSlot;
            if (input.wheel < 0) {
                this.selectedSlot = (this.selectedSlot - 1 + this.hotbarSlots) % this.hotbarSlots;
            } else {
                this.selectedSlot = (this.selectedSlot + 1) % this.hotbarSlots;
            }
            if (oldSlot !== this.selectedSlot) {
                this.cancelReload();
            }
        }

        for (let i = 0; i < this.hotbarSlots; i++) {
            if (input.isKeyPressed(`Digit${i + 1}`)) {
                if (this.selectedSlot !== i) {
                    this.selectedSlot = i;
                    this.cancelReload();
                }
            }
        }

        // Reload
        if (input.isKeyPressed('KeyR')) {
            this.reloadWeapon();
        }
    }

    updateZoom() {
        const item = this.getSelectedItem();
        let targetZoom = 0.8; // Base zoom

        if (item && item.attachments?.optic && (this.isAiming || this.aimProgress > 0)) {
            const opticDef = this.getItemDef(item.attachments.optic.id);
            if (opticDef && opticDef.zoom) {
                // If aiming, zoom out (smaller number in our system) to see further
                const zoomFactor = 1 + (opticDef.zoom - 1) * this.aimProgress;
                targetZoom = 0.8 / zoomFactor;
            }
        }

        // Smooth zoom
        this.game.zoom += (targetZoom - this.game.zoom) * 0.1;
        this.game.resize(); // Trigger camera recalculation
    }

    handleInputRightClick(mx, my) {
        const layout = this.getLayout();
        const input = this.game.input;

        // Helper to check and split/place items
        const processRightClick = (item, setItemFunc) => {
            if (this.heldItem) {
                // 1. If holding something, place 1 unit
                if (!item) {
                    // Empty slot: Place 1 from held
                    const oneItem = { ...this.heldItem, count: 1 };
                    setItemFunc(oneItem);
                    this.heldItem.count--;
                    if (this.heldItem.count <= 0) this.heldItem = null;
                    return true;
                } else if (item.id === this.heldItem.id) {
                    // Same item: Add 1 to stack
                    const maxStack = 99; // Adjust based on item type if needed
                    if (item.count < maxStack) {
                        item.count++;
                        this.heldItem.count--;
                        if (this.heldItem.count <= 0) this.heldItem = null;
                        return true;
                    }
                }
            } else {
                // 2. If not holding anything, pick up half
                if (item && item.count > 0) {
                    const takeCount = Math.ceil(item.count / 2);
                    this.heldItem = { ...item, count: takeCount };
                    item.count -= takeCount;
                    if (item.count <= 0) setItemFunc(null);
                    return true;
                }
            }
            return false;
        };

        // 0. Crafting Slots
        if (this.isCraftingOpen) {
            for (let i = 0; i < 6; i++) {
                if (this.pointInRect(mx, my, layout.craftingInput[i])) {
                    if (processRightClick(this.craftingSlots[i], (val) => this.craftingSlots[i] = val)) {
                        this.checkCraftingRecipe();
                        return;
                    }
                }
            }
        }

        // 1. Storage slots
        for (let i = 0; i < this.slots; i++) {
            if (this.pointInRect(mx, my, layout.storage[i])) {
                if (processRightClick(this.items[i], (val) => this.items[i] = val)) return;
            }
        }

        // 2. Hotbar slots
        for (let i = 0; i < this.hotbarSlots; i++) {
            if (this.pointInRect(mx, my, layout.hotbar[i])) {
                if (processRightClick(this.hotbar[i], (val) => this.hotbar[i] = val)) return;
            }
        }

        // 3. Equipment & Attachments (Original right-click logic for quick-actions)
        // Keep original functionality for attachments and medkits
        const checkSlots = [
            ...layout.storage.map((r, i) => ({ r, i, type: 'storage' })),
            ...layout.hotbar.map((r, i) => ({ r, i, type: 'hotbar' }))
        ];

        for (const slot of checkSlots) {
            if (this.pointInRect(mx, my, slot.r)) {
                const item = slot.type === 'storage' ? this.items[slot.i] : this.hotbar[slot.i];
                if (!item) continue;

                const itemDef = this.getItemDef(item.id);
                if (itemDef) {
                    if (itemDef.type === 'attachment') {
                        this.tryAttach(item, slot.type, slot.i);
                        return;
                    }
                    if (itemDef.id === 'medkit') {
                        this.useItemAt(slot.type, slot.i);
                        return;
                    }
                }
            }
        }
    }

    useItemAt(type, index) {
        const item = type === 'storage' ? this.items[index] : this.hotbar[index];
        if (!item) return false;

        const itemDef = this.getItemDef(item.id);
        if (!itemDef) return false;

        let success = false;
        if (itemDef.id === 'medkit') {
            const player = this.game.player;
            if (player.health < player.maxHealth) {
                player.health = Math.min(player.maxHealth, player.health + 200);
                success = true;
            }
        } else if (itemDef.type === 'ammo') {
            // Find weapon
            let weapon = this.getSelectedItem();
            if (weapon) {
                const wDef = this.getItemDef(weapon.id);
                if (wDef && wDef.caliber === itemDef.caliber) {
                    this.reloadWeapon();
                    return true;
                }
            }
            console.log(`Keep ${itemDef.name} in inventory to reload.`);
            success = false;
        }

        if (success) {
            item.count--;
            if (item.count <= 0) {
                if (type === 'storage') this.items[index] = null;
                else this.hotbar[index] = null;
            }
            return true;
        }
        return false;
    }

    tryAttach(attachmentItem, fromType, fromKey) {
        const weapon = this.getSelectedItem();
        if (!weapon) return;

        const attachDef = this.getItemDef(attachmentItem.id);
        if (!attachDef || !weapon.attachments) return;

        const slot = attachDef.slot; // e.g. 'optic'
        if (slot in weapon.attachments) {
            const old = weapon.attachments[slot];
            weapon.attachments[slot] = attachmentItem;

            if (fromType === 'storage') this.items[fromKey] = old;
            else if (fromType === 'hotbar') this.hotbar[fromKey] = old;

            console.log(`Attached ${attachDef.name} to ${weapon.id}`);
        }
    }

    reloadWeapon() {
        if (this.isReloading) return;

        const weapon = this.getSelectedItem();
        if (!weapon) return;

        const weaponDef = this.getItemDef(weapon.id);
        if (!weaponDef || weaponDef.type !== 'weapon' || !weaponDef.caliber) return;

        // Check if weapon is already full
        if (weapon.ammo >= weaponDef.magSize) return;

        // Find matching caliber ammo in inventory
        const ammosFound = this.findAmmo(weaponDef.caliber);
        if (!ammosFound) {
            console.log(`No ${weaponDef.caliber} ammo found.`);
            return;
        }

        this.isReloading = true;
        this.reloadTimer = weaponDef.reloadTime || 1.0;
        this.reloadingItemIdx = this.selectedSlot;
        console.log(`Reloading ${weaponDef.name} with ${weaponDef.caliber}...`);
    }

    findAmmo(caliber) {
        const ammosFound = [];
        // Search hotbar
        for (let i = 0; i < this.hotbarSlots; i++) {
            const item = this.hotbar[i];
            if (!item) continue;
            const itemDef = this.getItemDef(item.id);
            if (itemDef && itemDef.type === 'ammo' && itemDef.caliber === caliber) {
                ammosFound.push({ type: 'hotbar', index: i, item });
            }
        }
        // Search storage
        for (let i = 0; i < this.slots; i++) {
            const item = this.items[i];
            if (!item) continue;
            const itemDef = this.getItemDef(item.id);
            if (itemDef && itemDef.type === 'ammo' && itemDef.caliber === caliber) {
                ammosFound.push({ type: 'storage', index: i, item });
            }
        }
        return ammosFound.length > 0 ? ammosFound : null;
    }

    completeReload() {
        if (!this.isReloading) return;

        const weapon = this.hotbar[this.reloadingItemIdx];
        if (weapon) {
            const weaponDef = this.getItemDef(weapon.id);
            const needed = weaponDef.magSize - weapon.ammo;
            
            if (needed > 0) {
                const ammos = this.findAmmo(weaponDef.caliber);
                if (ammos) {
                    let totalToLoad = needed;
                    for (const info of ammos) {
                        const take = Math.min(totalToLoad, info.item.count);
                        info.item.count -= take;
                        weapon.ammo += take;
                        totalToLoad -= take;

                        if (info.item.count <= 0) {
                            if (info.type === 'hotbar') this.hotbar[info.index] = null;
                            else this.items[info.index] = null;
                        }
                        if (totalToLoad <= 0) break;
                    }
                    console.log(`Reload complete. Loaded up to ${weapon.ammo} rounds.`);
                }
            }
        }

        this.isReloading = false;
        this.reloadingItemIdx = -1;
    }

    cancelReload() {
        if (this.isReloading) {
            console.log("Reload cancelled.");
            this.isReloading = false;
            this.reloadingItemIdx = -1;
        }
    }

    updateHover(mx, my) {
        this.hoveredSlotInfo = null;
        const layout = this.getLayout();

        // 1. Check External Storage
        if (this.isExternalStorageOpen) {
            const storageItems = this.currentExternalStorage.storage || this.currentExternalStorage.items;
            layout.externalStorage.forEach((rect, i) => {
                if (this.pointInRect(mx, my, rect) && storageItems[i]) {
                    this.hoveredSlotInfo = { item: storageItems[i], x: rect.x, y: rect.y, size: rect.size };
                }
            });
            if (this.hoveredSlotInfo) return;
        }

        // 2. Check Crafting/Mod Slots
        if (this.isCraftingOpen) {
            if (this.craftingTab === 'CRAFT') {
                layout.craftingInput.forEach((rect, i) => {
                    if (this.pointInRect(mx, my, rect) && this.craftingSlots[i]) {
                        this.hoveredSlotInfo = { item: this.craftingSlots[i], x: rect.x, y: rect.y, size: rect.size };
                    }
                });
                if (layout.craftingResult && this.pointInRect(mx, my, layout.craftingResult) && this.craftingResult) {
                    this.hoveredSlotInfo = { item: this.craftingResult, x: layout.craftingResult.x, y: layout.craftingResult.y, size: layout.craftingResult.size };
                }
            } else {
                // MOD Tab
                if (layout.modWeaponSlot && this.pointInRect(mx, my, layout.modWeaponSlot) && this.modWeaponSlot) {
                    this.hoveredSlotInfo = { item: this.modWeaponSlot, x: layout.modWeaponSlot.x, y: layout.modWeaponSlot.y, size: layout.modWeaponSlot.size };
                }
                for (const key in layout.modAttachmentSlots) {
                    const rect = layout.modAttachmentSlots[key];
                    if (this.pointInRect(mx, my, rect) && this.modAttachmentSlots[key]) {
                        this.hoveredSlotInfo = { item: this.modAttachmentSlots[key], x: rect.x, y: rect.y, size: rect.size };
                    }
                }
            }
            if (this.hoveredSlotInfo) return;
        }

        // 3. Check Inventory storage
        for (let i = 0; i < this.slots; i++) {
            const rect = layout.storage[i];
            if (this.pointInRect(mx, my, rect) && this.items[i]) {
                this.hoveredSlotInfo = { item: this.items[i], x: rect.x, y: rect.y, size: rect.size };
                return;
            }
        }

        // Check hotbar
        for (let i = 0; i < this.hotbarSlots; i++) {
            const rect = layout.hotbar[i];
            if (this.pointInRect(mx, my, rect) && this.hotbar[i]) {
                this.hoveredSlotInfo = { item: this.hotbar[i], x: rect.x, y: rect.y, size: rect.size };
                return;
            }
        }

        // Check equipment
        for (const key in layout.equipment) {
            const rect = layout.equipment[key];
            if (this.pointInRect(mx, my, rect) && this.equipment[key]) {
                this.hoveredSlotInfo = { item: this.equipment[key], x: rect.x, y: rect.y, size: rect.size };
                return;
            }
        }
    }

    handleInputClick(mx, my) {
        const layout = this.getLayout();
        const input = this.game.input;
        const isShift = input.isKeyPressed('ShiftLeft') || input.isKeyPressed('ShiftRight');

        // Helper to check if two items can be merged
        const canMerge = (item1, item2) => {
            if (!item1 || !item2 || item1.id !== item2.id) return false;
            const def = this.getItemDef(item1.id);
            return def && !!def.stackable;
        };

        const maxStack = 999;

        // 0. Crafting & Mod Tab Switch
        if (this.isCraftingOpen) {
            for (const key in layout.craftingTabs) {
                const tab = layout.craftingTabs[key];
                if (mx >= tab.x && mx <= tab.x + tab.w && my >= tab.y && my <= tab.y + tab.h) {
                    this.craftingTab = key.toUpperCase();
                    return;
                }
            }
        }

        // 0. Crafting Logic
        if (this.isCraftingOpen && this.craftingTab === 'CRAFT') {
            // Input Slots
            for (let i = 0; i < 6; i++) {
                const rect = layout.craftingInput[i];
                if (this.pointInRect(mx, my, rect)) {
                    const slotItem = this.craftingSlots[i];
                    
                    if (this.heldItem && slotItem && this.heldItem.id === slotItem.id) {
                        // Merge Logic
                        const total = slotItem.count + this.heldItem.count;
                        if (total <= maxStack) {
                            slotItem.count = total;
                            this.heldItem = null;
                        } else {
                            slotItem.count = maxStack;
                            this.heldItem.count = total - maxStack;
                        }
                    } else {
                        // Swap Logic
                        const temp = this.craftingSlots[i];
                        this.craftingSlots[i] = this.heldItem;
                        this.heldItem = temp;
                    }
                    
                    this.checkCraftingRecipe();
                    return;
                }
            }
            // Result Slot
            const resRect = layout.craftingResult;
            if (this.pointInRect(mx, my, resRect) && this.craftingResult) {
                if (!this.heldItem) {
                    this.heldItem = this.craftingResult;
                    this.onCraftingTake();
                    return;
                } else if (this.heldItem.id === this.craftingResult.id && this.heldItem.count < maxStack) {
                    this.heldItem.count++;
                    this.onCraftingTake();
                    return;
                }
            }
        }

        // 0. MOD Logic
        if (this.isCraftingOpen && this.craftingTab === 'MOD') {
            // Main Weapon Slot
            const wRect = layout.modWeaponSlot;
            if (this.pointInRect(mx, my, wRect)) {
                if (this.heldItem) {
                    const hDef = this.getItemDef(this.heldItem.id);
                    if (hDef?.type !== 'weapon' || hDef?.subType === 'melee') return;
                }
                
                if (this.modWeaponSlot) {
                    // BEFORE taking or swapping, make sure ALL current attachments are saved into the weapon object
                    if (!this.modWeaponSlot.attachments) this.modWeaponSlot.attachments = { optic: null, barrel: null, underbarrel: null };
                    this.modWeaponSlot.attachments.optic = this.modAttachmentSlots.optic;
                    this.modWeaponSlot.attachments.barrel = this.modAttachmentSlots.barrel;
                    this.modWeaponSlot.attachments.underbarrel = this.modAttachmentSlots.underbarrel;
                }

                // Now handle the swap/pickup
                const temp = this.modWeaponSlot;
                this.modWeaponSlot = this.heldItem;
                this.heldItem = temp;

                // If we just put a NEW weapon in, load its attachments into UI slots
                if (this.modWeaponSlot) {
                    if (!this.modWeaponSlot.attachments) this.modWeaponSlot.attachments = { optic: null, barrel: null, underbarrel: null };
                    this.modAttachmentSlots.optic = this.modWeaponSlot.attachments.optic || null;
                    this.modAttachmentSlots.barrel = this.modWeaponSlot.attachments.barrel || null;
                    this.modAttachmentSlots.underbarrel = this.modWeaponSlot.attachments.underbarrel || null;
                } else {
                    // Emptying the slot
                    this.modAttachmentSlots = { optic: null, barrel: null, underbarrel: null };
                }
                return;
            }

            // Attachment Slots
            if (this.modWeaponSlot) {
                for (const slotKey in layout.modAttachmentSlots) {
                    const rect = layout.modAttachmentSlots[slotKey];
                    if (this.pointInRect(mx, my, rect)) {
                        const hDef = this.heldItem ? this.getItemDef(this.heldItem.id) : null;
                        
                        // Check if held item is an attachment for this slot
                        if (this.heldItem && (hDef?.type !== 'attachment' || hDef?.slot !== slotKey)) return;

                        // Swap & Sync with weapon data
                        const temp = this.modAttachmentSlots[slotKey];
                        this.modAttachmentSlots[slotKey] = this.heldItem;
                        this.heldItem = temp;
                        
                        // Apply to weapon object
                        if (!this.modWeaponSlot.attachments) this.modWeaponSlot.attachments = {};
                        this.modWeaponSlot.attachments[slotKey] = this.modAttachmentSlots[slotKey];
                        return;
                    }
                }
            }
        }

        // 0. External Storage
        if (this.isExternalStorageOpen) {
            const extSlots = this.currentExternalStorage.storageSlots || this.currentExternalStorage.items.length;
            const storageItems = this.currentExternalStorage.storage || this.currentExternalStorage.items;

            for (let i = 0; i < extSlots; i++) {
                const rect = layout.externalStorage[i];
                if (this.pointInRect(mx, my, rect)) {
                    // Check item type restriction (only for vehicles)
                    if (this.heldItem && this.externalStorageType === 'vehicle') {
                        const itemDef = this.getItemDef(this.heldItem.id);
                        const accepted = this.currentExternalStorage.acceptedItemTypes;
                        if (accepted && !accepted.includes(itemDef.type)) {
                            console.log(`This vehicle only accepts: ${accepted.join(', ')}`);
                            return; 
                        }
                    }
                    
                    if (isShift && storageItems[i]) {
                        this.handleQuickMove('external', i);
                        return;
                    }

                    // Merging logic
                    if (this.heldItem && canMerge(this.heldItem, storageItems[i])) {
                        const target = storageItems[i];
                        const total = target.count + this.heldItem.count;
                        if (total <= maxStack) {
                            target.count = total;
                            this.heldItem = null;
                        } else {
                            target.count = maxStack;
                            this.heldItem.count = total - maxStack;
                        }
                        return;
                    }

                    const temp = storageItems[i];
                    if (this.currentExternalStorage.storage) this.currentExternalStorage.storage[i] = this.heldItem;
                    else this.currentExternalStorage.items[i] = this.heldItem;
                    
                    // If moving from chest to player (heldItem was temp)
                    if (temp) {
                        const tDef = this.getItemDef(temp.id);
                        if (tDef && tDef.type === 'weapon') {
                            if (temp.ammo === undefined) temp.ammo = tDef.magSize || 0;
                            if (temp.totalAmmo === undefined) temp.totalAmmo = (tDef.magSize || 0) * 2;
                            if (!temp.attachments) temp.attachments = { optic: null, barrel: null, underbarrel: null };
                        }
                    }
                    
                    this.heldItem = temp;
                    return;
                }
            }
        }

        // 1. Storage slots
        for (let i = 0; i < this.slots; i++) {
            const rect = layout.storage[i];
            if (this.pointInRect(mx, my, rect)) {
                if (isShift && this.items[i]) {
                    this.handleQuickMove('storage', i);
                    return;
                }

                // Merging logic for storage
                if (this.heldItem && canMerge(this.heldItem, this.items[i])) {
                    const target = this.items[i];
                    const total = target.count + this.heldItem.count;
                    if (total <= maxStack) {
                        target.count = total;
                        this.heldItem = null;
                    } else {
                        target.count = maxStack;
                        this.heldItem.count = total - maxStack;
                    }
                    return;
                }

                const temp = this.items[i];
                this.items[i] = this.heldItem;
                this.heldItem = temp;
                return;
            }
        }

        // 2. Hotbar slots
        for (let i = 0; i < this.hotbarSlots; i++) {
            const rect = layout.hotbar[i];
            if (this.pointInRect(mx, my, rect)) {
                if (isShift && this.hotbar[i]) {
                    this.handleQuickMove('hotbar', i);
                    return;
                }

                // Merging logic for hotbar
                if (this.heldItem && canMerge(this.heldItem, this.hotbar[i])) {
                    const target = this.hotbar[i];
                    const total = target.count + this.heldItem.count;
                    if (total <= maxStack) {
                        target.count = total;
                        this.heldItem = null;
                    } else {
                        target.count = maxStack;
                        this.heldItem.count = total - maxStack;
                    }
                    return;
                }

                const temp = this.hotbar[i];
                this.hotbar[i] = this.heldItem;
                this.heldItem = temp;
                return;
            }
        }

        // 3. Equipment slots
        for (const slotKey in layout.equipment) {
            const rect = layout.equipment[slotKey];
            if (this.pointInRect(mx, my, rect)) {
                if (isShift && this.equipment[slotKey]) {
                    this.handleQuickMove('equipment', slotKey);
                    return;
                }
                if (this.heldItem) {
                    const itemDef = this.getItemDef(this.heldItem.id);
                    const canEquip = itemDef && itemDef.type === 'equipment' &&
                        (itemDef.slot === slotKey || (slotKey.startsWith('acc') && itemDef.slot?.startsWith('acc')));

                    if (!canEquip) return; // Invalid item for this slot
                }

                const temp = this.equipment[slotKey];
                this.equipment[slotKey] = this.heldItem;
                this.heldItem = temp;
                return;
            }
        }
    }

    handleQuickMove(fromType, fromKey) {
        let item = null;
        if (fromType === 'storage') item = this.items[fromKey];
        else if (fromType === 'hotbar') item = this.hotbar[fromKey];
        else if (fromType === 'equipment') item = this.equipment[fromKey];
        else if (fromType === 'external') {
            const storageItems = this.currentExternalStorage.storage || this.currentExternalStorage.items;
            item = storageItems[fromKey];
        }

        if (!item) return;
        const itemDef = this.getItemDef(item.id);
        if (!itemDef) return;

        // Move from external to player storage/hotbar
        if (fromType === 'external') {
            if (this.addItem(item)) {
                this.clearSlot(fromType, fromKey);
            }
            return;
        }

        // Move from player to external if open
        if (this.isExternalStorageOpen && fromType !== 'external') {
            // Check item type restriction (vehicles only)
            if (this.externalStorageType === 'vehicle') {
                const accepted = this.currentExternalStorage.acceptedItemTypes;
                if (accepted && !accepted.includes(itemDef.type)) return;
            }

            const extSlots = this.currentExternalStorage.storageSlots || this.currentExternalStorage.items.length;
            const storageItems = this.currentExternalStorage.storage || this.currentExternalStorage.items;
            for (let i = 0; i < extSlots; i++) {
                if (!storageItems[i]) {
                    storageItems[i] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                }
            }
        }

        // Try to move to equipment if from storage/hotbar
        if (fromType !== 'equipment' && itemDef.type === 'equipment') {
            const slotKey = itemDef.slot;
            if (slotKey.startsWith('acc')) {
                // Check acc1 then acc2
                if (!this.equipment['acc1']) {
                    this.equipment['acc1'] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                } else if (!this.equipment['acc2']) {
                    this.equipment['acc2'] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                }
            } else if (this.equipment[slotKey] === null) {
                this.equipment[slotKey] = item;
                this.clearSlot(fromType, fromKey);
                return;
            }
            // If slot full, fall through to move between storage/hotbar
        }

        // Move between storage and hotbar
        if (fromType === 'storage') {
            // Try hotbar first
            for (let i = 0; i < this.hotbarSlots; i++) {
                if (!this.hotbar[i]) {
                    this.hotbar[i] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                }
            }
        } else if (fromType === 'hotbar') {
            // Move to storage
            for (let i = 0; i < this.slots; i++) {
                if (!this.items[i]) {
                    this.items[i] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                }
            }
        } else if (fromType === 'equipment') {
            // Move to storage, then hotbar if full
            for (let i = 0; i < this.slots; i++) {
                if (!this.items[i]) {
                    this.items[i] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                }
            }
            for (let i = 0; i < this.hotbarSlots; i++) {
                if (!this.hotbar[i]) {
                    this.hotbar[i] = item;
                    this.clearSlot(fromType, fromKey);
                    return;
                }
            }
        }
    }

    clearSlot(type, key) {
        if (type === 'storage') this.items[key] = null;
        else if (type === 'hotbar') this.hotbar[key] = null;
        else if (type === 'equipment') this.equipment[key] = null;
        else if (type === 'external') {
            if (this.currentExternalStorage.storage) this.currentExternalStorage.storage[key] = null;
            else this.currentExternalStorage.items[key] = null;
        }
    }

    getItemDef(itemId) {
        return this.game.assetManager.getData('items')?.find(it => it.id === itemId);
    }

    pointInRect(px, py, rect) {
        return px >= rect.x && px <= rect.x + rect.size && py >= rect.y && py <= rect.y + rect.size;
    }

    getLayout() {
        const cols = 8;
        const slotSize = 50;
        const padding = 8;
        const winW = (slotSize + padding) * cols + padding + 40;
        
        // Increase window height for crafting to prevent overlap
        let winH = (this.isExternalStorageOpen || this.isCraftingOpen) ? 620 : 580; 

        const winX = (this.game.canvas.width - winW) / 2;
        const winY = (this.game.canvas.height - winH) / 2;

        const layout = {
            win: { x: winX, y: winY, w: winW, h: winH },
            preview: { x: winX + 25, y: winY + 60, w: 180, h: 180 },
            equipment: {},
            storage: [],
            hotbar: [],
            externalStorage: [],
            craftingInput: [],
            craftingResult: null
        };

        // Crafting Layout
        if (this.isCraftingOpen) {
            // Tab Buttons
            layout.craftingTabs = {
                craft: { x: winX + 25, y: winY + 50, w: 80, h: 25, label: 'CRAFT' },
                mod: { x: winX + 110, y: winY + 50, w: 80, h: 25, label: 'MOD' }
            };

            if (this.craftingTab === 'CRAFT') {
                const startX = winX + 80;
                const startY = winY + 90;
                for (let i = 0; i < 6; i++) {
                    layout.craftingInput.push({
                        x: startX + (i % 3) * (slotSize + padding),
                        y: startY + Math.floor(i / 3) * (slotSize + padding),
                        size: slotSize
                    });
                }
                layout.craftingResult = {
                    x: startX + 4 * (slotSize + padding) + 10,
                    y: startY + (slotSize + padding) * 0.5,
                    size: slotSize
                };
                layout.craftingArrowX = startX + 3.5 * (slotSize + padding);
                layout.craftingArrowY = startY + (slotSize + padding) - 5;
            } else {
                // MOD Tab Layout
                const startX = winX + 150;
                const startY = winY + 100;
                
                // Main Weapon Slot
                layout.modWeaponSlot = { x: startX, y: startY, size: slotSize * 1.5 };
                
                // Attachment Slots around weapon
                layout.modAttachmentSlots = {
                    optic: { x: startX + 100, y: startY - 20, size: slotSize, label: 'Optic' },
                    barrel: { x: startX + 100, y: startY + 40, size: slotSize, label: 'Barrel' },
                    underbarrel: { x: startX - 80, y: startY + 40, size: slotSize, label: 'Under' }
                };
            }
        }

        // External Storage Slots
        if (this.isExternalStorageOpen) {
            const extSlots = this.currentExternalStorage.storageSlots || this.currentExternalStorage.items.length;
            const extCols = 8;
            for (let i = 0; i < extSlots; i++) {
                const col = i % extCols;
                const row = Math.floor(i / extCols);
                layout.externalStorage.push({
                    x: winX + 25 + col * (slotSize + padding),
                    y: winY + 60 + row * (slotSize + padding),
                    size: slotSize
                });
            }
        }

        // Equipment Slots
        if (!this.isExternalStorageOpen && !this.isCraftingOpen) {
            const eqStartX = layout.preview.x + layout.preview.w + 20;
            const eqStartY = layout.preview.y;
            const eqRows = ['head', 'chest', 'top', 'bottom', 'acc1', 'acc2'];
            eqRows.forEach((key, idx) => {
                const col = Math.floor(idx / 3);
                const row = idx % 3;
                layout.equipment[key] = {
                    x: eqStartX + col * (slotSize + padding),
                    y: eqStartY + row * (slotSize + padding),
                    size: slotSize,
                    label: key
                };
            });
        }

        // --- FIXED: Push Storage Start Y down to avoid overlap ---
        // For crafting, the bottom of the grid is around Y + 240, so start at 280
        const storageStartY = (this.isExternalStorageOpen || this.isCraftingOpen) ? winY + 280 : layout.preview.y + layout.preview.h + 30;
        
        for (let i = 0; i < this.slots; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            layout.storage.push({
                x: winX + 25 + col * (slotSize + padding),
                y: storageStartY + row * (slotSize + padding),
                size: slotSize
            });
        }

        const hotbarY = storageStartY + 4 * (slotSize + padding) + 15;
        for (let i = 0; i < this.hotbarSlots; i++) {
            layout.hotbar.push({
                x: winX + 25 + i * (slotSize + padding),
                y: hotbarY,
                size: slotSize
            });
        }

        return layout;
    }

    useItem(slotIndex) {
        return this.useItemAt('hotbar', slotIndex);
    }

    render(ctx) {
        if (!this.isOpen) return;

        const layout = this.getLayout();
        const { win, preview, equipment, storage, hotbar } = layout;

        // Background
        ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
        ctx.fillRect(win.x, win.y, win.w, win.h);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(win.x, win.y, win.w, win.h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        
        if (this.isExternalStorageOpen) {
            // External Storage Mode
            ctx.fillStyle = '#f1c40f';
            ctx.fillText(this.externalStorageType === 'vehicle' ? "Vehicle Trunk" : "Loot Box", win.x + 25, win.y + 40);
            
            const storageItems = this.currentExternalStorage.storage || this.currentExternalStorage.items;
            layout.externalStorage.forEach((rect, i) => {
                this.drawSlot(ctx, rect, storageItems[i], false, 'Storage');
            });
            ctx.fillStyle = '#fff';
            ctx.fillText("Inventory", win.x + 25, storage[0].y - 15);
        } else if (this.isCraftingOpen) {
            ctx.fillStyle = '#f1c40f';
            ctx.fillText("Gun Workbench", win.x + 25, win.y + 35);
            
            // Draw Tabs
            for (const key in layout.craftingTabs) {
                const tab = layout.craftingTabs[key];
                const isActive = (key.toUpperCase() === this.craftingTab);
                ctx.fillStyle = isActive ? '#f1c40f' : '#333';
                ctx.fillRect(tab.x, tab.y, tab.w, tab.h);
                ctx.fillStyle = isActive ? '#000' : '#aaa';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(tab.label, tab.x + tab.w / 2, tab.y + 17);
                ctx.textAlign = 'left';
            }

            if (this.craftingTab === 'CRAFT') {
                // Draw Input Slots
                layout.craftingInput.forEach((rect, i) => {
                    this.drawSlot(ctx, rect, this.craftingSlots[i], false);
                });

                // Draw Arrow
                ctx.fillStyle = '#fff';
                ctx.font = '30px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("→", layout.craftingArrowX, layout.craftingArrowY);
                ctx.textAlign = 'left';

                // Draw Result
                this.drawSlot(ctx, layout.craftingResult, this.craftingResult, false, 'Result');
            } else {
                // Draw MOD Tab
                this.drawSlot(ctx, layout.modWeaponSlot, this.modWeaponSlot, false, 'Weapon');
                for (const slot in layout.modAttachmentSlots) {
                    const rect = layout.modAttachmentSlots[slot];
                    this.drawSlot(ctx, rect, this.modAttachmentSlots[slot], false, rect.label);
                }
            }
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.fillText("Inventory", win.x + 25, storage[0].y - 15);
        } else {
            // Normal Inventory Mode
            ctx.fillText("Character", win.x + 25, win.y + 40);

            // Player Preview
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(preview.x, preview.y, preview.w, preview.h);

            const centerX = preview.x + preview.w / 2;
            const centerY = preview.y + preview.h / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 35, 0, Math.PI * 2);
            ctx.fillStyle = this.game.player.color;
            ctx.fill();
            ctx.closePath();

            // Equipment
            for (const key in equipment) {
                const rect = equipment[key];
                this.drawSlot(ctx, rect, this.equipment[key], false, rect.label);
            }

            ctx.fillStyle = '#aaa';
            ctx.font = '12px Arial';
            ctx.fillText("Storage", win.x + 25, storage[0].y - 10);
        }

        // Storage Slots (Always drawn, position handled by getLayout)
        storage.forEach((rect, i) => {
            this.drawSlot(ctx, rect, this.items[i], false);
        });

        // Hotbar
        ctx.fillStyle = '#aaa';
        ctx.font = '12px Arial';
        ctx.fillText("Hotbar Slots", win.x + 25, hotbar[0].y - 10);
        hotbar.forEach((rect, i) => {
            this.drawSlot(ctx, rect, this.hotbar[i], false);
        });

        // Held Item
        if (this.heldItem) {
            const mx = this.game.input.mouse.x;
            const my = this.game.input.mouse.y;
            this.drawItem(ctx, this.heldItem, mx - 25, my - 25, 50);
        }

        // Tooltip (Always last)
        if (this.hoveredSlotInfo && !this.heldItem) {
            this.renderTooltip(ctx, this.hoveredSlotInfo);
        }
    }

    renderTooltip(ctx, info) {
        const itemDef = this.getItemDef(info.item.id);
        if (!itemDef) return;

        const padding = 12;
        const w = 200;
        
        // --- 1. Calculate Total Height First ---
        let totalH = padding;
        
        // Name & Type
        totalH += 20; // Title
        totalH += 15; // Type
        totalH += 10; // Spacer

        // Description height calculation
        if (itemDef.description) {
            const words = itemDef.description.split(' ');
            let line = '';
            for (const word of words) {
                if (ctx.measureText(line + word).width > w - padding * 2) {
                    totalH += 15;
                    line = word + ' ';
                } else {
                    line += word + ' ';
                }
            }
            totalH += 15; // Last line
            totalH += 10; // Spacer
        }

        // Stats height
        if (itemDef.type === 'weapon') {
            totalH += 35; // Damage & Fire Rate
            if (info.item.attachments) {
                totalH += 25; // Header
                totalH += Object.keys(info.item.attachments).length * 15; // Slots
            }
        }
        totalH += padding;

        // Position near slot, but keep inside canvas
        let tx = info.x + info.size + 10;
        let ty = info.y;
        if (tx + w > this.game.canvas.width) tx = info.x - w - 10;
        if (ty + totalH > this.game.canvas.height) ty = this.game.canvas.height - totalH - 10;

        // --- 2. Draw Background ---
        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 5, 0.95)';
        ctx.fillRect(tx, ty, w, totalH);
        ctx.strokeStyle = itemDef.color || '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, w, totalH);

        // --- 3. Draw Content ---
        let currentY = ty + padding;

        // Name
        ctx.fillStyle = itemDef.color || '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(itemDef.name, tx + padding, currentY + 15);
        currentY += 22;

        // Type
        ctx.fillStyle = '#aaa';
        ctx.font = 'italic 11px Arial';
        ctx.fillText(itemDef.type.toUpperCase(), tx + padding, currentY + 10);
        currentY += 20;

        // Description
        if (itemDef.description) {
            ctx.fillStyle = '#eee';
            ctx.font = '12px Arial';
            const words = itemDef.description.split(' ');
            let line = '';
            for (const word of words) {
                if (ctx.measureText(line + word).width > w - padding * 2) {
                    ctx.fillText(line, tx + padding, currentY + 10);
                    line = word + ' ';
                    currentY += 15;
                } else {
                    line += word + ' ';
                }
            }
            ctx.fillText(line, tx + padding, currentY + 10);
            currentY += 25;
        }

        // Stats
        if (itemDef.type === 'weapon') {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`Damage: ${itemDef.damage || 1}`, tx + padding, currentY);
            currentY += 15;
            ctx.fillText(`Fire Rate: ${itemDef.fireRate || 0.2}s`, tx + padding, currentY);
            currentY += 20;

            // Attachments List
            if (info.item.attachments) {
                ctx.fillStyle = '#5dade2';
                ctx.font = 'bold 12px Arial';
                ctx.fillText("MODIFICATIONS:", tx + padding, currentY);
                currentY += 18;
                ctx.font = 'bold 11px Arial';
                
                for (const slotKey in info.item.attachments) {
                    const attach = info.item.attachments[slotKey];
                    const aDef = attach ? this.getItemDef(attach.id) : null;
                    if (attach) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(`• ${slotKey.toUpperCase()}: ${aDef ? aDef.name : 'Unknown'}`, tx + padding + 5, currentY);
                    } else {
                        ctx.fillStyle = '#777777';
                        ctx.fillText(`• ${slotKey.toUpperCase()}: NONE`, tx + padding + 5, currentY);
                    }
                    currentY += 15;
                }
            }
        }
        ctx.restore();
    }

    drawSlot(ctx, rect, item, isSelected, label) {
        ctx.fillStyle = isSelected ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
        ctx.strokeStyle = isSelected ? '#3498db' : '#333';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(rect.x, rect.y, rect.size, rect.size);

        if (!item && label) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.textAlign = 'center';
            ctx.font = '9px Arial';
            ctx.fillText(label.toUpperCase(), rect.x + rect.size / 2, rect.y + rect.size / 2 + 4);
            ctx.textAlign = 'left';
        }

        if (item) {
            this.drawItem(ctx, item, rect.x, rect.y, rect.size);
        }
    }

    renderHotbar(ctx) {
        if (this.isOpen) return;

        const slotSize = 60;
        const padding = 10;
        const totalW = (slotSize + padding) * this.hotbarSlots - padding;
        const startX = (this.game.canvas.width - totalW) / 2;
        const startY = this.game.canvas.height - slotSize - 20;

        // Health Bar (Above Hotbar)
        const player = this.game.player;
        const barW = totalW;
        const barH = 12;
        const barX = startX;
        const barY = startY - 25;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        const healthRatio = Math.max(0, player.health / player.maxHealth);
        ctx.fillStyle = healthRatio > 0.3 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(barX, barY, barW * healthRatio, barH);

        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Health Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(player.health)} / ${player.maxHealth}`, barX + barW / 2, barY + 10);
        
        // Stamina Bar (Below Health Bar)
        const stamBarH = 6;
        const stamBarY = barY + barH + 4;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX, stamBarY, barW, stamBarH);
        
        // Fill
        const stamRatio = Math.max(0, player.stamina / player.maxStamina);
        ctx.fillStyle = player.isExhausted ? '#95a5a6' : '#3498db'; // Grey if exhausted, blue otherwise
        ctx.fillRect(barX, stamBarY, barW * stamRatio, stamBarH);
        
        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, stamBarY, barW, stamBarH);

        ctx.textAlign = 'left';

        for (let i = 0; i < this.hotbarSlots; i++) {
            const slotX = startX + i * (slotSize + padding);
            const slotY = startY;

            ctx.fillStyle = this.selectedSlot === i ? 'rgba(52, 152, 219, 0.5)' : 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(slotX, slotY, slotSize, slotSize);
            ctx.strokeStyle = this.selectedSlot === i ? '#3498db' : '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(slotX, slotY, slotSize, slotSize);

            ctx.fillStyle = '#aaa';
            ctx.font = '10px Arial';
            ctx.fillText(i + 1, slotX + 5, slotY + 15);

            const item = this.hotbar[i];
            if (item) this.drawItem(ctx, item, slotX, slotY, slotSize);
        }

        this.renderAmmoHUD(ctx);
    }

    renderAimOverlay(ctx) {
        const player = this.game.player;
        const camera = this.game.camera;
        const input = this.game.input;

        // Player screen position
        const screenX = (player.x - camera.x) * this.game.zoom;
        const screenY = (player.y - camera.y) * this.game.zoom;

        const targetX = input.mouse.x;
        const targetY = input.mouse.y;
        const angle = Math.atan2(targetY - screenY, targetX - screenX);

        // Sight Arc configuration
        const item = this.getSelectedItem();
        const optic = item?.attachments?.optic;
        if (!optic) return; // Cannot render aim overlay without optic

        const opticDef = this.getItemDef(optic.id);
        if (!opticDef) return;

        // Scope power affects arc width (Higher zoom = narrower arc)
        const baseArc = Math.PI * 0.6; // 108 deg base
        const arcWidth = baseArc / (opticDef.zoom || 1);

        ctx.save();

        // Create mask
        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.game.canvas.width;
        offCanvas.height = this.game.canvas.height;
        const offCtx = offCanvas.getContext('2d');

        // Black out everything
        offCtx.fillStyle = `rgba(0, 0, 0, ${1.0 * this.aimProgress})`;
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        // Cut out the vision cone
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.beginPath();
        offCtx.moveTo(screenX, screenY);
        // Extend arc far enough
        const radius = Math.max(offCanvas.width, offCanvas.height) * 1.5;
        offCtx.arc(screenX, screenY, radius, angle - arcWidth / 2, angle + arcWidth / 2);
        offCtx.fill();

        // Add vignette/blur effect
        offCtx.globalCompositeOperation = 'source-over';
        const grad = offCtx.createRadialGradient(screenX, screenY, 100, screenX, screenY, 400);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${0.3 * this.aimProgress})`);
        offCtx.fillStyle = grad;
        // offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height); // This might blur too much

        ctx.drawImage(offCanvas, 0, 0);

        // Draw scope vignette (the black ring)
        ctx.strokeStyle = `rgba(0,0,0,${this.aimProgress})`;
        ctx.lineWidth = 40;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    renderAmmoHUD(ctx) {
        const player = this.game.player;
        
        // 1. If in a vehicle that provides its own Ammo HUD (like a Tank)
        if (player.isInVehicle && player.currentVehicle.providesAmmoHUD) {
            this.renderVehicleAmmoHUD(ctx, player.currentVehicle);
            return;
        }

        const item = this.getSelectedItem();
        if (!item) return;

        const itemDef = this.getItemDef(item.id);
        if (!itemDef || itemDef.type !== 'weapon') return;

        const margin = 30;
        const x = margin;
        const y = this.game.canvas.height - margin;

        ctx.save();

        // Background Glow
        const gradient = ctx.createRadialGradient(x + 50, y - 30, 0, x + 50, y - 30, 100);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - 20, y - 100, 200, 120);

        // Weapon Name
        ctx.fillStyle = '#aaa';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(itemDef.name.toUpperCase(), x, y - 45);

        // Attachment Icons
        if (item.attachments) {
            let offset = 0;
            for (const slotKey in item.attachments) {
                const attach = item.attachments[slotKey];
                if (attach) {
                    const attachImg = this.game.assetManager.get(attach.id);
                    if (attachImg) {
                        const iconX = x + 180 + offset;
                        const iconY = y - 70;
                        ctx.drawImage(attachImg, iconX, iconY, 30, 30);
                        ctx.strokeStyle = '#f1c40f';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(iconX, iconY, 30, 30);
                        offset += 35;
                    }
                }
            }
        }

        // Calculate total ammo available for the current caliber
        let totalBullets = 0;
        const allSlots = [...this.hotbar, ...this.items];
        allSlots.forEach(i => {
            if (i) {
                const iDef = this.getItemDef(i.id);
                if (iDef && iDef.type === 'ammo' && iDef.caliber === itemDef.caliber) {
                    totalBullets += i.count;
                }
            }
        });

        const ammoStr = `${item.ammo || 0}`;
        const totalStr = ` / ${totalBullets} [${itemDef.caliber}]`;

        if (this.isReloading) {
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#f1c40f';
            ctx.fillText("RELOADING", x, y);

            // Progress Bar
            const barW = 200;
            const barH = 8;
            const barY = y + 15;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(x, barY, barW, barH);

            const itemDefMain = this.getItemDef(item.id);
            const totalTime = itemDefMain.reloadTime || 1.0;
            const progress = Math.min(1, Math.max(0, 1 - (this.reloadTimer / totalTime)));

            const grad = ctx.createLinearGradient(x, barY, x + barW, barY);
            grad.addColorStop(0, '#f1c40f');
            grad.addColorStop(1, '#e67e22');

            ctx.fillStyle = grad;
            ctx.fillRect(x, barY, barW * progress, barH);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, barY, barW, barH);
        } else {
            ctx.font = 'bold 36px Arial';
            ctx.fillText(ammoStr, x, y);

            const ammoWidth = ctx.measureText(ammoStr).width;
            ctx.fillStyle = '#666';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(totalStr, x + ammoWidth, y);

            // Reload Hint if low
            if (item.ammo === 0 && totalBullets > 0) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'italic 14px Arial';
                ctx.fillText("PRESS 'R' TO RELOAD", x, y + 20);
            }
        }

        ctx.restore();
    }

    renderVehicleAmmoHUD(ctx, vehicle) {
        const margin = 30;
        const x = margin;
        const y = this.game.canvas.height - margin;

        ctx.save();

        // Find current loaded ammo/shell info from storage
        let nextItem = null;
        for (let i = 0; i < vehicle.storageSlots; i++) {
            if (vehicle.storage[i]) {
                nextItem = vehicle.storage[i];
                break;
            }
        }

        // Background Glow
        const gradient = ctx.createRadialGradient(x + 50, y - 30, 0, x + 50, y - 30, 150);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - 20, y - 100, 300, 140);

        // APC uses currentMagAmmo, Tank uses the shell count directly
        const isAPC = vehicle.type === 'apc';
        const ammoCount = isAPC ? (vehicle.currentMagAmmo || 0) : (nextItem ? nextItem.count : 0);
        const hasAmmo = isAPC ? (ammoCount > 0 || nextItem !== null) : nextItem !== null;

        if (hasAmmo) {
            const def = nextItem ? this.getItemDef(nextItem.id) : null;
            const name = def ? def.name : (isAPC ? "HMG" : "CANNON");
            const color = def ? def.color : "#fff";
            
            ctx.fillStyle = color;
            ctx.font = 'bold 16px Arial';
            ctx.fillText(name.toUpperCase(), x, y - 45);

            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#fff';
            const countStr = ammoCount.toString();
            ctx.fillText(countStr, x, y);

            const countWidth = ctx.measureText(countStr).width;
            ctx.fillStyle = '#666';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(isAPC ? " ROUNDS" : " SHELLS LOADED", x + countWidth + 5, y);

            // Reserve info for APC
            if (isAPC && nextItem) {
                ctx.fillStyle = '#aaa';
                ctx.font = '12px Arial';
                ctx.fillText(`PREPARED MAGS: ${nextItem.count}`, x, y + 35);
            }

            // Cooldown/Reload Bar
            if (vehicle.fireTimer > 0) {
                const barW = 200;
                const barH = 8;
                const barY = y + 15;
                const totalCooldown = isAPC && ammoCount === 0 ? 1.0 : (vehicle.fireCooldown || 0.1);
                const progress = 1 - (vehicle.fireTimer / (totalCooldown || 1));
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(x, barY, barW, barH);
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(x, barY, barW * progress, barH);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.strokeRect(x, barY, barW, barH);
            }
        } else {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 36px Arial';
            ctx.fillText("OUT OF AMMO", x, y);
            ctx.fillStyle = '#aaa';
            ctx.font = 'italic 14px Arial';
            ctx.fillText("PRESS [T] TO LOAD AMMUNITION", x, y + 25);
        }

        ctx.restore();
    }

    drawItem(ctx, item, x, y, size) {
        const itemDef = this.game.assetManager.getData('items')?.find(it => it.id === item.id);
        if (itemDef) {
            const img = this.game.assetManager.get(item.id);
            if (img) {
                ctx.drawImage(img, x + 5, y + 5, size - 10, size - 10);
            } else {
                ctx.fillStyle = itemDef.color || '#fff';
                ctx.fillRect(x + 10, y + 10, size - 20, size - 20);
            }
        }

        if (item.count > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(item.count, x + size - 5, y + size - 5);
            ctx.textAlign = 'left';
        }
    }
}