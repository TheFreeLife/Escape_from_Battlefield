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

        // Test Items
        this.addHotbarItem({ id: 'rifle', count: 1 }, 0);
        this.addHotbarItem({ id: 'medkit', count: 5 }, 1);
        this.addItem({ id: 'medkit', count: 2 });
        this.addItem({ id: 'helmet', count: 1 });
        this.addItem({ id: 'vest', count: 1 });
        this.addItem({ id: 'boots', count: 1 });
        this.addItem({ id: 'watch', count: 1 });
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
                this.items[i] = item;
                return true;
            }
        }
        return false;
    }

    addHotbarItem(item, slot) {
        if (slot >= 0 && slot < this.hotbarSlots) {
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
            return;
        }

        for (let i = 0; i < this.hotbarSlots; i++) {
            if (input.isKeyPressed(`Digit${i + 1}`)) {
                this.selectedSlot = i;
            }
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

        // 1. Storage slots (No restrictions)
        for (let i = 0; i < this.slots; i++) {
            const rect = layout.storage[i];
            if (this.pointInRect(mx, my, rect)) {
                const temp = this.items[i];
                this.items[i] = this.heldItem;
                this.heldItem = temp;
                return;
            }
        }

        // 2. Hotbar slots (No restrictions)
        for (let i = 0; i < this.hotbarSlots; i++) {
            const rect = layout.hotbar[i];
            if (this.pointInRect(mx, my, rect)) {
                const temp = this.hotbar[i];
                this.hotbar[i] = this.heldItem;
                this.heldItem = temp;
                return;
            }
        }

        // 3. Equipment slots (Strict type/slot check)
        for (const slotKey in layout.equipment) {
            const rect = layout.equipment[slotKey];
            if (this.pointInRect(mx, my, rect)) {
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
        ctx.font = 'bold 14px Arial';
        ctx.fillText(itemDef.name, tx + padding, ty + padding + 15);

        // Type
        ctx.fillStyle = '#aaa';
        ctx.font = 'italic 11px Arial';
        ctx.fillText(itemDef.type.toUpperCase(), tx + padding, ty + padding + 35);
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
