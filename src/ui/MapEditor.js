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

            const palette = document.getElementById('tile-palette');

            const tiles = this.game.assetManager.getData('tiles') || [];

            

            // Tool selection (Basic)

            ['pen', 'eraser', 'fill'].forEach(tool => {

                const btn = document.getElementById(`tool-${tool}`);

                if (btn) btn.addEventListener('click', () => this.selectTool(tool));

            });

    

            // Shape Tool Logic

            const shapeMainBtn = document.getElementById('tool-shape-main');

            const shapeSubPalette = document.getElementById('shape-sub-palette');

            

            shapeMainBtn.addEventListener('click', () => {

                shapeSubPalette.classList.toggle('hidden');

            });

    

                    ['rect', 'circle', 'triangle'].forEach(tool => {

    

                        const btn = document.getElementById(`tool-${tool}`);

    

                        if (btn) btn.addEventListener('click', () => {

    

                            this.selectTool(tool);

    

                            // Update main button icon to match selected shape

    

                            shapeMainBtn.innerText = btn.innerText;

    

                            shapeSubPalette.classList.add('hidden');

    

                        });

    

                    });

    

            

    

                    // Layer Selection via Button Group

    

                    document.querySelectorAll('.layer-btn').forEach(btn => {

    

                        btn.addEventListener('click', () => {

    

                            // UI update

    

                            document.querySelectorAll('.layer-btn').forEach(el => el.classList.remove('active'));

    

                            btn.classList.add('active');

    

                            

    

                            // Logic update

    

                            this.activeLayer = btn.dataset.layer;

    

                            this.updatePaletteFilter();

    

                        });

    

                    });

    

            

    

                    // Unit Settings Modal Events
        document.getElementById('unit-settings-save').addEventListener('click', () => this.saveUnitSettings());
        document.getElementById('unit-settings-cancel').addEventListener('click', () => this.closeUnitSettings());
        document.getElementById('unit-settings-delete').addEventListener('click', () => this.deleteUnit());

        // Loot Box Settings Modal Events
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

    selectTool(tool) {
        // Clear all selected states
        document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(el => el.classList.remove('selected'));
        
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) btn.classList.add('selected');
        
        // If it's a shape, also highlight the main shape button
        if (['rect', 'circle', 'triangle'].includes(tool)) {
            document.getElementById('tool-shape-main').classList.add('selected');
        }
        
        this.selectedTool = tool;
    }

    updatePaletteFilter() {
        const palette = document.getElementById('tile-palette');
        if (!palette) return;
        palette.innerHTML = '';
        
        // 1. Units Layer: Fetch from enemies.json via AssetManager
        if (this.activeLayer === 'units') {
            const enemies = this.game.assetManager.getData('enemies') || [];
            enemies.forEach(enemy => {
                const div = document.createElement('div');
                div.className = 'palette-tile';
                if (enemy.id === this.selectedTileId) div.classList.add('selected');
                
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 50; previewCanvas.height = 50;
                const pCtx = previewCanvas.getContext('2d');
                
                // Use enemy color for preview
                pCtx.fillStyle = enemy.color || '#e74c3c';
                pCtx.beginPath();
                pCtx.arc(25, 25, 15, 0, Math.PI * 2);
                pCtx.fill();
                
                div.appendChild(previewCanvas);
                div.title = enemy.name;
                div.addEventListener('click', () => {
                    this.selectTile(enemy.id, div);
                });
                palette.appendChild(div);
            });
        } 
        // 2. Items Layer: Fetch from allItems (AssetManager.data.items)
        else if (this.activeLayer === 'items') {
            const items = this.game.assetManager.getData('items') || [];
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'palette-tile';
                if (item.id === this.selectedTileId) div.classList.add('selected');
                
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 50; previewCanvas.height = 50;
                const pCtx = previewCanvas.getContext('2d');
                
                // Render item sprite from AssetManager cache
                const itemImg = this.game.assetManager.get(item.id);
                if (itemImg) {
                    pCtx.drawImage(itemImg, 5, 5, 40, 40);
                } else {
                    pCtx.fillStyle = item.color || '#f1c40f';
                    pCtx.fillRect(10, 10, 30, 30);
                }
                
                div.appendChild(previewCanvas);
                div.title = item.name;
                div.addEventListener('click', () => {
                    this.selectTile(item.id, div);
                });
                palette.appendChild(div);
            });
        } 
        // 3. Tile Layers (Floor/Block): Fetch from tiles.json
        else {
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
                if (tileImg) {
                    pCtx.drawImage(tileImg, 0, 0, 50, 50);
                } else {
                    pCtx.fillStyle = tile.color || '#333';
                    pCtx.fillRect(0, 0, 50, 50);
                }
                
                div.appendChild(previewCanvas);
                div.title = tile.name;
                div.addEventListener('click', () => {
                    this.selectTile(tile.id, div);
                });
                palette.appendChild(div);
            });
            
            // Auto-select first tile if current selection is invalid for this layer
            if (!filtered.find(t => t.id === this.selectedTileId) && filtered.length > 0) {
                this.selectedTileId = filtered[0].id;
                this.updatePaletteFilter();
            }
        }
    }

    selectTile(id, element) {
        document.querySelectorAll('.palette-tile').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedTileId = id;
        if (this.selectedTool === 'eraser') {
            this.selectTool('pen');
        }
    }

    getTileAt(x, y) {
        return this.tiles.get(`${x},${y}`) || { floor: null, block: null, unit: null, item: null, metadata: null };
    }

    setTileAt(x, y, tileId, layer) {
        const key = `${x},${y}`;
        const cell = this.tiles.get(key) || { floor: null, block: null, unit: null, item: null, metadata: null };
        
        if (layer === 'units') {
            if (tileId === null) {
                cell.unit = null;
            } else {
                // Just set the unit, settings are now handled by right-click
                cell.unit = {
                    id: tileId,
                    command: 'GUARD',
                    patrolRadius: 250,
                    healthMult: 1.0,
                    damageMult: 1.0,
                    speedMult: 1.0
                };
            }
        } else if (layer === 'items') {
            cell.item = tileId;
        } else {
            cell[layer] = tileId;
            // Initialize metadata for loot box if newly placed
            if (layer === 'block' && tileId === 'loot_box' && !cell.metadata) {
                cell.metadata = { lootTable: [] };
            }
        }

        if (cell.floor === null && cell.block === null && cell.unit === null && cell.item === null) this.tiles.delete(key);
        else this.tiles.set(key, cell);
    }

    openLootSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (cell.block !== 'loot_box') return;

        this.editingLootPos = { x: gx, y: gy };
        const modal = document.getElementById('loot-box-settings-modal');
        const list = document.getElementById('loot-entries-list');
        list.innerHTML = '';
        modal.classList.remove('hidden');

        const lootTable = cell.metadata?.lootTable || [];
        lootTable.forEach(entry => this.addLootEntry(entry.id, entry.chance));
        
        // Add one empty entry if table is empty
        if (lootTable.length === 0) this.addLootEntry('', 100);
    }

    addLootEntry(selectedId = '', chance = 100) {
        const list = document.getElementById('loot-entries-list');
        const div = document.createElement('div');
        div.className = 'loot-entry';
        
        // Get all available items from AssetManager
        const items = this.game.assetManager.getData('items') || [];
        
        // Create dropdown options
        let optionsHtml = '<option value="">-- 아이템 선택 --</option>';
        items.forEach(item => {
            const selected = item.id === selectedId ? 'selected' : '';
            optionsHtml += `<option value="${item.id}" ${selected}>${item.name} (${item.id})</option>`;
        });

        div.innerHTML = `
            <select class="loot-item-id">
                ${optionsHtml}
            </select>
            <input type="number" class="loot-item-chance" value="${chance}" min="0" max="100">
            <button class="remove-entry-btn">×</button>
        `;
        div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
        list.appendChild(div);
    }

    saveLootSettings() {
        if (!this.editingLootPos) return;
        const cell = this.getTileAt(this.editingLootPos.x, this.editingLootPos.y);
        const entries = document.querySelectorAll('.loot-entry');
        const lootTable = [];
        
        entries.forEach(div => {
            const id = div.querySelector('.loot-item-id').value.trim();
            const chance = parseInt(div.querySelector('.loot-item-chance').value);
            if (id) lootTable.push({ id, chance });
        });

        cell.metadata = { ...cell.metadata, lootTable };
        this.closeLootSettings();
    }

    closeLootSettings() {
        document.getElementById('loot-box-settings-modal').classList.add('hidden');
        this.editingLootPos = null;
    }

    openUnitSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (!cell.unit) return;

        this.editingUnitPos = { x: gx, y: gy };
        const modal = document.getElementById('unit-settings-modal');
        modal.classList.remove('hidden');

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

    closeUnitSettings() {
        document.getElementById('unit-settings-modal').classList.add('hidden');
        this.editingUnitPos = null;
    }

    deleteUnit() {
        if (!this.editingUnitPos) return;
        this.setTileAt(this.editingUnitPos.x, this.editingUnitPos.y, null, 'units');
        this.closeUnitSettings();
    }

    update(dt) {
        if (this.game.gameState !== 'EDITOR') return;
        
        const unitModal = document.getElementById('unit-settings-modal');
        const lootModal = document.getElementById('loot-box-settings-modal');
        const isModalOpen = (unitModal && !unitModal.classList.contains('hidden')) || 
                           (lootModal && !lootModal.classList.contains('hidden'));
        
        const input = this.game.input;
        const mx = input.mouse.x; const my = input.mouse.y;

        const ts = this.baseTileSize * this.zoom;
        const gx = Math.floor((mx - this.offsetX) / ts);
        const gy = Math.floor((my - this.offsetY) / ts);
        
        // Check if mouse is over sidebar or modals
        let isOverUI = mx > this.game.canvas.width - 300;
        if (isModalOpen) {
            const activeModal = !unitModal.classList.contains('hidden') ? unitModal : lootModal;
            const rect = activeModal.getBoundingClientRect();
            if (mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom) {
                isOverUI = true;
            }
        }

        // Panning and Right-Click Logic (Only if NOT over UI)
        if (input.mouse.rightDown && !isOverUI) {
            const dx = mx - this.lastMousePos.x;
            const dy = my - this.lastMousePos.y;
            this.offsetX += dx;
            this.offsetY += dy;
            
            this.rightClickMoveDist = (this.rightClickMoveDist || 0) + Math.sqrt(dx*dx + dy*dy);
        } else {
            if (this.lastRightDown && !input.mouse.rightDown && !isOverUI && !isModalOpen) {
                if ((this.rightClickMoveDist || 0) < 5) {
                    const cell = this.getTileAt(gx, gy);
                    if (cell.unit) {
                        this.openUnitSettings(gx, gy);
                    } else if (cell.block === 'loot_box') {
                        this.openLootSettings(gx, gy);
                    }
                }
                this.rightClickMoveDist = 0;
            }
        }
        this.lastRightDown = input.mouse.rightDown;
        this.lastMousePos = { x: mx, y: my };

        // Zooming (Only if NOT over UI and modal is not open)
        if (input.wheel !== 0 && !isOverUI) {
            const zoomDelta = input.wheel > 0 ? -0.1 : 0.1;
            const oldZoom = this.zoom;
            this.zoom = Math.max(0.2, Math.min(5.0, this.zoom + zoomDelta));
            const zoomFactor = this.zoom / oldZoom;
            this.offsetX = mx - (mx - this.offsetX) * zoomFactor;
            this.offsetY = my - (my - this.offsetY) * zoomFactor;
        }

        if (input.mouse.leftDown && !isOverUI && !isModalOpen) {
            this.handleToolAction(gx, gy, 'start');
            this.isDrawing = true;
        } else {
            if (this.isDrawing) this.handleToolAction(gx, gy, 'end');
            this.isDrawing = false;
        }
    }

    handleToolAction(gx, gy, phase) {
        const tileId = this.selectedTool === 'eraser' ? null : this.selectedTileId;
        const layer = this.activeLayer;
        switch (this.selectedTool) {
            case 'pen':
            case 'eraser':
                this.setTileAt(gx, gy, tileId, layer);
                break;
            case 'fill':
                if (phase === 'start') {
                    const targetId = this.getTileAt(gx, gy)[layer];
                    this.floodFill(gx, gy, targetId, tileId, layer);
                }
                break;
            case 'rect':
            case 'circle':
            case 'triangle':
                if (phase === 'start') {
                    if (!this.rectStart) this.rectStart = { x: gx, y: gy };
                } else if (phase === 'end' && this.rectStart) {
                    const x1 = Math.min(this.rectStart.x, gx), x2 = Math.max(this.rectStart.x, gx);
                    const y1 = Math.min(this.rectStart.y, gy), y2 = Math.max(this.rectStart.y, gy);
                    
                    if (this.selectedTool === 'rect') {
                        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.setTileAt(x, y, tileId, layer);
                    } else if (this.selectedTool === 'circle') {
                        const centerX = (x1 + x2) / 2, centerY = (y1 + y2) / 2;
                        const radiusX = (x2 - x1) / 2, radiusY = (y2 - y1) / 2;
                        for (let y = y1; y <= y2; y++) {
                            for (let x = x1; x <= x2; x++) {
                                // Ellipse formula: (x-h)^2/a^2 + (y-k)^2/b^2 <= 1
                                const dx = x - centerX, dy = y - centerY;
                                if ((dx*dx)/(radiusX*radiusX || 1) + (dy*dy)/(radiusY*radiusY || 1) <= 1.1) {
                                    this.setTileAt(x, y, tileId, layer);
                                }
                            }
                        }
                    } else if (this.selectedTool === 'triangle') {
                        for (let y = y1; y <= y2; y++) {
                            for (let x = x1; x <= x2; x++) {
                                // Simple isosceles triangle logic: 
                                // Normalized Y from 0 to 1
                                const normY = (y - y1) / (y2 - y1 || 1);
                                const widthAtY = normY * (x2 - x1);
                                const centerX = (x1 + x2) / 2;
                                if (Math.abs(x - centerX) <= widthAtY / 2 + 0.5) {
                                    this.setTileAt(x, y, tileId, layer);
                                }
                            }
                        }
                    }
                    this.rectStart = null;
                }
                break;
        }
    }

    floodFill(startX, startY, targetId, replacementId, layer) {
        if (targetId === replacementId) return;
        const queue = [{ x: startX, y: startY }];
        const seen = new Set();
        const maxFill = 2500; let count = 0;
        while (queue.length > 0 && count < maxFill) {
            const { x, y } = queue.shift();
            const key = `${x},${y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (this.getTileAt(x, y)[layer] === targetId) {
                this.setTileAt(x, y, replacementId, layer);
                count++;
                queue.push({ x: x + 1, y: y });
                queue.push({ x: x - 1, y: y });
                queue.push({ x: x, y: y + 1 });
                queue.push({ x: x, y: y - 1 });
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
                const cell = this.getTileAt(x, y);
                row.push([cell.floor, cell.block, cell.unit, cell.item, cell.metadata]);
            }
            cropped.push(row);
        }
        document.getElementById('export-output').value = JSON.stringify(cropped)
            .replace(/\]\],\[\[/g, ']],\n    [[')
            .replace('[[[', '[\n    [[')
            .replace(']]]', ']]\n]');
    }

    importArray() {
        const input = document.getElementById('export-output').value.trim();
        if (!input) return;

        try {
            const data = JSON.parse(input);
            if (!Array.isArray(data) || !Array.isArray(data[0])) {
                throw new Error("Invalid format: Not a 2D array.");
            }

            if (confirm("현재 작업 중인 타일들이 모두 삭제됩니다. 계속하시겠습니까?")) {
                this.tiles.clear();
                data.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        if (Array.isArray(cell)) {
                            const [floor, block, unit, item, metadata] = cell;
                            if (floor !== null || block !== null || unit !== null || item !== null) {
                                this.tiles.set(`${x},${y}`, { 
                                    floor, block, 
                                    unit: unit || null, 
                                    item: item || null,
                                    metadata: metadata || null 
                                });
                            }
                        }
                    });
                });
                console.log("Import complete.");
                this.offsetX = 100;
                this.offsetY = 100;
            }
        } catch (e) {
            alert("가져오기 실패: 올바른 배열 형식이 아닙니다.\n" + e.message);
        }
    }

    testCurrentStructure() {
        if (this.tiles.size === 0) { alert("배치된 타일이 없습니다."); return; }

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
                const cell = this.getTileAt(x, y);
                row.push([cell.floor, cell.block, cell.unit, cell.item, cell.metadata]);
            }
            layout.push(row);
        }

        this.game.startTestMode(layout);
    }

    render(ctx) {
        if (this.game.gameState !== 'EDITOR') return;
        const ts = this.baseTileSize * this.zoom;
        const tilesData = this.game.assetManager.getData('tiles') || [];
        const enemiesData = this.game.assetManager.getData('enemies') || [];
        const itemsData = this.game.assetManager.getData('items') || [];

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        const startGX = Math.floor(-this.offsetX / ts);
        const endGX = Math.ceil((this.game.canvas.width - this.offsetX) / ts);
        const startGY = Math.floor(-this.offsetY / ts);
        const endGY = Math.ceil((this.game.canvas.height - this.offsetY) / ts);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        for (let x = startGX; x <= endGX; x++) { const vx = this.offsetX + x * ts; ctx.moveTo(vx, 0); ctx.lineTo(vx, this.game.canvas.height); }
        for (let y = startGY; y <= endGY; y++) { const vy = this.offsetY + y * ts; ctx.moveTo(0, vy); ctx.lineTo(this.game.canvas.width, vy); }
        ctx.stroke();

        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts; const ty = this.offsetY + gy * ts;
            
            // 1. Floor
            if (cell.floor) {
                const img = this.game.assetManager.get(cell.floor);
                if (img) ctx.drawImage(img, tx, ty, ts, ts);
                else { const def = tilesData.find(t => t.id === cell.floor); ctx.fillStyle = def ? def.color : '#333'; ctx.fillRect(tx, ty, ts, ts); }
            }
            // 2. Block
            if (cell.block) {
                const img = this.game.assetManager.get(cell.block);
                if (img) ctx.drawImage(img, tx, ty, ts, ts);
                else { const def = tilesData.find(t => t.id === cell.block); ctx.fillStyle = def ? def.color : '#555'; ctx.fillRect(tx, ty, ts, ts); }
            }
            // 3. Item
            if (cell.item) {
                const img = this.game.assetManager.get(cell.item);
                if (img) ctx.drawImage(img, tx + ts*0.2, ty + ts*0.2, ts*0.6, ts*0.6);
                else {
                    const def = itemsData.find(i => i.id === cell.item);
                    ctx.fillStyle = def ? def.color : '#f1c40f';
                    ctx.fillRect(tx + ts*0.25, ty + ts*0.25, ts*0.5, ts*0.5);
                }
            }
            // 4. Unit
            if (cell.unit) {
                const def = enemiesData.find(e => e.id === cell.unit.id);
                ctx.fillStyle = def ? def.color : '#e74c3c';
                ctx.beginPath();
                ctx.arc(tx + ts/2, ty + ts/2, ts * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.max(8, ts * 0.2)}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(cell.unit.command, tx + ts/2, ty + ts * 0.85);
            }
        });

        // Instructions
        ctx.fillStyle = '#fff'; ctx.font = '14px Arial';
        ctx.fillText(`레이어: ${this.activeLayer.toUpperCase()} | 줌: ${Math.round(this.zoom * 100)}% | 우클릭 드래그: 화면 이동`, 20, 30);
        if (['rect', 'circle', 'triangle'].includes(this.selectedTool) && this.rectStart && this.isDrawing) {
            const input = this.game.input;
            const curGX = Math.floor((input.mouse.x - this.offsetX) / ts);
            const curGY = Math.floor((input.mouse.y - this.offsetY) / ts);
            const x1 = Math.min(this.rectStart.x, curGX), x2 = Math.max(this.rectStart.x, curGX);
            const y1 = Math.min(this.rectStart.y, curGY), y2 = Math.max(this.rectStart.y, curGY);
            
            ctx.strokeStyle = '#f1c40f'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
            
            if (this.selectedTool === 'rect') {
                ctx.strokeRect(this.offsetX + x1 * ts, this.offsetY + y1 * ts, (x2 - x1 + 1) * ts, (y2 - y1 + 1) * ts);
            } else if (this.selectedTool === 'circle') {
                ctx.beginPath();
                ctx.ellipse(this.offsetX + (x1 + x2 + 1) * ts / 2, this.offsetY + (y1 + y2 + 1) * ts / 2, (x2 - x1 + 1) * ts / 2, (y2 - y1 + 1) * ts / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.selectedTool === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(this.offsetX + (x1 + x2 + 1) * ts / 2, this.offsetY + y1 * ts);
                ctx.lineTo(this.offsetX + x1 * ts, this.offsetY + (y2 + 1) * ts);
                ctx.lineTo(this.offsetX + (x2 + 1) * ts, this.offsetY + (y2 + 1) * ts);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
    }
}