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

        // Reload system
        this.isReloading = false;
        this.reloadTimer = 0;
        this.reloadingItemIdx = -1; // Index in hotbar

        // Test Items
        this.addHotbarItem({ id: 'pistol', count: 1 }, 0);
        this.addHotbarItem({ id: 'medkit', count: 5 }, 1);
        this.addHotbarItem({ id: 'ak47', count: 1 }, 2);
        this.addHotbarItem({ id: 'm40', count: 1 }, 3);
        this.addItem({ id: 'medkit', count: 2 });
        this.addItem({ id: 'helmet', count: 1 });
        this.addItem({ id: 'vest', count: 1 });
        this.addItem({ id: 'boots', count: 1 });
        this.addItem({ id: 'watch', count: 1 });
        this.addItem({ id: 'scope_2x', count: 1 });
        this.addItem({ id: 'scope_4x', count: 1 });
        this.addItem({ id: 'laser_sight', count: 1 });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (!this.isOpen) {
            if (this.heldItem) {
                if (!this.addItem(this.heldItem)) {
                    // Drop ground TBD
                }
                this.heldItem = null;
            }
            this.hoveredSlotInfo = null;
        }
    }

    addItem(item) {
        const itemDef = this.getItemDef(item.id);
        const isStackable = itemDef && itemDef.type === 'consumable';

        // 1. Try to stack if it's consumable
        if (isStackable) {
            // Check storage
            for (let i = 0; i < this.slots; i++) {
                if (this.items[i] && this.items[i].id === item.id && this.items[i].count < 99) {
                    const addAmount = Math.min(item.count, 99 - this.items[i].count);
                    this.items[i].count += addAmount;
                    item.count -= addAmount;
                    if (item.count <= 0) return true;
                }
            }
            // Check hotbar
            for (let i = 0; i < this.hotbarSlots; i++) {
                if (this.hotbar[i] && this.hotbar[i].id === item.id && this.hotbar[i].count < 99) {
                    const addAmount = Math.min(item.count, 99 - this.hotbar[i].count);
                    this.hotbar[i].count += addAmount;
                    item.count -= addAmount;
                    if (item.count <= 0) return true;
                }
            }
        }

        // 2. Find empty slot if still has count
        for (let i = 0; i < this.slots; i++) {
            if (!this.items[i]) {
                // Initialize weapon ammo if pickup
                if (itemDef && itemDef.type === 'weapon') {
                    item.ammo = itemDef.magSize;
                    item.totalAmmo = itemDef.magSize * 4;
                    item.attachments = { optic: null, barrel: null, underbarrel: null };
                }
                this.items[i] = item;
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
                item.totalAmmo = itemDef.magSize * 4;
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

            return;
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
            if (input.wheel > 0) {
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

        if (item && item.attachments?.optic) {
            const opticDef = this.getItemDef(item.attachments.optic.id);
            if (opticDef && opticDef.zoom) {
                targetZoom = 0.8 / opticDef.zoom;
            }
        }

        // Smooth zoom
        this.game.zoom += (targetZoom - this.game.zoom) * 0.1;
        this.game.resize(); // Trigger camera recalculation
    }

    handleInputRightClick(mx, my) {
        const layout = this.getLayout();
        // Check if we right-clicked an attachment in storage/hotbar to attach it to held weapon
        const checkSlots = [
            ...layout.storage.map((r, i) => ({ r, i, type: 'storage' })),
            ...layout.hotbar.map((r, i) => ({ r, i, type: 'hotbar' }))
        ];

        for (const slot of checkSlots) {
            if (this.pointInRect(mx, my, slot.r)) {
                const item = slot.type === 'storage' ? this.items[slot.i] : this.hotbar[slot.i];
                if (!item) continue;

                const itemDef = this.getItemDef(item.id);
                if (itemDef && itemDef.type === 'attachment') {
                    this.tryAttach(item, slot.type, slot.i);
                    return;
                }
            }
        }
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

        const item = this.getSelectedItem();
        if (!item) return;

        const itemDef = this.getItemDef(item.id);
        if (!itemDef || itemDef.type !== 'weapon') return;

        const needed = itemDef.magSize - (item.ammo || 0);
        if (needed <= 0 || item.totalAmmo <= 0) return;

        this.isReloading = true;
        this.reloadTimer = itemDef.reloadTime || 1.0;
        this.reloadingItemIdx = this.selectedSlot;
        console.log(`Starting reload for ${itemDef.name}...`);
    }

    completeReload() {
        if (!this.isReloading) return;

        const item = this.hotbar[this.reloadingItemIdx];
        if (item) {
            const itemDef = this.getItemDef(item.id);
            if (itemDef) {
                const needed = itemDef.magSize - (item.ammo || 0);
                const reloadAmount = Math.min(needed, item.totalAmmo);
                item.ammo = (item.ammo || 0) + reloadAmount;
                item.totalAmmo -= reloadAmount;
                console.log(`Reloaded ${itemDef.name}. Ammo: ${item.ammo}/${item.totalAmmo}`);
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

        // Check storage
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

        // 1. Storage slots
        for (let i = 0; i < this.slots; i++) {
            const rect = layout.storage[i];
            if (this.pointInRect(mx, my, rect)) {
                if (isShift && this.items[i]) {
                    this.handleQuickMove('storage', i);
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

        if (!item) return;
        const itemDef = this.getItemDef(item.id);
        if (!itemDef) return;

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
    }

    getItemDef(itemId) {
        return this.game.assetManager.getData('items')?.find(it => it.id === itemId);
    }

    pointInRect(px, py, rect) {
        return px >= rect.x && px <= rect.x + rect.size && py >= rect.y && py <= rect.y + rect.size;
    }

    getLayout() {
        const cols = 8;
        const slotSize = 50; // Optimized for small screens
        const padding = 8;
        const winW = (slotSize + padding) * cols + padding + 40;
        const winH = 580; // Optimized height
        const winX = (this.game.canvas.width - winW) / 2;
        const winY = (this.game.canvas.height - winH) / 2;

        const layout = {
            win: { x: winX, y: winY, w: winW, h: winH },
            preview: { x: winX + 25, y: winY + 60, w: 180, h: 180 },
            equipment: {},
            storage: [],
            hotbar: []
        };

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

        const storageStartY = layout.preview.y + layout.preview.h + 30;
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
        const item = this.hotbar[slotIndex];
        if (!item) return;

        const itemDef = this.getItemDef(item.id);
        if (!itemDef) return;

        if (itemDef.id === 'medkit' && item.count > 0) {
            // Heal player
            const player = this.game.player;
            if (player.health < player.maxHealth) {
                player.health = Math.min(player.maxHealth, player.health + 200);
                item.count--;
                if (item.count <= 0) this.hotbar[slotIndex] = null;
                console.log("Used Medkit! Health:", player.health);
                return true;
            }
        }
        return false;
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

        // Storage
        ctx.fillStyle = '#aaa';
        ctx.font = '12px Arial';
        ctx.fillText("Storage", win.x + 25, storage[0].y - 10);
        storage.forEach((rect, i) => {
            this.drawSlot(ctx, rect, this.items[i], false);
        });

        // Hotbar
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
        const titleHeight = 25;
        const typeHeight = 20;
        const w = 180;
        const h = titleHeight + typeHeight + padding * 2;

        // Position near slot, but keep inside canvas
        let tx = info.x + info.size + 10;
        let ty = info.y;
        if (tx + w > this.game.canvas.width) tx = info.x - w - 10;
        if (ty + h > this.game.canvas.height) ty = this.game.canvas.height - h - 10;

        // Shadow/BG
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tx, ty, w, h);
        ctx.strokeStyle = itemDef.color || '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, w, h);

        // Name
        ctx.fillStyle = itemDef.color || '#fff';
        ctx.font = 'bold 15px Arial';
        ctx.fillText(itemDef.name, tx + padding, ty + padding + 15);

        // Type
        ctx.fillStyle = '#aaa';
        ctx.font = 'italic 11px Arial';
        ctx.fillText(itemDef.type.toUpperCase(), tx + padding, ty + padding + 35);

        let currentY = ty + padding + 55;

        // Description
        if (itemDef.description) {
            ctx.fillStyle = '#eee';
            ctx.font = '12px Arial';
            // Simple word wrap
            const words = itemDef.description.split(' ');
            let line = '';
            for (const word of words) {
                if (ctx.measureText(line + word).width > w - padding * 2) {
                    ctx.fillText(line, tx + padding, currentY);
                    line = word + ' ';
                    currentY += 15;
                } else {
                    line += word + ' ';
                }
            }
            ctx.fillText(line, tx + padding, currentY);
            currentY += 20;
        }

        // Stats
        if (itemDef.type === 'weapon') {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`Damage: ${itemDef.damage || 1}`, tx + padding, currentY);
            currentY += 15;
            ctx.fillText(`Fire Rate: ${itemDef.fireRate || 0.2}s`, tx + padding, currentY);
            currentY += 15;
        }

        // Adjust background height (Redraw)
        const finalH = currentY - ty + padding;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(tx, ty, w, finalH);
        ctx.strokeStyle = itemDef.color || '#fff';
        ctx.strokeRect(tx, ty, w, finalH);

        // Redraw text over background
        ctx.fillStyle = itemDef.color || '#fff';
        ctx.font = 'bold 15px Arial';
        ctx.fillText(itemDef.name, tx + padding, ty + padding + 15);
        ctx.fillStyle = '#aaa';
        ctx.font = 'italic 11px Arial';
        ctx.fillText(itemDef.type.toUpperCase(), tx + padding, ty + padding + 35);

        currentY = ty + padding + 55;
        if (itemDef.description) {
            ctx.fillStyle = '#eee';
            ctx.font = '12px Arial';
            const words = itemDef.description.split(' ');
            let line = '';
            for (const word of words) {
                if (ctx.measureText(line + word).width > w - padding * 2) {
                    ctx.fillText(line, tx + padding, currentY);
                    line = word + ' ';
                    currentY += 15;
                } else {
                    line += word + ' ';
                }
            }
            ctx.fillText(line, tx + padding, currentY);
            currentY += 20;
        }
        if (itemDef.type === 'weapon') {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(`Damage: ${itemDef.damage || 1}`, tx + padding, currentY);
            currentY += 15;
            ctx.fillText(`Fire Rate: ${itemDef.fireRate || 0.2}s`, tx + padding, currentY);
        }
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

    renderAmmoHUD(ctx) {
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

        // Ammo Numbers
        ctx.fillStyle = '#fff';
        const ammoStr = `${item.ammo || 0}`;
        const totalStr = ` / ${item.totalAmmo || 0}`;

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
            if (item.ammo === 0 && item.totalAmmo > 0) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'italic 14px Arial';
                ctx.fillText("PRESS 'R' TO RELOAD", x, y + 20);
            }
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
