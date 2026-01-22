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
        this.currentRotation = 0; // 0, 90, 180, 270 degrees
        this.rectStart = null;
        this.isDrawing = false;
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => {
            if (this.game.gameState !== 'EDITOR') return;
            if (e.key.toLowerCase() === 'r') {
                this.currentRotation = (this.currentRotation + 90) % 360;
                console.log(`Rotation: ${this.currentRotation}°`);
            }
        });

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

        // Item Settings
        document.getElementById('item-settings-save').addEventListener('click', () => this.saveItemSettings());
        document.getElementById('item-settings-cancel').addEventListener('click', () => this.closeItemSettings());
        document.getElementById('item-settings-delete').addEventListener('click', () => this.deleteItem());

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
        if (id === 'v_transport_ship') return { w: 3, h: 2 };
        if (id === 'v_transport_plane') return { w: 3, h: 3 };
        return { w: 1, h: 1 };
    }

    getTileSize(id) {
        const tiles = this.game.assetManager.getData('tiles') || [];
        const tile = tiles.find(t => t.id === id);
        return { w: tile?.width || 1, h: tile?.height || 1 };
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
        
        const addHeader = (text) => {
            const h = document.createElement('div');
            h.style.width = '100%';
            h.style.padding = '8px 5px';
            h.style.fontSize = '12px';
            h.style.color = '#aaa';
            h.style.background = '#222';
            h.style.marginBottom = '5px';
            h.style.borderLeft = '3px solid #f1c40f';
            h.style.gridColumn = '1 / -1'; // Grid layout 지원용
            h.innerText = text;
            palette.appendChild(h);
        };

        if (this.activeLayer === 'units') {
            const enemies = this.game.assetManager.getData('enemies') || [];
            if (enemies.length > 0) {
                addHeader('👥 인명 유닛');
                enemies.forEach(enemy => {
                    const div = document.createElement('div');
                    div.className = 'palette-tile';
                    if (enemy.id === this.selectedTileId) div.classList.add('selected');
                    const previewCanvas = document.createElement('canvas');
                    previewCanvas.width = 50; previewCanvas.height = 50;
                    const pCtx = previewCanvas.getContext('2d');
                    pCtx.fillStyle = enemy.color || '#e74c3c';
                    pCtx.beginPath(); pCtx.arc(25, 25, 15, 0, Math.PI * 2); pCtx.fill();
                    pCtx.strokeStyle = '#fff'; pCtx.lineWidth = 2; pCtx.stroke();
                    div.appendChild(previewCanvas);
                    div.title = enemy.name;
                    div.addEventListener('click', () => this.selectTile(enemy.id, div));
                    palette.appendChild(div);
                });
            }

                        const landVehicles = [
                            { id: 'v_truck', name: '군용 트럭', color: '#4b5320' },
                            { id: 'v_tank', name: '전차 (Tank)', color: '#1e8449' },
                            { id: 'v_apc', name: '장갑차 (APC)', color: '#34495e' }
                        ];
                        const seaVehicles = [
                            { id: 'v_transport_ship', name: '운반선 (Carrier)', color: '#2c3e50' }
                        ];
                        const airVehicles = [
                            { id: 'v_transport_plane', name: '수송기 (Plane)', color: '#7f8c8d' }
                        ]; 
                        
                        if (landVehicles.length > 0) {
                            addHeader('🚜 지상 이동수단');
                            landVehicles.forEach(v => this.createVehiclePaletteTile(v, palette));
                        }
                        if (seaVehicles.length > 0) {
                            addHeader('🚢 해상 이동수단');
                            seaVehicles.forEach(v => this.createVehiclePaletteTile(v, palette));
                        }
                        if (airVehicles.length > 0) {
                            addHeader('🚁 공중 이동수단');
                            airVehicles.forEach(v => this.createVehiclePaletteTile(v, palette));
                        }
                    } else if (this.activeLayer === 'items') {                    const items = this.game.assetManager.getData('items') || [];
                    
                    const weapons = items.filter(i => i.type === 'weapon');
                    const ammos = items.filter(i => i.type === 'ammo');
                    const consumables = items.filter(i => i.type === 'consumable' || i.type === 'grenade'); // Include grenades
                    const others = items.filter(i => i.type !== 'weapon' && i.type !== 'ammo' && i.type !== 'consumable' && i.type !== 'grenade');
        
                    if (weapons.length > 0) {
                        const melee = weapons.filter(w => w.subType === 'melee');
                        const pistols = weapons.filter(w => ['ranged'].includes(w.subType) && (w.caliber === '9mm' || w.caliber === '.50 AE' || w.caliber === '.357'));
                        const rifles = weapons.filter(w => ['ranged'].includes(w.subType) && (w.caliber === '5.56mm' || w.caliber === '7.62mm') && w.magSize > 10 && w.fireRate < 0.2);
                        const snipers = weapons.filter(w => ['ranged'].includes(w.subType) && (w.caliber === '.338' || w.caliber === '7.62mm') && w.fireRate >= 0.4);
                        const shotguns = weapons.filter(w => w.caliber === '12g');
                        const heavy = weapons.filter(w => w.caliber === 'rocket' || w.caliber === '40mm' || w.magSize >= 100);
        
                        if (melee.length > 0) { addHeader('🗡️ 근접 무기'); melee.forEach(i => this.createPaletteTile(i, palette)); }
                        if (pistols.length > 0) { addHeader('🔫 권총'); pistols.forEach(i => this.createPaletteTile(i, palette)); }
                        if (rifles.length > 0) { addHeader('🔫 소총 / 기관단총'); rifles.forEach(i => this.createPaletteTile(i, palette)); }
                        if (snipers.length > 0) { addHeader('🔭 저격 / 지정사수'); snipers.forEach(i => this.createPaletteTile(i, palette)); }
                        if (shotguns.length > 0) { addHeader('🧱 산탄총'); shotguns.forEach(i => this.createPaletteTile(i, palette)); }
                        if (heavy.length > 0) { addHeader('🚀 중화기 / 폭발물'); heavy.forEach(i => this.createPaletteTile(i, palette)); }
                    }
        
                    if (ammos.length > 0) {
                        addHeader('📦 탄약');
                        ammos.forEach(i => this.createPaletteTile(i, palette));
                    }
        
                    if (consumables.length > 0) {
                        const partsIds = ['iron_ingot', 'wood_plank', 'spring', 'pistol_grip', 'short_barrel', 'long_barrel', 'ar_receiver', 'ak_receiver', 'smg_receiver', 'bolt_action_parts', 'shotgun_parts', 'explosive_material'];
                        const materials = consumables.filter(c => partsIds.includes(c.id));
                        const realConsumables = consumables.filter(c => !partsIds.includes(c.id));
        
                        if (materials.length > 0) {
                            addHeader('🛠️ 제작 재료 / 부품');
                            materials.forEach(i => this.createPaletteTile(i, palette));
                        }
                        if (realConsumables.length > 0) {
                            addHeader('💊 일반 소모품 / 폭발물');
                            realConsumables.forEach(i => this.createPaletteTile(i, palette));
                        }
                    }
        
            
            if (others.length > 0) {
                // 기타 아이템들 (장비 등)
                const equipment = others.filter(o => o.type === 'equipment');
                const attachments = others.filter(o => o.type === 'attachment');
                
                if (equipment.length > 0) { addHeader('👕 개인 장비'); equipment.forEach(i => this.createPaletteTile(i, palette)); }
                if (attachments.length > 0) { addHeader('🔍 총기 부착물'); attachments.forEach(i => this.createPaletteTile(i, palette)); }
            }
        } else if (this.activeLayer === 'block') {
            const tiles = this.game.assetManager.getData('tiles') || [];
            const blocks = tiles.filter(t => t.layer === 'block');
            
            const interactable = blocks.filter(b => b.interactable);
            const normal = blocks.filter(b => !b.interactable);

            if (interactable.length > 0) {
                addHeader('상호작용 가능 (상자, 문 등)');
                interactable.forEach(tile => this.createPaletteTile(tile, palette));
            }
            if (normal.length > 0) {
                addHeader('일반 블록 (벽, 엄폐물 등)');
                normal.forEach(tile => this.createPaletteTile(tile, palette));
            }
        } else {
            const tiles = this.game.assetManager.getData('tiles') || [];
            const filtered = tiles.filter(t => t.layer === this.activeLayer);
            filtered.forEach(tile => this.createPaletteTile(tile, palette));
        }
    }

    createPaletteTile(tile, container) {
        const div = document.createElement('div');
        div.className = 'palette-tile';
        if (tile.id === this.selectedTileId) div.classList.add('selected');

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 50; previewCanvas.height = 50;
        const pCtx = previewCanvas.getContext('2d');

        const img = this.game.assetManager.get(tile.id);
        if (img) {
            pCtx.drawImage(img, 5, 5, 40, 40);
        } else {
            pCtx.fillStyle = tile.color || '#555';
            pCtx.fillRect(10, 10, 30, 30);
            pCtx.strokeStyle = '#fff';
            pCtx.lineWidth = 1;
            pCtx.strokeRect(10, 10, 30, 30);
        }

        div.appendChild(previewCanvas);
        div.title = tile.name || tile.id;
        div.addEventListener('click', () => this.selectTile(tile.id, div));
        container.appendChild(div);
    }

    createVehiclePaletteTile(v, palette) {
        const div = document.createElement('div');
        div.className = 'palette-tile';
        if (v.id === this.selectedTileId) div.classList.add('selected');
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 50; previewCanvas.height = 50;
        const pCtx = previewCanvas.getContext('2d');
        pCtx.fillStyle = v.color; 
        pCtx.fillRect(10, 15, 30, 20);
        pCtx.strokeStyle = '#fff'; pCtx.lineWidth = 2; pCtx.strokeRect(10, 15, 30, 20);
        div.appendChild(previewCanvas);
        div.title = v.name;
        div.addEventListener('click', () => this.selectTile(v.id, div));
        palette.appendChild(div);
    }

    selectTile(id, element) {
        document.querySelectorAll('.palette-tile').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedTileId = id; 
        if (this.selectedTool === 'eraser') this.selectTool('pen');
    }

    isCellEmpty(cell) {
        return cell.floor === null && cell.block === null && cell.unit === null && cell.item === null;
    }

    getTileAt(x, y) {
        return this.tiles.get(`${x},${y}`) || { floor: null, block: null, unit: null, item: null, metadata: null };
    }

    setTileAt(x, y, tileId, layer, phase = 'start') {
        const key = `${x},${y}`;
        const cell = this.tiles.get(key) || { floor: null, block: null, unit: null, item: null, metadata: null };
        
        if (tileId === null) {
            if (layer === 'items') {
                cell.item = null;
            } else if (layer === 'units') {
                const unit = cell.unit;
                if (!unit) return;
                let masterKey = key;
                if (unit.id === 'occupied_space') masterKey = unit.master || key;
                
                const [mx, my] = masterKey.split(',').map(Number);
                const masterCell = this.tiles.get(masterKey);
                const mUnit = masterCell?.unit;
                if (mUnit) {
                    const { w, h } = this.getUnitSize(mUnit.id);
                    for (let oy = 0; oy < h; oy++) {
                        for (let ox = 0; ox < w; ox++) {
                            const tKey = `${mx + ox},${my + oy}`;
                            const tCell = this.tiles.get(tKey);
                            if (tCell) {
                                tCell.unit = null;
                                if (this.isCellEmpty(tCell)) this.tiles.delete(tKey);
                            }
                        }
                    }
                } else {
                    cell.unit = null;
                }
            } else {
                const current = cell[layer];
                if (!current) return;
                let masterKey = key;
                if (current === 'occupied_space') masterKey = cell.metadata?.[layer + 'Master'] || key;

                const [mx, my] = masterKey.split(',').map(Number);
                const masterCell = this.tiles.get(masterKey);
                const mItem = masterCell?.[layer];
                if (mItem) {
                    const metadata = masterCell.metadata || {};
                    const rot = (metadata[layer + 'Rotation'] || 0);
                    const baseSize = this.getTileSize(mItem);
                    const isRotated = (rot === 90 || rot === 270);
                    const ew = isRotated ? baseSize.h : baseSize.w;
                    const eh = isRotated ? baseSize.w : baseSize.h;

                    for (let oy = 0; oy < eh; oy++) {
                        for (let ox = 0; ox < ew; ox++) {
                            const tKey = `${mx + ox},${my + oy}`;
                            const tCell = this.tiles.get(tKey);
                            if (tCell) {
                                tCell[layer] = null;
                                if (tCell.metadata) delete tCell.metadata[layer + 'Master'];
                                if (this.isCellEmpty(tCell)) this.tiles.delete(tKey);
                            }
                        }
                    }
                } else {
                    cell[layer] = null;
                }
            }
            if (this.isCellEmpty(cell)) this.tiles.delete(key);
            return;
        }

        const baseSize = (layer === 'units') ? this.getUnitSize(tileId) : this.getTileSize(tileId);
        const isRotated = (this.currentRotation === 90 || this.currentRotation === 270);
        const ew = isRotated ? baseSize.h : baseSize.w;
        const eh = isRotated ? baseSize.w : baseSize.h;

        if (ew > 1 || eh > 1 || (layer === 'units' || layer === 'block')) {
            for (let oy = 0; oy < eh; oy++) {
                for (let ox = 0; ox < ew; ox++) {
                    const tKey = `${x + ox},${y + oy}`;
                    const tCell = this.tiles.get(tKey);
                    if (tCell) {
                        if (layer === 'units' && (tCell.unit !== null || tCell.block !== null)) return;
                        if (layer === 'block' && (tCell.block !== null || tCell.unit !== null)) return;
                    }
                }
            }
        }

        if (ew > 1 || eh > 1) {
            if (phase !== 'start') return;
            for (let oy = 0; oy < eh; oy++) {
                for (let ox = 0; ox < ew; ox++) {
                    const tKey = `${x + ox},${y + oy}`;
                    const tCell = this.tiles.get(tKey) || { floor: null, block: null, unit: null, item: null, metadata: null };
                    if (ox === 0 && oy === 0) {
                        if (layer === 'units') {
                            tCell.unit = { id: tileId, w: ew, h: eh, command: 'GUARD', patrolRadius: 250, healthMult: 1.0, damageMult: 1.0, speedMult: 1.0 };
                        } else {
                            tCell[layer] = tileId;
                            if (!tCell.metadata) tCell.metadata = {};
                            tCell.metadata[layer + 'Rotation'] = this.currentRotation;
                            if (layer === 'block' && tileId === 'loot_box' && !tCell.metadata.lootTable) tCell.metadata.lootTable = [];
                        }
                    } else {
                        if (layer === 'units') {
                            tCell.unit = { id: 'occupied_space', master: key };
                        } else {
                            tCell[layer] = 'occupied_space';
                            if (!tCell.metadata) tCell.metadata = {};
                            tCell.metadata[layer + 'Master'] = key;
                        }
                    }
                    this.tiles.set(tKey, tCell);
                }
            }
            return;
        }

        if (layer === 'units') {
            cell.unit = { id: tileId, command: 'GUARD', patrolRadius: 250, healthMult: 1.0, damageMult: 1.0, speedMult: 1.0 };
        } else if (layer === 'items') {
            const itemId = (typeof tileId === 'object') ? tileId.id : tileId;
            const count = (typeof tileId === 'object') ? (tileId.count || 1) : 1;
            cell.item = { id: itemId, count: count };
        } else {
            cell[layer] = tileId;
            if (!cell.metadata) cell.metadata = {};
            cell.metadata[layer + 'Rotation'] = this.currentRotation;
            if (layer === 'block' && tileId === 'loot_box' && !cell.metadata.lootTable) cell.metadata.lootTable = [];
        }
        this.tiles.set(key, cell);
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

    openItemSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (!cell.item) return;
        this.editingItemPos = { x: gx, y: gy };
        const modal = document.getElementById('item-settings-modal');
        const countInput = document.getElementById('item-count-input');
        modal.classList.remove('hidden');
        const itemId = (typeof cell.item === 'string') ? cell.item : cell.item.id;
        const itemCount = (typeof cell.item === 'string') ? 1 : (cell.item.count || 1);
        const itemDef = this.game.assetManager.getData('items')?.find(it => it.id === itemId);
        const isWeapon = itemDef?.type === 'weapon';
        countInput.value = isWeapon ? 1 : itemCount;
        countInput.disabled = isWeapon; 
    }

    saveItemSettings() {
        if (!this.editingItemPos) return;
        const cell = this.getTileAt(this.editingItemPos.x, this.editingItemPos.y);
        const countInput = document.getElementById('item-count-input');
        const itemId = (typeof cell.item === 'string') ? cell.item : cell.item.id;
        cell.item = { id: itemId, count: parseInt(countInput.value) || 1 };
        this.closeItemSettings();
    }

    closeItemSettings() {
        document.getElementById('item-settings-modal').classList.add('hidden');
        this.editingItemPos = null;
    }

    deleteItem() {
        if (!this.editingItemPos) return;
        const cell = this.getTileAt(this.editingItemPos.x, this.editingItemPos.y);
        cell.item = null;
        if (cell.floor === null && cell.block === null && cell.unit === null && cell.item === null) {
            this.tiles.delete(`${this.editingItemPos.x},${this.editingItemPos.y}`);
        }
        this.closeItemSettings();
    }

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
        const itemModal = document.getElementById('item-settings-modal');
        const isModalOpen = (unitModal && !unitModal.classList.contains('hidden')) || (lootModal && !lootModal.classList.contains('hidden')) || (itemModal && !itemModal.classList.contains('hidden'));
        const input = this.game.input; 
        const mx = input.mouse.x; 
        const my = input.mouse.y;
        const ts = this.baseTileSize * this.zoom;
        const gx = Math.floor((mx - this.offsetX) / ts); 
        const gy = Math.floor((my - this.offsetY) / ts);
        let isOverUI = mx > this.game.canvas.width - 300;
        if (isModalOpen) isOverUI = true; 
        if (input.mouse.rightDown && !isOverUI) {
            const dx = mx - this.lastMousePos.x; const dy = my - this.lastMousePos.y;
            this.offsetX += dx; this.offsetY += dy;
            this.rightClickMoveDist = (this.rightClickMoveDist || 0) + Math.sqrt(dx*dx + dy*dy);
        } else if (this.lastRightDown && !input.mouse.rightDown && !isOverUI && !isModalOpen) {
            if ((this.rightClickMoveDist || 0) < 5) {
                const cell = this.getTileAt(gx, gy);
                if (cell.unit && !cell.unit.id.startsWith('v_')) this.openUnitSettings(gx, gy);
                else if (cell.block === 'loot_box') this.openLootSettings(gx, gy);
                else if (cell.item) this.openItemSettings(gx, gy);
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
            if (cell.floor && cell.floor !== 'occupied_space') {
                const img = this.game.assetManager.get(cell.floor);
                const rot = (cell.metadata?.floorRotation || 0) * (Math.PI / 180);
                ctx.save();
                ctx.translate(tx + ts/2, ty + ts/2);
                ctx.rotate(rot);
                if (img) ctx.drawImage(img, -ts/2, -ts/2, ts, ts);
                else { ctx.fillStyle = '#333'; ctx.fillRect(-ts/2, -ts/2, ts, ts); }
                ctx.restore();
            }
        });
        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts, ty = this.offsetY + gy * ts;
            if (cell.block && cell.block !== 'occupied_space') {
                const img = this.game.assetManager.get(cell.block);
                const baseSize = this.getTileSize(cell.block);
                const rot = (cell.metadata?.blockRotation || 0);
                const isRotated = (rot === 90 || rot === 270);
                const ew = isRotated ? baseSize.h : baseSize.w;
                const eh = isRotated ? baseSize.w : baseSize.h;
                ctx.save();
                ctx.translate(tx + (ts * ew)/2, ty + (ts * eh)/2);
                ctx.rotate(rot * Math.PI / 180);
                if (img) ctx.drawImage(img, -(ts * baseSize.w)/2, -(ts * baseSize.h)/2, ts * baseSize.w, ts * baseSize.h);
                else { ctx.fillStyle = '#555'; ctx.fillRect(-(ts * baseSize.w)/2, -(ts * baseSize.h)/2, ts * baseSize.w, ts * baseSize.h); }
                ctx.restore();
            }
            if (cell.item) {
                const itemId = (cell.item && typeof cell.item === 'object') ? cell.item.id : cell.item;
                const itemCount = (cell.item && typeof cell.item === 'object') ? (cell.item.count || 1) : 1;
                const img = this.game.assetManager.get(itemId);
                if (img) ctx.drawImage(img, tx+ts*0.2, ty+ts*0.2, ts*0.6, ts*0.6);
                else { 
                    const itemDef = this.game.assetManager.getData('items')?.find(it => it.id === itemId);
                    ctx.fillStyle = itemDef?.color || '#f1c40f';
                    ctx.fillRect(tx+ts*0.25, ty+ts*0.25, ts*0.5, ts*0.5);
                }
                if (itemCount > 1) {
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, ts * 0.25)}px Arial`; ctx.textAlign = 'right';
                    ctx.fillText(itemCount, tx + ts - 5, ty + ts - 5); ctx.textAlign = 'left';
                }
            }
            if (cell.unit) {
                if (cell.unit.id === 'occupied_space' || cell.unit.id === 'v_reserved') return;
                if (cell.unit.id.startsWith('v_')) {
                    const size = this.getUnitSize(cell.unit.id);
                    let vColor = '#4b5320';
                    if (cell.unit.id === 'v_tank') vColor = '#1e8449';
                    else if (cell.unit.id === 'v_apc') vColor = '#34495e';
                    else if (cell.unit.id === 'v_transport_ship') vColor = '#2c3e50';
                    else if (cell.unit.id === 'v_transport_plane') vColor = '#7f8c8d';
                    ctx.fillStyle = vColor;
                    ctx.fillRect(tx + ts*0.1, ty + ts*0.1, ts * size.w - ts*0.2, ts * size.h - ts*0.2);
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(tx + ts*0.1, ty + ts*0.1, ts * size.w - ts*0.2, ts * size.h - ts*0.2);
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(10, ts * 0.3)}px Arial`; ctx.textAlign = 'center';
                    let label = cell.unit.id.replace('v_', '').toUpperCase();
                    if (label === 'TRANSPORT_SHIP') label = 'SHIP';
                    ctx.fillText(label, tx + (ts * size.w)/2, ty + (ts * size.h)/2 + 5);
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
        const input = this.game.input; const mx = input.mouse.x; const my = input.mouse.y;
        if (mx < this.game.canvas.width - 300) {
            const gx = Math.floor((mx - this.offsetX) / ts); const gy = Math.floor((my - this.offsetY) / ts);
            const tx = this.offsetX + gx * ts; const ty = this.offsetY + gy * ts;
            ctx.save(); ctx.globalAlpha = 0.5;
            if (this.selectedTool === 'eraser') {
                ctx.fillStyle = 'rgba(231, 76, 60, 0.3)'; ctx.fillRect(tx, ty, ts, ts);
                ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.strokeRect(tx, ty, ts, ts);
            } else if (this.selectedTileId) {
                const baseSize = (this.activeLayer === 'units') ? this.getUnitSize(this.selectedTileId) : this.getTileSize(this.selectedTileId);
                const isRotated = (this.currentRotation === 90 || this.currentRotation === 270);
                const ew = isRotated ? baseSize.h : baseSize.w;
                const eh = isRotated ? baseSize.w : baseSize.h;
                const rot = this.currentRotation * (Math.PI / 180);
                ctx.translate(tx + (ew * ts)/2, ty + (eh * ts)/2);
                ctx.rotate(rot);
                if (this.activeLayer === 'units') {
                    if (this.selectedTileId.startsWith('v_')) {
                        ctx.fillStyle = '#fff'; ctx.fillRect(-(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w*ts, baseSize.h*ts);
                    } else {
                        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, 0, ts * 0.35, 0, Math.PI * 2); ctx.fill();
                    }
                } else {
                    const img = this.game.assetManager.get(this.selectedTileId);
                    if (img) ctx.drawImage(img, -(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w * ts, baseSize.h * ts);
                    else { ctx.fillStyle = '#fff'; ctx.fillRect(-(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w*ts, baseSize.h*ts); }
                }
                ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2; ctx.strokeRect(-(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w*ts, baseSize.h*ts);
            }
            ctx.restore();
        }
    }
}