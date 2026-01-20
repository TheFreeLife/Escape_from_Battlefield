export default class MapEditor {
    constructor(game) {
        this.game = game;
        this.baseTileSize = 40;
        this.zoom = 1.0;
        this.offsetX = 100;
        this.offsetY = 100;
        this.lastMousePos = { x: 0, y: 0 };
        this.tiles = new Map(); 
        this.selectedTileId = 'grass';
        this.selectedTool = 'pen';
        this.activeLayer = 'floor';
        this.rectStart = null;
        this.isDrawing = false;
        this.init();
    }

    init() {
        const shapeMainBtn = document.getElementById('tool-shape-main');
        const shapeSubPalette = document.getElementById('shape-sub-palette');

        ['pen', 'eraser', 'fill'].forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) btn.addEventListener('click', () => this.selectTool(tool));
        });

        shapeMainBtn.addEventListener('click', () => {
            shapeSubPalette.classList.toggle('hidden');
        });

        ['rect', 'circle', 'triangle'].forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) btn.addEventListener('click', () => {
                this.selectTool(tool);
                shapeMainBtn.innerText = btn.innerText;
                shapeSubPalette.classList.add('hidden');
            });
        });

        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.layer-btn').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                this.activeLayer = btn.dataset.layer;
                this.updatePaletteFilter();
            });
        });

        document.getElementById('unit-settings-save').addEventListener('click', () => this.saveUnitSettings());
        document.getElementById('unit-settings-cancel').addEventListener('click', () => this.closeUnitSettings());
        document.getElementById('unit-settings-delete').addEventListener('click', () => this.deleteUnit());
        document.getElementById('add-loot-entry-btn').addEventListener('click', () => this.addLootEntry());
        document.getElementById('loot-settings-save').addEventListener('click', () => this.saveLootSettings());
        document.getElementById('loot-settings-cancel').addEventListener('click', () => this.closeLootSettings());

        this.updatePaletteFilter();
        document.getElementById('export-btn').addEventListener('click', () => this.exportArray());
        document.getElementById('import-btn').addEventListener('click', () => this.importArray());
        document.getElementById('test-editor-btn').addEventListener('click', () => this.testCurrentStructure());
        document.getElementById('clear-editor-btn').addEventListener('click', () => {
            if(confirm("정말 모든 타일을 삭제하시겠습니까?")) this.tiles.clear();
        });
    }

    getUnitSize(id) {
        if (id === 'v_tank') return { w: 2, h: 2 };
        if (id === 'v_apc') return { w: 2, h: 2 };
        if (id === 'v_truck') return { w: 2, h: 2 };
        return { w: 1, h: 1 };
    }

    selectTool(tool) {
        document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(el => el.classList.remove('selected'));
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) btn.classList.add('selected');
        if (['rect', 'circle', 'triangle'].includes(tool)) {
            document.getElementById('tool-shape-main').classList.add('selected');
        }
        this.selectedTool = tool;
    }

    updatePaletteFilter() {
        const palette = document.getElementById('tile-palette');
        if (!palette) return;
        palette.innerHTML = '';
        
        if (this.activeLayer === 'units') {
            const enemies = this.game.assetManager.getData('enemies') || [];
            enemies.forEach(enemy => {
                const div = document.createElement('div');
                div.className = 'palette-tile';
                if (enemy.id === this.selectedTileId) div.classList.add('selected');
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 50; previewCanvas.height = 50;
                const pCtx = previewCanvas.getContext('2d');
                pCtx.fillStyle = enemy.color || '#e74c3c';
                pCtx.beginPath(); pCtx.arc(25, 25, 15, 0, Math.PI * 2); pCtx.fill();
                div.appendChild(previewCanvas);
                div.title = enemy.name;
                div.addEventListener('click', () => this.selectTile(enemy.id, div));
                palette.appendChild(div);
            });

            const vehicleTypes = [
                { id: 'v_truck', name: '군용 트럭', color: '#4b5320' },
                { id: 'v_tank', name: '전차 (Tank)', color: '#1e8449' },
                { id: 'v_apc', name: '장갑차 (APC)', color: '#34495e' }
            ];
            vehicleTypes.forEach(v => {
                const div = document.createElement('div');
                div.className = 'palette-tile';
                if (v.id === this.selectedTileId) div.classList.add('selected');
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 50; previewCanvas.height = 50;
                const pCtx = previewCanvas.getContext('2d');
                pCtx.fillStyle = v.color; pCtx.fillRect(10, 15, 30, 20);
                div.appendChild(previewCanvas);
                div.title = v.name;
                div.addEventListener('click', () => this.selectTile(v.id, div));
                palette.appendChild(div);
            });
        } else if (this.activeLayer === 'items') {
            const items = this.game.assetManager.getData('items') || [];
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'palette-tile';
                if (item.id === this.selectedTileId) div.classList.add('selected');
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 50; previewCanvas.height = 50;
                const pCtx = previewCanvas.getContext('2d');
                const itemImg = this.game.assetManager.get(item.id);
                if (itemImg) pCtx.drawImage(itemImg, 5, 5, 40, 40);
                else { pCtx.fillStyle = item.color || '#f1c40f'; pCtx.fillRect(10, 10, 30, 30); }
                div.appendChild(previewCanvas);
                div.title = item.name;
                div.addEventListener('click', () => this.selectTile(item.id, div));
                palette.appendChild(div);
            });
        } else {
            const tiles = this.game.assetManager.getData('tiles') || [];
            const filtered = tiles.filter(t => t.layer === this.activeLayer);
            filtered.forEach(tile => {
                const div = document.createElement('div');
                div.className = 'palette-tile';
                if (tile.id === this.selectedTileId) div.classList.add('selected');
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 50; previewCanvas.height = 50;
                const pCtx = previewCanvas.getContext('2d');
                const tileImg = this.game.assetManager.get(tile.id);
                if (tileImg) pCtx.drawImage(tileImg, 0, 0, 50, 50);
                else { pCtx.fillStyle = tile.color || '#333'; pCtx.fillRect(0, 0, 50, 50); }
                div.appendChild(previewCanvas);
                div.title = tile.name;
                div.addEventListener('click', () => this.selectTile(tile.id, div));
                palette.appendChild(div);
            });
        }
    }

    selectTile(id, element) {
        document.querySelectorAll('.palette-tile').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedTileId = id;
        if (this.selectedTool === 'eraser') this.selectTool('pen');
    }

    getTileAt(x, y) {
        return this.tiles.get(`${x},${y}`) || { floor: null, block: null, unit: null, item: null, metadata: null };
    }

    setTileAt(x, y, tileId, layer, phase = 'start') {
        const key = `${x},${y}`;
        const cell = this.tiles.get(key) || { floor: null, block: null, unit: null, item: null, metadata: null };
        
        if (layer === 'units') {
            if (tileId === null) {
                if (cell.unit && (cell.unit.id.startsWith('v_') || cell.unit.id === 'occupied_space')) {
                    const masterKey = cell.unit.id === 'occupied_space' ? cell.unit.master : key;
                    const [mx, my] = masterKey.split(',').map(Number);
                    const masterCell = this.tiles.get(masterKey);
                    if (masterCell && masterCell.unit) {
                        const { w, h } = this.getUnitSize(masterCell.unit.id);
                        for (let oy = 0; oy < h; oy++) {
                            for (let ox = 0; ox < w; ox++) {
                                const tKey = `${mx + ox},${my + oy}`;
                                const tCell = this.tiles.get(tKey);
                                if (tCell) {
                                    tCell.unit = null;
                                    if (tCell.floor === null && tCell.block === null && tCell.unit === null && tCell.item === null) this.tiles.delete(tKey);
                                }
                            }
                        }
                    }
                    return;
                }
                cell.unit = null;
            } else {
                const { w, h } = this.getUnitSize(tileId);
                if (w > 1 || h > 1) {
                    if (phase !== 'start') return;
                    let occupied = false;
                    for (let oy = 0; oy < h; oy++) {
                        for (let ox = 0; ox < w; ox++) {
                            const tCell = this.getTileAt(x + ox, y + oy);
                            if (tCell.unit && tCell.unit.id !== null) {
                                if (tCell.unit.id !== 'occupied_space' || tCell.unit.master !== key) occupied = true;
                            }
                        }
                    }
                    if (occupied) { if (!confirm("겹치는 유닛이 있습니다. 덮어씌우시겠습니까?")) return; }
                    for (let oy = 0; oy < h; oy++) {
                        for (let ox = 0; ox < w; ox++) {
                            const tKey = `${x + ox},${y + oy}`;
                            const tCell = this.tiles.get(tKey) || { floor: null, block: null, unit: null, item: null, metadata: null };
                            if (ox === 0 && oy === 0) tCell.unit = { id: tileId, w, h };
                            else tCell.unit = { id: 'occupied_space', master: key };
                            this.tiles.set(tKey, tCell);
                        }
                    }
                    return;
                } else {
                    if (cell.unit && cell.unit.id === 'occupied_space') return; 
                    cell.unit = { id: tileId, command: 'GUARD', patrolRadius: 250, healthMult: 1.0, damageMult: 1.0, speedMult: 1.0 };
                }
            }
        } else if (layer === 'items') {
            cell.item = tileId;
        } else {
            cell[layer] = tileId;
            if (layer === 'block' && tileId === 'loot_box' && !cell.metadata) cell.metadata = { lootTable: [] };
        }
        if (cell.floor === null && cell.block === null && cell.unit === null && cell.item === null) this.tiles.delete(key);
        else this.tiles.set(key, cell);
    }

    openLootSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (cell.block !== 'loot_box') return;
        this.editingLootPos = { x: gx, y: gy };
        const list = document.getElementById('loot-entries-list');
        list.innerHTML = '';
        document.getElementById('loot-box-settings-modal').classList.remove('hidden');
        const lootTable = cell.metadata?.lootTable || [];
        lootTable.forEach(entry => this.addLootEntry(entry.id, entry.chance));
        if (lootTable.length === 0) this.addLootEntry('', 100);
    }

    addLootEntry(selectedId = '', chance = 100) {
        const list = document.getElementById('loot-entries-list');
        const div = document.createElement('div');
        div.className = 'loot-entry';
        const items = this.game.assetManager.getData('items') || [];
        let optionsHtml = '<option value="">-- 아이템 선택 --</option>';
        items.forEach(item => { optionsHtml += `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.name} (${item.id})</option>`; });
        div.innerHTML = `<select class="loot-item-id">${optionsHtml}</select><input type="number" class="loot-item-chance" value="${chance}" min="0" max="100"><button class="remove-entry-btn">×</button>`;
        div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
        list.appendChild(div);
    }

    saveLootSettings() {
        if (!this.editingLootPos) return;
        const cell = this.getTileAt(this.editingLootPos.x, this.editingLootPos.y);
        const lootTable = [];
        document.querySelectorAll('.loot-entry').forEach(div => {
            const id = div.querySelector('.loot-item-id').value.trim();
            const chance = parseInt(div.querySelector('.loot-item-chance').value);
            if (id) lootTable.push({ id, chance });
        });
        cell.metadata = { ...cell.metadata, lootTable };
        this.closeLootSettings();
    }

    closeLootSettings() { document.getElementById('loot-box-settings-modal').classList.add('hidden'); this.editingLootPos = null; }

    openUnitSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (!cell.unit) return;
        this.editingUnitPos = { x: gx, y: gy };
        document.getElementById('unit-settings-modal').classList.remove('hidden');
        document.getElementById('unit-command').value = cell.unit.command || 'GUARD';
        document.getElementById('unit-patrol-radius').value = cell.unit.patrolRadius || 250;
        document.getElementById('unit-health-mult').value = cell.unit.healthMult || 1.0;
        document.getElementById('unit-damage-mult').value = cell.unit.damageMult || 1.0;
        document.getElementById('unit-speed-mult').value = cell.unit.speedMult || 1.0;
    }

    saveUnitSettings() {
        if (!this.editingUnitPos) return;
        const cell = this.getTileAt(this.editingUnitPos.x, this.editingUnitPos.y);
        if (cell.unit) {
            cell.unit.command = document.getElementById('unit-command').value;
            cell.unit.patrolRadius = parseInt(document.getElementById('unit-patrol-radius').value);
            cell.unit.healthMult = parseFloat(document.getElementById('unit-health-mult').value);
            cell.unit.damageMult = parseFloat(document.getElementById('unit-damage-mult').value);
            cell.unit.speedMult = parseFloat(document.getElementById('unit-speed-mult').value);
        }
        this.closeUnitSettings();
    }

    closeUnitSettings() { document.getElementById('unit-settings-modal').classList.add('hidden'); this.editingUnitPos = null; }
    deleteUnit() { if (!this.editingUnitPos) return; this.setTileAt(this.editingUnitPos.x, this.editingUnitPos.y, null, 'units'); this.closeUnitSettings(); }

    update(dt) {
        if (this.game.gameState !== 'EDITOR') return;
        const unitModal = document.getElementById('unit-settings-modal');
        const lootModal = document.getElementById('loot-box-settings-modal');
        const isModalOpen = (unitModal && !unitModal.classList.contains('hidden')) || (lootModal && !lootModal.classList.contains('hidden'));
        const input = this.game.input; const mx = input.mouse.x; const my = input.mouse.y;
        const ts = this.baseTileSize * this.zoom;
        const gx = Math.floor((mx - this.offsetX) / ts); const gy = Math.floor((my - this.offsetY) / ts);
        let isOverUI = mx > this.game.canvas.width - 300;
        if (isModalOpen) {
            const activeModal = !unitModal.classList.contains('hidden') ? unitModal : lootModal;
            const rect = activeModal.getBoundingClientRect();
            if (mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom) isOverUI = true;
        }
        if (input.mouse.rightDown && !isOverUI) {
            const dx = mx - this.lastMousePos.x; const dy = my - this.lastMousePos.y;
            this.offsetX += dx; this.offsetY += dy;
            this.rightClickMoveDist = (this.rightClickMoveDist || 0) + Math.sqrt(dx*dx + dy*dy);
        } else if (this.lastRightDown && !input.mouse.rightDown && !isOverUI && !isModalOpen) {
            if ((this.rightClickMoveDist || 0) < 5) {
                const cell = this.getTileAt(gx, gy);
                if (cell.unit && !cell.unit.id.startsWith('v_')) this.openUnitSettings(gx, gy);
                else if (cell.block === 'loot_box') this.openLootSettings(gx, gy);
            }
            this.rightClickMoveDist = 0;
        }
        this.lastRightDown = input.mouse.rightDown; this.lastMousePos = { x: mx, y: my };
        if (input.wheel !== 0 && !isOverUI) {
            const oldZoom = this.zoom;
            this.zoom = Math.max(0.2, Math.min(5.0, this.zoom + (input.wheel > 0 ? -0.1 : 0.1)));
            const factor = this.zoom / oldZoom;
            this.offsetX = mx - (mx - this.offsetX) * factor; this.offsetY = my - (my - this.offsetY) * factor;
        }
        if (input.mouse.leftDown && !isOverUI && !isModalOpen) {
            const phase = !this.isDrawing ? 'start' : 'drag';
            this.handleToolAction(gx, gy, phase);
            this.isDrawing = true;
        } else { if (this.isDrawing) this.handleToolAction(gx, gy, 'end'); this.isDrawing = false; }
    }

    handleToolAction(gx, gy, phase) {
        const tileId = this.selectedTool === 'eraser' ? null : this.selectedTileId;
        const layer = this.activeLayer;
        switch (this.selectedTool) {
            case 'pen': case 'eraser': this.setTileAt(gx, gy, tileId, layer, phase); break;
            case 'fill': if (phase === 'start') this.floodFill(gx, gy, this.getTileAt(gx, gy)[layer], tileId, layer); break;
            case 'rect': case 'circle': case 'triangle':
                if (phase === 'start') this.rectStart = { x: gx, y: gy };
                else if (phase === 'end' && this.rectStart) {
                    const x1 = Math.min(this.rectStart.x, gx), x2 = Math.max(this.rectStart.x, gx);
                    const y1 = Math.min(this.rectStart.y, gy), y2 = Math.max(this.rectStart.y, gy);
                    for (let y = y1; y <= y2; y++) {
                        for (let x = x1; x <= x2; x++) {
                            if (this.selectedTool === 'rect') this.setTileAt(x, y, tileId, layer);
                            else if (this.selectedTool === 'circle') {
                                const cx = (x1+x2)/2, cy = (y1+y2)/2, rx = (x2-x1)/2, ry = (y2-y1)/2;
                                if (((x-cx)**2)/(rx**2||1) + ((y-cy)**2)/(ry**2||1) <= 1.1) this.setTileAt(x, y, tileId, layer);
                            } else {
                                const normY = (y-y1)/(y2-y1||1), width = normY*(x2-x1), cx = (x1+x2)/2;
                                if (Math.abs(x-cx) <= width/2+0.5) this.setTileAt(x, y, tileId, layer);
                            }
                        }
                    }
                    this.rectStart = null;
                } break;
        }
    }

    floodFill(startX, startY, targetId, replacementId, layer) {
        if (targetId === replacementId) return;
        const queue = [{ x: startX, y: startY }], seen = new Set();
        let count = 0;
        while (queue.length > 0 && count++ < 2500) {
            const { x, y } = queue.shift(); const key = `${x},${y}`;
            if (seen.has(key)) continue; seen.add(key);
            if (this.getTileAt(x, y)[layer] === targetId) {
                this.setTileAt(x, y, replacementId, layer);
                queue.push({x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1});
            }
        }
    }

    exportArray() {
        if (this.tiles.size === 0) { alert("배치된 타일이 없습니다."); return; }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.tiles.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        });
        const cropped = [];
        for(let y = minY; y <= maxY; y++) {
            const row = [];
            for(let x = minX; x <= maxX; x++) {
                const c = this.getTileAt(x, y);
                row.push([c.floor, c.block, (c.unit && (c.unit.id === 'occupied_space' || c.unit.id === 'v_reserved')) ? null : c.unit, c.item, c.metadata]);
            }
            cropped.push(row);
        }
        document.getElementById('export-output').value = JSON.stringify(cropped).replace(/]]],\[\[/g, ']],\n    [[').replace('[[[', '[\n    [[') .replace(']]]', ']]\n]');
    }

    importArray() {
        const input = document.getElementById('export-output').value.trim();
        if (!input) return;
        try {
            const data = JSON.parse(input);
            if (confirm("현재 작업 중인 타일들이 모두 삭제됩니다. 계속하시겠습니까?")) {
                this.tiles.clear();
                data.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        const [floor, block, unit, item, metadata] = cell;
                        if (floor || block || unit || item) {
                            const size = unit ? this.getUnitSize(unit.id) : { w: 1, h: 1 };
                            if (size.w > 1 || size.h > 1) {
                                for (let oy = 0; oy < size.h; oy++) {
                                    for (let ox = 0; ox < size.w; ox++) {
                                        const tKey = `${x + ox},${y + oy}`;
                                        const tCell = this.tiles.get(tKey) || { floor: null, block: null, unit: null, item: null, metadata: null };
                                        if (ox === 0 && oy === 0) { unit.w = size.w; unit.h = size.h; tCell.unit = unit; }
                                        else tCell.unit = { id: 'occupied_space', master: `${x},${y}` };
                                        this.tiles.set(tKey, tCell);
                                    }
                                }
                            } else {
                                const existing = this.tiles.get(`${x},${y}`) || { floor: null, block: null, unit: null, item: null, metadata: null };
                                existing.floor = floor; existing.block = block; existing.metadata = metadata; existing.item = item;
                                if (!existing.unit || existing.unit.id !== 'occupied_space') existing.unit = unit;
                                this.tiles.set(`${x},${y}`, existing);
                            }
                        }
                    });
                });
                console.log("Import complete.");
            }
        } catch (e) { alert("가져오기 실패: " + e.message); }
    }

    testCurrentStructure() {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.tiles.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        });
        const layout = [];
        for(let y = minY; y <= maxY; y++) {
            const row = [];
            for(let x = minX; x <= maxX; x++) {
                const c = this.getTileAt(x, y);
                row.push([c.floor, c.block, (c.unit && (c.unit.id === 'occupied_space' || c.unit.id === 'v_reserved')) ? null : c.unit, c.item, c.metadata]);
            }
            layout.push(row);
        }
        this.game.startTestMode(layout);
    }

    render(ctx) {
        if (this.game.gameState !== 'EDITOR') return;
        const ts = this.baseTileSize * this.zoom;
        const enemiesData = this.game.assetManager.getData('enemies') || [];
        const itemsData = this.game.assetManager.getData('items') || [];
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        const startGX = Math.floor(-this.offsetX / ts), endGX = Math.ceil((this.game.canvas.width - this.offsetX) / ts);
        const startGY = Math.floor(-this.offsetY / ts), endGY = Math.ceil((this.game.canvas.height - this.offsetY) / ts);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.beginPath();
        for (let x = startGX; x <= endGX; x++) { const vx = this.offsetX + x * ts; ctx.moveTo(vx, 0); ctx.lineTo(vx, this.game.canvas.height); }
        for (let y = startGY; y <= endGY; y++) { const vy = this.offsetY + y * ts; ctx.moveTo(0, vy); ctx.lineTo(this.game.canvas.width, vy); }
        ctx.stroke();

        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts, ty = this.offsetY + gy * ts;
            if (cell.floor) {
                const img = this.game.assetManager.get(cell.floor);
                if (img) ctx.drawImage(img, tx, ty, ts, ts);
                else { ctx.fillStyle = '#333'; ctx.fillRect(tx, ty, ts, ts); }
            }
            if (cell.block) {
                const img = this.game.assetManager.get(cell.block);
                if (img) ctx.drawImage(img, tx, ty, ts, ts);
                else { ctx.fillStyle = '#555'; ctx.fillRect(tx, ty, ts, ts); }
            }
            if (cell.item) {
                const img = this.game.assetManager.get(cell.item);
                if (img) ctx.drawImage(img, tx+ts*0.2, ty+ts*0.2, ts*0.6, ts*0.6);
                else { ctx.fillStyle = '#f1c40f'; ctx.fillRect(tx+ts*0.25, ty+ts*0.25, ts*0.5, ts*0.5); }
            }
            if (cell.unit) {
                if (cell.unit.id === 'occupied_space' || cell.unit.id === 'v_reserved') return;
                if (cell.unit.id.startsWith('v_')) {
                    const size = this.getUnitSize(cell.unit.id);
                    ctx.fillStyle = cell.unit.id === 'v_tank' ? '#1e8449' : (cell.unit.id === 'v_apc' ? '#34495e' : '#4b5320');
                    ctx.fillRect(tx + ts*0.1, ty + ts*0.1, ts * size.w - ts*0.2, ts * size.h - ts*0.2);
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(tx + ts*0.1, ty + ts*0.1, ts * size.w - ts*0.2, ts * size.h - ts*0.2);
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(10, ts * 0.3)}px Arial`; ctx.textAlign = 'center';
                    ctx.fillText(cell.unit.id.replace('v_', '').toUpperCase(), tx + (ts * size.w)/2, ty + (ts * size.h)/2 + 5);
                } else {
                    const def = enemiesData.find(e => e.id === cell.unit.id);
                    ctx.fillStyle = def ? def.color : '#e74c3c';
                    ctx.beginPath(); ctx.arc(tx + ts/2, ty + ts/2, ts * 0.35, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, ts * 0.2)}px Arial`; ctx.textAlign = 'center';
                    ctx.fillText(cell.unit.command, tx + ts/2, ty + ts * 0.85);
                }
            }
        });
    }
}